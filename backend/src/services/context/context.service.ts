import { prisma } from '../../lib/prisma';

let _cachedPrompt: string | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60_000;

export async function getActiveContextsAsPrompt(): Promise<string> {
  const contexts = await prisma.editorialContext.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  if (contexts.length === 0) return '';

  const lines = contexts.map((c) => `- [${c.title}] : ${c.content}`);
  return `\n\nCONSIGNES ÉDITORIALES :\n${lines.join('\n')}`;
}

export async function getActiveContextsCached(): Promise<string> {
  const now = Date.now();
  if (_cachedPrompt !== null && now - _cacheTime < CACHE_TTL_MS) {
    return _cachedPrompt;
  }
  _cachedPrompt = await getActiveContextsAsPrompt();
  _cacheTime = now;
  return _cachedPrompt;
}

export function invalidateContextCache(): void {
  _cachedPrompt = null;
  _cacheTime = 0;
}
