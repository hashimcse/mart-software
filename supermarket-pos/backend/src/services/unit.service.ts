import { prisma } from '../config/database';
import { translateUniqueConstraintError } from '../utils/prismaErrors';
import { recordAuditLog } from './audit.service';
import type { CreateUnitInput } from '../schemas/unit.schema';

export async function listUnits() {
  return prisma.unit.findMany({ orderBy: { name: 'asc' } });
}

export async function createUnit(input: CreateUnitInput, actingUserId: string) {
  try {
    const unit = await prisma.unit.create({ data: input });
    await recordAuditLog({ userId: actingUserId, action: 'UNIT_CREATED', entityType: 'Unit', entityId: unit.id, newValue: input });
    return unit;
  } catch (err) {
    throw translateUniqueConstraintError(err);
  }
}
