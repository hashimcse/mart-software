import { prisma } from '../config/database';
import { Prisma, PurchaseStatus, PaymentMethod } from '../generated/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { nextPurchaseNumber } from './counter.service';
import { recordAuditLog } from './audit.service';
import { parsePagination, toPaginatedResult } from '../utils/pagination';
import type { CreatePurchaseInput } from '../schemas/purchase.schema';
import type { SupplierPaymentInput } from '../schemas/supplier.schema';

const PURCHASE_INCLUDE = {
  items: { include: { product: { select: { name: true, sku: true } } } },
  payments: true,
  supplier: true,
} as const;

export async function createPurchase(input: CreatePurchaseInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new ValidationError('Supplier not found');

    let subtotal = new Prisma.Decimal(0);
    const itemsData: { productId: string; quantity: string; unitCost: string; subtotal: Prisma.Decimal }[] = [];

    for (const item of input.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new NotFoundError(`Product ${item.productId} not found`);

      const lineSubtotal = new Prisma.Decimal(item.unitCost).mul(item.quantity);
      subtotal = subtotal.add(lineSubtotal);
      itemsData.push({ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost, subtotal: lineSubtotal });
    }

    const taxAmount = new Prisma.Decimal(input.taxAmount ?? '0');
    const total = subtotal.add(taxAmount);
    const purchaseNumber = await nextPurchaseNumber(tx);

    const purchase = await tx.purchase.create({
      data: {
        purchaseNumber,
        supplierId: input.supplierId,
        status: 'ORDERED',
        subtotal,
        taxAmount,
        total,
        items: { create: itemsData },
      },
      include: PURCHASE_INCLUDE,
    });

    await recordAuditLog({
      userId,
      action: 'PURCHASE_CREATED',
      entityType: 'Purchase',
      entityId: purchase.id,
      newValue: { purchaseNumber, total: total.toFixed(2), itemCount: itemsData.length },
    }, tx);

    return purchase;
  });
}

// This is the first real writer of MovementType.PURCHASE — stock only
// increases once the order is actually marked received, matching the
// spec's workflow (Supplier → PO → Receive Stock → Inventory Updated →
// Invoice → Payment). Creating the PO alone never touches inventory.
export async function receivePurchase(purchaseId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM purchases WHERE id = ${purchaseId} FOR UPDATE`;
    const purchase = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { items: true } });
    if (!purchase) throw new NotFoundError('Purchase not found');
    if (purchase.status !== 'ORDERED') {
      throw new ValidationError(`Only an ordered purchase can be received (this one is ${purchase.status})`);
    }

    for (const item of purchase.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { increment: item.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'PURCHASE',
          quantity: item.quantity,
          referenceType: 'purchase',
          referenceId: purchase.id,
          userId,
        },
      });
    }

    const updated = await tx.purchase.update({
      where: { id: purchaseId },
      data: { status: 'RECEIVED', receivedAt: new Date() },
      include: PURCHASE_INCLUDE,
    });

    await recordAuditLog({
      userId,
      action: 'PURCHASE_RECEIVED',
      entityType: 'Purchase',
      entityId: purchaseId,
      newValue: { itemCount: purchase.items.length },
    }, tx);

    return updated;
  });
}

export async function markInvoiced(purchaseId: string, userId: string) {
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) throw new NotFoundError('Purchase not found');
  if (purchase.status !== 'RECEIVED') {
    throw new ValidationError(`Only a received purchase can be marked invoiced (this one is ${purchase.status})`);
  }

  const updated = await prisma.purchase.update({
    where: { id: purchaseId, status: 'RECEIVED' },
    data: { status: 'INVOICED' },
    include: PURCHASE_INCLUDE,
  });
  await recordAuditLog({ userId, action: 'PURCHASE_INVOICED', entityType: 'Purchase', entityId: purchaseId });
  return updated;
}

export async function cancelPurchase(purchaseId: string, userId: string) {
  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!purchase) throw new NotFoundError('Purchase not found');
  if (purchase.status !== 'ORDERED') {
    // Once stock has been received there's real inventory movement to
    // reverse, which is a purchase-return, not a cancellation — deferred
    // to a future phase rather than half-implemented here.
    throw new ValidationError('Only an ordered (not yet received) purchase can be cancelled');
  }

  const updated = await prisma.purchase.update({
    where: { id: purchaseId, status: 'ORDERED' },
    data: { status: 'CANCELLED' },
    include: PURCHASE_INCLUDE,
  });
  await recordAuditLog({ userId, action: 'PURCHASE_CANCELLED', entityType: 'Purchase', entityId: purchaseId });
  return updated;
}

export async function getPurchaseById(id: string) {
  const purchase = await prisma.purchase.findUnique({ where: { id }, include: PURCHASE_INCLUDE });
  if (!purchase) throw new NotFoundError('Purchase not found');
  return purchase;
}

interface ListPurchasesQuery {
  page?: string;
  pageSize?: string;
  supplierId?: string;
  status?: string;
}

const VALID_STATUSES = ['ORDERED', 'RECEIVED', 'INVOICED', 'PAID', 'CANCELLED'];

export async function listPurchases(query: ListPurchasesQuery) {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.PurchaseWhereInput = {};
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.status && VALID_STATUSES.includes(query.status)) where.status = query.status as PurchaseStatus;

  const [items, total] = await Promise.all([
    prisma.purchase.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: PURCHASE_INCLUDE }),
    prisma.purchase.count({ where }),
  ]);

  return toPaginatedResult(items, total, page, pageSize);
}

export async function recordSupplierPayment(
  supplierId: string,
  input: SupplierPaymentInput,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundError('Supplier not found');

    if (input.purchaseId) {
      const purchase = await tx.purchase.findUnique({ where: { id: input.purchaseId } });
      if (!purchase) throw new NotFoundError('Purchase not found');
      if (purchase.supplierId !== supplierId) {
        throw new ValidationError('That purchase does not belong to this supplier');
      }
      if (purchase.status === 'CANCELLED') {
        throw new ValidationError('Cannot record a payment against a cancelled purchase');
      }
    }

    const payment = await tx.supplierPayment.create({
      data: {
        supplierId,
        purchaseId: input.purchaseId,
        amount: new Prisma.Decimal(input.amount),
        method: input.method as PaymentMethod,
      },
    });

    if (input.purchaseId) {
      const purchase = await tx.purchase.findUnique({ where: { id: input.purchaseId }, include: { payments: true } });
      const totalPaid = purchase!.payments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
      if (totalPaid.greaterThanOrEqualTo(purchase!.total) && (purchase!.status === 'RECEIVED' || purchase!.status === 'INVOICED')) {
        await tx.purchase.update({ where: { id: input.purchaseId }, data: { status: 'PAID' } });
      }
    }

    await recordAuditLog({
      userId,
      action: 'SUPPLIER_PAYMENT_RECORDED',
      entityType: 'Supplier',
      entityId: supplierId,
      newValue: { amount: input.amount, method: input.method, purchaseId: input.purchaseId ?? null },
    }, tx);

    return payment;
  });
}
