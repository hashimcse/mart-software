import { prisma } from '../config/database';
import { Prisma } from '../generated/prisma';

interface AuditLogInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      oldValue: input.oldValue,
      newValue: input.newValue,
      ipAddress: input.ipAddress ?? undefined,
    },
  });
}
