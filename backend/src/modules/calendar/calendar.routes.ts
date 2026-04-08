import type { FastifyInstance } from 'fastify';
import { calendarQuerySchema, generateEventPostSchema } from './calendar.schema';
import {
  getEventsInRange,
  discoverAdditionalEvents,
  generatePostForEvent,
} from '../../services/calendar/calendar.service';

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

    return {
      known: knownEvents,
      discovered,
      total: knownEvents.length + discovered.length,
    };
  });

  app.post('/api/calendar/generate', async (request) => {
    const event = generateEventPostSchema.parse(request.body);
    return generatePostForEvent(event);
  });
}
