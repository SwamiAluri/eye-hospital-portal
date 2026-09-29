import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

const activeItem = {
  sessionId: 'sess-1',
  patientId: 'pat-1',
  patientName: 'Ravi Kumar',
  uhid: 'UH001',
  phone: '9000000001',
  branchId: 'branch-1',
  counselorId: 'counsellor-amelia',
  counselorName: 'Amelia Martinez',
  recommendedSurgery: 'Phaco',
  patientIntention: 'WillingWeek' as const,
  sessionDate: '2026-09-01T00:00:00Z',
  lastContactDate: null,
  contactAttemptCount: 0,
  lastContactOutcome: null,
  escalationStatus: 'Normal',
  overdueSinceDate: null,
  alertLevel: 'Normal' as const,
};

const unassignedActiveItem = {
  ...activeItem,
  sessionId: 'sess-2',
  patientName: 'Unassigned Patient',
  counselorId: null,
  counselorName: null,
};

vi.mock('@/hooks/use-counsellors-desk-queries', () => ({
  FOLLOWUP_PAGE_SIZE: 20,
  useActiveFollowupsQuery: () => ({
    data: {
      total: 2,
      page: 1,
      pageSize: 20,
      items: [activeItem, unassignedActiveItem],
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useColdLeadsQuery: () => ({
    data: {
      total: 1,
      page: 1,
      pageSize: 20,
      items: [
        {
          sessionId: 'sess-cold-1',
          patientId: 'pat-cold',
          patientName: 'Cold Lead',
          uhid: 'UH002',
          phone: null,
          branchId: 'branch-1',
          counselorId: 'counsellor-amelia',
          counselorName: 'Amelia Martinez',
          recommendedSurgery: null,
          patientIntention: 'Declined' as const,
          sessionDate: '2026-08-01T00:00:00Z',
          lastContactDate: null,
          contactAttemptCount: 0,
          lastContactOutcome: null,
          additionalNotes: null,
        },
      ],
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
  usePostSurgeryFollowupsQuery: () => ({
    data: {
      total: 1,
      page: 1,
      pageSize: 20,
      items: [
        {
          journeyId: 'j1',
          patientId: 'pat-ps',
          patientName: 'Post Surgery Patient',
          uhid: 'UH003',
          phone: null,
          branchId: 'branch-1',
          sessionId: null,
          surgeryType: 'Phaco',
          dischargedAt: '2026-08-15T00:00:00Z',
          daysSinceDischarge: 36,
          conditionAtDischarge: 'Stable',
          dischargeDate: '2026-08-15',
          pendingPostOpVisits: 1,
        },
      ],
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useFollowupStatsQuery: () => ({
    data: {
      filters: { branchId: null, intention: null, q: null, scope: 'filtered' },
      active: { total: 2, urgentHigh: 0, neverContacted: 2, averageAttempts: null },
      cold: { total: 1, declined: 1, referredElsewhere: 0, averageAttempts: null },
      postSurgery: {
        total: 1,
        over30Days: 1,
        pendingPostOpVisits: 1,
        averageDaysSinceDischarge: 36,
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

  it('renders counsellor shell testids and worklist rows', () => {
    const html = renderToStaticMarkup(<SurgeryFollowupPage />);
    expect(html).toContain('data-testid="followup-page"');
    expect(html).toContain('data-testid="followup-summary"');
    expect(html).toContain('data-testid="followup-tabs"');
    expect(html).toContain('data-testid="followup-toolbar"');
    expect(html).toContain('data-testid="followup-search"');
    expect(html).toContain('data-testid="followup-worklist"');
    expect(html).not.toContain('Follow-up Center');
    expect(html).toContain('Ravi Kumar');
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

/** Phase 3I Slice 10 — label honesty + shared queue (Active default tab). */
describe('Phase 3I Slice 10 — Follow-up Center honesty', () => {
  it('Active rows show Original Counsellor, not Owner', () => {
    const html = renderToStaticMarkup(<SurgeryFollowupPage />);
    expect(html).toContain('Original Counsellor: Amelia Martinez');
    expect(html).toContain('Original Counsellor: Unassigned');
    expect(html).not.toMatch(/· Owner:/);
    expect(html).not.toContain('Assigned To');
    expect(html).not.toContain('My Follow-ups');
    expect(html).not.toContain('Assigned to Me');
    expect(html).not.toContain('Claim');
  });

  it('exposes existing column cues without changing row content or ReQueue', () => {
    const html = renderToStaticMarkup(<SurgeryFollowupPage />);
    expect(html).toContain('data-testid="followup-column-cues"');
    expect(html).toContain('role="columnheader"');
    expect(html).toContain('>Patient<');
    expect(html).toContain('>Procedure<');
    expect(html).toContain('>Status<');
    expect(html).toContain('>Contact<');
    expect(html).toContain('>Action<');
    expect(html).toContain('Ravi Kumar');
    expect(html).toContain('Phaco');
    expect(html).toContain('Original Counsellor: Amelia Martinez');
    expect(html).toContain('Re-queue to waiting list');
    expect(html).not.toContain('My Follow-ups');
  });

  it('does not add Assign / Claim / Reassign CTAs on Follow-up Center', () => {
    const html = renderToStaticMarkup(<SurgeryFollowupPage />);
    expect(html).not.toMatch(/>Assign</);
    expect(html).not.toMatch(/>Claim</);
    expect(html).not.toMatch(/>Reassign</);
    expect(html).toContain('Open session');
    expect(html).toContain('Re-queue to waiting list');
  });

  it('tabs exclude My Follow-ups / Assigned to Me', () => {
    const html = renderToStaticMarkup(<SurgeryFollowupPage />);
    expect(html).toContain('Active');
    expect(html).toContain('Cold Leads');
    expect(html).toContain('Post-Surgery');
    expect(html).not.toContain('My Follow-ups');
    expect(html).not.toContain('Assigned to Me');
  });
});

describe('PD-LD-06 follow-up worklist loading announcement', () => {
  it('exposes one status announcement and keeps skeleton geometry hidden', () => {
    const src = readFileSync(join(__dirname, 'page.tsx'), 'utf8').replace(/\r\n/g, '\n');
    const skeleton = src.slice(src.indexOf('showSkeleton ?'), src.indexOf('followup-empty'));
    expect(skeleton).toContain('<div role="status">');
    expect(skeleton).toContain('>Loading<');
    expect(skeleton).toContain('aria-hidden');
    expect(skeleton.match(/role="status"/g)).toHaveLength(1);
  });
});
