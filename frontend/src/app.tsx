import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout';
import { useAuth } from '@/hooks/use-auth';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { ContentsPage } from '@/pages/contents';
import { ContentDetailPage } from '@/pages/content-detail';
import { SourcesPage } from '@/pages/sources';
import { ResearchPage } from '@/pages/research';
import { CalendarPage } from '@/pages/calendar';
import { GeneratePage } from '@/pages/generate';
import { ContextPage } from '@/pages/context';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="contents" element={<ContentsPage />} />
        <Route path="contents/:id" element={<ContentDetailPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="research" element={<ResearchPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="generate" element={<GeneratePage />} />
        <Route path="context" element={<ContextPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
