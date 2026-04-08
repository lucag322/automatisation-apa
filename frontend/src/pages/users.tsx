import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Shield, ShieldCheck, UserPlus, Trash2, Loader2, Clock, CheckCircle2 } from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'editor';
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ users: UserItem[] }>('/auth/users'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { email: string; name?: string }) =>
      api.post<{ user: UserItem; emailSent: boolean; inviteLink: string }>('/auth/register', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEmail('');
      setName('');
      setShowForm(false);
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'admin' | 'editor' }) =>
      api.patch(`/auth/users/${id}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  const users = data?.users || [];

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} utilisateur{users.length > 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Créer un utilisateur</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({ email, name: name || undefined });
              }}
            >
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="email@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nom (optionnel)</Label>
                <Input
                  placeholder="Prénom Nom"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Inviter
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
              </div>
              {createMutation.isError && (
                <p className="sm:col-span-2 text-sm text-destructive">
                  {(createMutation.error as Error).message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    {u.isSuperAdmin ? (
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    ) : u.role === 'admin' ? (
                      <Shield className="h-5 w-5 text-primary" />
                    ) : (
                      <span className="text-sm font-semibold text-primary">
                        {(u.name || u.email)[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.name || u.email.split('@')[0]}</span>
                      {u.isSuperAdmin && (
                        <Badge variant="default" className="text-xs">Super Admin</Badge>
                      )}
                      {!u.isSuperAdmin && u.role === 'admin' && (
                        <Badge variant="secondary" className="text-xs">Admin</Badge>
                      )}
                      {u.role === 'editor' && (
                        <Badge variant="outline" className="text-xs">Éditeur</Badge>
                      )}
                      {!u.isSuperAdmin && !u.isActive && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 gap-1">
                          <Clock className="h-3 w-3" />
                          Invitation envoyée
                        </Badge>
                      )}
                      {!u.isSuperAdmin && u.isActive && (
                        <span className="text-green-500"><CheckCircle2 className="h-3.5 w-3.5" /></span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                </div>

                {!u.isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={roleMutation.isPending}
                      onClick={() =>
                        roleMutation.mutate({
                          id: u.id,
                          role: u.role === 'admin' ? 'editor' : 'admin',
                        })
                      }
                    >
                      {u.role === 'admin' ? 'Retirer admin' : 'Passer admin'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(`Supprimer ${u.email} ?`)) {
                          deleteMutation.mutate(u.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
