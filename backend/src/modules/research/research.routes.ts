import type { FastifyInstance } from 'fastify';
import { researchQuerySchema } from './research.schema';
import { runResearch } from '../../services/research/research.service';

export async function researchRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.post('/api/research', async (request) => {
    const { topic } = researchQuerySchema.parse(request.body);
    return runResearch(topic);
  });
}
