import { Prisma, ContentStatus, type PostType, type Theme } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import type { ContentFilters, UpdateContentInput } from './content.schema';
import { generateLinkedInPost, regeneratePost } from '../../services/openai/openai.service';

export async function listContentItems(filters: ContentFilters) {
  const where: Prisma.ContentItemWhereInput = {};

  if (filters.status) where.status = filters.status as ContentStatus;
  if (filters.theme) where.theme = filters.theme as Theme;
  if (filters.postType) where.postType = filters.postType as PostType;
  if (filters.sourceType) {
    where.source = { sourceType: filters.sourceType as any };
  }
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  const orderBy: Prisma.ContentItemOrderByWithRelationInput = (() => {
    switch (filters.sort) {
      case 'oldest': return { createdAt: 'asc' };
      case 'priority': return { priorityScore: 'desc' };
      case 'score': return { aiConfidence: 'desc' };
      case 'review_first': return { status: 'asc' };
      default: return { createdAt: 'desc' };
    }
  })();

  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await Promise.all([
    prisma.contentItem.findMany({
      where,
      orderBy,
      skip,
      take: filters.limit,
      include: {
        source: { select: { id: true, title: true, sourceType: true, url: true } },
      },
    }),
    prisma.contentItem.count({ where }),
  ]);

  return {
    items,
    total,
    page: filters.page,
    totalPages: Math.ceil(total / filters.limit),
  };
}

export async function getContentItem(id: string) {
  const item = await prisma.contentItem.findUnique({
    where: { id },
    include: {
      source: true,
      versions: { orderBy: { versionNumber: 'desc' } },
      reviewLogs: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });
  if (!item) throw new NotFoundError('Content item');
  return item;
}

export async function updateContentItem(id: string, data: UpdateContentInput, userId?: string) {
  const item = await prisma.contentItem.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('Content item');

  const latestVersion = await prisma.contentVersion.findFirst({
    where: { contentItemId: id },
    orderBy: { versionNumber: 'desc' },
  });
  const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.contentItem.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.hook !== undefined && { hook: data.hook }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.hashtags !== undefined && { hashtags: data.hashtags }),
        ...(data.cta !== undefined && { cta: data.cta }),
        ...(data.postType !== undefined && { postType: data.postType as PostType }),
        ...(data.theme !== undefined && { theme: data.theme as Theme }),
        ...(data.persona !== undefined && { persona: data.persona }),
        ...(data.priorityScore !== undefined && { priorityScore: data.priorityScore }),
        ...(data.targetPublishDate !== undefined && {
          targetPublishDate: data.targetPublishDate ? new Date(data.targetPublishDate) : null,
        }),
      },
    });

    await tx.contentVersion.create({
      data: {
        contentItemId: id,
        title: updatedItem.title,
        hook: updatedItem.hook,
        body: updatedItem.body,
        hashtags: updatedItem.hashtags,
        cta: updatedItem.cta,
        versionNumber: nextVersion,
        createdByUserId: userId,
      },
    });

    return updatedItem;
  });

  return updated;
}

export async function updateContentStatus(
  id: string,
  status: ContentStatus,
  userId?: string,
  comment?: string,
) {
  const item = await prisma.contentItem.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('Content item');

  const actionMap: Record<string, string> = {
    approved: 'approve',
    rejected: 'reject',
    to_review: 'move_to_review',
    published: 'publish',
  };

  const updated = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.contentItem.update({
      where: { id },
      data: { status },
    });

    const action = actionMap[status] || 'request_changes';
    await tx.reviewLog.create({
      data: {
        contentItemId: id,
        userId,
        action: action as any,
        comment,
      },
    });

    return updatedItem;
  });

  return updated;
}

export async function regenerateContentItem(id: string, angle?: string, instructions?: string) {
  const item = await prisma.contentItem.findUnique({
    where: { id },
    include: { source: true },
  });
  if (!item) throw new NotFoundError('Content item');

  const sourceContent = item.source?.rawContent || item.body;
  const result = await regeneratePost(sourceContent, item.theme, angle, instructions);

  const latestVersion = await prisma.contentVersion.findFirst({
    where: { contentItemId: id },
    orderBy: { versionNumber: 'desc' },
  });
  const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.contentItem.update({
      where: { id },
      data: {
        title: result.title,
        hook: result.hook,
        body: result.body,
        hashtags: result.hashtags,
        cta: result.cta,
        aiConfidence: result.confidence,
        status: 'draft',
      },
    });

    await tx.contentVersion.create({
      data: {
        contentItemId: id,
        title: result.title,
        hook: result.hook || '',
        body: result.body,
        hashtags: result.hashtags,
        cta: result.cta,
        versionNumber: nextVersion,
      },
    });

    await tx.reviewLog.create({
      data: {
        contentItemId: id,
        action: 'regenerate',
        comment: angle ? `Regenerated with angle: ${angle}` : 'Regenerated with AI',
      },
    });

    return updatedItem;
  });

  return updated;
}

export async function duplicateContentItem(id: string) {
  const item = await prisma.contentItem.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('Content item');

  const duplicate = await prisma.$transaction(async (tx) => {
    const newItem = await tx.contentItem.create({
      data: {
        sourceId: item.sourceId,
        title: `${item.title} (copy)`,
        hook: item.hook,
        body: item.body,
        hashtags: item.hashtags,
        cta: item.cta,
        postType: item.postType,
        theme: item.theme,
        persona: item.persona,
        status: 'draft',
        priorityScore: item.priorityScore,
        aiConfidence: item.aiConfidence,
        targetPublishDate: item.targetPublishDate,
      },
    });

    await tx.contentVersion.create({
      data: {
        contentItemId: newItem.id,
        title: newItem.title,
        hook: newItem.hook,
        body: newItem.body,
        hashtags: newItem.hashtags,
        cta: newItem.cta,
        versionNumber: 1,
      },
    });

    return newItem;
  });

  return duplicate;
}

export async function deleteContentItem(id: string) {
  const item = await prisma.contentItem.findUnique({ where: { id } });
  if (!item) throw new NotFoundError('Content item');

  await prisma.$transaction(async (tx) => {
    await tx.reviewLog.deleteMany({ where: { contentItemId: id } });
    await tx.contentVersion.deleteMany({ where: { contentItemId: id } });
    await tx.contentItem.delete({ where: { id } });
  });

  return { deleted: true };
}

export async function restoreVersion(contentItemId: string, versionId: string, userId?: string) {
  const version = await prisma.contentVersion.findUnique({ where: { id: versionId } });
  if (!version || version.contentItemId !== contentItemId) {
    throw new NotFoundError('Version');
  }

  const latestVersion = await prisma.contentVersion.findFirst({
    where: { contentItemId },
    orderBy: { versionNumber: 'desc' },
  });
  const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

  const restored = await prisma.$transaction(async (tx) => {
    const item = await tx.contentItem.update({
      where: { id: contentItemId },
      data: {
        title: version.title,
        hook: version.hook,
        body: version.body,
        hashtags: version.hashtags,
        cta: version.cta,
      },
    });

    await tx.contentVersion.create({
      data: {
        contentItemId,
        title: version.title,
        hook: version.hook,
        body: version.body,
        hashtags: version.hashtags,
        cta: version.cta,
        versionNumber: nextVersion,
        createdByUserId: userId,
      },
    });

    return item;
  });

  return restored;
}
