import type { FastifyInstance } from 'fastify';
import {
  contentFiltersSchema,
  updateContentSchema,
  updateStatusSchema,
  regenerateSchema,
} from './content.schema';
import {
  listContentItems,
  getContentItem,
  updateContentItem,
  updateContentStatus,
  regenerateContentItem,
  duplicateContentItem,
  deleteContentItem,
  restoreVersion,
} from './content.service';

export async function contentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/api/contents', async (request) => {
    const filters = contentFiltersSchema.parse(request.query);
    return listContentItems(filters);
  });

  app.get<{ Params: { id: string } }>('/api/contents/:id', async (request) => {
    return getContentItem(request.params.id);
  });

  app.patch<{ Params: { id: string } }>('/api/contents/:id', async (request) => {
    const data = updateContentSchema.parse(request.body);
    const user = request.user as { id: string };
    return updateContentItem(request.params.id, data, user.id);
  });

  app.patch<{ Params: { id: string } }>('/api/contents/:id/status', async (request) => {
    const { status, comment } = updateStatusSchema.parse(request.body);
    const user = request.user as { id: string };
    return updateContentStatus(request.params.id, status, user.id, comment);
  });

  app.post<{ Params: { id: string } }>('/api/contents/:id/regenerate', async (request) => {
    const data = regenerateSchema.parse(request.body);
    return regenerateContentItem(request.params.id, data.angle, data.instructions);
  });

  app.post<{ Params: { id: string } }>('/api/contents/:id/duplicate', async (request) => {
    return duplicateContentItem(request.params.id);
  });

  app.delete<{ Params: { id: string } }>('/api/contents/:id', async (request) => {
    return deleteContentItem(request.params.id);
  });

  app.get<{ Params: { id: string } }>('/api/contents/:id/versions', async (request) => {
    const item = await getContentItem(request.params.id);
    return item.versions;
  });

  app.post<{ Params: { id: string; versionId: string } }>(
    '/api/contents/:id/versions/:versionId/restore',
    async (request) => {
      const user = request.user as { id: string };
      return restoreVersion(request.params.id, request.params.versionId, user.id);
    },
  );

  app.get<{ Params: { id: string } }>('/api/contents/:id/reviews', async (request) => {
    const item = await getContentItem(request.params.id);
    return item.reviewLogs;
  });
}
