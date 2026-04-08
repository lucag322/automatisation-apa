import type { ContentStatus, Theme, PostType, SourceType } from '@/types';

export const statusColors: Record<ContentStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  to_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  published: 'bg-blue-100 text-blue-800',
};

export const statusLabels: Record<ContentStatus, string> = {
  draft: 'Brouillon',
  to_review: 'À relire',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  published: 'Publié',
};

export const themeLabels: Record<Theme, string> = {
  sport: 'Sport',
  adapted_sport: 'Sport adapté',
  disability: 'Handicap',
  maison_sport_sante: 'Maison Sport-Santé',
  public_health: 'Santé publique',
  inclusion: 'Inclusion',
  awareness_campaign: 'Campagne de sensibilisation',
  law_and_policy: 'Lois & politiques',
  official_report: 'Rapport officiel',
  public_interest_event: 'Événement d\'intérêt public',
};

export const postTypeLabels: Record<PostType, string> = {
  informational: 'Informatif',
  awareness: 'Sensibilisation',
  opinion: 'Opinion',
  testimonial: 'Témoignage',
  event_promotion: 'Promotion d\'événement',
  recap: 'Récapitulatif',
  call_to_action: 'Appel à l\'action',
  educational: 'Éducatif',
};

export const sourceTypeLabels: Record<SourceType, string> = {
  article: 'Article',
  report: 'Rapport',
  study: 'Étude',
  law: 'Loi',
  event: 'Événement',
  announcement: 'Annonce',
  campaign: 'Campagne',
  press_release: 'Communiqué de presse',
  official_document: 'Document officiel',
  other: 'Autre',
};

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
