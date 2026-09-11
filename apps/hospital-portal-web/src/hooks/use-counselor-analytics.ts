import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/lib/api';

// ─── Shared types (Phase 2D) ─────────────────────────────────────────────────

export interface AnalyticsSummary {
  period: number | null;
  windowMode?: 'period' | 'custom';
  from?: string;
  toExclusive?: string;
  branchId?: string | null;
  counselorId?: string | null;
  totalSessions: number;
  agreedCount: number;
  declinedCount: number;
  undecidedCount: number;
  decisionRate: number;
  conversionRate: number;
  avgDaysToDecision: number;
  bySurgeryType: { surgeryType: string; count: number; agreedCount: number }[];
  bySessionType: { sessionType: string; count: number }[];
  callbackTotal: number;
  callbackCompleted: number;
  callbackCompletionRate: number;
  generatedAt: string;
}

export interface TrendPoint {
  date: string;
  count: number;
  agreedCount: number;
}

export interface AnalyticsTrends {
  period: number | null;
  windowMode?: 'period' | 'custom';
  from?: string;
  toExclusive?: string;
  branchId?: string | null;
  counselorId?: string | null;
  trend: TrendPoint[];
}

export interface AgingSession {
  id: string;
  patientName: string;
  recommendedSurgery: string | null;
  phone: string | null;
  daysSinceSession: number;
  sessionDate?: string;
}

export interface AgingBuckets {
  bucket_0_3: AgingSession[];
  bucket_4_7: AgingSession[];
  bucket_8_14: AgingSession[];
  bucket_15_plus: AgingSession[];
}

export interface AgingBucketCounts {
  bucket_0_3: number;
  bucket_4_7: number;
  bucket_8_14: number;
  bucket_15_plus: number;
}

export interface FollowupAgingData {
  totalPending: number;
  buckets: AgingBuckets;
  counts?: AgingBucketCounts;
  truncated?: boolean;
  population?: string;
  period?: number | null;
  windowMode?: 'period' | 'custom';
  from?: string;
  toExclusive?: string;
  branchId?: string | null;
  counselorId?: string | null;
  generatedAt: string;
}

export type CounselorAnalyticsFilters = {
  branchId?: string | null;
  counselorId?: string | null;
  period?: number;
  from?: string;
  to?: string;
};

function buildAnalyticsParams(filters: CounselorAnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from && filters.to) {
    params.set('from', filters.from);
    params.set('to', filters.to);
  } else if (filters.period != null) {
    params.set('period', String(filters.period));
  }
  if (filters.branchId) params.set('branchId', filters.branchId);
  if (filters.counselorId) params.set('counselorId', filters.counselorId);
  return params;
}

export const counselorAnalyticsKeys = {
  all: ['counselor-analytics'] as const,
  summary: (filters: CounselorAnalyticsFilters) =>
    [
      ...counselorAnalyticsKeys.all,
      'summary',
      filters.branchId ?? '',
      filters.counselorId ?? '',
      filters.period ?? '',
      filters.from ?? '',
      filters.to ?? '',
    ] as const,
  trends: (filters: CounselorAnalyticsFilters) =>
    [
      ...counselorAnalyticsKeys.all,
      'trends',
      filters.branchId ?? '',
      filters.counselorId ?? '',
      filters.period ?? '',
      filters.from ?? '',
      filters.to ?? '',
    ] as const,
  aging: (filters: CounselorAnalyticsFilters) =>
    [
      ...counselorAnalyticsKeys.all,
      'aging',
      filters.branchId ?? '',
      filters.counselorId ?? '',
      filters.period ?? '',
      filters.from ?? '',
      filters.to ?? '',
    ] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCounselorAnalytics(filters: CounselorAnalyticsFilters) {
  return useQuery<AnalyticsSummary>({
    queryKey: counselorAnalyticsKeys.summary(filters),
    queryFn: async () => {
      const api = getApi();
      const params = buildAnalyticsParams(filters);
      const res = await api.get(`/counseling/analytics/summary?${params}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCounselorAnalyticsTrends(filters: CounselorAnalyticsFilters) {
  return useQuery<AnalyticsTrends>({
    queryKey: counselorAnalyticsKeys.trends(filters),
    queryFn: async () => {
      const api = getApi();
      const params = buildAnalyticsParams(filters);
      const res = await api.get(`/counseling/analytics/trends?${params}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCounselorFollowupAging(filters: CounselorAnalyticsFilters) {
  return useQuery<FollowupAgingData>({
    queryKey: counselorAnalyticsKeys.aging(filters),
    queryFn: async () => {
      const api = getApi();
      const params = buildAnalyticsParams(filters);
      const res = await api.get(`/counseling/analytics/followup-aging?${params}`);
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
