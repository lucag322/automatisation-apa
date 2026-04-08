import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { manualGenerateSchema, refineSchema, saveGeneratedSchema } from './generate.schema';
import {
  generateLinkedInPost,
  classifyContent,
  refinePost,
} from '../../services/openai/openai.service';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import type { SourceType } from '@prisma/client';

async function tryScrapUrl(url: string): Promise<{ title: string; content: string } | null> {
  try {
    const { scrapeUrl } = await import('../source/source.service');
    return await scrapeUrl(url);
  } catch {
    return null;
  }
}

export async function generateRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.post('/api/generate/preview', async (request) => {
    const { prompt, url } = manualGenerateSchema.parse(request.body);

    let content = prompt;
    let title = prompt.substring(0, 120);
    let scrapedUrl = url;

    if (url) {
      const scraped = await tryScrapUrl(url);
      if (scraped) {
        content = `${prompt}\n\n--- Contenu de l'article ---\n${scraped.content}`;
        title = scraped.title || title;
      } else {
        content = `${prompt}\n\n(URL fournie mais impossible à scraper : ${url})`;
      }
    }

    const { theme, postType } = await classifyContent(content, title);
    const post = await generateLinkedInPost(content, theme, postType, title, url);

    return {
      ...post,
      theme,
      postType,
      sourceTitle: title,
      sourceUrl: url || null,
      rawContent: content,
    };
  });

  app.post('/api/generate/refine', async (request) => {
    const { title, hook, body, cta, hashtags, instructions } = refineSchema.parse(request.body);
    return refinePost({ title, hook, body, cta, hashtags }, instructions);
  });

  app.post('/api/generate/save', async (request) => {
    const input = saveGeneratedSchema.parse(request.body);

    const contentHash = crypto
      .createHash('sha256')
      .update(`manual::${input.title}::${Date.now()}`)
      .digest('hex');

    const source = await prisma.source.create({
      data: {
        url: input.sourceUrl || `manual://${Date.now()}`,
        title: input.sourceTitle || input.title,
        rawContent: input.rawContent || input.body,
        summary: input.hook,
        sourceType: 'article' as SourceType,
        contentHash,
      },
    });

    const contentItem = await prisma.$transaction(async (tx) => {
      const item = await tx.contentItem.create({
        data: {
          sourceId: source.id,
          title: input.title,
          hook: input.hook,
          body: input.body,
          hashtags: input.hashtags,
          cta: input.cta,
          postType: input.postType as any,
          theme: input.theme as any,
          status: 'draft',
          aiConfidence: 0.9,
          priorityScore: 5,
        },
      });

      await tx.contentVersion.create({
        data: {
          contentItemId: item.id,
          title: input.title,
          hook: input.hook,
          body: input.body,
          hashtags: input.hashtags,
          cta: input.cta,
          versionNumber: 1,
        },
      });

      return item;
    });

    return { source, contentItem };
  });
}
