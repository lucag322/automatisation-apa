import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';
import { createContextSchema, updateContextSchema } from './context.schema';
import { NotFoundError } from '../../lib/errors';
import { invalidateContextCache } from '../../services/context/context.service';

export async function contextRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/api/contexts', async () => {
    return prisma.editorialContext.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  });

  app.post('/api/contexts', async (request) => {
    const data = createContextSchema.parse(request.body);
    const result = await prisma.editorialContext.create({ data });
    invalidateContextCache();
    return result;
  });

  app.patch<{ Params: { id: string } }>('/api/contexts/:id', async (request) => {
    const data = updateContextSchema.parse(request.body);
    const existing = await prisma.editorialContext.findUnique({ where: { id: request.params.id } });
    if (!existing) throw new NotFoundError('Context');
    const result = await prisma.editorialContext.update({
      where: { id: request.params.id },
      data,
    });
    invalidateContextCache();
    return result;
  });

  app.delete<{ Params: { id: string } }>('/api/contexts/:id', async (request) => {
    const existing = await prisma.editorialContext.findUnique({ where: { id: request.params.id } });
    if (!existing) throw new NotFoundError('Context');
    await prisma.editorialContext.delete({ where: { id: request.params.id } });
    invalidateContextCache();
    return { deleted: true };
  });
}
