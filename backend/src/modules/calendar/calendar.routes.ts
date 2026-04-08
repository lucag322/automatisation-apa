import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { calendarQuerySchema, generateEventPostSchema } from './calendar.schema';
import {
  getEventsInRange,
  discoverAdditionalEvents,
  generatePostForEvent,
} from '../../services/calendar/calendar.service';
import { prisma } from '../../lib/prisma';

function eventContentHash(name: string, fullDate: string): string {
  return crypto.createHash('sha256').update(`calendar::${name}::${fullDate}`).digest('hex');
}

export async function calendarRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/api/calendar/events', async (request) => {
    const { startDate, endDate, discover } = calendarQuerySchema.parse(request.query);
    const knownEvents = getEventsInRange(startDate, endDate);

    let discovered: Awaited<ReturnType<typeof discoverAdditionalEvents>> = [];
    if (discover) {
      const existingNames = knownEvents.map((e) => e.name);
      discovered = await discoverAdditionalEvents(startDate, endDate, existingNames);
    }

    const allEvents = [...knownEvents, ...discovered];
    const hashes = allEvents.map((e) => eventContentHash(e.name, e.fullDate));
    const existingSources = await prisma.source.findMany({
      where: { contentHash: { in: hashes } },
      select: { contentHash: true },
    });
    const generatedHashes = new Set(existingSources.map((s) => s.contentHash));

    function markGenerated<T extends { name: string; fullDate: string }>(events: T[]) {
      return events.map((e) => ({
        ...e,
        generated: generatedHashes.has(eventContentHash(e.name, e.fullDate)),
      }));
    }

    return {
      known: markGenerated(knownEvents),
      discovered: markGenerated(discovered),
      total: knownEvents.length + discovered.length,
    };
  });

  app.post('/api/calendar/generate', async (request) => {
    const event = generateEventPostSchema.parse(request.body);
    return generatePostForEvent(event);
  });
}
