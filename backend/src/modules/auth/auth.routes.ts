import type { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema } from './auth.schema';
import { authenticateUser, getUserById, createUser } from './auth.service';
import { ForbiddenError } from '../../lib/errors';

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

  app.post('/api/auth/register', {
    onRequest: [app.authenticate],
  }, async (request) => {
    const caller = request.user as { role: string };
    if (caller.role !== 'admin') {
      throw new ForbiddenError('Only admins can create users');
    }
    const body = registerSchema.parse(request.body);
    const user = await createUser(body);
    return { user };
  });
}
