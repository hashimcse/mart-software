import { prisma } from '../config/database';
import { Prisma } from '../generated/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { nextPurchaseReturnNumber } from './counter.service';
import { recordAuditLog } from './audit.service';
import type { CreatePurchaseReturnInput } from '../schemas/return.schema';

const PURCHASE_RETURN_INCLUDE = {
  items: { include: { purchaseItem: { include: { product: { select: { name: true, sku: true } } } } } },
  purchase: { select: { purchaseNumber: true, supplierId: true } },
} as const;

const RECEIVABLE_STATUSES = ['RECEIVED', 'INVOICED', 'PAID'];

async function getAlreadyReturnedMap(purchaseId: string, client: Prisma.TransactionClient | typeof prisma = prisma) {
  const existing = await client.purchaseReturnItem.findMany({
    where: { purchaseItem: { purchaseId } },
    select: { purchaseItemId: true, quantity: true },
  });
  const map = new Map<string, Prisma.Decimal>();
  for (const ri of existing) {
    map.set(ri.purchaseItemId, (map.get(ri.purchaseItemId) ?? new Prisma.Decimal(0)).add(ri.quantity));
  }
  return map;
}

export async function getPurchaseReturnableLines(purchaseId: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: { include: { product: true } } },
  });
  if (!purchase) throw new NotFoundError('Purchase not found');
  if (!RECEIVABLE_STATUSES.includes(purchase.status)) {
    throw new ValidationError('Only a received purchase can have items returned to the supplier');
  }

  const alreadyReturned = await getAlreadyReturnedMap(purchaseId);

  return {
    purchaseId: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    lines: purchase.items.map((pi) => {
      const returned = alreadyReturned.get(pi.id) ?? new Prisma.Decimal(0);
      return {
        purchaseItemId: pi.id,
        productName: pi.product.name,
        sku: pi.product.sku,
        unitCost: pi.unitCost.toFixed(2),
        originalQuantity: pi.quantity.toFixed(3),
        returnable: pi.quantity.sub(returned).toFixed(3),
      };
    }),
  };
}

export async function createPurchaseReturn(input: CreatePurchaseReturnInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM purchases WHERE id = ${input.purchaseId} FOR UPDATE`;
    const purchase = await tx.purchase.findUnique({
      where: { id: input.purchaseId },
      include: { items: { include: { product: { select: { name: true } } } } },
    });
    if (!purchase) throw new NotFoundError('Purchase not found');
    if (!RECEIVABLE_STATUSES.includes(purchase.status)) {
      throw new ValidationError('Only a received purchase can have items returned to the supplier');
    }

    const purchaseItemMap = new Map(purchase.items.map((i) => [i.id, i]));
    const alreadyReturned = await getAlreadyReturnedMap(input.purchaseId, tx);

    let totalAmount = new Prisma.Decimal(0);
    const itemsData: { purchaseItemId: string; quantity: string; amount: Prisma.Decimal; productId: string }[] = [];

    for (const item of input.items) {
      const purchaseItem = purchaseItemMap.get(item.purchaseItemId);
      if (!purchaseItem) throw new NotFoundError(`Purchase item ${item.purchaseItemId} not found on this purchase`);

      const returnQty = new Prisma.Decimal(item.quantity);
      if (returnQty.lessThanOrEqualTo(0)) throw new ValidationError('Return quantity must be greater than zero');

      const already = alreadyReturned.get(item.purchaseItemId) ?? new Prisma.Decimal(0);
      const remaining = purchaseItem.quantity.sub(already);
      if (returnQty.greaterThan(remaining)) {
        throw new ValidationError(
          `Cannot return ${returnQty.toFixed(3)} of "${purchaseItem.product.name}" — only ${remaining.toFixed(3)} of ${purchaseItem.quantity.toFixed(3)} is still returnable`,
        );
      }

      const linePaid = purchase.subtotal.isZero() ? new Prisma.Decimal(0) : purchaseItem.subtotal.mul(purchase.total).div(purchase.subtotal);
      const amount = linePaid.mul(already.add(returnQty)).div(purchaseItem.quantity).toDecimalPlaces(2).sub(linePaid.mul(already).div(purchaseItem.quantity).toDecimalPlaces(2));
      totalAmount = totalAmount.add(amount);

      itemsData.push({ purchaseItemId: item.purchaseItemId, quantity: item.quantity, amount, productId: purchaseItem.productId });
      alreadyReturned.set(item.purchaseItemId, already.add(returnQty));
    }

    // Unlike a sale return, there's no "keep it, don't restock" option —
    // the goods are physically leaving the store either way, so this
    // always removes stock, with the same race-safe guarded decrement
    // sales and inventory adjustments use.
    for (const item of itemsData) {
      const result = await tx.product.updateMany({
        where: { id: item.productId, currentStock: { gte: item.quantity } },
        data: { currentStock: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        throw new ValidationError(
          'Not enough stock on hand to return that quantity — check for sales or other movements since receiving.',
        );
      }
    }

    const returnNumber = await nextPurchaseReturnNumber(tx);
    const createdReturn = await tx.purchaseReturn.create({
      data: {
        returnNumber,
        purchaseId: input.purchaseId,
        reason: input.reason,
        totalAmount,
        items: {
          create: itemsData.map((i) => ({ purchaseItemId: i.purchaseItemId, quantity: i.quantity, amount: i.amount })),
        },
      },
      include: PURCHASE_RETURN_INCLUDE,
    });

    for (const item of itemsData) {
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'RETURN',
          quantity: new Prisma.Decimal(item.quantity).mul(-1),
          referenceType: 'purchase_return',
          referenceId: createdReturn.id,
          userId,
        },
      });
    }

    await recordAuditLog({
      userId,
      action: 'PURCHASE_RETURN_CREATED',
      entityType: 'PurchaseReturn',
      entityId: createdReturn.id,
      newValue: { returnNumber, totalAmount: totalAmount.toFixed(2), purchaseId: input.purchaseId },
    }, tx);

    return createdReturn;
  });
}
