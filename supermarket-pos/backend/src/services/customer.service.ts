import { prisma } from '../config/database';
import { Prisma, PaymentMethod, CustomerType } from '../generated/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { translateUniqueConstraintError } from '../utils/prismaErrors';
import { recordAuditLog } from './audit.service';
import { parsePagination, toPaginatedResult } from '../utils/pagination';
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerPaymentInput,
} from '../schemas/customer.schema';

// Outstanding balance is never stored on the Customer row — it's computed
// from CREDIT-method sale payments minus what they've paid back, the same
// "never store what can drift" pattern used for supplier balances. A
// return against a credit-paid sale reduces what that sale contributes,
// capped per-sale at the credit amount so a mostly-cash sale with a small
// credit component can't be pushed into an unrealistic negative.
async function computeBalance(tx: Prisma.TransactionClient | typeof prisma, customerId: string) {
  const [creditPayments, customerPayments, returns] = await Promise.all([
    tx.payment.findMany({
      where: { method: 'CREDIT', sale: { customerId, status: { not: 'CANCELLED' } } },
      select: { amount: true, saleId: true },
    }),
    tx.customerPayment.findMany({ where: { customerId }, select: { amount: true } }),
    tx.return.findMany({ where: { sale: { customerId }, refundMethod: 'CREDIT' }, select: { totalRefund: true, saleId: true } }),
  ]);

  const returnedBySale = new Map<string, Prisma.Decimal>();
  for (const r of returns) {
    returnedBySale.set(r.saleId, (returnedBySale.get(r.saleId) ?? new Prisma.Decimal(0)).add(r.totalRefund));
  }

  let totalCredit = new Prisma.Decimal(0);
  const creditBySale = new Map<string,Prisma.Decimal>();
  for (const p of creditPayments) {
    creditBySale.set(p.saleId,(creditBySale.get(p.saleId)??new Prisma.Decimal(0)).add(p.amount));
  }
  for(const [saleId,amount] of creditBySale) {
    totalCredit=totalCredit.add(amount.sub(Prisma.Decimal.min(returnedBySale.get(saleId)??0,amount)));
  }

  const totalPaid = customerPayments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
  const outstandingBalance = totalCredit.sub(totalPaid);

  return {
    totalCredit: totalCredit.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    outstandingBalance: outstandingBalance.toFixed(2),
  };
}

interface ListCustomersQuery {
  page?: string;
  pageSize?: string;
  search?: string;
  type?: string;
}

const VALID_TYPES = ['WALK_IN', 'REGISTERED', 'CREDIT'];

export async function listCustomers(query: ListCustomersQuery) {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.CustomerWhereInput = {};
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search } },
    ];
  }
  if (query.type && VALID_TYPES.includes(query.type)) where.type = query.type as CustomerType;

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.customer.count({ where }),
  ]);

  const items = await Promise.all(
    rows.map(async (c) => ({ ...c, balance: await computeBalance(prisma, c.id) })),
  );

  return toPaginatedResult(items, total, page, pageSize);
}

export async function getCustomerById(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new NotFoundError('Customer not found');

  const [balance, recentSales, recentPayments] = await Promise.all([
    computeBalance(prisma, id),
    prisma.sale.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { items: true, payments: true },
    }),
    prisma.customerPayment.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  return { ...customer, balance, recentSales, recentPayments };
}

export async function createCustomer(input: CreateCustomerInput, actingUserId: string) {
  try {
    const customer = await prisma.customer.create({ data: input });
    await recordAuditLog({
      userId: actingUserId,
      action: 'CUSTOMER_CREATED',
      entityType: 'Customer',
      entityId: customer.id,
      newValue: input,
    });
    return customer;
  } catch (err) {
    throw translateUniqueConstraintError(err);
  }
}

export async function updateCustomer(id: string, input: UpdateCustomerInput, actingUserId: string) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Customer not found');

  try {
    const updated = await prisma.customer.update({ where: { id }, data: input });
    await recordAuditLog({
      userId: actingUserId,
      action: 'CUSTOMER_UPDATED',
      entityType: 'Customer',
      entityId: id,
      oldValue: { name: existing.name, type: existing.type, creditLimit: existing.creditLimit.toString() },
      newValue: input,
    });
    return updated;
  } catch (err) {
    throw translateUniqueConstraintError(err);
  }
}

export async function recordCustomerPayment(customerId: string, input: CustomerPaymentInput, actingUserId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new NotFoundError('Customer not found');

  const payment = await prisma.customerPayment.create({
    data: {
      customerId,
      amount: new Prisma.Decimal(input.amount),
      method: input.method as PaymentMethod,
      notes: input.notes,
    },
  });

  await recordAuditLog({
    userId: actingUserId,
    action: 'CUSTOMER_PAYMENT_RECORDED',
    entityType: 'Customer',
    entityId: customerId,
    newValue: { amount: input.amount, method: input.method },
  });

  return payment;
}

export async function adjustLoyaltyPoints(customerId: string, pointsChange: number, reason: string, actingUserId: string) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundError('Customer not found');

    const newTotal = customer.loyaltyPoints + pointsChange;
    if (newTotal < 0) {
      throw new ValidationError(
        `Cannot deduct ${Math.abs(pointsChange)} points — ${customer.name} only has ${customer.loyaltyPoints}`,
      );
    }

    const updated = await tx.customer.update({ where: { id: customerId }, data: { loyaltyPoints: newTotal } });

    await recordAuditLog({
      userId: actingUserId,
      action: 'LOYALTY_POINTS_ADJUSTED',
      entityType: 'Customer',
      entityId: customerId,
      oldValue: { loyaltyPoints: customer.loyaltyPoints },
      newValue: { loyaltyPoints: newTotal, change: pointsChange, reason },
    }, tx);

    return updated;
  });
}

// Exported for sale.service.ts's automatic point accrual on checkout.
export { computeBalance };
