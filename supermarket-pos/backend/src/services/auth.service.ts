import { prisma } from '../config/database';
import { verifyPassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import { generateRefreshToken, hashToken } from '../utils/tokens';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import { recordAuditLog } from './audit.service';

async function loadUserWithPermissions(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
}

type UserWithPermissions = NonNullable<Awaited<ReturnType<typeof loadUserWithPermissions>>>;

function toPublicUser(user: UserWithPermissions) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions.map((rp) => rp.permission.key),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
  };
}

async function issueTokens(userId: string) {
  const user = await loadUserWithPermissions(userId);
  if (!user) throw new UnauthorizedError();

  const permissions = user.role.permissions.map((rp) => rp.permission.key);
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role.name,
    permissions,
  });

  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { token: hashToken(refreshToken), userId: user.id, expiresAt },
  });

  return { accessToken, refreshToken, user: toPublicUser(user) };
}

export async function login(username: string, password: string, ipAddress?: string) {
  const user = await prisma.user.findUnique({ where: { username } });

  // NOTE: for simplicity this skips a constant-time dummy-hash comparison
  // when the user doesn't exist. A hardening pass in a later phase can add
  // that to fully mask username enumeration via response timing.
  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !passwordOk || !user.isActive) {
    await recordAuditLog({
      action: 'USER_LOGIN_FAILED',
      entityType: 'User',
      entityId: user?.id ?? null,
      newValue: { username },
      ipAddress,
    });
    throw new UnauthorizedError('Invalid username or password');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAuditLog({
    userId: user.id,
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user.id,
    ipAddress,
  });

  return issueTokens(user.id);
}

export async function refreshSession(refreshToken: string) {
  const hashed = hashToken(refreshToken);
  const existing = await prisma.refreshToken.findUnique({ where: { token: hashed } });

  if (!existing || existing.revoked || existing.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token is invalid or expired');
  }

  // Rotate: revoke the presented token and issue a brand new pair.
  await prisma.refreshToken.update({ where: { id: existing.id }, data: { revoked: true } });
  return issueTokens(existing.userId);
}

export async function logout(refreshToken: string) {
  const hashed = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({ where: { token: hashed }, data: { revoked: true } });
}

export async function getCurrentUser(userId: string) {
  const user = await loadUserWithPermissions(userId);
  if (!user) throw new UnauthorizedError();
  return toPublicUser(user);
}
