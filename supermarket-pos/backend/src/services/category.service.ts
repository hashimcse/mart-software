import { prisma } from '../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { recordAuditLog } from './audit.service';
import type { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema';

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true, children: true } } },
  });
}

export async function createCategory(input: CreateCategoryInput, actingUserId: string) {
  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new ValidationError('Parent category does not exist');
  }

  const category = await prisma.category.create({ data: input });
  await recordAuditLog({
    userId: actingUserId,
    action: 'CATEGORY_CREATED',
    entityType: 'Category',
    entityId: category.id,
    newValue: input,
  });
  return category;
}

export async function updateCategory(id: string, input: UpdateCategoryInput, actingUserId: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Category not found');
  if (input.parentId === id) throw new ValidationError('A category cannot be its own parent');
  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new ValidationError('Parent category does not exist');
  }

  const updated = await prisma.category.update({ where: { id }, data: input });
  await recordAuditLog({
    userId: actingUserId,
    action: 'CATEGORY_UPDATED',
    entityType: 'Category',
    entityId: id,
    oldValue: { name: existing.name, parentId: existing.parentId },
    newValue: input,
  });
  return updated;
}

export async function deleteCategory(id: string, actingUserId: string) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!existing) throw new NotFoundError('Category not found');
  if (existing._count.products > 0 || existing._count.children > 0) {
    throw new ConflictError('This category has products or subcategories attached. Reassign them first.');
  }

  await prisma.category.delete({ where: { id } });
  await recordAuditLog({
    userId: actingUserId,
    action: 'CATEGORY_DELETED',
    entityType: 'Category',
    entityId: id,
    oldValue: { name: existing.name },
  });
}
