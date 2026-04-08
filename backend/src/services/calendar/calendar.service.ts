import { generateLinkedInPost } from '../openai/openai.service';
import { prisma } from '../../lib/prisma';
import type { SourceType } from '@prisma/client';
import crypto from 'crypto';

export interface CalendarEvent {
  name: string;
  date: string;
  description: string;
  themes: string[];
}

const KNOWN_EVENTS: CalendarEvent[] = [
  // --- January ---
  { name: "Journée mondiale du braille", date: "01-04", description: "Sensibilisation à l'écriture braille et à l'accessibilité pour les personnes aveugles et malvoyantes.", themes: ["disability", "inclusion"] },
  { name: "Journée mondiale de la lèpre", date: "01-28", description: "Sensibilisation à la lèpre et lutte contre les stigmatisations.", themes: ["public_health", "awareness_campaign"] },
  // --- February ---
  { name: "Journée mondiale contre le cancer", date: "02-04", description: "Mobilisation mondiale pour la prévention, le dépistage et la lutte contre le cancer.", themes: ["public_health", "awareness_campaign"] },
  { name: "Journée internationale de l'épilepsie", date: "02-10", description: "Sensibilisation à l'épilepsie et soutien aux personnes touchées.", themes: ["public_health", "disability"] },
  { name: "Journée mondiale des maladies rares", date: "02-28", description: "Visibilité et soutien pour les personnes atteintes de maladies rares.", themes: ["public_health", "inclusion"] },
  // --- March ---
  { name: "Journée mondiale de l'audition", date: "03-03", description: "Prévention de la perte auditive et promotion de la santé de l'oreille.", themes: ["public_health", "disability"] },
  { name: "Journée internationale des droits des femmes", date: "03-08", description: "Égalité des genres, droits des femmes dans le sport et la santé.", themes: ["inclusion", "awareness_campaign"] },
  { name: "Journée mondiale de la trisomie 21", date: "03-21", description: "Sensibilisation au syndrome de Down et inclusion des personnes porteuses.", themes: ["disability", "inclusion"] },
  // --- April ---
  { name: "Journée mondiale de sensibilisation à l'autisme", date: "04-02", description: "Compréhension de l'autisme et inclusion des personnes autistes dans la société et le sport.", themes: ["disability", "inclusion", "adapted_sport"] },
  { name: "Journée mondiale de la santé", date: "04-07", description: "Santé pour tous : accès aux soins, prévention, activité physique.", themes: ["public_health", "maison_sport_sante"] },
  { name: "Journée mondiale de la maladie de Parkinson", date: "04-11", description: "Sensibilisation à Parkinson, rôle de l'activité physique adaptée.", themes: ["public_health", "adapted_sport"] },
  // --- May ---
  { name: "Journée mondiale de l'asthme", date: "05-07", description: "Prévention et gestion de l'asthme, sport et asthme.", themes: ["public_health", "sport"] },
  { name: "Journée mondiale de la fibromyalgie", date: "05-12", description: "Sensibilisation à la fibromyalgie et importance de l'activité physique adaptée.", themes: ["public_health", "adapted_sport"] },
  { name: "Journée mondiale de l'accessibilité", date: "05-16", description: "Accessibilité numérique et physique pour les personnes en situation de handicap.", themes: ["disability", "inclusion"] },
  { name: "Semaine européenne du sport", date: "05-23", description: "Promouvoir le sport et l'activité physique en Europe.", themes: ["sport", "public_health"] },
  // --- June ---
  { name: "Journée mondiale de la sclérose en plaques", date: "06-01", description: "Sensibilisation à la SEP, sport adapté et qualité de vie.", themes: ["public_health", "adapted_sport", "disability"] },
  { name: "Journée mondiale des donneurs de sang", date: "06-14", description: "Importance du don de sang pour la santé publique.", themes: ["public_health", "awareness_campaign"] },
  { name: "Journée olympique", date: "06-23", description: "Célébration de l'olympisme, du sport et de ses valeurs.", themes: ["sport", "inclusion"] },
  // --- July ---
  { name: "Journée mondiale du sport pour le développement et la paix", date: "07-06", description: "Le sport comme outil de développement social, de paix et d'inclusion.", themes: ["sport", "inclusion"] },
  // --- August ---
  { name: "Journée mondiale du chat", date: "08-08", description: "Bien-être animal et thérapie animale en santé.", themes: ["public_health"] },
  // --- September ---
  { name: "Journée mondiale de la prévention du suicide", date: "09-10", description: "Prévention du suicide et santé mentale, rôle du sport.", themes: ["public_health", "sport"] },
  { name: "Journée mondiale de la maladie d'Alzheimer", date: "09-21", description: "Sensibilisation à Alzheimer, activité physique et prévention cognitive.", themes: ["public_health", "adapted_sport"] },
  { name: "Journée mondiale du cœur", date: "09-29", description: "Prévention des maladies cardiovasculaires par le sport et l'hygiène de vie.", themes: ["public_health", "sport", "maison_sport_sante"] },
  // --- October ---
  { name: "Octobre Rose - Mois de sensibilisation au cancer du sein", date: "10-01", description: "Campagne mondiale de sensibilisation au dépistage du cancer du sein et à l'activité physique en prévention.", themes: ["public_health", "awareness_campaign", "sport"] },
  { name: "Journée mondiale de la santé mentale", date: "10-10", description: "Santé mentale, bien-être psychologique et sport.", themes: ["public_health", "sport"] },
  { name: "Journée mondiale de la vue", date: "10-12", description: "Prévention de la cécité et handicap visuel.", themes: ["public_health", "disability"] },
  { name: "Journée mondiale du refus de la misère", date: "10-17", description: "Lutte contre la pauvreté et accès au sport pour tous.", themes: ["inclusion", "sport"] },
  // --- November ---
  { name: "Movember - Mois de la santé masculine", date: "11-01", description: "Sensibilisation au cancer de la prostate, santé mentale masculine et sport.", themes: ["public_health", "awareness_campaign", "sport"] },
  { name: "Journée mondiale du diabète", date: "11-14", description: "Prévention du diabète par l'activité physique et l'alimentation.", themes: ["public_health", "sport", "maison_sport_sante"] },
  { name: "Semaine européenne pour l'emploi des personnes handicapées", date: "11-18", description: "Emploi, inclusion professionnelle et handicap.", themes: ["disability", "inclusion"] },
  { name: "Journée mondiale de lutte contre les violences faites aux femmes", date: "11-25", description: "Lutte contre les violences et sport comme outil de résilience.", themes: ["inclusion", "awareness_campaign"] },
  // --- December ---
  { name: "Journée mondiale de lutte contre le sida", date: "12-01", description: "Prévention VIH/SIDA et santé publique.", themes: ["public_health", "awareness_campaign"] },
  { name: "Journée internationale des personnes handicapées", date: "12-03", description: "Droits, inclusion et sport adapté pour les personnes en situation de handicap.", themes: ["disability", "inclusion", "adapted_sport"] },
  { name: "Journée mondiale de la Couverture Santé Universelle", date: "12-12", description: "Accès universel aux soins de santé.", themes: ["public_health", "law_and_policy"] },
  { name: "Téléthon", date: "12-06", description: "Collecte pour la recherche sur les maladies rares et neuromusculaires, sport adapté.", themes: ["disability", "awareness_campaign", "adapted_sport"] },
];

