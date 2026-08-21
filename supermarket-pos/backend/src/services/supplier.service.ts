import { prisma } from '../config/database';
import { Prisma } from '../generated/prisma';
import { NotFoundError } from '../utils/errors';
import { translateUniqueConstraintError } from '../utils/prismaErrors';
import { recordAuditLog } from './audit.service';
import { parsePagination, toPaginatedResult } from '../utils/pagination';
import type { CreateSupplierInput, UpdateSupplierInput } from '../schemas/supplier.schema';

interface BalanceInputs {
  openingBalance: Prisma.Decimal;
  purchases: { total: Prisma.Decimal; status: string }[];
  payments: { amount: Prisma.Decimal }[];
}

// Balance is always computed from purchases + payments rather than stored
// as its own column — a stored running balance is one more place for a
// missed update to quietly drift from reality. Cancelled purchases don't
// count against the balance since nothing was ever owed for them.
function computeBalance(supplier: BalanceInputs) {
  const totalPurchases = supplier.purchases
    .filter((p) => p.status !== 'CANCELLED')
    .reduce((sum, p) => sum.add(p.total), new Prisma.Decimal(0));
  const totalPaid = supplier.payments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
  const outstandingBalance = supplier.openingBalance.add(totalPurchases).sub(totalPaid);

  return {
    openingBalance: supplier.openingBalance.toFixed(2),
    totalPurchases: totalPurchases.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    outstandingBalance: outstandingBalance.toFixed(2),
  };
}

interface ListSuppliersQuery {
  page?: string;
  pageSize?: string;
  search?: string;
}

export async function listSuppliers(query: ListSuppliersQuery) {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.SupplierWhereInput = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { company: { contains: query.search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
      include: { purchases: { select: { total: true, status: true } }, payments: { select: { amount: true } } },
    }),
    prisma.supplier.count({ where }),
  ]);

  const items = rows.map(({ purchases, payments, ...supplier }) => ({
    ...supplier,
    balance: computeBalance({ openingBalance: supplier.openingBalance, purchases, payments }),
  }));

  return toPaginatedResult(items, total, page, pageSize);
}

export async function getSupplierById(id: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      purchases: { orderBy: { createdAt: 'desc' }, take: 20 },
      payments: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!supplier) throw new NotFoundError('Supplier not found');

  return { ...supplier, balance: computeBalance(supplier) };
}

export async function createSupplier(input: CreateSupplierInput, actingUserId: string) {
  try {
    const supplier = await prisma.supplier.create({ data: input });
    await recordAuditLog({
      userId: actingUserId,
      action: 'SUPPLIER_CREATED',
      entityType: 'Supplier',
      entityId: supplier.id,
      newValue: { name: supplier.name },
    });
    return supplier;
  } catch (err) {
    throw translateUniqueConstraintError(err);
  }
}

export async function updateSupplier(id: string, input: UpdateSupplierInput, actingUserId: string) {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Supplier not found');

  const updated = await prisma.supplier.update({ where: { id }, data: input });
  await recordAuditLog({
    userId: actingUserId,
    action: 'SUPPLIER_UPDATED',
    entityType: 'Supplier',
    entityId: id,
    oldValue: { name: existing.name, isActive: existing.isActive },
    newValue: input,
  });
  return updated;
}
