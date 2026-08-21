import { Prisma } from '../generated/prisma';

type TxClient = Prisma.TransactionClient;

async function nextValue(tx: TxClient, key: string): Promise<number> {
  const counter = await tx.counter.upsert({
    where: { id: key },
    create: { id: key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

export async function nextInvoiceNumber(tx: TxClient): Promise<string> {
  const value = await nextValue(tx, 'invoice');
  return `INV-${String(value).padStart(6, '0')}`;
}

export async function nextPurchaseNumber(tx: TxClient): Promise<string> {
  const value = await nextValue(tx, 'purchase');
  return `PO-${String(value).padStart(6, '0')}`;
}
