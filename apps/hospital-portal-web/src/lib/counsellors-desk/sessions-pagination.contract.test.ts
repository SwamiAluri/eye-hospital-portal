import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const sessionsPage = readFileSync(
  resolve(__dirname, '../../app/dashboard/counsellors-desk/sessions/page.tsx'),
  'utf8',
);

const paginationHelpers = readFileSync(
  resolve(__dirname, './sessions-pagination.ts'),
  'utf8',
);

describe('Phase 3I Slice 13 Package B — Sessions pagination contracts', () => {
  it('uses accepted pageSize 20 and URL page SoT (no hard-coded 50 / page 1)', () => {
    expect(paginationHelpers).toContain('SESSIONS_PAGE_SIZE = 20');
    expect(sessionsPage).toContain('SESSIONS_PAGE_SIZE');
    expect(sessionsPage).toContain('parseSessionsPageParam');
    expect(sessionsPage).toContain('pageSize: SESSIONS_PAGE_SIZE');
    expect(sessionsPage).not.toMatch(/pageSize:\s*50/);
    expect(sessionsPage).not.toMatch(/page:\s*1,/);
  });

  it('keeps page changes on the same filters and resets page when filters are applied', () => {
    expect(sessionsPage).toContain('setSessionsPageInSearchParams');
    expect(sessionsPage).toContain('applySessionsRegisterDraft');
    expect(sessionsPage).toContain('setSessionsPageInSearchParams(next, 1)');
    expect(sessionsPage).not.toContain('toggleReassignmentRequiredInSearchParams');
  });

  it('clamps page after refresh using TotalPages and keeps Open/Back via history', () => {
    expect(sessionsPage).toContain('clampSessionsPage');
    expect(sessionsPage).toContain('totalPages');
    expect(sessionsPage).toContain('buildSessionsOpenHref');
    expect(sessionsPage).toContain('router.push(');
    expect(sessionsPage).not.toContain('router.back()');
    expect(sessionsPage).not.toContain('aria-label="Go back"');
  });

  it('keeps server TotalCount in the pagination footer and not as a content heading', () => {
    expect(sessionsPage).not.toContain('data-testid="sessions-list-count"');
    expect(sessionsPage).toContain('data-testid="sessions-list-pagination-summary"');
    expect(sessionsPage).toContain('{totalCount}');
    expect(sessionsPage).toContain('data-testid="sessions-list-pagination"');
    expect(sessionsPage).toContain('data-testid="sessions-list-pagination-prev"');
    expect(sessionsPage).toContain('data-testid="sessions-list-pagination-next"');
    expect(sessionsPage).toContain('aria-label="Counselling sessions pagination"');
    expect(sessionsPage).not.toMatch(/Rows per page|page-size|onPageSizeChange/i);
    expect(sessionsPage).not.toMatch(/sliceWaitingListPage|sessions\.slice\(/);
  });

  it('does not expose ReQueue or alter Reassign dialog path', () => {
    expect(sessionsPage).not.toMatch(/ReQueue|re-queue|requeue/i);
    expect(sessionsPage).toContain('WaitingListReassignDialog');
    expect(sessionsPage).toContain('canShowSessionsRrReassign');
  });
});
