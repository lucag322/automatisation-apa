export type ContentStatus = 'draft' | 'to_review' | 'approved' | 'rejected' | 'published';
export type PostType = 'informational' | 'awareness' | 'opinion' | 'testimonial' | 'event_promotion' | 'recap' | 'call_to_action' | 'educational';
export type Theme = 'sport' | 'adapted_sport' | 'disability' | 'maison_sport_sante' | 'public_health' | 'inclusion' | 'awareness_campaign' | 'law_and_policy' | 'official_report' | 'public_interest_event';
export type SourceType = 'article' | 'report' | 'study' | 'law' | 'event' | 'announcement' | 'campaign' | 'press_release' | 'official_document' | 'other';
export type ReviewAction = 'approve' | 'reject' | 'request_changes' | 'move_to_review' | 'regenerate' | 'publish';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'editor';
}

export interface Source {
  id: string;
  url: string;
  title: string;
  rawContent: string;
  summary: string | null;
  sourceType: SourceType;
  publishedAt: string | null;
  reliabilityScore: number | null;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  _count?: { contentItems: number };
  contentItems?: ContentItemSummary[];
}

export interface ContentItemSummary {
  id: string;
  title: string;
  status: ContentStatus;
  createdAt: string;
}

export interface ContentItem {
  id: string;
  sourceId: string | null;
  source: { id: string; title: string; sourceType: SourceType; url: string } | null;
  title: string;
  hook: string | null;
  body: string;
  hashtags: string[];
  cta: string | null;
  postType: PostType;
  theme: Theme;
  persona: string | null;
  status: ContentStatus;
  priorityScore: number;
  aiConfidence: number | null;
  targetPublishDate: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: ContentVersion[];
  reviewLogs?: ReviewLog[];
}

export interface ContentVersion {
  id: string;
  contentItemId: string;
  title: string;
  hook: string | null;
  body: string;
  hashtags: string[];
  cta: string | null;
  versionNumber: number;
  createdAt: string;
  createdByUserId: string | null;
}

export interface ReviewLog {
  id: string;
  contentItemId: string;
  userId: string | null;
  user: { id: string; email: string; name: string | null } | null;
  action: ReviewAction;
  comment: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DashboardStats {
  totalContent: number;
  drafts: number;
  toReview: number;
  approved: number;
  rejected: number;
  published: number;
  totalSources: number;
  contentByTheme: { theme: string; count: number }[];
}
