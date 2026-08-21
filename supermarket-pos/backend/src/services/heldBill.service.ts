import { prisma } from '../config/database';
import { Prisma } from '../generated/prisma';
import { NotFoundError } from '../utils/errors';
import type { HoldBillInput } from '../schemas/heldBill.schema';

export async function listHeldBills(terminalId?: string) {
  return prisma.heldBill.findMany({
    where: terminalId ? { terminalId } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { cashier: { select: { id: true, name: true } }, customer: true },
  });
}

export async function holdBill(input: HoldBillInput, cashierId: string) {
  return prisma.heldBill.create({
    data: {
      terminalId: input.terminalId,
      customerId: input.customerId ?? undefined,
      cartData: input.cartData as Prisma.InputJsonValue,
      note: input.note,
      cashierId,
    },
  });
}

export async function resumeBill(id: string) {
  const bill = await prisma.heldBill.findUnique({ where: { id } });
  if (!bill) throw new NotFoundError('Held bill not found');
  return bill;
}

export async function deleteHeldBill(id: string) {
  const bill = await prisma.heldBill.findUnique({ where: { id } });
  if (!bill) throw new NotFoundError('Held bill not found');
  await prisma.heldBill.delete({ where: { id } });
}
