import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';

// Reuse a single PrismaClient instance across the app (and across
// hot-reloads in dev) to avoid exhausting database connections.
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma__ = prisma;
}
