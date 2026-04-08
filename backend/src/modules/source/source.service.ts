import crypto from 'crypto';
import { type SourceType, type Prisma } from '@prisma/client';
import * as cheerio from 'cheerio';
import { prisma } from '../../lib/prisma';
import { NotFoundError, ConflictError, AppError } from '../../lib/errors';
import type { IngestInput, ScrapeAndIngestInput } from './source.schema';
import {
  summarizeSource,
  classifyContent,
  generateLinkedInPost,
} from '../../services/openai/openai.service';

export async function listSources(filters: { sourceType?: string; page: number; limit: number }) {
  const where: Prisma.SourceWhereInput = {};
  if (filters.sourceType) where.sourceType = filters.sourceType as SourceType;

  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await Promise.all([
    prisma.source.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.limit,
      include: { _count: { select: { contentItems: true } } },
    }),
    prisma.source.count({ where }),
  ]);

  return {
    items,
    total,
    page: filters.page,
    totalPages: Math.ceil(total / filters.limit),
  };
}

export async function getSource(id: string) {
  const source = await prisma.source.findUnique({
    where: { id },
    include: {
      contentItems: {
        select: { id: true, title: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!source) throw new NotFoundError('Source');
  return source;
}

function computeHash(content: string, url: string): string {
  return crypto.createHash('sha256').update(`${url}::${content}`).digest('hex');
}

export async function ingestSource(input: IngestInput) {
  const contentHash = computeHash(input.content, input.url);

  const existing = await prisma.source.findUnique({ where: { contentHash } });
  if (existing) {
    throw new ConflictError('Source already ingested (duplicate detected)');
  }

  const [summary, classification] = await Promise.all([
    summarizeSource(input.content, input.title),
    classifyContent(input.content, input.title),
  ]);
  const { theme, postType } = classification;

  const source = await prisma.source.create({
    data: {
      url: input.url,
      title: input.title,
      rawContent: input.content,
      summary,
      sourceType: (input.source_type as SourceType) || 'article',
      publishedAt: input.published_at ? new Date(input.published_at) : null,
      contentHash,
    },
  });

  const post = await generateLinkedInPost(input.content, theme, postType, input.title, input.url);

  const contentItem = await prisma.$transaction(async (tx) => {
    const item = await tx.contentItem.create({
      data: {
        sourceId: source.id,
        title: post.title,
        hook: post.hook,
        body: post.body,
        hashtags: post.hashtags,
        cta: post.cta,
        postType: postType as any,
        theme: theme as any,
        status: 'draft',
        aiConfidence: post.confidence,
        priorityScore: 5,
      },
    });

    await tx.contentVersion.create({
      data: {
        contentItemId: item.id,
        title: post.title,
        hook: post.hook || '',
        body: post.body,
        hashtags: post.hashtags,
        cta: post.cta,
        versionNumber: 1,
      },
    });

    return item;
  });

  return { source, contentItem };
}

export async function deleteSource(id: string) {
  const source = await prisma.source.findUnique({
    where: { id },
    include: { contentItems: { select: { id: true } } },
  });
  if (!source) throw new NotFoundError('Source');

  await prisma.$transaction(async (tx) => {
    const contentIds = source.contentItems.map((c) => c.id);
    if (contentIds.length > 0) {
      await tx.reviewLog.deleteMany({ where: { contentItemId: { in: contentIds } } });
      await tx.contentVersion.deleteMany({ where: { contentItemId: { in: contentIds } } });
      await tx.contentItem.deleteMany({ where: { id: { in: contentIds } } });
    }
    await tx.source.delete({ where: { id } });
  });

  return { deleted: true };
}

export async function reprocessSource(id: string) {
  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) throw new NotFoundError('Source');

  const { theme, postType } = await classifyContent(source.rawContent, source.title);

  const post = await generateLinkedInPost(source.rawContent, theme, postType, source.title, source.url);

  const contentItem = await prisma.$transaction(async (tx) => {
    const item = await tx.contentItem.create({
      data: {
        sourceId: source.id,
        title: post.title,
        hook: post.hook,
        body: post.body,
        hashtags: post.hashtags,
        cta: post.cta,
        postType: postType as any,
        theme: theme as any,
        status: 'draft',
        aiConfidence: post.confidence,
        priorityScore: 5,
      },
    });

    await tx.contentVersion.create({
      data: {
        contentItemId: item.id,
        title: post.title,
        hook: post.hook || '',
        body: post.body,
        hashtags: post.hashtags,
        cta: post.cta,
        versionNumber: 1,
      },
    });

    return item;
  });

  return contentItem;
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
  'Accept-Encoding': 'identity',
};

async function fetchWithRedirects(url: string): Promise<{ finalUrl: string; html: string }> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new AppError(400, `Impossible de récupérer l'URL (HTTP ${response.status}). Le site bloque peut-être l'accès.`);
  }

  return { finalUrl: response.url || url, html: await response.text() };
}

function extractContent(html: string): { title: string; content: string } {
  const $ = cheerio.load(html);

  $('script, style, nav, footer, header, aside, iframe, noscript, [role="banner"], [role="navigation"], .cookie-banner, .ads, .advertisement').remove();

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    '';

  const selectors = ['article', '[role="main"]', 'main', '.post-content', '.article-content', '.entry-content', '.article-body', '#article-body', '.story-body'];
  let contentEl = null;
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 100) {
      contentEl = el;
      break;
    }
  }

  if (!contentEl) {
    contentEl = $('body');
  }

  const paragraphs: string[] = [];
  contentEl.find('p, h2, h3, li').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) paragraphs.push(text);
  });

  let content = paragraphs.join('\n\n');

  if (content.length < 50) {
    content = contentEl.text().replace(/\s+/g, ' ').trim();
  }

  if (content.length > 15_000) {
    content = content.substring(0, 15_000);
  }

  return { title, content };
}

export async function scrapeUrl(rawUrl: string): Promise<{ title: string; content: string }> {
  try {
    const { html } = await fetchWithRedirects(rawUrl);
    const result = extractContent(html);

    if (result.content.length < 50) {
      throw new AppError(
        400,
        'Impossible d\'extraire du contenu exploitable depuis cette URL. Le site bloque peut-être l\'accès ou utilise du JavaScript pour charger le contenu.',
      );
    }

    return result;
  } catch (err) {
    if (err instanceof AppError) throw err;

    const msg = err instanceof Error ? err.message : 'Erreur inconnue';
    if (msg.includes('timeout') || msg.includes('TimeoutError') || msg.includes('aborted')) {
      throw new AppError(400, 'Le site met trop de temps à répondre (timeout). Essayez la saisie manuelle.');
    }
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      throw new AppError(400, `Impossible de contacter le site : ${rawUrl}. Vérifiez l'URL ou essayez la saisie manuelle.`);
    }
    throw new AppError(400, `Erreur lors du scraping : ${msg}`);
  }
}

export async function scrapeAndIngest(input: ScrapeAndIngestInput) {
  let title = input.title || '';
  let content = '';

  try {
    const scraped = await scrapeUrl(input.url);
    title = title || scraped.title || 'Sans titre';
    content = scraped.content;
  } catch (scrapeError) {
    if (input.snippet && input.snippet.length > 10) {
      title = title || 'Sans titre';
      content = `${title}\n\n${input.snippet}`;
    } else {
      throw scrapeError;
    }
  }

  return ingestSource({
    url: input.url,
    title,
    content,
    source_type: input.source_type,
  });
}
