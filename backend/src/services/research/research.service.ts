import RssParser from 'rss-parser';
import OpenAI from 'openai';
import { getEnv } from '../../lib/env';

const rssParser = new RssParser({
  timeout: 10_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; EditorialBot/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  },
});

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY });
  return _openai;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export interface SuggestedArticle {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt: string | null;
  relevanceScore: number;
  relevanceReason: string;
  suggestedTheme: string;
}

const EDITORIAL_THEMES = [
  'sport santé maison sport-santé',
  'handicap inclusion accessibilité',
  'sport adapté handisport paralympique',
  'santé publique prévention APA activité physique adaptée',
  'loi politique handicap inclusion',
  'campagne sensibilisation handicap',
];

const CURATED_RSS_FEEDS = [
  { name: 'Handicap.fr', url: 'https://informations.handicap.fr/flux-rss.php' },
  { name: 'Faire Face (APF)', url: 'https://www.faire-face.fr/feed/' },
  { name: 'Sport & Société', url: 'https://www.sports.gouv.fr/rss' },
  { name: 'Santé Publique France', url: 'https://www.santepubliquefrance.fr/content/feeds/rss' },
  { name: 'Gazette Santé Social', url: 'https://www.gazette-sante-social.fr/feed' },
  { name: 'Yanous (Handicap)', url: 'https://www.yanous.com/rss.xml' },
  { name: 'Handirect', url: 'https://www.handirect.fr/feed/' },
];

const MAX_AGE_DAYS_GOOGLE = 7;
const MAX_AGE_DAYS_RSS = 7;

function buildGoogleNewsUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encoded}+when:${MAX_AGE_DAYS_GOOGLE}d&hl=fr&gl=FR&ceid=FR:fr`;
}

interface RawArticle {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt: string | null;
}

async function fetchGoogleNews(query: string): Promise<RawArticle[]> {
  try {
    const feed = await rssParser.parseURL(buildGoogleNewsUrl(query));
    return (feed.items || [])
      .filter((item) => daysAgo(item.pubDate || null) <= MAX_AGE_DAYS_GOOGLE)
      .slice(0, 10)
      .map((item) => ({
        title: item.title || '',
        url: item.link || '',
        snippet: (item.contentSnippet || item.content || '').substring(0, 300),
        source: `Google News: ${query}`,
        publishedAt: item.pubDate || null,
      }));
  } catch (err) {
    console.error(`Google News fetch failed for "${query}":`, err);
    return [];
  }
}

async function fetchRssFeed(feed: { name: string; url: string }): Promise<RawArticle[]> {
  try {
    const parsed = await rssParser.parseURL(feed.url);
    return (parsed.items || [])
      .filter((item) => daysAgo(item.pubDate || null) <= MAX_AGE_DAYS_RSS)
      .slice(0, 5)
      .map((item) => ({
        title: item.title || '',
        url: item.link || '',
        snippet: (item.contentSnippet || item.content || '').replace(/<[^>]*>/g, '').substring(0, 300),
        source: feed.name,
        publishedAt: item.pubDate || null,
      }));
  } catch (err) {
    console.error(`RSS feed "${feed.name}" failed:`, err);
    return [];
  }
}

function deduplicateArticles(articles: RawArticle[]): RawArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    const key = a.url || a.title.toLowerCase().substring(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByDateDesc(articles: RawArticle[]): RawArticle[] {
  return [...articles].sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return db - da;
  });
}

async function aiGenerateQueries(customTopic?: string): Promise<string[]> {
  const now = new Date();
  const today = todayISO();
  const year = now.getFullYear();
  const month = now.toLocaleString('fr-FR', { month: 'long' });

  if (customTopic) {
    const client = getOpenAI();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant de veille éditoriale spécialisé en sport, santé publique, handicap et inclusion.

INFORMATION CRITIQUE - Date du jour : ${today} (${month} ${year}).
Ta base de connaissances peut être en retard. La date ci-dessus est la VRAIE date actuelle, fournie par le système.

Génère 4 requêtes de recherche Google News en français pour trouver des articles RÉCENTS et pertinents sur le sujet donné.
Intègre "${month} ${year}" ou "${year}" dans chaque requête pour garantir des résultats actuels.
Les requêtes doivent être variées : actualités récentes, annonces, initiatives, événements.
Réponds en JSON : { "queries": ["requête 1", "requête 2", ...] }`,
        },
        { role: 'user', content: `Sujet de recherche : ${customTopic}` },
      ],
    });

    try {
      const raw = response.choices[0]?.message?.content?.trim() || '';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed.queries) ? parsed.queries.slice(0, 5) : EDITORIAL_THEMES.slice(0, 3);
    } catch {
      return [`${customTopic} ${month} ${year}`, `${customTopic} actualité ${year}`];
    }
  }

  return EDITORIAL_THEMES.map((t) => `${t} ${month} ${year}`);
}

