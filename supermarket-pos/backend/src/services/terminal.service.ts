import { prisma } from '../config/database';

export async function listActiveTerminals() {
  return prisma.terminal.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}
