import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const sessionsPage = readFileSync(
  resolve(__dirname, '../../app/dashboard/counsellors-desk/sessions/page.tsx'),
  'utf8',
);

const sidebar = readFileSync(
  resolve(__dirname, '../navigation/sidebar-menu-sections.tsx'),
  'utf8',
);

describe('Phase 3I Slice 13 Package B — Sessions page + nav contracts', () => {
  it('reuses WaitingListReassignDialog and reassignSession path (no second mutation)', () => {
    expect(sessionsPage).toContain('WaitingListReassignDialog');
    expect(sessionsPage).toContain('canShowSessionsRrReassign');
    expect(sessionsPage).toContain('COUNSELLING_SESSIONS_REASSIGN_PERMISSION');
    expect(sessionsPage).toContain('data-testid="sessions-row-reassign"');
  });

  it('does not expose ReQueue from Sessions', () => {
    expect(sessionsPage).not.toMatch(/ReQueue|re-queue|requeue/i);
  });

  it('gates Reassign on RR filter + permission helper (PD-S13-A = C)', () => {
    expect(sessionsPage).toContain('canShowSessionsRrReassign');
    expect(sessionsPage).toContain('reassignmentRequiredFilter: reassignmentRequired');
  });

  it('adds existing Sessions route to Counsellor sidebar (PD-S13-B = B)', () => {
    expect(sidebar).toContain("label: 'Counselling Sessions'");
    expect(sidebar).toContain("href: '/dashboard/counsellors-desk/sessions'");
    expect(sidebar).toContain("requiredPermission: 'counseling_sessions.read'");
    // No new RR worklist route / alias
    expect(sidebar).not.toContain('reassignment-required');
    expect(sidebar).not.toContain('/counsellors-desk/reassignment');
  });

  it('does not force reassignmentRequired=true on the nav href', () => {
    const sessionsNavBlock = sidebar.slice(
      sidebar.indexOf("label: 'Counselling Sessions'"),
      sidebar.indexOf("label: 'Counselling Sessions'") + 280,
    );
    expect(sessionsNavBlock).toContain("/dashboard/counsellors-desk/sessions'");
    expect(sessionsNavBlock).not.toContain('reassignmentRequired');
  });
});
