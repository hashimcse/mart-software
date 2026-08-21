import { prisma } from '../config/database';
import { Prisma, PaymentMethod } from '../generated/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { nextInvoiceNumber } from './counter.service';
import { recordAuditLog } from './audit.service';
import { getSettings } from './settings.service';
import { parsePagination, toPaginatedResult } from '../utils/pagination';
import type { CreateSaleInput } from '../schemas/sale.schema';

// Per-line or cart-level discounts above this fraction of the pre-discount
// amount need `discounts.apply_large`, not just `discounts.apply` (spec
// section 14: "Only authorized employees should be able to apply large
// discounts"). This threshold isn't yet exposed in Settings — worth adding
// there before it needs to vary by store.
const LARGE_DISCOUNT_RATIO = 0.2;

const SALE_INCLUDE = {
  items: { include: { product: true } },
  payments: true,
  customer: true,
  cashier: { select: { id: true, name: true } },
  terminal: true,
} as const;

function assertDiscountAllowed(discount: Prisma.Decimal, base: Prisma.Decimal, permissions: string[]) {
  if (discount.isZero()) return;
  if (!permissions.includes('discounts.apply')) {
    throw new ForbiddenError('You do not have permission to apply discounts');
  }
  const ratio = base.isZero() ? new Prisma.Decimal(0) : discount.div(base);
  if (ratio.greaterThan(LARGE_DISCOUNT_RATIO) && !permissions.includes('discounts.apply_large')) {
    throw new ForbiddenError('This discount exceeds your authorization limit — ask a manager to approve it');
  }
}

interface ProductForLine {
  id: string;
  name: string;
  status: string;
  sellingPrice: Prisma.Decimal;
  tax: { rate: Prisma.Decimal; isInclusive: boolean } | null;
}

function computeLine(product: ProductForLine, quantity: string, discount: Prisma.Decimal) {
  const qty = new Prisma.Decimal(quantity);
  const unitPrice = product.sellingPrice;
  const taxableAmount = unitPrice.mul(qty).sub(discount);

  let tax = new Prisma.Decimal(0);
  let subtotal = taxableAmount;

  if (product.tax) {
    const rateFraction = product.tax.rate.div(100);
    if (product.tax.isInclusive) {
      tax = taxableAmount.sub(taxableAmount.div(rateFraction.add(1)));
      subtotal = taxableAmount.sub(tax);
    } else {
      tax = taxableAmount.mul(rateFraction);
      subtotal = taxableAmount;
    }
  }

  return { unitPrice, taxableAmount, subtotal, tax };
}

