import { prisma } from '../config/database';
import { Prisma } from '../generated/prisma';
import { ValidationError } from '../utils/errors';
import { recordAuditLog } from './audit.service';

// Defaults double as the whitelist of settings the app knows about — an
// unrecognized key is rejected rather than silently stored, since a typo'd
// key would otherwise be invisible to every reader that expects the
// documented name.
export const DEFAULT_SETTINGS: Record<string, string> = {
  'store.name': 'ABC Mart',
  'store.address': 'Main Road',
  'store.phone': '091-XXXXXXX',
  'store.taxNumber': '',
  'store.receiptFooter': 'Thank You!\nVisit Again',
  'store.currency': 'PKR',
  'pos.receiptWidth': '80',
  'pos.printerMode': 'browser',
  'pos.printerHost': '',
  'pos.printerPort': '9100',
  'loyalty.enabled': 'true',
  'loyalty.pointsPerHundred': '1',
};

function categoryFor(key: string): string {
  return key.split('.')[0] ?? 'system';
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const rows = await prisma.setting.findMany();
  const overrides = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...overrides };
}

export async function updateSetting(key: string, value: string | number | boolean, actingUserId: string) {
  if (!(key in DEFAULT_SETTINGS)) {
    throw new ValidationError(`Unknown setting "${key}"`);
  }

  const existing = await prisma.setting.findUnique({ where: { key } });
  const updated = await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue, category: categoryFor(key) },
    update: { value: value as Prisma.InputJsonValue },
  });

  await recordAuditLog({
    userId: actingUserId,
    action: 'SETTING_UPDATED',
    entityType: 'Setting',
    entityId: key,
    oldValue: existing ? { value: existing.value } : { value: DEFAULT_SETTINGS[key] },
    newValue: { value },
  });

  return updated;
}
