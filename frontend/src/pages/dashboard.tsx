import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  PenLine,
  Eye,
  CheckCircle2,
  XCircle,
  Send,
  Database,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { themeLabels } from '@/lib/labels';
import type { DashboardStats, Theme } from '@/types';

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const statCards = [
    { label: 'Total contenus', value: data.totalContent, icon: FileText, color: 'text-foreground' },
    { label: 'Brouillons', value: data.drafts, icon: PenLine, color: 'text-gray-500' },
    { label: 'À relire', value: data.toReview, icon: Eye, color: 'text-yellow-600' },
    { label: 'Approuvés', value: data.approved, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Rejetés', value: data.rejected, icon: XCircle, color: 'text-red-500' },
    { label: 'Publiés', value: data.published, icon: Send, color: 'text-blue-600' },
    { label: 'Sources', value: data.totalSources, icon: Database, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble du pipeline éditorial</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contenus par thème</CardTitle>
          </CardHeader>
          <CardContent>
            {data.contentByTheme.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun contenu pour le moment</p>
            ) : (
              <div className="space-y-3">
                {data.contentByTheme.map((item) => (
                  <div key={item.theme} className="flex items-center justify-between">
                    <span className="text-sm">{themeLabels[item.theme as Theme] || item.theme}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
