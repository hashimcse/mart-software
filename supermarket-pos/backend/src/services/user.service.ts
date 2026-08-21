import { prisma } from '../config/database';
import { hashPassword } from '../utils/password';
import { ConflictError, NotFoundError } from '../utils/errors';
import { recordAuditLog } from './audit.service';

export async function listUsers() {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: 'asc' },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    role: u.role.name,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  }));
}

interface CreateUserInput {
  name: string;
  username: string;
  email?: string;
  password: string;
  roleName: string;
}

export async function createUser(input: CreateUserInput, actingUserId: string) {
  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) {
    throw new ConflictError('A user with this username already exists');
  }

  const role = await prisma.role.findUnique({ where: { name: input.roleName } });
  if (!role) {
    throw new NotFoundError(`Role "${input.roleName}" does not exist`);
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      username: input.username,
      email: input.email,
      passwordHash,
      roleId: role.id,
    },
    include: { role: true },
  });

  await recordAuditLog({
    userId: actingUserId,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    newValue: { username: user.username, role: role.name },
  });

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role.name,
    isActive: user.isActive,
  };
}

export async function setUserActive(userId: string, isActive: boolean, actingUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  const updated = await prisma.user.update({ where: { id: userId }, data: { isActive } });

  await recordAuditLog({
    userId: actingUserId,
    action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    entityType: 'User',
    entityId: userId,
    oldValue: { isActive: user.isActive },
    newValue: { isActive: updated.isActive },
  });

  return updated;
}
