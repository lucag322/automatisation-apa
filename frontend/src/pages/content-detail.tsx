import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, ArrowLeft, Save, CheckCircle2, XCircle, Eye, RotateCcw,
  Copy, Send, Clipboard, ExternalLink, Clock, ChevronDown, ChevronUp, Trash2, ClipboardCopy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { TiptapEditor } from '@/components/tiptap-editor';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import {
  statusColors, statusLabels, themeLabels, postTypeLabels,
  formatDate, formatDateTime,
} from '@/lib/labels';
import type { ContentItem, Theme, PostType } from '@/types';

const THEMES: Theme[] = [
  'sport', 'adapted_sport', 'disability', 'maison_sport_sante', 'public_health',
  'inclusion', 'awareness_campaign', 'law_and_policy', 'official_report', 'public_interest_event',
];
const POST_TYPES: PostType[] = [
  'informational', 'awareness', 'opinion', 'testimonial', 'event_promotion', 'recap', 'call_to_action', 'educational',
];

export function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [hook, setHook] = useState('');
  const [body, setBody] = useState('');
  const [cta, setCta] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [theme, setTheme] = useState<string>('');
  const [postType, setPostType] = useState<string>('');
  const [persona, setPersona] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [showRawContent, setShowRawContent] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateAngle, setRegenerateAngle] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ['content', id],
    queryFn: () => api.get<ContentItem>(`/contents/${id}`),
    enabled: !!id,
  });

  if (item && !initialized) {
    setTitle(item.title);
    setHook(item.hook || '');
    setBody(item.body);
    setCta(item.cta || '');
    setHashtags(item.hashtags.join(', '));
    setTheme(item.theme);
    setPostType(item.postType);
    setPersona(item.persona || '');
    setInitialized(true);
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['content', id] });
    queryClient.invalidateQueries({ queryKey: ['contents'] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/contents/${id}`, {
        title, hook, body, cta, theme, postType, persona,
        hashtags: hashtags.split(',').map((h) => h.trim()).filter(Boolean),
      }),
    onSuccess: () => { toast.success('Contenu enregistré'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/contents/${id}/status`, { status }),
    onSuccess: () => { toast.success('Statut mis à jour'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => api.post(`/contents/${id}/regenerate`, { angle: regenerateAngle || undefined }),
    onSuccess: () => {
      toast.success('Contenu régénéré');
      setInitialized(false);
      setRegenerateOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => api.post<ContentItem>(`/contents/${id}/duplicate`),
    onSuccess: (data) => {
      toast.success('Contenu dupliqué');
      navigate(`/contents/${data.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/contents/${id}`),
    onSuccess: () => {
      toast.success('Contenu supprimé');
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/contents');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => api.post(`/contents/${id}/versions/${versionId}/restore`),
    onSuccess: () => {
      toast.success('Version restaurée');
      setInitialized(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyToClipboard = () => {
    const text = [
      hook,
      '',
      body.replace(/<[^>]+>/g, ''),
      '',
      cta,
      '',
      hashtags.split(',').map((h) => h.trim()).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' '),
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papiers');
  };

  const copyField = (value: string, label: string) => {
    const text = value.replace(/<[^>]+>/g, '');
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Contenu introuvable</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/contents')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Modifier le contenu</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge className={statusColors[item.status]} variant="secondary">
              {statusLabels[item.status]}
            </Badge>
            {item.aiConfidence !== null && (
              <span className="text-xs text-muted-foreground">
                Confiance IA : {(item.aiConfidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            <Clipboard className="mr-2 h-4 w-4" />
            Copier
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Titre</Label>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyField(title, 'Titre')}>
                    <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Accroche</Label>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyField(hook, 'Accroche')}>
                    <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <Textarea value={hook} onChange={(e) => setHook(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Corps du texte</Label>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyField(body, 'Corps du texte')}>
                    <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <TiptapEditor content={body} onChange={setBody} placeholder="Rédigez le contenu du post..." />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Appel à l'action</Label>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyField(cta, 'Appel à l\'action')}>
                    <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <Input value={cta} onChange={(e) => setCta(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Hashtags (séparés par des virgules)</Label>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyField(hashtags, 'Hashtags')}>
                    <ClipboardCopy className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Thème</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {THEMES.map((t) => (
                        <SelectItem key={t} value={t}>{themeLabels[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type de post</Label>
                  <Select value={postType} onValueChange={setPostType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {POST_TYPES.map((p) => (
                        <SelectItem key={p} value={p}>{postTypeLabels[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Persona cible</Label>
                <Input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Ex. : Professionnels de santé" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {item.status !== 'to_review' && (
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => statusMutation.mutate('to_review')}>
                  <Eye className="mr-2 h-4 w-4" /> Passer en relecture
                </Button>
              )}
              {item.status !== 'approved' && (
                <Button variant="outline" size="sm" className="w-full justify-start text-green-600" onClick={() => statusMutation.mutate('approved')}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approuver
                </Button>
              )}
              {item.status !== 'rejected' && (
                <Button variant="outline" size="sm" className="w-full justify-start text-red-600" onClick={() => statusMutation.mutate('rejected')}>
                  <XCircle className="mr-2 h-4 w-4" /> Rejeter
                </Button>
              )}
              {item.status !== 'published' && (
                <Button variant="outline" size="sm" className="w-full justify-start text-blue-600" onClick={() => statusMutation.mutate('published')}>
                  <Send className="mr-2 h-4 w-4" /> Marquer comme publié
                </Button>
              )}
              <Separator />
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setRegenerateOpen(true)}>
                <RotateCcw className="mr-2 h-4 w-4" /> Régénérer avec l'IA
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => duplicateMutation.mutate()}>
                <Copy className="mr-2 h-4 w-4" /> Dupliquer
              </Button>
              {item.status === 'rejected' && (
                <>
                  <Separator />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {item.source && (
            <Card>
              <CardHeader><CardTitle className="text-base">Source</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{item.source.title}</p>
                <a href={item.source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Voir la source
                </a>
                <Badge variant="outline">{item.source.sourceType}</Badge>
                {'rawContent' in item.source && (
                  <div className="pt-2">
                    <button
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setShowRawContent(!showRawContent)}
                    >
                      {showRawContent ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Contenu brut
                    </button>
                    {showRawContent && (
                      <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted p-3 text-xs">
                        {(item.source as any).rawContent}
                      </pre>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Métadonnées</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Créé le :</span> {formatDateTime(item.createdAt)}</p>
              <p><span className="text-muted-foreground">Modifié le :</span> {formatDateTime(item.updatedAt)}</p>
              <p><span className="text-muted-foreground">Priorité :</span> {item.priorityScore}</p>
              <p><span className="text-muted-foreground">Date cible :</span> {formatDate(item.targetPublishDate)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="versions">
        <TabsList>
          <TabsTrigger value="versions">Versions ({item.versions?.length || 0})</TabsTrigger>
          <TabsTrigger value="reviews">Historique de relecture ({item.reviewLogs?.length || 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="versions" className="space-y-3">
          {item.versions?.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium">Version {v.versionNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {formatDateTime(v.createdAt)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{v.title}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restoreMutation.mutate(v.id)}
                  disabled={restoreMutation.isPending}
                >
                  Restaurer
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="reviews" className="space-y-3">
          {item.reviewLogs?.map((log) => (
            <Card key={log.id}>
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{log.action.replace(/_/g, ' ')}</Badge>
                  {log.user && <span className="text-sm">{log.user.name || log.user.email}</span>}
                  <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                </div>
                {log.comment && <p className="mt-2 text-sm text-muted-foreground">{log.comment}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Régénérer avec l'IA</DialogTitle>
            <DialogDescription>Indiquez un angle ou des instructions optionnelles pour une nouvelle génération.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Angle ou instructions (optionnel)</Label>
            <Textarea
              value={regenerateAngle}
              onChange={(e) => setRegenerateAngle(e.target.value)}
              placeholder="Ex. : Mettre l'accent sur l'impact pour les personnes en situation de handicap"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateOpen(false)}>Annuler</Button>
            <Button onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
              {regenerateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Régénérer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce contenu</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Le contenu, ses versions et son historique de relecture seront définitivement supprimés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
