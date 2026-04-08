import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, Calendar, Tag, Star, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { statusColors, statusLabels, themeLabels, postTypeLabels, formatDate } from '@/lib/labels';
import type { ContentItem, PaginatedResponse, ContentStatus, Theme, PostType } from '@/types';

const STATUSES: ContentStatus[] = ['draft', 'to_review', 'approved', 'rejected', 'published'];
const THEMES: Theme[] = [
  'sport', 'adapted_sport', 'disability', 'maison_sport_sante', 'public_health',
  'inclusion', 'awareness_campaign', 'law_and_policy', 'official_report', 'public_interest_event',
];
const POST_TYPES: PostType[] = [
  'informational', 'awareness', 'opinion', 'testimonial', 'event_promotion', 'recap', 'call_to_action', 'educational',
];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Plus récent' },
  { value: 'oldest', label: 'Plus ancien' },
  { value: 'priority', label: 'Priorité haute' },
  { value: 'score', label: 'Meilleur score' },
  { value: 'review_first', label: 'À relire en premier' },
];

export function ContentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>('');
  const [theme, setTheme] = useState<string>('');
  const [postType, setPostType] = useState<string>('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contents/${id}`),
    onSuccess: () => {
      toast.success('Contenu supprimé');
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (theme) params.set('theme', theme);
  if (postType) params.set('postType', postType);
  params.set('sort', sort);
  params.set('page', String(page));
  params.set('limit', '20');

  const { data, isLoading } = useQuery({
    queryKey: ['contents', status, theme, postType, sort, page],
    queryFn: () => api.get<PaginatedResponse<ContentItem>>(`/contents?${params.toString()}`),
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contenus</h1>
        <p className="text-muted-foreground">Parcourir et gérer les contenus éditoriaux</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={theme} onValueChange={(v) => { setTheme(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tous les thèmes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les thèmes</SelectItem>
            {THEMES.map((t) => (
              <SelectItem key={t} value={t}>{themeLabels[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={postType} onValueChange={(v) => { setPostType(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {POST_TYPES.map((p) => (
              <SelectItem key={p} value={p}>{postTypeLabels[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Search className="mb-4 h-12 w-12" />
          <p className="text-lg font-medium">Aucun contenu trouvé</p>
          <p className="text-sm">Essayez de modifier vos filtres</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => navigate(`/contents/${item.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-2">
                    <h3 className="min-w-0 flex-1 line-clamp-2 text-sm font-semibold leading-tight">
                      {item.title}
                    </h3>
                    <Badge className={`shrink-0 ${statusColors[item.status]}`} variant="secondary">
                      {statusLabels[item.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  {item.hook && (
                    <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{item.hook}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs">
                      <Tag className="mr-1 h-3 w-3" />
                      {themeLabels[item.theme]}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {postTypeLabels[item.postType]}
                    </Badge>
                    {item.source && (
                      <Badge variant="outline" className="text-xs">
                        {item.source.sourceType}
                      </Badge>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(item.targetPublishDate || item.createdAt)}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {item.priorityScore.toFixed(1)}
                        {item.aiConfidence !== null && (
                          <span className="ml-1">({(item.aiConfidence * 100).toFixed(0)}%)</span>
                        )}
                      </div>
                      {item.status === 'rejected' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:bg-red-100 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Supprimer définitivement ce contenu ?')) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.page} sur {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Suivant
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
