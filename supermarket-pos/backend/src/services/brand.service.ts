import { prisma } from '../config/database';
import { ConflictError, NotFoundError } from '../utils/errors';
import { translateUniqueConstraintError } from '../utils/prismaErrors';
import { recordAuditLog } from './audit.service';

export async function listBrands() {
  return prisma.brand.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
}

export async function createBrand(name: string, actingUserId: string) {
  try {
    const brand = await prisma.brand.create({ data: { name } });
    await recordAuditLog({ userId: actingUserId, action: 'BRAND_CREATED', entityType: 'Brand', entityId: brand.id, newValue: { name } });
    return brand;
  } catch (err) {
    throw translateUniqueConstraintError(err);
  }
}

export async function updateBrand(id: string, name: string, actingUserId: string) {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Brand not found');

  try {
    const updated = await prisma.brand.update({ where: { id }, data: { name } });
    await recordAuditLog({
      userId: actingUserId,
      action: 'BRAND_UPDATED',
      entityType: 'Brand',
      entityId: id,
      oldValue: { name: existing.name },
      newValue: { name },
    });
    return updated;
  } catch (err) {
    throw translateUniqueConstraintError(err);
  }
}

export async function deleteBrand(id: string, actingUserId: string) {
  const existing = await prisma.brand.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) throw new NotFoundError('Brand not found');
  if (existing._count.products > 0) {
    throw new ConflictError('This brand has products attached. Reassign them first.');
  }

  await prisma.brand.delete({ where: { id } });
  await recordAuditLog({ userId: actingUserId, action: 'BRAND_DELETED', entityType: 'Brand', entityId: id, oldValue: { name: existing.name } });
}
