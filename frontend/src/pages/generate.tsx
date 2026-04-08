import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Wand2, Save, FilePlus, Link2, ClipboardCopy,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface GeneratedPost {
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  confidence: number;
  theme: string;
  postType: string;
  sourceTitle?: string;
  sourceUrl?: string | null;
  rawContent?: string;
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ml-2 inline-flex shrink-0 items-center text-muted-foreground hover:text-foreground"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <ClipboardCopy className="h-4 w-4" />}
    </button>
  );
}

export function GeneratePage() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [url, setUrl] = useState('');
  const [post, setPost] = useState<GeneratedPost | null>(null);

  const hasPost = post !== null;
  const isWorking = false;

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post<GeneratedPost>('/generate/preview', {
        prompt,
        ...(url ? { url } : {}),
      }),
    onSuccess: (data) => {
      setPost(data);
      setPrompt('');
      toast.success('Post généré avec succès');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refineMutation = useMutation({
    mutationFn: () => {
      if (!post) throw new Error('Aucun post à modifier');
      return api.post<GeneratedPost>('/generate/refine', {
        title: post.title,
        hook: post.hook,
        body: post.body,
        cta: post.cta,
        hashtags: post.hashtags,
        instructions: prompt,
      });
    },
    onSuccess: (data) => {
      setPost((prev) => prev ? { ...prev, ...data } : null);
      setPrompt('');
      toast.success('Post modifié par l\'IA');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!post) throw new Error('Aucun post à sauvegarder');
      return api.post('/generate/save', {
        title: post.title,
        hook: post.hook,
        body: post.body,
        cta: post.cta,
        hashtags: post.hashtags,
        theme: post.theme,
        postType: post.postType,
        sourceUrl: post.sourceUrl || undefined,
        sourceTitle: post.sourceTitle || undefined,
        rawContent: post.rawContent || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Post sauvegardé dans les contenus');
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      resetAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetAll() {
    setPost(null);
    setPrompt('');
    setUrl('');
  }

  function handleSubmit() {
    if (!prompt.trim()) return;
    if (hasPost) {
      refineMutation.mutate();
    } else {
      generateMutation.mutate();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const isPending = generateMutation.isPending || refineMutation.isPending;

  function updateField(field: keyof GeneratedPost, value: string | string[]) {
    setPost((prev) => prev ? { ...prev, [field]: value } : null);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wand2 className="h-8 w-8" />
            Génération manuelle
          </h1>
          <p className="text-muted-foreground">
            Écrivez un prompt ou collez un lien pour générer, puis demandez des modifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPost && (
            <>
              <Button variant="outline" size="sm" onClick={resetAll}>
                <FilePlus className="mr-2 h-4 w-4" />
                Nouveau
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Sauvegarder
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Prompt + URL input */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Textarea
            placeholder={
              hasPost
                ? 'Demandez une modification : "Rends le ton plus engageant", "Ajoute une question", "Raccourcis le texte"...'
                : 'Décrivez le post que vous voulez : sujet, angle, ton... Ex: "Un post engageant sur Octobre Rose et l\'activité physique"'
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
          />
          {!hasPost && (
            <div className="space-y-1">
              <Label htmlFor="url" className="flex items-center gap-1 text-xs text-muted-foreground">
                <Link2 className="h-3 w-3" />
                Lien vers un article (optionnel)
              </Label>
              <Input
                id="url"
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isPending}
            className="w-full"
          >
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {hasPost ? 'Modification en cours...' : 'Génération en cours...'}</>
            ) : (
              <><Wand2 className="mr-2 h-4 w-4" /> {hasPost ? 'Modifier avec l\'IA' : 'Générer le post'}</>
            )}
          </Button>
          {!hasPost && (
            <p className="text-center text-xs text-muted-foreground">Entrée pour envoyer, Shift+Entrée pour retour à la ligne</p>
          )}
        </CardContent>
      </Card>

      {/* Post editor */}
      {hasPost && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Post</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {themeLabels[post.theme] || post.theme}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Confiance : {Math.round(post.confidence * 100)}%
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center">
                  <Label>Titre</Label>
                  <CopyButton text={post.title} />
                </div>
                <Input
                  value={post.title}
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center">
                  <Label>Accroche</Label>
                  <CopyButton text={post.hook} />
                </div>
                <Textarea
                  value={post.hook}
                  onChange={(e) => updateField('hook', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center">
                  <Label>Texte</Label>
                  <CopyButton text={post.body} />
                </div>
                <Textarea
                  value={post.body}
                  onChange={(e) => updateField('body', e.target.value)}
                  rows={8}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center">
                  <Label>Appel à l'action</Label>
                  <CopyButton text={post.cta} />
                </div>
                <Input
                  value={post.cta}
                  onChange={(e) => updateField('cta', e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center">
                  <Label>Hashtags</Label>
                  <CopyButton text={post.hashtags.join(' ')} />
                </div>
                <Input
                  value={post.hashtags.join(', ')}
                  onChange={(e) =>
                    updateField(
                      'hashtags',
                      e.target.value
                        .split(',')
                        .map((h) => h.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="#SportSanté, #Inclusion, ..."
                />
              </div>
            </CardContent>
          </Card>

        </>
      )}
    </div>
  );
}
