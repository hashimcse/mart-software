import { prisma } from '../config/database';
import { Prisma, PaymentMethod } from '../generated/prisma';
import { NotFoundError, ValidationError } from '../utils/errors';
import { recordAuditLog } from './audit.service';
import { parsePagination, toPaginatedResult } from '../utils/pagination';
import type { CreateExpenseInput } from '../schemas/expense.schema';

interface ListExpensesQuery {
  page?: string;
  pageSize?: string;
  category?: string;
}

export async function listExpenses(query: ListExpensesQuery) {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.ExpenseWhereInput = {};
  if (query.category) where.category = query.category;

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip,
      take,
      orderBy: { date: 'desc' },
      include: { employee: { select: { name: true } } },
    }),
    prisma.expense.count({ where }),
  ]);

  return toPaginatedResult(items, total, page, pageSize);
}

export async function createExpense(input: CreateExpenseInput, actingUserId: string) {
  return prisma.$transaction(async (tx) => {
    if (input.cashSessionId) {
      const session = await tx.cashSession.findUnique({ where: { id: input.cashSessionId } });
      if (session) await tx.$queryRaw`SELECT id FROM terminals WHERE id = ${session.terminalId} FOR UPDATE`;
      const fresh = session ? await tx.cashSession.findUnique({where:{id:session.id}}) : null;
      if (!session) throw new NotFoundError('Cash session not found');
      if (fresh?.status !== 'OPEN') throw new ValidationError('That cash session is already closed');
    }

    const expense = await tx.expense.create({
      data: {
        category: input.category,
        description: input.description,
        amount: new Prisma.Decimal(input.amount),
        paymentMethod: input.paymentMethod as PaymentMethod,
        employeeId: actingUserId,
        cashSessionId: input.cashSessionId,
        notes: input.notes,
      },
      include: { employee: { select: { name: true } } },
    });

    // Only a cash expense drawn from an open session actually moves money
    // out of that drawer — a bank-transferred rent payment, for instance,
    // never touches the till.
    if (input.paymentMethod === 'CASH' && input.cashSessionId) {
      await tx.cashMovement.create({
        data: {
          sessionId: input.cashSessionId,
          type: 'EXPENSE',
          amount: new Prisma.Decimal(input.amount),
          referenceId: expense.id,
          notes: `${input.category}${input.description ? ': ' + input.description : ''}`,
        },
      });
    }

    await recordAuditLog({
      userId: actingUserId,
      action: 'EXPENSE_CREATED',
      entityType: 'Expense',
      entityId: expense.id,
      newValue: { category: input.category, amount: input.amount, paymentMethod: input.paymentMethod },
    }, tx);

    return expense;
  });
}
