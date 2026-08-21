import { prisma } from '../config/database';
import { Prisma, MovementType } from '../generated/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { recordAuditLog } from './audit.service';
import { parsePagination, toPaginatedResult } from '../utils/pagination';

const PRODUCT_ALERT_INCLUDE = { unit: true, category: true } as const;

// Shared by adjustments, damaged, and expired stock changes: negative
// deltas use the same race-safe guarded UPDATE as sales (WHERE stock >=
// amount removed), so a stock correction can never push stock negative,
// and increases are a plain increment since there's no lower bound to guard.
async function applyStockChange(
  productId: string,
  delta: Prisma.Decimal,
  type: MovementType,
  reason: string | undefined,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    if (delta.isNegative()) {
      const absDelta = delta.abs();
      const result = await tx.product.updateMany({
        where: { id: productId, currentStock: { gte: absDelta } },
        data: { currentStock: { decrement: absDelta } },
      });
      if (result.count === 0) {
        throw new ValidationError(
          `Cannot remove ${absDelta.toFixed(3)} of "${product.name}" — only ${product.currentStock} in stock`,
        );
      }
    } else if (delta.greaterThan(0)) {
      await tx.product.update({ where: { id: productId }, data: { currentStock: { increment: delta } } });
    } else {
      throw new ValidationError('Quantity change cannot be zero');
    }

    const movement = await tx.inventoryMovement.create({
      data: { productId, type, quantity: delta, reason, userId },
      include: { product: { select: { name: true, sku: true } }, user: { select: { name: true } } },
    });

    await recordAuditLog({
      userId,
      action: `INVENTORY_${type}`,
      entityType: 'Product',
      entityId: productId,
      newValue: { quantity: delta.toFixed(3), reason, type },
    });

    return movement;
  });
}

export async function recordAdjustment(productId: string, quantityChange: string, reason: string, userId: string) {
  return applyStockChange(productId, new Prisma.Decimal(quantityChange), 'ADJUSTMENT', reason, userId);
}

export async function recordDamaged(productId: string, quantity: string, reason: string | undefined, userId: string) {
  return applyStockChange(productId, new Prisma.Decimal(quantity).mul(-1), 'DAMAGED', reason, userId);
}

export async function recordExpired(productId: string, quantity: string, reason: string | undefined, userId: string) {
  return applyStockChange(productId, new Prisma.Decimal(quantity).mul(-1), 'EXPIRED', reason, userId);
}

interface MovementQuery {
  page?: string;
  pageSize?: string;
  productId?: string;
  type?: string;
}

const VALID_TYPES = ['SALE', 'PURCHASE', 'ADJUSTMENT', 'RETURN', 'DAMAGED', 'EXPIRED'];

export async function listMovements(query: MovementQuery) {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.InventoryMovementWhereInput = {};
  if (query.productId) where.productId = query.productId;
  if (query.type && VALID_TYPES.includes(query.type)) where.type = query.type as MovementType;

  const [items, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { name: true, sku: true } }, user: { select: { name: true } } },
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  return toPaginatedResult(items, total, page, pageSize);
}

export async function getLowStockProducts() {
  // Prisma can't compare two columns of the same row in a `where` filter
  // (currentStock <= minStock), so that comparison happens here in JS
  // rather than in SQL. Fine at the scale of a single store's catalog;
  // worth a raw query or a generated column if that stops being true.
  const products = await prisma.product.findMany({ where: { status: 'ACTIVE' }, include: PRODUCT_ALERT_INCLUDE });
  return products.filter((p) => p.currentStock.greaterThan(0) && p.currentStock.lessThanOrEqualTo(p.minStock));
}

export async function getOutOfStockProducts() {
  return prisma.product.findMany({
    where: { status: 'ACTIVE', currentStock: { lte: 0 } },
    include: PRODUCT_ALERT_INCLUDE,
  });
}

export async function getExpiringProducts(daysAhead = 14) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  return prisma.product.findMany({
    where: { status: 'ACTIVE', expiryDate: { not: null, lte: cutoff } },
    include: PRODUCT_ALERT_INCLUDE,
    orderBy: { expiryDate: 'asc' },
  });
}

export async function getValuation() {
  const products = await prisma.product.findMany({ where: { status: 'ACTIVE' } });

  let totalCost = new Prisma.Decimal(0);
  let totalRetail = new Prisma.Decimal(0);
  for (const p of products) {
    totalCost = totalCost.add(p.currentStock.mul(p.purchasePrice));
    totalRetail = totalRetail.add(p.currentStock.mul(p.sellingPrice));
  }

  return {
    totalCost: totalCost.toFixed(2),
    totalRetail: totalRetail.toFixed(2),
    potentialProfit: totalRetail.sub(totalCost).toFixed(2),
    productCount: products.length,
  };
}
