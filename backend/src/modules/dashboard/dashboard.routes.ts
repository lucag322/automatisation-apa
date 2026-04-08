import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/api/dashboard/stats', async () => {
    const [
      totalContent,
      drafts,
      toReview,
      approved,
      rejected,
      published,
      totalSources,
      contentByTheme,
    ] = await Promise.all([
      prisma.contentItem.count(),
      prisma.contentItem.count({ where: { status: 'draft' } }),
      prisma.contentItem.count({ where: { status: 'to_review' } }),
      prisma.contentItem.count({ where: { status: 'approved' } }),
      prisma.contentItem.count({ where: { status: 'rejected' } }),
      prisma.contentItem.count({ where: { status: 'published' } }),
      prisma.source.count(),
      prisma.contentItem.groupBy({
        by: ['theme'],
        _count: { id: true },
      }),
    ]);

    return {
      totalContent,
      drafts,
      toReview,
      approved,
      rejected,
      published,
      totalSources,
      contentByTheme: contentByTheme.map((g) => ({
        theme: g.theme,
        count: g._count.id,
      })),
    };
  });
}
