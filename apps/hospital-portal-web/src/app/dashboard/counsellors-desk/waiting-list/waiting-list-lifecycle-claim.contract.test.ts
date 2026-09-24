import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSrc = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
const tabPanelSrc = readFileSync(
  join(
    __dirname,
    '../../../../components/counsellors-desk/session/CounsellingTabPanel.tsx',
  ),
  'utf8',
);
const sessionContentSrc = readFileSync(
  join(
    __dirname,
    '../../../../components/counsellors-desk/session/CounsellingSessionPageContent.tsx',
  ),
  'utf8',
);
const queueWidgetSrc = readFileSync(
  join(
    __dirname,
    '../../../../components/counsellors-desk/waiting-list/WaitingListQueueWidget.tsx',
  ),
  'utf8',
);

describe('Waiting List lifecycle ownership claim contracts', () => {
  it('resolves ownership then continues via claim-for-lifecycle only (no Slice 3 Assign, no peer picker)', () => {
    expect(pageSrc).toContain('resolveLifecycleOwnershipDecision');
    expect(pageSrc).toContain('Continue as me');
    expect(pageSrc).toContain('buildLifecycleOwnershipConfirmCopy');
    expect(pageSrc).toContain("kind === 're-evaluate' ? 'ReEvaluate' : 'StartRepeat'");
    expect(pageSrc).toContain('claimSessionForLifecycle');
    expect(pageSrc).toMatch(/expectedCounselorId:\s*decision\.expectedCounselorId/);
    expect(pageSrc).toMatch(/intent,/);
    expect(pageSrc).not.toMatch(/assignSession\(/);
    expect(pageSrc).not.toMatch(/claimSessionForLifecycle[\s\S]{0,400}getCounselors/);
  });

  it('Processing self-assign opens counselling workflow; Pending assign does not auto-start', () => {
    expect(pageSrc).toContain('shouldOpenProcessingAfterAssign');
    expect(pageSrc).toContain('navigateToSession(patient)');
    expect(pageSrc).toMatch(
      /shouldOpenProcessingAfterAssign[\s\S]{0,400}navigateToSession\(patient\)/,
    );
  });

  it('Pending Start Counseling passes lifecycle=start-counseling (explicit start, not silent)', () => {
    expect(pageSrc).toContain("if (lifecycle === 'open') qs.set('lifecycle', 'start-counseling')");
    expect(pageSrc).toContain("kind === 'open'");
    expect(pageSrc).toContain("navigateToSession(patient, 'open')");
  });

  it('Done/Repeat row click does not pass lifecycle query (no silent start)', () => {
    expect(pageSrc).toContain(
      '// Done/owned Repeat row click = view only — never silently start lifecycle or claim ownership.',
    );
    expect(pageSrc).toMatch(
      /Done\/owned Repeat row click[\s\S]{0,200}navigateToSession\(patient\);/,
    );
  });

  it('409 ownership/Version conflict surfaces the server message, refreshes list, and does not navigate', () => {
    // Phase 3I Slice 7 (PD-S7-06/07): claim-for-lifecycle 409s cover both stale-ownership and
    // stale-Version — the server message (SessionConcurrency.StaleMessage vs "Session ownership
    // changed.") is surfaced verbatim via the shared concurrency helper, no auto-retry.
    expect(pageSrc).toContain('isSessionConcurrencyConflict');
    expect(pageSrc).toContain('getSessionConcurrencyMessage');
    expect(pageSrc).toMatch(/isSessionConcurrencyConflict\(err\)[\s\S]{0,300}waitingListQuery\.refetch/);
  });

  it('claim-for-lifecycle sends the expected Version (Phase 3I Slice 7)', () => {
    expect(pageSrc).toMatch(/version:\s*patient\.version/);
  });

  it('Done workspace no longer mounts large Re-evaluate banner', () => {
    expect(tabPanelSrc).not.toContain('Session completed');
    expect(tabPanelSrc).not.toMatch(/title=["']Re-evaluate["']/);
  });

  it('Waiting List owns Start Repeat entry (session page does not add a second CTA gate)', () => {
    expect(sessionContentSrc).toContain(
      'Waiting List owns Start Repeat / Re-evaluate',
    );
    expect(pageSrc).toContain("kind === 'start-repeat'");
    expect(pageSrc).toContain("qs.set('lifecycle', 'start-repeat')");
  });

  it('Attention column removed from Patient Queue cues', () => {
    expect(queueWidgetSrc).toContain("'Patient'");
    expect(queueWidgetSrc).toContain("'Visit'");
    expect(queueWidgetSrc).toContain("'Procedure / Eye'");
    expect(queueWidgetSrc).toContain("'Owner'");
    expect(queueWidgetSrc).toContain("'Status'");
    expect(queueWidgetSrc).toContain("'Action'");
    expect(queueWidgetSrc).not.toContain('Attention');
  });
});
