import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { loginSchema, registerSchema, setPasswordSchema } from './auth.schema';
import { authenticateUser, getUserById, createUser, listUsers, updateUserRole, deleteUser, setPasswordWithToken } from './auth.service';
import { ForbiddenError } from '../../lib/errors';

function requireAdmin(caller: { role: string }) {
  if (caller.role !== 'admin') {
    throw new ForbiddenError('Only admins can perform this action');
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await authenticateUser(body);
    const token = app.jwt.sign({ id: user.id, email: user.email, role: user.role });
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });
    return { user, token };
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const payload = request.user as { id: string };
    const user = await getUserById(payload.id);
    return { user };
  });

  app.get('/api/auth/users', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const caller = request.user as { role: string };
    requireAdmin(caller);
    const users = await listUsers();
    return { users };
  });

  app.post('/api/auth/register', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const caller = request.user as { role: string };
    requireAdmin(caller);
    const body = registerSchema.parse(request.body);
    const user = await createUser(body);
    return { user };
  });

  app.patch('/api/auth/users/:id/role', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const caller = request.user as { role: string };
    requireAdmin(caller);
    const { id } = request.params as { id: string };
    const { role } = z.object({ role: z.enum(['admin', 'editor']) }).parse(request.body);
    const user = await updateUserRole(id, role);
    return { user };
  });

  app.delete('/api/auth/users/:id', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const caller = request.user as { role: string };
    requireAdmin(caller);
    const { id } = request.params as { id: string };
    return deleteUser(id);
  });

  app.post('/api/auth/set-password', async (request) => {
    const { token, password } = setPasswordSchema.parse(request.body);
    const result = await setPasswordWithToken(token, password);
    return { ok: true, ...result };
  });
}
