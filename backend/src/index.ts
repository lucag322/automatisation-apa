import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { ZodError } from 'zod';
import { getEnv } from './lib/env';
import { prisma } from './lib/prisma';
import { AppError } from './lib/errors';
import { authRoutes } from './modules/auth/auth.routes';
import { contentRoutes } from './modules/content/content.routes';
import { sourceRoutes } from './modules/source/source.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { researchRoutes } from './modules/research/research.routes';
import { calendarRoutes } from './modules/calendar/calendar.routes';
import { generateRoutes } from './modules/generate/generate.routes';
import { contextRoutes } from './modules/context/context.routes';

const env = getEnv();

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

app.register(cors, {
  origin: env.CORS_ORIGIN.split(','),
  credentials: true,
});

app.register(cookie);

app.register(jwt, {
  secret: env.JWT_SECRET,
  cookie: {
    cookieName: 'token',
    signed: false,
  },
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>;
  }
}

app.decorate('authenticate', async function (
  request: import('fastify').FastifyRequest,
  reply: import('fastify').FastifyReply,
) {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    reply.code(400).send({
      error: 'Validation Error',
      details: error.flatten().fieldErrors,
    });
    return;
  }

  if (error instanceof AppError) {
    reply.code(error.statusCode).send({ error: error.message });
    return;
  }

  app.log.error(error);
  reply.code(500).send({ error: 'Internal Server Error' });
});

app.register(authRoutes);
app.register(contentRoutes);
app.register(sourceRoutes);
app.register(dashboardRoutes);
app.register(researchRoutes);
app.register(calendarRoutes);
app.register(generateRoutes);
app.register(contextRoutes);

app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

async function start() {
  try {
    await prisma.$connect();
    app.log.info('Database connected');

    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server running on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
