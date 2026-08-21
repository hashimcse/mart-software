import { Prisma } from '../generated/prisma';
import { ConflictError } from './errors';

// Prisma's unique-constraint violation (P2002) is the backend-side backstop
// for barcode/SKU/name uniqueness — the frontend and zod schemas catch the
// common case, but a race between two requests (e.g. two terminals creating
// the same barcode at once) can only be caught here. Never trust frontend
// validation alone (spec section 33).
export function translateUniqueConstraintError(err: unknown): Error {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
    return new ConflictError(`A record with this ${target} already exists`);
  }
  return err instanceof Error ? err : new Error('Unknown error');
}
