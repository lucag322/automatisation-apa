import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { UnauthorizedError, ConflictError, ForbiddenError, NotFoundError, AppError } from '../../lib/errors';
import { getEnv } from '../../lib/env';
import { sendInviteEmail } from '../../services/email/email.service';
import type { LoginInput, RegisterInput } from './auth.schema';

function getSuperAdminEmail(): string | undefined {
  return getEnv().ADMIN_EMAIL;
}

function isSuperAdmin(email: string): boolean {
  return email === getSuperAdminEmail();
}

export async function authenticateUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isSuperAdmin: isSuperAdmin(user.email),
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!user) return null;
  return { ...user, isSuperAdmin: isSuperAdmin(user.email) };
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  return users.map((u) => ({ ...u, isSuperAdmin: isSuperAdmin(u.email) }));
}

export async function createUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name || input.email.split('@')[0],
      role: input.role || 'editor',
      isActive: false,
      inviteToken,
      inviteExpiresAt,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true, isActive: true },
  });

  const frontendUrl = getEnv().FRONTEND_URL;
  const inviteLink = `${frontendUrl}/set-password?token=${inviteToken}`;
  const emailSent = await sendInviteEmail(
    input.email,
    input.name || input.email.split('@')[0],
    inviteLink,
  );

  return { ...user, isSuperAdmin: false, emailSent, inviteLink };
}

export async function setPasswordWithToken(token: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user) {
    throw new NotFoundError('Invalid or expired invitation');
  }
  if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
    throw new AppError(410, 'Invitation expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      isActive: true,
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  return { email: user.email, name: user.name };
}

export async function updateUserRole(targetId: string, newRole: 'admin' | 'editor') {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new NotFoundError('User');
  if (isSuperAdmin(target.email)) {
    throw new ForbiddenError('Cannot modify the super admin');
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { role: newRole },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return { ...updated, isSuperAdmin: false };
}

export async function deleteUser(targetId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new NotFoundError('User');
  if (isSuperAdmin(target.email)) {
    throw new ForbiddenError('Cannot delete the super admin');
  }

  await prisma.user.delete({ where: { id: targetId } });
  return { ok: true };
}
