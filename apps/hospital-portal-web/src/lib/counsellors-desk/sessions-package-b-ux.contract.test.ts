import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const sessionsPage = readFileSync(
  resolve(__dirname, '../../app/dashboard/counsellors-desk/sessions/page.tsx'),
  'utf8',
);

describe('Phase 3I Slice 13 Package B — Sessions UX remediation contracts', () => {
  it('uses Counsellor shell + pill RR filter patterns (no second RR mechanism)', () => {
    expect(sessionsPage).toContain('counsellingSessionTokens.shellPage');
    expect(sessionsPage).toContain('counsellingSessionTokens.sessionWidget');
    expect(sessionsPage).toContain('counsellingSessionTokens.pillTab');
    expect(sessionsPage).toContain('counsellingSessionTokens.pillTabCurrent');
    expect(sessionsPage).toContain('aria-pressed={reassignmentRequired}');
    expect(sessionsPage).toContain('data-testid="reassignment-required-filter"');
    expect(sessionsPage).toContain('toggleReassignmentRequiredInSearchParams');
  });

  it('does not duplicate RR as a filter chip when the pill already shows it', () => {
    expect(sessionsPage).toContain('Non-RR filter chips only');
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
    expect(sessionsPage).toContain('No sessions require reassignment');
    expect(sessionsPage).toContain('None match the Reassignment Required filter.');
    expect(sessionsPage).toContain('data-testid="sessions-list-empty"');
  });

  it('does not expose ReQueue or invent Owner column / KPI strip', () => {
    expect(sessionsPage).not.toMatch(/ReQueue|re-queue|requeue/i);
    expect(sessionsPage).not.toMatch(/>Owner</);
    expect(sessionsPage).not.toMatch(/kpi|KPI/i);
  });
});