async function aiScoreArticles(articles: RawArticle[]): Promise<SuggestedArticle[]> {
  if (articles.length === 0) return [];

  const batch = articles.slice(0, 30);
  const today = todayISO();

  const articlesList = batch.map((a, i) => {
    const age = daysAgo(a.publishedAt);
    const ageLabel = age === 0 ? "aujourd'hui" : age === 1 ? 'hier' : `il y a ${age}j`;
    return `[${i}] "${a.title}" (${ageLabel}) — ${a.snippet.substring(0, 150)}`;
  }).join('\n');

  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 2000,
    messages: [
      {
        role: 'system',
        content: `Tu es un éditeur spécialisé en sport, santé publique, handicap et inclusion.

INFORMATION CRITIQUE - Date du jour : ${today}. Cette date est fournie par le système et est EXACTE. Ne te fie PAS à ta base de connaissances pour la date.

Évalue les articles suivants pour leur pertinence éditoriale LinkedIn.
Les indications d'âge entre parenthèses (aujourd'hui, hier, il y a Xj) sont calculées par le système à partir de la date réelle et sont fiables.

Critères de scoring (0-100) :
- Pertinence thématique (sport-santé, handicap, inclusion, APA, Maisons Sport-Santé)
- Potentiel d'engagement LinkedIn
- FRAÎCHEUR : les articles d'aujourd'hui ou d'hier doivent avoir un bonus significatif (+10-15 points). Les articles de plus de 5 jours doivent être pénalisés.
- Qualité informative (données, chiffres, témoignages)

Pour chaque article, réponds en JSON :
{
  "scored": [
    { "index": 0, "score": 85, "reason": "Raison courte", "theme": "disability" },
    ...
  ]
}

Thèmes possibles : sport, adapted_sport, disability, maison_sport_sante, public_health, inclusion, awareness_campaign, law_and_policy, official_report, public_interest_event

N'inclus QUE les articles avec un score >= 40. Exclus les articles hors-sujet, publicitaires, ou sans valeur éditoriale.`,
      },
      { role: 'user', content: `Articles à évaluer :\n\n${articlesList}` },
    ],
  });

  try {
    const raw = response.choices[0]?.message?.content?.trim() || '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed.scored)) return [];

    return parsed.scored
      .filter((s: any) => s.index >= 0 && s.index < batch.length && s.score >= 40)
      .map((s: any) => ({
        title: batch[s.index].title,
        url: batch[s.index].url,
        snippet: batch[s.index].snippet,
        source: batch[s.index].source,
        publishedAt: batch[s.index].publishedAt,
        relevanceScore: s.score,
        relevanceReason: s.reason || '',
        suggestedTheme: s.theme || 'public_health',
      }))
      .sort((a: SuggestedArticle, b: SuggestedArticle) => b.relevanceScore - a.relevanceScore);
  } catch (err) {
    console.error('AI scoring failed:', err);
    return batch.map((a) => ({
      title: a.title,
      url: a.url,
      snippet: a.snippet,
      source: a.source,
      publishedAt: a.publishedAt,
      relevanceScore: 50,
      relevanceReason: 'Scoring automatique non disponible',
      suggestedTheme: 'public_health',
    }));
  }
}

export interface ResearchResult {
  suggestions: SuggestedArticle[];
  queriesUsed: string[];
  sourcesScanned: number;
  feedsReached: string[];
  feedsFailed: string[];
  durationMs: number;
  searchDate: string;
}

export async function runResearch(customTopic?: string): Promise<ResearchResult> {
  const start = Date.now();
  const searchDate = todayISO();

  const queries = await aiGenerateQueries(customTopic);

  const feedsReached: string[] = [];
  const feedsFailed: string[] = [];

  const [newsResults, ...rssResults] = await Promise.all([
    Promise.all(queries.map((q) => fetchGoogleNews(q))),
    ...CURATED_RSS_FEEDS.map(async (feed) => {
      const result = await fetchRssFeed(feed);
      if (result.length > 0) feedsReached.push(feed.name);
      else feedsFailed.push(feed.name);
      return result;
    }),
  ]);

  const allNews = newsResults.flat();
  const allRss = rssResults.flat();
  const combined = deduplicateArticles(sortByDateDesc([...allNews, ...allRss]));

  const suggestions = await aiScoreArticles(combined);

  return {
    suggestions: suggestions.slice(0, 20),
    queriesUsed: queries,
    sourcesScanned: combined.length,
    feedsReached,
    feedsFailed,
    durationMs: Date.now() - start,
    searchDate,
  };
}
