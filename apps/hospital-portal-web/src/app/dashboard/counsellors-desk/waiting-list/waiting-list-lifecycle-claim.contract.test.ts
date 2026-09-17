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
    expect(pageSrc).toContain('Assign to me & Re-evaluate');
    expect(pageSrc).toContain('Assign to me & Start Repeat');
    expect(pageSrc).toContain("kind === 're-evaluate' ? 'ReEvaluate' : 'StartRepeat'");
    expect(pageSrc).toContain('claimSessionForLifecycle');
    expect(pageSrc).toMatch(/expectedCounselorId:\s*decision\.expectedCounselorId/);
    expect(pageSrc).toMatch(/intent,/);
    expect(pageSrc).not.toMatch(/assignSession\(/);
    expect(pageSrc).not.toMatch(/claimSessionForLifecycle[\s\S]{0,400}getCounselors/);
  });

  it('Pending Start Counseling passes lifecycle=start-counseling (explicit start, not silent)', () => {
    expect(pageSrc).toContain("if (lifecycle === 'open') qs.set('lifecycle', 'start-counseling')");
    expect(pageSrc).toContain("kind === 'open'");
    expect(pageSrc).toContain("navigateToSession(patient, 'open')");
  });

  it('Done/Repeat row click does not pass lifecycle query (no silent start)', () => {
    expect(pageSrc).toContain(
      '// Done/Repeat row click = view only — never silently start lifecycle or claim ownership.',
    );
    expect(pageSrc).toMatch(
      /Done\/Repeat row click[\s\S]{0,200}navigateToSession\(patient\);/,
    );
  });

  it('409 ownership conflict refreshes list and does not navigate', () => {
    expect(pageSrc).toContain('Session ownership changed. Refreshing the waiting list.');
    expect(pageSrc).toMatch(/status === 409[\s\S]{0,200}waitingListQuery\.refetch/);
  });

  it('Done workspace no longer mounts large Re-evaluate banner', () => {
    expect(tabPanelSrc).not.toContain('Session completed');
    expect(tabPanelSrc).not.toMatch(/title=["']Re-evaluate["']/);
  });

  it('Waiting List start-repeat entry does not gate on Repeat banner', () => {
    expect(sessionContentSrc).toContain('showRepeatStartControls = false');
    expect(sessionContentSrc).toContain('no second banner gate');
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