export async function createSale(input: CreateSaleInput, cashierId: string, permissions: string[]) {
  const settings = await getSettings();
  const loyaltyEnabled = settings['loyalty.enabled'] === 'true';
  const pointsPerHundred = new Prisma.Decimal(String(settings['loyalty.pointsPerHundred'] ?? '1'));

  return prisma.$transaction(async (tx) => {
    const terminal = await tx.terminal.findUnique({ where: { id: input.terminalId } });
    if (!terminal || !terminal.isActive) throw new ValidationError('Invalid or inactive terminal');

    if (input.customerId) {
      const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new ValidationError('Customer not found');
    }

    const productIds = input.items.map((i) => i.productId);
    const products = await tx.product.findMany({ where: { id: { in: productIds } }, include: { tax: true } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = new Prisma.Decimal(0);
    let taxAmount = new Prisma.Decimal(0);
    let lineDiscountTotal = new Prisma.Decimal(0);

    const lineData: {
      productId: string;
      quantity: string;
      unitPrice: Prisma.Decimal;
      discount: Prisma.Decimal;
      tax: Prisma.Decimal;
      subtotal: Prisma.Decimal;
    }[] = [];

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new NotFoundError(`Product ${item.productId} not found`);
      if (product.status !== 'ACTIVE') throw new ValidationError(`"${product.name}" is not available for sale`);

      const discount = new Prisma.Decimal(item.discount ?? '0');
      const { unitPrice, taxableAmount, subtotal: lineSubtotal, tax: lineTax } = computeLine(product, item.quantity, discount);

      assertDiscountAllowed(discount, unitPrice.mul(new Prisma.Decimal(item.quantity)), permissions);
      if (taxableAmount.isNegative()) {
        throw new ValidationError(`Discount on "${product.name}" cannot exceed its price`);
      }

      subtotal = subtotal.add(lineSubtotal);
      taxAmount = taxAmount.add(lineTax);
      lineDiscountTotal = lineDiscountTotal.add(discount);

      lineData.push({ productId: product.id, quantity: item.quantity, unitPrice, discount, tax: lineTax, subtotal: lineSubtotal });
    }

    const cartDiscount = new Prisma.Decimal(input.discountAmount ?? '0');
    assertDiscountAllowed(cartDiscount, subtotal.add(taxAmount), permissions);

    const total = subtotal.add(taxAmount).sub(cartDiscount);
    if (total.isNegative()) throw new ValidationError('Discount cannot exceed the sale total');

    // Split payments (spec section 12): each non-cash line is charged for
    // exactly its stated amount (a card terminal doesn't hand back change).
    // At most one cash line is allowed, and it covers whatever's left after
    // non-cash payments — it may exceed that remainder, producing change.
    // Payment.amount always sums to exactly `total`; the tendered-vs-applied
    // difference for cash is reported as `changeDue` rather than inflating
    // the stored payment, keeping "sum of payments == sale total" a clean
    // invariant for later reporting/reconciliation.
    const nonCashPayments = input.payments.filter((p) => p.method !== 'CASH');
    const cashPayments = input.payments.filter((p) => p.method === 'CASH');
    if (cashPayments.length > 1) {
      throw new ValidationError('Combine cash into a single payment line');
    }

    const nonCashTotal = nonCashPayments.reduce(
      (sum, p) => sum.add(new Prisma.Decimal(p.amount)),
      new Prisma.Decimal(0),
    );
    if (nonCashTotal.greaterThan(total)) {
      throw new ValidationError(
        `Non-cash payments (${nonCashTotal.toFixed(2)}) cannot exceed the sale total (${total.toFixed(2)})`,
      );
    }

    const remainingForCash = total.sub(nonCashTotal);
    const cashTendered = cashPayments[0] ? new Prisma.Decimal(cashPayments[0].amount) : new Prisma.Decimal(0);

    if (remainingForCash.greaterThan(0) && cashTendered.lessThan(remainingForCash)) {
      const shortBy = remainingForCash.sub(cashTendered);
      throw new ValidationError(`Payments are short by ${shortBy.toFixed(2)} of the ${total.toFixed(2)} total`);
    }

    const cashApplied = remainingForCash.greaterThan(0)
      ? cashTendered.lessThan(remainingForCash)
        ? cashTendered
        : remainingForCash
      : new Prisma.Decimal(0);
    const changeDue = cashTendered.sub(cashApplied);

    const paymentRows: { method: PaymentMethod; amount: Prisma.Decimal }[] = nonCashPayments.map((p) => ({
      method: p.method as PaymentMethod,
      amount: new Prisma.Decimal(p.amount),
    }));
    if (cashApplied.greaterThan(0)) {
      paymentRows.push({ method: 'CASH' as PaymentMethod, amount: cashApplied });
    }
    if (paymentRows.length === 0) {
      throw new ValidationError('At least one payment covering the sale total is required');
    }

    // Atomic, race-safe stock deduction: the WHERE guard makes it
    // impossible for this UPDATE to ever push stock negative, and
    // Postgres's row lock on UPDATE serializes two terminals selling the
    // same product at the same moment (spec section 38's concurrent-sale
    // edge case) without any extra manual locking.
    for (const item of input.items) {
      const result = await tx.product.updateMany({
        where: { id: item.productId, currentStock: { gte: item.quantity } },
        data: { currentStock: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        const product = productMap.get(item.productId)!;
        throw new ValidationError(
          `Insufficient stock for "${product.name}" (have ${product.currentStock}, need ${item.quantity})`,
        );
      }
    }

    const invoiceNumber = await nextInvoiceNumber(tx);

    const sale = await tx.sale.create({
      data: {
        invoiceNumber,
        customerId: input.customerId ?? undefined,
        cashierId,
        terminalId: input.terminalId,
        subtotal,
        discountAmount: lineDiscountTotal.add(cartDiscount),
        taxAmount,
        total,
        items: {
          create: lineData.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            tax: l.tax,
            subtotal: l.subtotal,
          })),
        },
        payments: { create: paymentRows.map((p) => ({ method: p.method, amount: p.amount })) },
      },
      include: SALE_INCLUDE,
    });

    for (const item of input.items) {
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'SALE',
          quantity: new Prisma.Decimal(item.quantity).mul(-1),
          referenceType: 'sale',
          referenceId: sale.id,
          userId: cashierId,
        },
      });
    }

    // Loyalty accrual (Phase 7): points are awarded on the sale total,
    // truncated down to a whole point, and only for a customer actually
    // attached to the sale — walk-in sales don't accrue anything. Reads
    // the earn rate from Settings fetched once before the transaction
    // (settings change rarely enough that a slightly-stale read here is a
    // fine tradeoff against making settings.service transaction-aware).
    let loyaltyPointsEarned = 0;
    if (input.customerId && loyaltyEnabled) {
      loyaltyPointsEarned = total.mul(pointsPerHundred).div(100).floor().toNumber();
      if (loyaltyPointsEarned > 0) {
        await tx.customer.update({
          where: { id: input.customerId },
          data: { loyaltyPoints: { increment: loyaltyPointsEarned } },
        });
      }
    }

    await recordAuditLog({
      userId: cashierId,
      action: 'SALE_COMPLETED',
      entityType: 'Sale',
      entityId: sale.id,
      newValue: { invoiceNumber, total: total.toFixed(2), itemCount: input.items.length, loyaltyPointsEarned },
    });

    return { sale, changeDue: changeDue.toFixed(2), loyaltyPointsEarned };
  });
}

export async function getSaleById(id: string) {
  const sale = await prisma.sale.findUnique({ where: { id }, include: SALE_INCLUDE });
  if (!sale) throw new NotFoundError('Sale not found');
  return sale;
}

export async function listSales(query: { page?: string; pageSize?: string; terminalId?: string }) {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.SaleWhereInput = {};
  if (query.terminalId) where.terminalId = query.terminalId;

  const [items, total] = await Promise.all([
    prisma.sale.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: SALE_INCLUDE }),
    prisma.sale.count({ where }),
  ]);

  return toPaginatedResult(items, total, page, pageSize);
}
