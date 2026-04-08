import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, Loader2, Sparkles, CheckCircle2, Calendar as CalendarIcon,
  Search, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface CalendarEvent {
  name: string;
  date: string;
  fullDate: string;
  description: string;
  themes: string[];
}

interface CalendarResponse {
  known: CalendarEvent[];
  discovered: CalendarEvent[];
  total: number;
}

const themeLabels: Record<string, string> = {
  sport: 'Sport',
  adapted_sport: 'Sport adapté',
  disability: 'Handicap',
  maison_sport_sante: 'Maison Sport-Santé',
  public_health: 'Santé publique',
  inclusion: 'Inclusion',
  awareness_campaign: 'Sensibilisation',
  law_and_policy: 'Loi & politique',
  official_report: 'Rapport officiel',
  public_interest_event: 'Événement d\'intérêt public',
};

const themeColors: Record<string, string> = {
  sport: 'bg-blue-100 text-blue-800',
  adapted_sport: 'bg-purple-100 text-purple-800',
  disability: 'bg-orange-100 text-orange-800',
  maison_sport_sante: 'bg-green-100 text-green-800',
  public_health: 'bg-red-100 text-red-800',
  inclusion: 'bg-teal-100 text-teal-800',
  awareness_campaign: 'bg-pink-100 text-pink-800',
  law_and_policy: 'bg-gray-100 text-gray-800',
};

function formatEventDate(fullDate: string): string {
  return new Date(fullDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDefaultRange(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: now,
    end: new Date(now.getFullYear(), now.getMonth() + 2, 0),
  };
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function isEventPast(fullDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(fullDate) < today;
}

function isEventToday(fullDate: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return fullDate === today;
}

export function CalendarPage() {
  const queryClient = useQueryClient();
  const defaults = getDefaultRange();
  const [startDate, setStartDate] = useState<Date | undefined>(defaults.start);
  const [endDate, setEndDate] = useState<Date | undefined>(defaults.end);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [discoveredEvents, setDiscoveredEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [generatedEvents, setGeneratedEvents] = useState<Set<string>>(new Set());

  async function fetchEvents(discover = false) {
    if (!startDate || !endDate) return;
    if (discover) setDiscovering(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        startDate: toISODate(startDate),
        endDate: toISODate(endDate),
        discover: String(discover),
      });
      const data = await api.get<CalendarResponse>(`/calendar/events?${params}`);
      setEvents(data.known);
      if (discover) {
        setDiscoveredEvents(data.discovered);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
      setDiscovering(false);
    }
  }

  const generateMutation = useMutation({
    mutationFn: (event: CalendarEvent) =>
      api.post('/calendar/generate', event),
    onSuccess: (result: any, event) => {
      if (result.alreadyExists) {
        toast.info(`"${event.name}" a déjà été généré.`);
      } else {
        toast.success(`Post généré pour "${event.name}"`);
        queryClient.invalidateQueries({ queryKey: ['contents'] });
        queryClient.invalidateQueries({ queryKey: ['sources'] });
      }
      setGeneratedEvents((prev) => new Set([...prev, event.name + event.fullDate]));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateAllMutation = useMutation({
    mutationFn: async (eventList: CalendarEvent[]) => {
      const results = [];
      for (const event of eventList) {
        const key = event.name + event.fullDate;
        if (generatedEvents.has(key)) continue;
        const result = await api.post('/calendar/generate', event);
        results.push({ event, result });
        setGeneratedEvents((prev) => new Set([...prev, key]));
      }
      return results;
    },
    onSuccess: (results) => {
      const created = results.filter((r: any) => !r.result.alreadyExists).length;
      const skipped = results.filter((r: any) => r.result.alreadyExists).length;
      let msg = `${created} post(s) généré(s)`;
      if (skipped > 0) msg += `, ${skipped} déjà existant(s)`;
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allEvents = [...(events || []), ...discoveredEvents];
  const futureEvents = allEvents.filter((e) => !isEventPast(e.fullDate) || isEventToday(e.fullDate));
  const ungeneratedEvents = futureEvents.filter(
    (e) => !generatedEvents.has(e.name + e.fullDate),
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-8 w-8" />
          Calendrier éditorial
        </h1>
        <p className="text-muted-foreground">
          Découvrez les journées mondiales et événements clés, puis générez des posts LinkedIn pour chacun
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sélectionner une période</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-56 space-y-1">
              <Label>Date de début</Label>
              <DatePicker
                date={startDate}
                onSelect={setStartDate}
                placeholder="Début"
              />
            </div>
            <div className="w-56 space-y-1">
              <Label>Date de fin</Label>
              <DatePicker
                date={endDate}
                onSelect={setEndDate}
                placeholder="Fin"
              />
            </div>
            <Button onClick={() => fetchEvents(false)} disabled={loading || !startDate || !endDate}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement...</>
              ) : (
                <><Search className="mr-2 h-4 w-4" /> Rechercher</>
              )}
            </Button>
            {events !== null && (
              <Button
                variant="outline"
                onClick={() => fetchEvents(true)}
                disabled={discovering}
              >
                {discovering ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Découverte IA...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Découvrir plus avec l'IA</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {events !== null && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {allEvents.length} événement(s) trouvé(s)
              {discoveredEvents.length > 0 && ` dont ${discoveredEvents.length} découvert(s) par l'IA`}
            </p>
            {ungeneratedEvents.length > 1 && (
              <Button
                onClick={() => generateAllMutation.mutate(ungeneratedEvents)}
                disabled={generateAllMutation.isPending}
              >
                {generateAllMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Génération en cours...</>
                ) : (
                  <>Tout générer ({ungeneratedEvents.length})</>
                )}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {allEvents.map((event) => {
              const key = event.name + event.fullDate;
              const isGenerated = generatedEvents.has(key);
              const past = isEventPast(event.fullDate) && !isEventToday(event.fullDate);
              const today = isEventToday(event.fullDate);
              const isDiscovered = discoveredEvents.includes(event);

              return (
                <Card
                  key={key}
                  className={`transition-all ${past ? 'opacity-50' : ''} ${today ? 'ring-2 ring-primary' : ''} ${isGenerated ? 'bg-green-50/50' : ''}`}
                >
                  <CardContent className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{event.name}</h3>
                        {isDiscovered && (
                          <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-xs">
                            <Sparkles className="mr-1 h-3 w-3" /> IA
                          </Badge>
                        )}
                        {today && (
                          <Badge className="bg-primary text-primary-foreground text-xs">
                            Aujourd'hui
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarIcon className="h-4 w-4 shrink-0" />
                        <span className="capitalize">{formatEventDate(event.fullDate)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {event.themes.map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className={`text-xs ${themeColors[t] || 'bg-gray-100 text-gray-700'}`}
                          >
                            {themeLabels[t] || t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isGenerated ? (
                        <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          Généré
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => generateMutation.mutate(event)}
                          disabled={generateMutation.isPending || past}
                        >
                          {generateMutation.isPending &&
                           generateMutation.variables?.name === event.name ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <ChevronRight className="mr-1 h-4 w-4" />
                          )}
                          Générer
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {events !== null && allEvents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <CalendarDays className="mb-4 h-12 w-12" />
          <p className="text-lg font-medium">Aucun événement trouvé dans cette période</p>
          <p className="text-sm">Essayez une plage de dates plus large ou utilisez la découverte IA</p>
        </div>
      )}
    </div>
  );
}
