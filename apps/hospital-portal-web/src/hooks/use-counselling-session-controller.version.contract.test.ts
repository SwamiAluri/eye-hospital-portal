import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 3I Slice 7 (PD-S7-01/06/07) — use-counselling-session-controller.ts Version wiring.
 *
 * This hook is a ~2000-line orchestrator wired to TanStack Query, next/navigation, and many
 * sibling hooks — a full render/interaction test would require mocking most of the counselling
 * desk stack. Following this codebase's existing convention for large orchestration files
 * (see waiting-list-lifecycle-claim.contract.test.ts), these are source-content contracts that
 * pin down the Version concurrency wiring: every covered mutation sends session.version, the
 * bumped Version from the response is patched onto local session state, and 409s stop cold with
 * no auto-retry.
 */
describe('use-counselling-session-controller — Version concurrency (Phase 3I Slice 7)', () => {
  const src = readFileSync(resolve(__dirname, './use-counselling-session-controller.ts'), 'utf8');

  it('exposes updateSessionVersion / bumpSessionVersionLocally for out-of-band callers', () => {
    expect(src).toMatch(/const updateSessionVersion = useCallback\(\(version\?: number\)/);
    expect(src).toContain('bumpSessionVersionLocally');
    // Both must be part of the hook's returned object so context consumers (e.g.
    // CounsellingProceduresWorkspace) can patch Version after refresh-from-opd.
    expect(src).toMatch(/return \{[\s\S]{0,400}updateSessionVersion/);
    expect(src).toMatch(/return \{[\s\S]{0,400}bumpSessionVersionLocally/);
  });

  it('keeps a sync sessionVersionRef so Start/Save Draft → immediate Complete cannot send a stale Version', () => {
    expect(src).toContain('sessionVersionRef');
    expect(src).toContain('sessionForMutation');
    expect(src).toContain('resolveMutationVersion');
    expect(src).toMatch(/sessionVersionRef\.current = version/);
  });

  it('startSession calls (re-evaluate, start-repeat, start-counselling) send mutationSession.version and patch the response Version', () => {
    const startCalls = [...src.matchAll(/counsellorsDeskApi\.startSession\([\s\S]*?\)/g)].map((m) => m[0]);
    expect(startCalls.length).toBeGreaterThanOrEqual(3);
    for (const call of startCalls) {
      expect(call).toMatch(/mutationSession\?\.version|mutationSession\.version/);
    }
  });

  it('Start Counseling patches Version from the Start response before getSession verification', () => {
    expect(src).toMatch(
      /const startedOp = await counsellorsDeskApi\.startSession[\s\S]{0,200}updateSessionVersion\(startedOp\.version\)/,
    );
    expect(src).toMatch(/updateSessionVersion\(started\.version \?\? startedOp\.version\)/);
  });

  it('startSession / getSession results update local Version via updateSessionVersion or an explicit version field', () => {
    expect(src).toMatch(/updateSessionVersion\(started\.version/);
  });

  it('every startSession call site stops on 409 with the shared concurrency helper (no auto-retry)', () => {
    const conflictGuards = src.match(/isSessionConcurrencyConflict\(err\)/g) ?? [];
    expect(conflictGuards.length).toBeGreaterThanOrEqual(3);
    expect(src).toContain('getSessionConcurrencyMessage(err)');
  });

  it('handleSaveDraft and handleSave patch session.version from onSuccess and sync Version on 409', () => {
    expect(src).toMatch(/onSuccess:\s*\(snapshot,\s*version\)\s*=>\s*\{[\s\S]{0,120}updateSessionVersion\(version\)/);
    expect(src).toMatch(
      /onSuccess:\s*\(\{\s*snapshot,\s*queueStatus:\s*nextStatus,\s*openCoverageTab,\s*version\s*\}\)\s*=>\s*\{[\s\S]{0,200}updateSessionVersion\(version\)/,
    );
    expect(src).toContain('onConcurrencyVersionSync: updateSessionVersion');
    expect(src).toContain('session: counsellingMutationSession');
  });

  it('syncs CounselingSession.Version after coverage/system writers before Save Draft', () => {
    expect(src).toContain('syncSessionVersionFromServer');
    expect(src).toContain('fetchCounsellingSessionVersion');
    expect(src).toMatch(
      /if \(showCoverageWorkflow \|\| coverageTabMounted\) \{\s*await syncSessionVersionFromServer\(\);/,
    );
    expect(src).toMatch(
      /coverageSaved = await saveCoveragePanelDraft\(\{ force: true \}\);[\s\S]{0,200}await syncSessionVersionFromServer\(\);/,
    );
    expect(src).toContain('void syncSessionVersionFromServer()');
    expect(src).toMatch(/const handleCaseWorkspaceChange = useCallback\(/);
  });

  it('Save/Complete preserve ReQueue AdditionalNotes markers via parse/compose (not shown in Notes UI)', () => {
    expect(src).toContain('composeCounsellorAdditionalNotes');
    expect(src).toContain('parseCounsellorAdditionalNotes');
    expect(src).toContain('requeueNoteEventsRef');
    expect(src).not.toMatch(/setRequeueNoteEvents/);
  });
});
