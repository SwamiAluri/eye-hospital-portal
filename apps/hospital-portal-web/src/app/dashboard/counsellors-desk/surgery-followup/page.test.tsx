import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (v: string) => v,
}));

vi.mock('@/lib/auth-store', () => ({
  useAuthStore: () => ({ user: { branchId: 'branch-1' }, selectedBranchId: null }),
}));

vi.mock('@/hooks/use-counsellors-desk-queries', () => ({
  FOLLOWUP_PAGE_SIZE: 20,
  useActiveFollowupsQuery: () => ({
    data: { total: 0, page: 1, pageSize: 20, items: [] },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useColdLeadsQuery: () => ({
    data: { total: 0, page: 1, pageSize: 20, items: [] },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
  usePostSurgeryFollowupsQuery: () => ({
    data: { total: 0, page: 1, pageSize: 20, items: [] },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useFollowupStatsQuery: () => ({
    data: {
      filters: { branchId: null, intention: null, q: null, scope: 'filtered' },
      active: { total: 0, urgentHigh: 0, neverContacted: 0, averageAttempts: null },
      cold: { total: 0, declined: 0, referredElsewhere: 0, averageAttempts: null },
      postSurgery: {
        total: 0,
        over30Days: 0,
        pendingPostOpVisits: 0,
        averageDaysSinceDischarge: null,
      },
    },
    isPending: false,
    isFetching: false,
    isError: false,
  }),
  useInvalidateCounsellorsDesk: () => ({
    invalidateFollowups: vi.fn(),
  }),
}));

vi.mock('@/components/permissions/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/lib/api/counsellors-desk.api', () => ({
  counsellorsDeskApi: {},
}));

import SurgeryFollowupPage from '@/app/dashboard/counsellors-desk/surgery-followup/page';

describe('SurgeryFollowupPage Phase 2F shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders counsellor shell testids and empty state', () => {
    const html = renderToStaticMarkup(<SurgeryFollowupPage />);
    expect(html).toContain('data-testid="followup-page"');
    expect(html).toContain('data-testid="followup-summary"');
    expect(html).toContain('data-testid="followup-tabs"');
    expect(html).toContain('data-testid="followup-toolbar"');
    expect(html).toContain('data-testid="followup-search"');
    expect(html).toContain('data-testid="followup-worklist"');
    expect(html).toContain('Follow-up Center');
    expect(html).toContain('No active follow-ups found');
    expect(html).not.toContain('Scheduler opening soon');
    expect(html).not.toContain('Est. window');
    expect(html).not.toContain('followup-date-filter');
  });

  it('exposes intention filter for active tab and server search placeholder', () => {
    const html = renderToStaticMarkup(<SurgeryFollowupPage />);
    expect(html).toContain('data-testid="followup-intention-filter"');
    expect(html).toContain('Search name, MRN, phone, or procedure');
    expect(html).toContain('Active');
    expect(html).not.toContain('High Priority');
    expect(html).not.toContain('Over 30 Days');
    expect(html).toContain('Never Contacted');
    expect(html).toContain('Avg Attempts');
  });

  it('Phase2Y: Active KPI has no priority language and no alert-level chrome', () => {
    const html = renderToStaticMarkup(<SurgeryFollowupPage />);
    expect(html).not.toContain('High Priority');
    expect(html).not.toContain('>Critical<');
    expect(html).not.toContain('>High<');
    expect(html).not.toContain('>Medium<');
    expect(html).toContain('Never Contacted');
    expect(html).not.toContain('Due Date');
    expect(html).not.toContain('Overdue');
    expect(html).not.toContain('SLA');
  });
});
