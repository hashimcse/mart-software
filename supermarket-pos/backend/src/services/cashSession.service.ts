import { prisma } from "../config/database";
import { Prisma, CashMovementType } from "../generated/prisma";
import { NotFoundError, ValidationError } from "../utils/errors";
import { recordAuditLog } from "./audit.service";

const SESSION_INCLUDE = {
  cashier: { select: { id: true, name: true } },
  terminal: true,
  movements: { orderBy: { createdAt: "asc" } as const },
} as const;

// SALE and CASH_IN put money into the drawer; REFUND, CASH_OUT, and EXPENSE
// take money out. This is the only place that distinction lives, so
// opening/closing math and the live "expected so far" preview can't drift
// apart from each other.
const INCREASES_CASH: CashMovementType[] = ["SALE", "CASH_IN"];

function computeExpected(
  openingCash: Prisma.Decimal,
  movements: { type: CashMovementType; amount: Prisma.Decimal }[],
) {
  return movements.reduce((total, m) => {
    return INCREASES_CASH.includes(m.type)
      ? total.add(m.amount)
      : total.sub(m.amount);
  }, openingCash);
}

export async function getOpenSession(terminalId: string) {
  return prisma.cashSession.findFirst({
    where: { terminalId, status: "OPEN" },
    include: SESSION_INCLUDE,
  });
}

export async function getSessionById(id: string) {
  const session = await prisma.cashSession.findUnique({
    where: { id },
    include: SESSION_INCLUDE,
  });
  if (!session) throw new NotFoundError("Cash session not found");

  const expectedSoFar = computeExpected(session.openingCash, session.movements);
  const totals = session.movements.reduce<Record<string, Prisma.Decimal>>(
    (acc, m) => {
      acc[m.type] = (acc[m.type] ?? new Prisma.Decimal(0)).add(m.amount);
      return acc;
    },
    {},
  );

  return {
    ...session,
    expectedSoFar: expectedSoFar.toFixed(2),
    totalsByType: Object.fromEntries(
      Object.entries(totals).map(([k, v]) => [k, v.toFixed(2)]),
    ),
  };
}

export async function openSession(
  terminalId: string,
  openingCash: string,
  cashierId: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM terminals WHERE id = ${terminalId} FOR UPDATE`;
    const existing = await tx.cashSession.findFirst({
      where: { terminalId, status: "OPEN" },
    });
    if (existing)
      throw new ValidationError(
        "This terminal already has an open cash session",
      );

    const session = await tx.cashSession.create({
      data: {
        terminalId,
        cashierId,
        openingCash: new Prisma.Decimal(openingCash),
        status: "OPEN",
      },
      include: SESSION_INCLUDE,
    });

    await recordAuditLog(
      {
        userId: cashierId,
        action: "CASH_SESSION_OPENED",
        entityType: "CashSession",
        entityId: session.id,
        newValue: { terminalId, openingCash },
      },
      tx,
    );

    return session;
  });
}

export async function addCashMovement(
  sessionId: string,
  type: "CASH_IN" | "CASH_OUT",
  amount: string,
  notes: string | undefined,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const owner = await tx.cashSession.findUnique({ where: { id: sessionId } });
    if (!owner) throw new NotFoundError("Cash session not found");
    await tx.$queryRaw`SELECT id FROM terminals WHERE id = ${owner.terminalId} FOR UPDATE`;
    const session = await tx.cashSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundError("Cash session not found");
    if (session.status !== "OPEN")
      throw new ValidationError("This cash session is already closed");

    const movement = await tx.cashMovement.create({
      data: { sessionId, type, amount: new Prisma.Decimal(amount), notes },
    });

    await recordAuditLog(
      {
        userId,
        action: type === "CASH_IN" ? "CASH_ADDED" : "CASH_REMOVED",
        entityType: "CashSession",
        entityId: sessionId,
        newValue: { amount, notes },
      },
      tx,
    );

    return movement;
  });
}

export async function closeSession(
  sessionId: string,
  actualCash: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const owner = await tx.cashSession.findUnique({ where: { id: sessionId } });
    if (!owner) throw new NotFoundError("Cash session not found");
    await tx.$queryRaw`SELECT id FROM terminals WHERE id = ${owner.terminalId} FOR UPDATE`;
    const session = await tx.cashSession.findUnique({
      where: { id: sessionId },
      include: { movements: true },
    });
    if (!session) throw new NotFoundError("Cash session not found");
    if (session.status !== "OPEN")
      throw new ValidationError("This cash session is already closed");

    const expected = computeExpected(session.openingCash, session.movements);
    const actual = new Prisma.Decimal(actualCash);
    const difference = actual.sub(expected);

    const updated = await tx.cashSession.update({
      where: { id: sessionId },
      data: {
        status: "CLOSED",
        actualCash: actual,
        expectedCash: expected,
        difference,
        closedAt: new Date(),
      },
      include: SESSION_INCLUDE,
    });

    await recordAuditLog(
      {
        userId,
        action: "CASH_SESSION_CLOSED",
        entityType: "CashSession",
        entityId: sessionId,
        newValue: {
          expectedCash: expected.toFixed(2),
          actualCash: actual.toFixed(2),
          difference: difference.toFixed(2),
        },
      },
      tx,
    );

    return updated;
  });
}

interface ListSessionsQuery {
  terminalId?: string;
  status?: string;
}

export async function listSessions(query: ListSessionsQuery) {
  const where: Prisma.CashSessionWhereInput = {};
  if (query.terminalId) where.terminalId = query.terminalId;
  if (query.status === "OPEN" || query.status === "CLOSED")
    where.status = query.status;

  return prisma.cashSession.findMany({
    where,
    orderBy: { openedAt: "desc" },
    take: 30,
    include: { cashier: { select: { name: true } }, terminal: true },
  });
}
