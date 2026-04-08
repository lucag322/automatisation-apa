import type { FastifyInstance } from 'fastify';
import { sourceFiltersSchema, ingestSchema, scrapeAndIngestSchema } from './source.schema';
import { listSources, getSource, ingestSource, reprocessSource, deleteSource, scrapeAndIngest } from './source.service';

export async function sourceRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/api/sources', async (request) => {
    const filters = sourceFiltersSchema.parse(request.query);
    return listSources(filters);
  });

  app.get<{ Params: { id: string } }>('/api/sources/:id', async (request) => {
    return getSource(request.params.id);
  });

  app.post('/api/ingest', async (request) => {
    const data = ingestSchema.parse(request.body);
    return ingestSource(data);
  });

  app.post('/api/sources/scrape', async (request) => {
    const data = scrapeAndIngestSchema.parse(request.body);
    return scrapeAndIngest(data);
  });

  app.post<{ Params: { id: string } }>('/api/sources/:id/reprocess', async (request) => {
    return reprocessSource(request.params.id);
  });

  app.delete<{ Params: { id: string } }>('/api/sources/:id', async (request) => {
    return deleteSource(request.params.id);
  });
}
