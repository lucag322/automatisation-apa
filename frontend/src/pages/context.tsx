import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Plus, Trash2, Pencil, BookOpen, Check, X, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface EditorialContext {
  id: string;
  title: string;
  content: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export function ContextPage() {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const { data: contexts, isLoading } = useQuery({
    queryKey: ['contexts'],
    queryFn: () => api.get<EditorialContext[]>('/contexts'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/contexts', { title: newTitle, content: newContent }),
    onSuccess: () => {
      setNewTitle('');
      setNewContent('');
      queryClient.invalidateQueries({ queryKey: ['contexts'] });
      toast.success('Consigne ajoutée');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (ctx: { id: string; title: string; content: string }) =>
      api.patch(`/contexts/${ctx.id}`, { title: ctx.title, content: ctx.content }),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['contexts'] });
      toast.success('Consigne modifiée');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (ctx: { id: string; active: boolean }) =>
      api.patch(`/contexts/${ctx.id}`, { active: !ctx.active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contexts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contexts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contexts'] });
      toast.success('Consigne supprimée');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(ctx: EditorialContext) {
    setEditingId(ctx.id);
    setEditTitle(ctx.title);
    setEditContent(ctx.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
  }

  const activeCount = contexts?.filter((c) => c.active).length ?? 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-8 w-8" />
          Contexte éditorial
        </h1>
        <p className="text-muted-foreground">
          Définissez des consignes persistantes que l'IA suivra dans chaque génération de post
        </p>
      </div>

      {/* Add new */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter une consigne</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ctx-title">Titre</Label>
            <Input
              id="ctx-title"
              placeholder="Ex: Identité de marque, Ton à adopter, Sujet prioritaire..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ctx-content">Consigne</Label>
            <Textarea
              id="ctx-content"
              placeholder="Ex: Mentionne toujours APA de Géant quand c'est pertinent. Notre association promeut le sport adapté et l'activité physique pour les personnes en situation de handicap..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
            />
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!newTitle.trim() || !newContent.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Ajouter
          </Button>
        </CardContent>
      </Card>

      {/* Info */}
      {contexts && contexts.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {activeCount} consigne(s) active(s) sur {contexts.length} — les consignes actives sont injectées dans chaque génération de post.
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !contexts || contexts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BookOpen className="mb-4 h-12 w-12" />
          <p className="text-lg font-medium">Aucune consigne définie</p>
          <p className="text-sm">Ajoutez des consignes pour guider l'IA dans la génération de vos posts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contexts.map((ctx) => {
            const isEditing = editingId === ctx.id;

            return (
              <Card key={ctx.id} className={!ctx.active ? 'opacity-50' : ''}>
                <CardContent className="py-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            updateMutation.mutate({ id: ctx.id, title: editTitle, content: editContent })
                          }
                          disabled={updateMutation.isPending}
                        >
                          <Check className="mr-1 h-4 w-4" /> Enregistrer
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          <X className="mr-1 h-4 w-4" /> Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{ctx.title}</h3>
                          <Badge
                            variant="secondary"
                            className={ctx.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
                          >
                            {ctx.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                          {ctx.content}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleMutation.mutate({ id: ctx.id, active: ctx.active })}
                          title={ctx.active ? 'Désactiver' : 'Activer'}
                        >
                          {ctx.active ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEdit(ctx)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Supprimer la consigne "${ctx.title}" ?`)) {
                              deleteMutation.mutate(ctx.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
