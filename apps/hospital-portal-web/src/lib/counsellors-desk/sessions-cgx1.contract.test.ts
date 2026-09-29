import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const sessionsPage = readFileSync(
  resolve(__dirname, '../../app/dashboard/counsellors-desk/sessions/page.tsx'),
  'utf8',
);

const agingTable = readFileSync(
  resolve(__dirname, '../../components/counselor/FollowupAgingTable.tsx'),
  'utf8',
);

describe('CGX-1 Sessions presentation contracts', () => {
  it('does not repeat a content page title and keeps the sessions table', () => {
    expect(sessionsPage).not.toContain('data-testid="sessions-list-title"');
    expect(sessionsPage).not.toContain('staff-page-title');
    expect(sessionsPage).not.toContain('<h1');
    expect(sessionsPage).toContain('data-testid="sessions-filters-open"');
    expect(sessionsPage).toContain('Search session number');
    expect(sessionsPage).toContain('aria-label="Counselling sessions"');
    expect(sessionsPage).toContain('sessionsHeaderClassName');
    expect(sessionsPage).not.toContain('uppercase tracking-wide');
    expect(sessionsPage).not.toContain('text-[10px] font-semibold uppercase');
  });

  it('renders MRN and Eye from the list payload without a UHID or Eye column', () => {
    expect(sessionsPage).toContain('SessionsMrnLine');
    expect(sessionsPage).toContain('SessionsEyeLine');
    expect(sessionsPage).toContain('patientMrn ?? session.PatientMrn');
    expect(sessionsPage).toContain('surgeryTentativeEye ?? session.SurgeryTentativeEye');
    expect(sessionsPage).not.toMatch(/UHID/i);
    expect(sessionsPage).not.toContain('HealthId');
    expect(sessionsPage).not.toMatch(/>\s*Eye\s*</);
  });

  it('keeps Decision values, Open, and contextual Reassign', () => {
    expect(sessionsPage).toContain("return 'Pending'");
    expect(sessionsPage).toContain("return 'Agreed'");
    expect(sessionsPage).toContain("return 'Declined'");
    expect(sessionsPage).toContain("return '—'");
    expect(sessionsPage).toContain('data-testid="sessions-row-open"');
    expect(sessionsPage).toContain('data-testid="sessions-row-reassign"');
    expect(sessionsPage).toContain('canShowSessionsRrReassign');
    expect(sessionsPage).toContain('reassignmentRequiredFilter: reassignmentRequired');
    expect(sessionsPage).toMatch(/>\s*Owner\s*</);
    expect(sessionsPage).toMatch(/>\s*Status\s*</);
  });

  it('keeps server page size 20 and ?page= helpers', () => {
    expect(sessionsPage).toContain('pageSize: SESSIONS_PAGE_SIZE');
    expect(sessionsPage).toContain('parseSessionsPageParam');
    expect(sessionsPage).toContain("searchParams.get('page')");
    expect(sessionsPage).toContain('setSessionsPageInSearchParams');
    expect(sessionsPage).not.toMatch(/pageSize:\s*50/);
    expect(sessionsPage).not.toMatch(/sliceWaitingListPage|sessions\.slice\(/);
  });

  it('keeps loading, empty, and error recovery, with Clear for drill-down filters and no Refresh', () => {
    expect(sessionsPage).toContain('data-testid="sessions-list-loading"');
    expect(sessionsPage).toContain('Loading sessions…');
    expect(sessionsPage).toContain('data-testid="sessions-list-empty"');
    expect(sessionsPage).toContain('resolveSessionsEmptyCopy');
    expect(sessionsPage).toContain('data-testid="sessions-list-error"');
    expect(sessionsPage).toContain('Failed to load sessions');
    expect(sessionsPage).toContain('Retry');
    expect(sessionsPage).toContain('void refetch()');
    expect(sessionsPage).toContain('data-testid="sessions-list-clear"');
    expect(sessionsPage).not.toContain('data-testid="sessions-list-refresh"');
  });
});

describe('CGX-1 Analytics aging header typography', () => {
  it('uses the readable header class and does not change aging data hooks', () => {
    expect(agingTable).toContain('cgx1WorklistHeaderClass');
    expect(agingTable).not.toContain('uppercase');
    expect(agingTable).toContain('useCounselorFollowupAging');
    expect(agingTable).toContain('Patient');
    expect(agingTable).toContain('Surgery');
    expect(agingTable).toContain('Phone');
    expect(agingTable).toContain('Days');
    expect(agingTable).toContain('Action');
    expect(agingTable).toContain('analytics-aging-open-session');
  });
});
