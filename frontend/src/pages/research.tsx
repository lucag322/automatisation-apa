import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Search, Sparkles, ExternalLink, ArrowRight, Brain,
  Globe, Rss, TrendingUp, ChevronDown, ChevronUp, CheckCircle2, X, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { themeLabels } from '@/lib/labels';
import type { Theme } from '@/types';

interface SuggestedArticle {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt: string | null;
  relevanceScore: number;
  relevanceReason: string;
  suggestedTheme: string;
}

interface ResearchResult {
  suggestions: SuggestedArticle[];
  queriesUsed: string[];
  sourcesScanned: number;
  feedsReached: string[];
  feedsFailed: string[];
  durationMs: number;
  searchDate: string;
}

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days <= 7) return `Il y a ${days}j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const QUICK_TOPICS = [
  { label: 'Sport-Santé', query: 'maison sport santé activité physique adaptée' },
  { label: 'Handicap & Inclusion', query: 'handicap inclusion accessibilité France' },
  { label: 'Handisport', query: 'handisport sport adapté paralympique' },
  { label: 'Santé publique', query: 'santé publique prévention sédentarité' },
  { label: 'Politique & lois', query: 'loi handicap politique inclusion accessibilité' },
  { label: 'APA', query: 'activité physique adaptée prescription sport santé' },
];

function getScoreColor(score: number) {
  if (score >= 75) return 'bg-green-100 text-green-800';
  if (score >= 55) return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-600';
}

function getScoreBar(score: number) {
  if (score >= 75) return 'bg-green-500';
  if (score >= 55) return 'bg-yellow-500';
  return 'bg-gray-400';
}

const CACHE_KEY = ['research-results'];

export function ResearchPage() {
  const queryClient = useQueryClient();
  const [customTopic, setCustomTopic] = useState('');
  const [showMeta, setShowMeta] = useState(false);

  const { data: cached } = useQuery<{
    results: ResearchResult;
    ingestedUrls: string[];
    dismissedUrls: string[];
  }>({
    queryKey: CACHE_KEY,
    queryFn: () => { throw new Error('no-fetch'); },
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const results = cached?.results ?? null;
  const ingestedUrls = new Set(cached?.ingestedUrls ?? []);
  const dismissedUrls = new Set(cached?.dismissedUrls ?? []);

  function updateCache(partial: Partial<{ results: ResearchResult; ingestedUrls: string[]; dismissedUrls: string[] }>) {
    const prev = queryClient.getQueryData<any>(CACHE_KEY) ?? { results: null, ingestedUrls: [], dismissedUrls: [] };
    queryClient.setQueryData(CACHE_KEY, { ...prev, ...partial });
  }

  const researchMutation = useMutation({
    mutationFn: (topic?: string) =>
      api.post<ResearchResult>('/research', { topic }),
    onSuccess: (data) => {
      updateCache({ results: data, ingestedUrls: [], dismissedUrls: [] });
      if (data.suggestions.length === 0) {
        toast.info('Aucun article pertinent trouvé. Essayez un autre sujet.');
      } else {
        toast.success(`${data.suggestions.length} articles pertinents trouvés`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ingestMutation = useMutation({
    mutationFn: (article: SuggestedArticle) =>
      api.post('/sources/scrape', {
        url: article.url,
        title: article.title,
        snippet: article.snippet,
        source_type: 'article',
      }),
    onSuccess: (_, article) => {
      toast.success(`"${article.title.substring(0, 50)}..." généré avec succès`);
      updateCache({ ingestedUrls: [...(cached?.ingestedUrls ?? []), article.url] });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function dismissArticle(url: string) {
    updateCache({ dismissedUrls: [...(cached?.dismissedUrls ?? []), url] });
  }

  function clearAllDismissed() {
    if (!results) return;
    const nonIngested = results.suggestions
      .filter((a) => !ingestedUrls.has(a.url))
      .map((a) => a.url);
    updateCache({ dismissedUrls: [...(cached?.dismissedUrls ?? []), ...nonIngested] });
  }

  function restoreDismissed() {
    updateCache({ dismissedUrls: [] });
  }

  function handleSearch(topic?: string) {
    researchMutation.mutate(topic);
  }

  const visibleSuggestions = results?.suggestions.filter((a) => !dismissedUrls.has(a.url)) ?? [];
  const dismissedCount = dismissedUrls.size;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          Recherche IA
        </h1>
        <p className="text-muted-foreground mt-1">
          L'agent IA explore le web pour trouver des articles pertinents à transformer en posts LinkedIn
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recherche personnalisée</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Ex: nouvelles Maisons Sport-Santé, JO Paris héritage handicap..."
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && customTopic.trim() && handleSearch(customTopic.trim())}
              className="flex-1"
            />
            <Button
              onClick={() => handleSearch(customTopic.trim() || undefined)}
              disabled={researchMutation.isPending}
            >
              {researchMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Rechercher
            </Button>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Recherches rapides :</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_TOPICS.map((topic) => (
                <Button
                  key={topic.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomTopic(topic.query);
                    handleSearch(topic.query);
                  }}
                  disabled={researchMutation.isPending}
                  className="text-xs"
                >
                  {topic.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {researchMutation.isPending && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="flex items-center gap-4 py-8">
            <div className="relative">
              <Brain className="h-10 w-10 text-blue-600 animate-pulse" />
              <Loader2 className="absolute -right-1 -bottom-1 h-5 w-5 text-blue-600 animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-blue-900">Agent IA en cours de recherche...</p>
              <div className="mt-2 space-y-1 text-sm text-blue-700">
                <p className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3" />
                  Génération des requêtes de recherche intelligentes
                </p>
                <p className="flex items-center gap-2">
                  <Globe className="h-3 w-3" />
                  Exploration de Google News et des flux RSS spécialisés
                </p>
                <p className="flex items-center gap-2">
                  <Rss className="h-3 w-3" />
                  Analyse et scoring des articles par pertinence
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-xl font-semibold">
                {visibleSuggestions.length} article{visibleSuggestions.length > 1 ? 's' : ''}
              </h2>
              <Badge variant="secondary" className="text-xs">
                {results.sourcesScanned} sources analysées en {(results.durationMs / 1000).toFixed(1)}s
              </Badge>
              <span className="text-xs text-muted-foreground">
                Recherche du {new Date(results.searchDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {visibleSuggestions.some((a) => !ingestedUrls.has(a.url)) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  onClick={clearAllDismissed}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Tout écarter
                </Button>
              )}
              {dismissedCount > 0 && (
                <Button variant="outline" size="sm" onClick={restoreDismissed}>
                  Restaurer ({dismissedCount})
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMeta(!showMeta)}
              >
                {showMeta ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                Détails
              </Button>
            </div>
          </div>

          {showMeta && (
            <Card className="bg-muted/50">
              <CardContent className="py-4 space-y-3 text-sm">
                <div>
                  <p className="font-medium mb-1">Requêtes utilisées :</p>
                  <div className="flex flex-wrap gap-1">
                    {results.queriesUsed.map((q, i) => (
                      <Badge key={i} variant="outline" className="text-xs font-normal">{q}</Badge>
                    ))}
                  </div>
                </div>
                {results.feedsReached.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Flux RSS atteints :</p>
                    <p className="text-muted-foreground">{results.feedsReached.join(', ')}</p>
                  </div>
                )}
                {results.feedsFailed.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Flux RSS indisponibles :</p>
                    <p className="text-muted-foreground">{results.feedsFailed.join(', ')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {visibleSuggestions.map((article, index) => {
              const isIngested = ingestedUrls.has(article.url);
              const themeLabel = themeLabels[article.suggestedTheme as Theme] || article.suggestedTheme;

              return (
                <Card key={index} className={isIngested ? 'border-green-200 bg-green-50/30' : ''}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center gap-1 pt-0.5">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${getScoreColor(article.relevanceScore)}`}>
                              {article.relevanceScore}
                            </div>
                            <div className="h-1 w-6 rounded-full bg-gray-200">
                              <div
                                className={`h-full rounded-full ${getScoreBar(article.relevanceScore)}`}
                                style={{ width: `${article.relevanceScore}%` }}
                              />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium leading-tight">{article.title}</h3>
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{article.snippet}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">{themeLabel}</Badge>
                              <span className="flex items-center gap-1">
                                <Rss className="h-3 w-3" />
                                {article.source}
                              </span>
                              {article.publishedAt && (
                                <span className={relativeDate(article.publishedAt) === "Aujourd'hui" ? 'font-medium text-green-700' : ''}>
                                  {relativeDate(article.publishedAt)}
                                </span>
                              )}
                              <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-foreground"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Voir l'article
                              </a>
                            </div>
                            {article.relevanceReason && (
                              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground italic">
                                <TrendingUp className="h-3 w-3 flex-shrink-0" />
                                {article.relevanceReason}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-2">
                        {isIngested ? (
                          <Button variant="outline" size="sm" disabled className="text-green-700">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Généré
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => ingestMutation.mutate(article)}
                              disabled={ingestMutation.isPending}
                            >
                              {ingestMutation.isPending && ingestMutation.variables?.url === article.url ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowRight className="mr-2 h-4 w-4" />
                              )}
                              Générer
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                              onClick={() => dismissArticle(article.url)}
                              title="Écarter cet article"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {visibleSuggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="mb-4 h-12 w-12" />
              <p className="text-lg font-medium">
                {dismissedCount > 0 ? 'Tous les articles ont été écartés' : 'Aucun article pertinent trouvé'}
              </p>
              <p className="text-sm">
                {dismissedCount > 0 ? (
                  <Button variant="link" className="p-0 h-auto" onClick={restoreDismissed}>
                    Restaurer les {dismissedCount} article{dismissedCount > 1 ? 's' : ''} écarté{dismissedCount > 1 ? 's' : ''}
                  </Button>
                ) : (
                  "Essayez d'affiner votre recherche ou de changer de sujet"
                )}
              </p>
            </div>
          )}
        </>
      )}

      {!results && !researchMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Brain className="mb-4 h-16 w-16 opacity-30" />
          <p className="text-lg font-medium">Lancez une recherche pour commencer</p>
          <p className="text-sm mt-1">L'agent IA va explorer Google News et des flux RSS spécialisés</p>
          <p className="text-sm">pour trouver les meilleurs articles sur vos thématiques</p>
          <Separator className="my-6 w-48" />
          <div className="grid grid-cols-3 gap-6 text-center text-xs">
            <div>
              <Globe className="mx-auto mb-2 h-6 w-6" />
              <p>Google News</p>
              <p className="text-muted-foreground/60">Actualités web</p>
            </div>
            <div>
              <Rss className="mx-auto mb-2 h-6 w-6" />
              <p>Flux RSS</p>
              <p className="text-muted-foreground/60">Sources spécialisées</p>
            </div>
            <div>
              <Sparkles className="mx-auto mb-2 h-6 w-6" />
              <p>Scoring IA</p>
              <p className="text-muted-foreground/60">Filtrage intelligent</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