function parseDate(mmdd: string, year: number): Date {
  const [month, day] = mmdd.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getEventsInRange(startDate: string, endDate: string): (CalendarEvent & { fullDate: string })[] {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const results: (CalendarEvent & { fullDate: string })[] = [];

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  for (let year = startYear; year <= endYear; year++) {
    for (const event of KNOWN_EVENTS) {
      const eventDate = parseDate(event.date, year);
      if (eventDate >= start && eventDate <= end) {
        results.push({
          ...event,
          fullDate: eventDate.toISOString().split('T')[0],
        });
      }
    }
  }

  results.sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  return results;
}

export async function discoverAdditionalEvents(
  startDate: string,
  endDate: string,
  existingNames: string[],
): Promise<(CalendarEvent & { fullDate: string })[]> {
  const { default: OpenAI } = await import('openai');
  const { getEnv } = await import('../../lib/env');
  const client = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 2000,
    messages: [
      {
        role: 'system',
        content: `Expert en journées mondiales/nationales santé, sport, handicap, inclusion, APA.
Trouve les événements dans la période donnée. Exclure : ${existingNames.join(', ')}
JSON uniquement : [{"name":"...","date":"YYYY-MM-DD","description":"...","themes":["..."]}]
Thèmes : sport, adapted_sport, disability, maison_sport_sante, public_health, inclusion, awareness_campaign, law_and_policy, official_report, public_interest_event`,
      },
      {
        role: 'user',
        content: `Trouve les événements entre ${startDate} et ${endDate}.`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() || '[]';
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e: any) => e.name && e.date && e.description)
      .map((e: any) => ({
        name: e.name,
        date: e.date.substring(5),
        description: e.description,
        themes: Array.isArray(e.themes) ? e.themes : ['public_health'],
        fullDate: e.date,
      }));
  } catch {
    return [];
  }
}

export async function generatePostForEvent(event: CalendarEvent & { fullDate: string }) {
  const content = `Événement : ${event.name}\nDate : ${event.fullDate}\nDescription : ${event.description}\nThèmes : ${event.themes.join(', ')}`;
  const title = event.name;

  const theme = event.themes[0] || 'public_health';
  const postType = 'event_promotion';

  const post = await generateLinkedInPost(content, theme, postType, title);

  const contentHash = crypto
    .createHash('sha256')
    .update(`calendar::${event.name}::${event.fullDate}`)
    .digest('hex');

  const existing = await prisma.source.findUnique({ where: { contentHash } });
  if (existing) {
    return { alreadyExists: true, sourceId: existing.id };
  }

  const source = await prisma.source.create({
    data: {
      url: `https://www.google.com/search?q=${encodeURIComponent(event.name + ' ' + event.fullDate)}`,
      title: event.name,
      rawContent: content,
      summary: event.description,
      sourceType: 'event' as SourceType,
      publishedAt: new Date(event.fullDate),
      contentHash,
    },
  });

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
        priorityScore: 7,
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
