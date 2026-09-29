import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const sessionsPage = readFileSync(
  resolve(__dirname, '../../app/dashboard/counsellors-desk/sessions/page.tsx'),
  'utf8',
);

describe('Phase 3I Slice 13 Package B — Sessions UX remediation contracts', () => {
  it('uses the Counsellor shell and one filter sheet for the register', () => {
    expect(sessionsPage).toContain('counsellingSessionTokens.shellPage');
    expect(sessionsPage).toContain('counsellingSessionTokens.sessionWidget');
    expect(sessionsPage).toContain('data-testid="sessions-filters-open"');
    expect(sessionsPage).toContain('id="sessions-filter-rr"');
    expect(sessionsPage).toContain('applySessionsRegisterDraft');
    expect(sessionsPage).not.toContain('toggleReassignmentRequiredInSearchParams');
    expect(sessionsPage).not.toContain('pillTabCurrent');
  });

  it('shows Reassignment Required as a removable register filter', () => {
    expect(sessionsPage).toContain('Active register filters, including Reassignment Required.');
    expect(sessionsPage).toContain('>Reassignment required<');
    expect(sessionsPage).not.toMatch(
      /if \(reassignmentRequired\) chips\.push\('Reassignment Required'\)/,
    );
  });

  it('keeps Open primary and Reassign secondary with existing gating', () => {
    expect(sessionsPage).toContain('data-testid="sessions-row-open"');
    expect(sessionsPage).toContain('data-testid="sessions-row-reassign"');
    expect(sessionsPage).toContain('canShowSessionsRrReassign');
    expect(sessionsPage).toContain('variant="default"');
    expect(sessionsPage).toContain('WaitingListReassignDialog');

    const openIdx = sessionsPage.indexOf('data-testid="sessions-row-open"');
    const reassignIdx = sessionsPage.indexOf('data-testid="sessions-row-reassign"');
    expect(openIdx).toBeGreaterThan(-1);
    expect(reassignIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeLessThan(reassignIdx);
  });

  it('uses statusPill for Decision and preserves column IA', () => {
    expect(sessionsPage).toContain('counsellingSessionTokens.statusPill');
    expect(sessionsPage).toContain('statusPillRequired');
    expect(sessionsPage).toContain('statusPillComplete');
    expect(sessionsPage).toContain('statusPillDanger');
    expect(sessionsPage).toMatch(/Patient/);
    expect(sessionsPage).toMatch(/Session date/);
    expect(sessionsPage).toMatch(/Surgery/);
    expect(sessionsPage).toMatch(/Decision/);
    expect(sessionsPage).toMatch(/Action/);
    expect(sessionsPage).toContain('aria-label="Counselling sessions"');
  });

  it('uses the approved RR empty-state copy', () => {
    expect(sessionsPage).toContain('resolveSessionsEmptyCopy');
    expect(sessionsPage).toContain('role="status"');
    expect(sessionsPage).toContain('data-testid="sessions-list-empty"');
    expect(sessionsPage).not.toContain('None match the Reassignment Required filter.');
  });

  it('shows Owner and Status from the list payload and does not add a KPI strip or ReQueue', () => {
    expect(sessionsPage).toMatch(/>\s*Owner\s*</);
    expect(sessionsPage).toMatch(/>\s*Status\s*</);
    expect(sessionsPage).toContain('sessionsOwnerLabel');
    expect(sessionsPage).toContain('formatSessionListStatus');
    expect(sessionsPage).not.toMatch(/ReQueue|re-queue|requeue/i);
    expect(sessionsPage).not.toMatch(/kpi|KPI/i);
  });
});
