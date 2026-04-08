import OpenAI from 'openai';
import { getEnv } from '../../lib/env';
import { PROMPTS } from './prompts';
import { getActiveContextsCached } from '../context/context.service';

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY });
  }
  return _client;
}

type Model = 'gpt-4o' | 'gpt-4o-mini';

async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  opts?: { model?: Model; maxTokens?: number; temperature?: number },
): Promise<string> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: opts?.model || 'gpt-4o-mini',
    temperature: opts?.temperature ?? 0.4,
    max_tokens: opts?.maxTokens || 1000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  return response.choices[0]?.message?.content?.trim() || '';
}

function truncateContent(content: string, maxChars = 5000): string {
  if (content.length <= maxChars) return content;
  return content.substring(0, maxChars) + '\n\n[... contenu tronqué]';
}

export async function summarizeSource(content: string, title?: string): Promise<string> {
  const truncated = truncateContent(content, 4000);
  const userPrompt = title
    ? `Titre : ${title}\n\n${truncated}`
    : truncated;
  return chatCompletion(PROMPTS.SUMMARIZE_SYSTEM, userPrompt, {
    model: 'gpt-4o-mini',
    maxTokens: 500,
  });
}

interface Classification {
  theme: string;
  postType: string;
}

export async function classifyContent(content: string, title: string): Promise<Classification> {
  const truncated = truncateContent(content, 2000);
  const result = await chatCompletion(
    PROMPTS.CLASSIFY_SYSTEM,
    `Title: ${title}\n\nContent:\n${truncated}`,
    { model: 'gpt-4o-mini', maxTokens: 50, temperature: 0.1 },
  );

  const validThemes = [
    'sport', 'adapted_sport', 'disability', 'maison_sport_sante',
    'public_health', 'inclusion', 'awareness_campaign', 'law_and_policy',
    'official_report', 'public_interest_event',
  ];
  const validTypes = [
    'informational', 'awareness', 'opinion', 'testimonial',
    'event_promotion', 'recap', 'call_to_action', 'educational',
  ];

  const cleaned = result.toLowerCase().trim();
  const parts = cleaned.split(/[,|\s\/]+/).map((p) => p.replace(/[^a-z_]/g, ''));

  const theme = parts.find((p) => validThemes.includes(p)) || 'public_health';
  const postType = parts.find((p) => validTypes.includes(p)) || 'informational';

  return { theme, postType };
}

// Keep old exports for backward compat
export async function classifyTheme(content: string, title: string): Promise<string> {
  const { theme } = await classifyContent(content, title);
  return theme;
}

export async function classifyPostType(content: string, title: string): Promise<string> {
  const { postType } = await classifyContent(content, title);
  return postType;
}

interface GeneratedPost {
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  confidence: number;
}

export async function generateLinkedInPost(
  content: string,
  theme: string,
  postType: string,
  sourceTitle: string,
  sourceUrl?: string,
): Promise<GeneratedPost> {
  const truncated = truncateContent(content);
  const urlLine = sourceUrl ? `\nURL source : ${sourceUrl}` : '';
  const contextBlock = await getActiveContextsCached();
  const result = await chatCompletion(
    PROMPTS.GENERATE_POST_SYSTEM + contextBlock,
    `Theme: ${theme}\nType: ${postType}\n\nTITRE SOURCE :\n${sourceTitle}${urlLine}\n\nContenu :\n${truncated}`,
    { model: 'gpt-4o', maxTokens: 800 },
  );
  return parseGeneratedPost(result);
}

export async function regeneratePost(
  content: string,
  theme: string,
  angle?: string,
  instructions?: string,
): Promise<GeneratedPost> {
  const truncated = truncateContent(content);
  const extra = [
    angle ? `Angle: ${angle}` : '',
    instructions ? `Instructions: ${instructions}` : '',
  ].filter(Boolean).join('\n');

  const contextBlock = await getActiveContextsCached();
  const result = await chatCompletion(
    PROMPTS.REGENERATE_POST_SYSTEM + contextBlock,
    `Theme: ${theme}\n${extra}\n\nContenu :\n${truncated}`,
    { model: 'gpt-4o', maxTokens: 800 },
  );
  return parseGeneratedPost(result);
}

export async function refinePost(
  currentPost: { title: string; hook: string; body: string; cta: string; hashtags: string[] },
  instructions: string,
): Promise<GeneratedPost> {
  const postJson = JSON.stringify(currentPost, null, 2);
  const contextBlock = await getActiveContextsCached();
  const result = await chatCompletion(
    PROMPTS.REFINE_POST_SYSTEM + contextBlock,
    `POST :\n${postJson}\n\nMODIFICATIONS :\n${instructions}`,
    { model: 'gpt-4o', maxTokens: 800 },
  );
  return parseGeneratedPost(result);
}

function parseGeneratedPost(raw: string): GeneratedPost {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || 'Untitled',
      hook: parsed.hook || '',
      body: parsed.body || '',
      cta: parsed.cta || '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 5) : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
    };
  } catch {
    return {
      title: 'Generated Post',
      hook: '',
      body: raw,
      cta: '',
      hashtags: [],
      confidence: 0.5,
    };
  }
}
