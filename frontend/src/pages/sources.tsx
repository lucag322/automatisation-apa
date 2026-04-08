import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ExternalLink, RotateCcw, Database, Plus, Globe, FileText, Sparkles, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { sourceTypeLabels, formatDate } from '@/lib/labels';
import type { Source, PaginatedResponse, SourceType } from '@/types';

const SOURCE_TYPES: SourceType[] = [
  'article', 'report', 'study', 'law', 'event', 'announcement',
  'campaign', 'press_release', 'official_document', 'other',
];

export function SourcesPage() {
  const queryClient = useQueryClient();
  const [sourceType, setSourceType] = useState<string>('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ingestTab, setIngestTab] = useState<string>('url');

  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [typeInput, setTypeInput] = useState('article');

  const params = new URLSearchParams();
  if (sourceType) params.set('sourceType', sourceType);
  params.set('page', String(page));
  params.set('limit', '20');

  const { data, isLoading } = useQuery({
    queryKey: ['sources', sourceType, page],
    queryFn: () => api.get<PaginatedResponse<Source>>(`/sources?${params.toString()}`),
  });

  const scrapeMutation = useMutation({
    mutationFn: (payload: { url: string; title?: string; source_type?: string }) =>
      api.post('/sources/scrape', payload),
    onSuccess: () => {
      toast.success('Source ajoutée et contenu généré avec succès');
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      resetForm();
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const manualIngestMutation = useMutation({
    mutationFn: (payload: { url: string; title: string; content: string; source_type?: string }) =>
      api.post('/ingest', payload),
    onSuccess: () => {
      toast.success('Source ajoutée et contenu généré avec succès');
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      resetForm();
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sources/${id}/reprocess`),
    onSuccess: () => {
      toast.success('Source retraitée, nouveau contenu créé');
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sources/${id}`),
    onSuccess: () => {
      toast.success('Source et contenus associés supprimés');
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetForm() {
    setUrlInput('');
    setTitleInput('');
    setContentInput('');
    setTypeInput('article');
  }

  function handleSubmit() {
    if (ingestTab === 'url') {
      if (!urlInput.trim()) {
        toast.error('Veuillez saisir une URL');
        return;
      }
      scrapeMutation.mutate({
        url: urlInput.trim(),
        title: titleInput.trim() || undefined,
        source_type: typeInput,
      });
    } else {
      if (!urlInput.trim() || !titleInput.trim() || !contentInput.trim()) {
        toast.error('Veuillez remplir tous les champs obligatoires');
        return;
      }
      manualIngestMutation.mutate({
        url: urlInput.trim(),
        title: titleInput.trim(),
        content: contentInput.trim(),
        source_type: typeInput,
      });
    }
  }

  const isSubmitting = scrapeMutation.isPending || manualIngestMutation.isPending;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sources</h1>
          <p className="text-muted-foreground">Sources ajoutées et leurs métadonnées</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une source
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter une source</DialogTitle>
            <DialogDescription>
              Ajoutez une nouvelle source pour générer automatiquement un article LinkedIn via l'IA.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={ingestTab} onValueChange={setIngestTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="url" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Depuis une URL
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Saisie manuelle
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">URL de l'article *</Label>
                <Input
                  id="url"
                  placeholder="https://example.com/article..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Le contenu sera automatiquement extrait de la page web
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title-url">Titre (optionnel)</Label>
                <Input
                  id="title-url"
                  placeholder="Sera extrait automatiquement si non renseigné"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Type de source</Label>
                <Select value={typeInput} onValueChange={setTypeInput}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{sourceTypeLabels[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url-manual">URL de référence *</Label>
                <Input
                  id="url-manual"
                  placeholder="https://example.com/article..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title-manual">Titre *</Label>
                <Input
                  id="title-manual"
                  placeholder="Titre de l'article ou de la source"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Contenu *</Label>
                <Textarea
                  id="content"
                  placeholder="Collez ici le contenu de l'article..."
                  value={contentInput}
                  onChange={(e) => setContentInput(e.target.value)}
                  rows={8}
                />
              </div>
              <div className="space-y-2">
                <Label>Type de source</Label>
                <Select value={typeInput} onValueChange={setTypeInput}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{sourceTypeLabels[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Traitement IA en cours...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Générer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3">
        <Select value={sourceType} onValueChange={(v) => { setSourceType(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {SOURCE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{sourceTypeLabels[t]}</SelectItem>
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
          <Database className="mb-4 h-12 w-12" />
          <p className="text-lg font-medium">Aucune source trouvée</p>
          <p className="text-sm">Cliquez sur "Ajouter une source" pour commencer</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {data.items.map((source) => (
              <Card key={source.id}>
                <CardContent className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-medium">{source.title}</h3>
                      <Badge variant="outline">{sourceTypeLabels[source.sourceType]}</Badge>
                    </div>
                    {source.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{source.summary}</p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      {source.url.startsWith('http') && (
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
                          <ExternalLink className="h-3 w-3" /> URL source
                        </a>
                      )}
                      <span>Ajouté le : {formatDate(source.createdAt)}</span>
                      {source.publishedAt && <span>Publié le : {formatDate(source.publishedAt)}</span>}
                      {source._count && <span>{source._count.contentItems} contenu(s)</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reprocessMutation.mutate(source.id)}
                      disabled={reprocessMutation.isPending}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Retraiter
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        if (confirm('Supprimer cette source et tous ses contenus associés ?')) {
                          deleteMutation.mutate(source.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.page} sur {data.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                Suivant
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
