import { prisma } from '../config/database';
import { Prisma, PaymentMethod } from '../generated/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { nextReturnNumber } from './counter.service';
import { recordAuditLog } from './audit.service';
import { parsePagination, toPaginatedResult } from '../utils/pagination';
import type { CreateReturnInput } from '../schemas/return.schema';

const RETURN_INCLUDE = {
  items: { include: { saleItem: { include: { product: true } } } },
  sale: { select: { invoiceNumber: true } },
  customer: true,
} as const;

async function getAlreadyReturnedMap(tx: Prisma.TransactionClient | typeof prisma, saleId: string) {
  const existing = await tx.returnItem.findMany({
    where: { saleItem: { saleId } },
    select: { saleItemId: true, quantity: true },
  });
  const map = new Map<string, Prisma.Decimal>();
  for (const ri of existing) {
    map.set(ri.saleItemId, (map.get(ri.saleItemId) ?? new Prisma.Decimal(0)).add(ri.quantity));
  }
  return map;
}

// What a cashier sees before building a return: each line's original
// quantity and how much of it is still eligible, after accounting for any
// prior partial returns against the same sale (spec section 38's "returns
// only 2 of 5" — and that cap has to hold across repeated partial returns,
// not just the first one).
export async function getReturnableLines(saleId: string) {
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { items: { include: { product: true } } } });
  if (!sale) throw new NotFoundError('Sale not found');
  if (sale.status === 'CANCELLED') throw new ValidationError('Cannot return a cancelled sale');

  const alreadyReturned = await getAlreadyReturnedMap(prisma, saleId);

  return {
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    status: sale.status,
    lines: sale.items.map((si) => {
      const returned = alreadyReturned.get(si.id) ?? new Prisma.Decimal(0);
      return {
        saleItemId: si.id,
        productName: si.product.name,
        sku: si.product.sku,
        unitPrice: si.unitPrice.toFixed(2),
        originalQuantity: si.quantity.toFixed(3),
        alreadyReturned: returned.toFixed(3),
        returnable: si.quantity.sub(returned).toFixed(3),
      };
    }),
  };
}

