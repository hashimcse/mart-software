import { prisma } from '../config/database';
import { Prisma, ProductStatus } from '../generated/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { translateUniqueConstraintError } from '../utils/prismaErrors';
import { recordAuditLog } from './audit.service';
import { parsePagination, toPaginatedResult } from '../utils/pagination';
import { PRICE_FIELDS, CreateProductInput, UpdateProductInput } from '../schemas/product.schema';

const VALID_STATUSES: string[] = ['ACTIVE', 'INACTIVE', 'DISCONTINUED'];
const PRODUCT_INCLUDE = { category: true, brand: true, unit: true, tax: true } as const;

interface ListProductsQuery {
  page?: string;
  pageSize?: string;
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: string;
}

export async function listProducts(query: ListProductsQuery) {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.ProductWhereInput = {};
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
      { barcode: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.brandId) where.brandId = query.brandId;
  if (query.status && VALID_STATUSES.includes(query.status)) where.status = query.status as ProductStatus;

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: PRODUCT_INCLUDE }),
    prisma.product.count({ where }),
  ]);

  return toPaginatedResult(items, total, page, pageSize);
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { ...PRODUCT_INCLUDE, supplier: true },
  });
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

// Fast, single-row barcode lookup — this is the query the future POS
// screen's scanner input hammers on every scan, so it goes straight at
// the unique-indexed `barcode` column with no joins beyond what's needed
// to render a cart line.
export async function getProductByBarcode(barcode: string) {
  const product = await prisma.product.findUnique({ where: { barcode }, include: PRODUCT_INCLUDE });
  if (!product) throw new NotFoundError('No product matches that barcode');
  return product;
}

async function assertUnitExists(unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw new ValidationError('Selected unit does not exist');
}

export async function createProduct(input: CreateProductInput, actingUserId: string) {
  await assertUnitExists(input.unitId);

  try {
    const product = await prisma.product.create({ data: input, include: PRODUCT_INCLUDE });
    await recordAuditLog({
      userId: actingUserId,
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: product.id,
      newValue: input,
    });
    return product;
  } catch (err) {
    throw translateUniqueConstraintError(err);
  }
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  actingUserId: string,
  canEditPrice: boolean,
) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Product not found');

  const touchesPrice = PRICE_FIELDS.some((field) => field in input);
  if (touchesPrice && !canEditPrice) {
    throw new ValidationError('You do not have permission to change prices on this product');
  }

  if (input.unitId) await assertUnitExists(input.unitId);

  try {
    const updated = await prisma.product.update({ where: { id }, data: input, include: PRODUCT_INCLUDE });
    await recordAuditLog({
      userId: actingUserId,
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: id,
      oldValue: {
        name: existing.name,
        sku: existing.sku,
        barcode: existing.barcode,
        sellingPrice: existing.sellingPrice.toString(),
        purchasePrice: existing.purchasePrice.toString(),
      },
      newValue: input,
    });
    return updated;
  } catch (err) {
    throw translateUniqueConstraintError(err);
  }
}

export async function setProductStatus(id: string, status: ProductStatus, actingUserId: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Product not found');

  const updated = await prisma.product.update({ where: { id }, data: { status }, include: PRODUCT_INCLUDE });
  await recordAuditLog({
    userId: actingUserId,
    action: 'PRODUCT_STATUS_CHANGED',
    entityType: 'Product',
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { status },
  });
  return updated;
}

export async function setProductImage(id: string, imageUrl: string, actingUserId: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Product not found');

  const updated = await prisma.product.update({ where: { id }, data: { imageUrl }, include: PRODUCT_INCLUDE });
  await recordAuditLog({
    userId: actingUserId,
    action: 'PRODUCT_IMAGE_UPDATED',
    entityType: 'Product',
    entityId: id,
    newValue: { imageUrl },
  });
  return updated;
}
