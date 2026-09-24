import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 3I — Done Re-evaluate / Repeat Start must reopen Auth queue
 * (StartSession) so Waiting List projects Processing after return/refresh.
 * Azure + local FE status alone are not authoritative.
 */
const controllerSrc = readFileSync(
  join(__dirname, '../../../../hooks/use-counselling-session-controller.ts'),
  'utf8',
);
const pageSrc = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

function extractBlock(src: string, startMarker: string, endMarker: string): string {
  const start = src.indexOf(startMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = src.indexOf(endMarker, start + startMarker.length);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe('Waiting List lifecycle status sync contracts', () => {
  it('executeReEvaluate calls Auth startSession before Azure reEvaluate enrichment', () => {
    const block = extractBlock(
      controllerSrc,
      'const executeReEvaluate = useCallback(async () => {',
      'const handleReEvaluate = useCallback(() => {',
    );
    expect(block).toMatch(
      /counsellorsDeskApi\.startSession\(\s*sessionId,\s*undefined,\s*mutationSession\?\.version,?/,
    );
    expect(block).toMatch(/counsellingAzureApi\.reEvaluate\(sessionId\)/);
    const authIdx = block.search(
      /counsellorsDeskApi\.startSession\(\s*sessionId,\s*undefined,\s*mutationSession\?\.version,?/,
    );
    const azureIdx = block.indexOf('counsellingAzureApi.reEvaluate(sessionId)');
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(azureIdx).toBeGreaterThan(authIdx);
  });

  it('Start Repeat continues to use Auth startSession (authoritative reopen)', () => {
    const block = extractBlock(
      controllerSrc,
      'const handleStartRepeatSession = useCallback(async () => {',
      '// Waiting List Re-evaluate CTA',
    );
    expect(block).toMatch(
      /counsellorsDeskApi\.startSession\(\s*sessionId,\s*repeatSessionTypeCode,\s*mutationSession\?\.version,?/,
    );
  });

  it('current-owner Re-evaluate uses existing Continue confirmation before navigate', () => {
    expect(pageSrc).toContain("decision.path === 'continue'");
    expect(pageSrc).toContain('Re-evaluate Session');
    expect(pageSrc).toContain(
      'Changing the procedure will restart the counselling process (Done → In Progress). Continue?',
    );
    expect(pageSrc).toContain("confirmText: 'Continue'");
    // Must not replace current-owner path with Assign-to-me.
    const continueBlock = extractBlock(
      pageSrc,
      "if (decision.path === 'continue') {",
      "if (decision.path === 'blocked') {",
    );
    expect(continueBlock).toContain("kind === 're-evaluate'");
    expect(continueBlock).toContain('showConfirmation');
    expect(continueBlock).not.toContain('Assign to me');
    expect(continueBlock).not.toContain('Continue as me');
    expect(continueBlock).not.toContain('claimSessionForLifecycle');
  });

  it('NULL/other-owner path uses Continue as me + claim-for-lifecycle', () => {
    expect(pageSrc).toContain('Continue as me');
    expect(pageSrc).toContain('buildLifecycleOwnershipConfirmCopy');
    expect(pageSrc).toContain('claimSessionForLifecycle');
  });

  it('lifecycle query still consumed once on session page (no second prompt)', () => {
    expect(controllerSrc).toContain("lifecycleParam !== 're-evaluate'");
    expect(controllerSrc).toContain('lifecycleHandledRef.current = `${sessionId}:re-evaluate`');
    expect(controllerSrc).toContain("lifecycleParam !== 'start-repeat'");
    expect(controllerSrc).toContain('lifecycleHandledRef.current = `${sessionId}:start-repeat`');
    expect(controllerSrc).toContain("lifecycleParam !== 'start-counseling'");
    expect(controllerSrc).toContain('lifecycleHandledRef.current = `${sessionId}:start-counseling`');
  });

  it('Pending Start Counseling uses Auth startSession (not silent Pending auto-start)', () => {
    expect(controllerSrc).toContain('handleStartCounselingSession');
    expect(controllerSrc).toMatch(
      /const handleStartCounselingSession[\s\S]*?counsellorsDeskApi\.startSession\(\s*sessionId,\s*undefined,\s*mutationSession\?\.version,?/,
    );
    expect(controllerSrc).toContain('assertCounsellingStartReachedProcessing');
    expect(controllerSrc).not.toMatch(
      /if \(data\.status === 'Pending'\)[\s\S]{0,200}counsellorsDeskApi\.startSession/,
    );
  });
});