export async function createReturn(input: CreateReturnInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sales WHERE id = ${input.saleId} FOR UPDATE`;
    const sale = await tx.sale.findUnique({
      where: { id: input.saleId },
      include: { items: { include: { product: { select: { name: true } } } } },
    });
    if (!sale) throw new NotFoundError('Sale not found');
    if (sale.status === 'CANCELLED') throw new ValidationError('Cannot return a cancelled sale');
    if (sale.status === 'RETURNED') throw new ValidationError('This sale has already been fully returned');

    const saleItemMap = new Map(sale.items.map((i) => [i.id, i]));
    const alreadyReturned = await getAlreadyReturnedMap(tx, input.saleId);

    let totalRefund = new Prisma.Decimal(0);
    const itemsData: {
      saleItemId: string;
      quantity: string;
      refundAmount: Prisma.Decimal;
      productId: string;
      restock: boolean;
    }[] = [];

    for (const item of input.items) {
      const saleItem = saleItemMap.get(item.saleItemId);
      if (!saleItem) throw new NotFoundError(`Sale item ${item.saleItemId} not found on this sale`);

      const returnQty = new Prisma.Decimal(item.quantity);
      if (returnQty.lessThanOrEqualTo(0)) throw new ValidationError('Return quantity must be greater than zero');

      const already = alreadyReturned.get(item.saleItemId) ?? new Prisma.Decimal(0);
      const remaining = saleItem.quantity.sub(already);
      if (returnQty.greaterThan(remaining)) {
        throw new ValidationError(
          `Cannot return ${returnQty.toFixed(3)} of "${saleItem.product.name}" — only ${remaining.toFixed(3)} of ${saleItem.quantity.toFixed(3)} is still returnable`,
        );
      }

      // Refund proportionally to what was actually paid per unit (net of
      // this line's discount, including its share of tax), not just the
      // list price — so a discounted or tax-inclusive line refunds
      // correctly for a partial return.
      // Allocate the paid total across lines, including the cart discount.
      // Cumulative rounding ensures repeated partial returns equal a full return.
      const ordered = [...sale.items].sort((a,b) => a.id.localeCompare(b.id));
      const gross = sale.subtotal.add(sale.taxAmount);
      let allocated = new Prisma.Decimal(0);
      let linePaid = new Prisma.Decimal(0);
      for (let i = 0; i < ordered.length; i++) {
        const line = ordered[i];
        const share = i === ordered.length - 1 ? sale.total.sub(allocated)
          : gross.isZero() ? new Prisma.Decimal(0) : line.subtotal.add(line.tax).mul(sale.total).div(gross).toDecimalPlaces(2);
        allocated = allocated.add(share);
        if (line.id === saleItem.id) linePaid = share;
      }
      const refundAmount = linePaid.mul(already.add(returnQty)).div(saleItem.quantity).toDecimalPlaces(2)
        .sub(linePaid.mul(already).div(saleItem.quantity).toDecimalPlaces(2));
      totalRefund = totalRefund.add(refundAmount);

      itemsData.push({
        saleItemId: item.saleItemId,
        quantity: item.quantity,
        refundAmount,
        productId: saleItem.productId,
        restock: item.restock ?? true,
      });

      alreadyReturned.set(item.saleItemId, already.add(returnQty));
    }

    const returnNumber = await nextReturnNumber(tx);

    if (input.refundMethod === 'CREDIT') {
      if(!sale.customerId) throw new ValidationError('Credit refunds require the original credit customer');
      const credit = await tx.payment.aggregate({where:{saleId:sale.id,method:'CREDIT'},_sum:{amount:true}});
      const prior = await tx.return.aggregate({where:{saleId:sale.id,refundMethod:'CREDIT'},_sum:{totalRefund:true}});
      if(totalRefund.add(prior._sum.totalRefund??0).gt(credit._sum.amount??0)) throw new ValidationError('Credit refund exceeds the credit charged on this sale');
    }

    const createdReturn = await tx.return.create({
      data: {
        returnNumber,
        saleId: input.saleId,
        customerId: sale.customerId,
        cashierId: userId,
        reason: input.reason,
        refundMethod: input.refundMethod as PaymentMethod,
        totalRefund,
        items: {
          create: itemsData.map((i) => ({
            saleItemId: i.saleItemId,
            quantity: i.quantity,
            refundAmount: i.refundAmount,
            restock: i.restock,
          })),
        },
      },
      include: RETURN_INCLUDE,
    });

    await tx.$queryRaw`SELECT id FROM terminals WHERE id = ${sale.terminalId} FOR UPDATE`;
    if (input.refundMethod === 'CASH') {
      const openSession = await tx.cashSession.findFirst({ where: { terminalId: sale.terminalId, status: 'OPEN' } });
      if (openSession) {
        await tx.cashMovement.create({
          data: { sessionId: openSession.id, type: 'REFUND', amount: totalRefund, referenceId: createdReturn.id },
        });
      }
    }

    for (const item of itemsData) {
      if (!item.restock) continue;
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { increment: item.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'RETURN',
          quantity: item.quantity,
          referenceType: 'sale_return',
          referenceId: createdReturn.id,
          userId,
        },
      });
    }

    const isFullyReturned = sale.items.every((si) => {
      const total = alreadyReturned.get(si.id) ?? new Prisma.Decimal(0);
      return total.greaterThanOrEqualTo(si.quantity);
    });

    await tx.sale.update({
      where: { id: input.saleId },
      data: { status: isFullyReturned ? 'RETURNED' : 'PARTIALLY_RETURNED' },
    });

    await recordAuditLog({
      userId,
      action: 'RETURN_CREATED',
      entityType: 'Return',
      entityId: createdReturn.id,
      newValue: { returnNumber, totalRefund: totalRefund.toFixed(2), saleId: input.saleId, itemCount: itemsData.length },
    }, tx);

    return createdReturn;
  });
}

export async function getReturnById(id: string) {
  const ret = await prisma.return.findUnique({ where: { id }, include: RETURN_INCLUDE });
  if (!ret) throw new NotFoundError('Return not found');
  return ret;
}

interface ListReturnsQuery {
  page?: string;
  pageSize?: string;
  saleId?: string;
}

export async function listReturns(query: ListReturnsQuery) {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.ReturnWhereInput = {};
  if (query.saleId) where.saleId = query.saleId;

  const [items, total] = await Promise.all([
    prisma.return.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: RETURN_INCLUDE }),
    prisma.return.count({ where }),
  ]);

  return toPaginatedResult(items, total, page, pageSize);
}
