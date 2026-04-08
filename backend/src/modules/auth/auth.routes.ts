import type { FastifyInstance } from 'fastify';
import { loginSchema } from './auth.schema';
import { authenticateUser, getUserById } from './auth.service';

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
}
