import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 3I Slice 5 UAT gap — Pending = read-only until Start Counseling.
 * PD-PENDING-READONLY-01
 */
const controllerSrc = readFileSync(
  join(__dirname, '../../../../hooks/use-counselling-session-controller.ts'),
  'utf8',
);
const pageSrc = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
const headerSrc = readFileSync(
  join(
    __dirname,
    '../../../../components/counsellors-desk/session/SessionPageHeader.tsx',
  ),
  'utf8',
);
const actionsSrc = readFileSync(
  join(
    __dirname,
    '../../../../lib/counsellors-desk/counselling-session-actions.ts',
  ),
  'utf8',
);

describe('Waiting List Pending read-only contracts (PD-PENDING-READONLY-01)', () => {
  it('session isReadOnly seals Pending via isPendingLifecycleReadOnly (persisted status)', () => {
    expect(controllerSrc).toContain('isPendingLifecycleReadOnly(queueStatus)');
    expect(controllerSrc).toMatch(
      /const isReadOnly\s*=[\s\S]*?pendingLocksMutations/,
    );
  });

  it('row click navigates without lifecycle=start-counseling (no silent StartSession)', () => {
    expect(pageSrc).toContain('const handleRowClick = useCallback');
    const rowBlock = pageSrc.slice(
      pageSrc.indexOf('const handleRowClick = useCallback'),
      pageSrc.indexOf('const handleLifecycleAction = useCallback'),
    );
    expect(rowBlock).toContain('navigateToSession(patient)');
    expect(rowBlock).not.toContain("navigateToSession(patient, 'open')");
    expect(rowBlock).not.toContain('startSession');
  });

  it('Start Counseling alone passes lifecycle=start-counseling', () => {
    expect(pageSrc).toContain("if (lifecycle === 'open') qs.set('lifecycle', 'start-counseling')");
    expect(pageSrc).toContain("if (kind === 'open')");
    expect(pageSrc).toContain("navigateToSession(patient, 'open')");
  });

  it('Pending action bar hides Save Draft / mutation primary CTAs', () => {
    expect(actionsSrc).toContain("queueStatus === 'Pending'");
    expect(actionsSrc).toMatch(/queueStatus === 'Pending'[\s\S]*?showSaveDraft:\s*false/);
  });

  it('History / Clinical Recommendations remain available (not gated by isReadOnly)', () => {
    expect(headerSrc).toContain('openSessionHistory');
    expect(headerSrc).toContain('openClinicalRecommendations');
    expect(headerSrc).not.toMatch(/isReadOnly/);
  });

  it('lifecycle=start-counseling still requires Auth startSession (query param alone is not editability)', () => {
    expect(controllerSrc).toContain("lifecycleParam !== 'start-counseling'");
    expect(controllerSrc).toContain('handleStartCounselingSession');
    expect(controllerSrc).toMatch(
      /const handleStartCounselingSession[\s\S]*?counsellorsDeskApi\.startSession\(sessionId\)/,
    );
    expect(controllerSrc).toContain('assertCounsellingStartReachedProcessing');
  });
});
