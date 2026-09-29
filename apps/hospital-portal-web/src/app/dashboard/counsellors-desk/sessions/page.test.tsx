import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

const harness = vi.hoisted(() => ({
  search: '',
  sessions: [] as Record<string, unknown>[],
  isPending: false,
  isError: false,
  canReassign: true,
  push: vi.fn(),
  replace: vi.fn(),
  counselors: [] as Array<{
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string | null;
  }>,
  branches: [] as Array<{ branchId: string; branchName: string }>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: harness.push, replace: harness.replace }),
  usePathname: () => '/dashboard/counsellors-desk/sessions',
  useSearchParams: () => new URLSearchParams(harness.search),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { queryKey: readonly unknown[] }) => {
    const key = opts.queryKey.map(String).join('|');
    if (key.includes('sessions-register-labels')) return { data: harness.counselors };
    return { data: { branches: harness.branches } };
  },
}));

vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/permissions/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/hooks/use-permissions', () => ({
  useHasPermission: () => harness.canReassign,
}));

vi.mock('@/hooks/use-counseling-sessions', () => ({
  useCounselingSessions: () => ({
    data: { sessions: harness.sessions, totalCount: harness.sessions.length, totalPages: 1 },
    isPending: harness.isPending,
    isError: harness.isError,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/components/counsellors-desk/waiting-list/WaitingListReassignDialog', () => ({
  WaitingListReassignDialog: () => null,
}));

import SessionsPage from './page';

const pageSource = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');

function renderPage() {
  return renderToStaticMarkup(<SessionsPage />);
}

describe('Counselling Sessions register', () => {
  beforeEach(() => {
    harness.search = '';
    harness.sessions = [];
    harness.isPending = false;
    harness.isError = false;
    harness.canReassign = true;
    harness.push.mockReset();
    harness.replace.mockReset();
    harness.counselors = [];
    harness.branches = [];
  });

  it('opens as one register with Filters and session-number search', () => {
    const html = renderPage();
    expect(html).toContain('data-testid="sessions-filters-open"');
    expect(html).toContain('Filters');
    expect(html).toContain('Search session number');
    expect(html).not.toContain('aria-label="Session views"');
    expect(html).not.toContain('Sessions in your authorized branches.');
    expect(html).toContain('No counselling sessions');
    expect(html).toContain('Sessions in your authorized branches will show here.');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('Filtered from Analytics');
    expect(html).not.toContain('sessions-row-reassign');
  });

  it('shows owner and status, and Open does not assign ownership', () => {
    harness.sessions = [
      {
        id: 'sess-1',
        patientName: 'Ravi Kumar',
        counselorId: 'c-amelia',
        counselorName: 'Amelia Martinez',
        status: 'InProgress',
        sessionDate: '2026-09-01',
        recommendedSurgery: 'Phaco',
        pendingDecision: false,
        patientAgreedToSurgery: true,
      },
      {
        id: 'sess-2',
        patientName: 'Open Case',
        counselorId: null,
        counselorName: null,
        status: 'Scheduled',
        sessionDate: '2026-09-02',
      },
    ];
    const html = renderPage();
    expect(html).toContain('Amelia Martinez');
    expect(html).toContain('Unassigned');
    expect(html).toContain('In Progress');
    expect(html).toContain('Scheduled');
    expect(html).toContain('>Owner<');
    expect(html).toContain('>Status<');
    expect(html).not.toContain('sessions-row-reassign');
    const openCall = 'router.push(buildSessionsOpenHref(id, searchParams.toString()))';
    expect(pageSource).toContain(openCall);
    const openAt = pageSource.indexOf(openCall);
    expect(pageSource.slice(openAt - 120, openAt + openCall.length)).not.toMatch(/setReassignSession|requeue/i);
  });

  it('renders the Analytics context, a removable Agreed chip, and Clear', () => {
    harness.search =
      'analyticsOutcome=Agreed&patientAgreedToSurgery=true&pendingDecision=false&counselorId=c-amelia&branchId=b1&sessionDateFrom=2026-09-01&sessionDateTo=2026-09-27';
    harness.counselors = [
      {
        id: 'c-amelia',
        firstName: 'Amelia',
        lastName: 'Martinez',
        name: 'Amelia Martinez',
        email: null,
      },
    ];
    harness.branches = [{ branchId: 'b1', branchName: 'Madhapur' }];
    const html = renderPage();
    expect(html).toContain('Filtered from Analytics');
    expect(html).toContain('Back to Analytics');
    expect(html).toContain('href="/dashboard/counselor/analytics"');
    expect(html).toContain('aria-label="Remove Decision Agreed filter"');
    expect(html).not.toContain('Agreed to surgery');
    expect(html).not.toContain('Not pending');
    expect(html).toContain('Amelia Martinez');
    expect(html).toContain('Madhapur');
    expect(html).toContain('>Clear<');
    expect(html).toContain('No sessions match these filters');
  });

  it('shows Reassignment Required as a filter Clear can remove', () => {
    harness.search = 'reassignmentRequired=true';
    let html = renderPage();
    expect(html).toContain('aria-label="Remove Reassignment required filter"');
    expect(html).toContain('No sessions require reassignment');
    expect(html).toContain(
      'This list shows open sessions whose owner is inactive, removed, or no longer authorized for the branch.',
    );
    expect(html).toContain('sessions-list-clear');
    expect(html).not.toContain('sessions-reassignment-purpose');
    expect(html).not.toContain('sessions-row-reassign');

    harness.search =
      'reassignmentRequired=true&analyticsOutcome=Agreed&patientAgreedToSurgery=true&pendingDecision=false';
    html = renderPage();
    expect(html).toContain('No sessions require reassignment for these filters');
    expect(html).toContain('Clear filters to see every reassignment in your authorized branches.');
    expect(html).toContain('aria-label="Remove Decision Agreed filter"');
    expect(html).toContain('sessions-list-clear');
  });

  it('shows Reassign only when the existing permission gate allows it', () => {
    harness.search = 'reassignmentRequired=true';
    harness.canReassign = true;
    harness.sessions = [
      {
        id: 'sess-1',
        patientName: 'Ravi Kumar',
        counselorId: 'c-amelia',
        counselorName: 'Amelia Martinez',
        status: 'Scheduled',
        sessionDate: '2026-09-01',
      },
    ];
    expect(renderPage()).toContain('sessions-row-reassign');

    harness.canReassign = false;
    expect(renderPage()).not.toContain('sessions-row-reassign');
  });
});
