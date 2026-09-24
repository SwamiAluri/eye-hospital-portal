import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 3I Slice 7 (PD-S7-01/06) — refresh-from-opd Version wiring for CounsellorBiometryStatus
 * (CounsellingProceduresWorkspace). Source-content contract, matching this codebase's convention
 * for large session-context-wired components (see waiting-list-lifecycle-claim.contract.test.ts).
 */
describe('CounsellingProceduresWorkspace — refresh-from-opd Version concurrency (Phase 3I Slice 7)', () => {
  const src = readFileSync(resolve(__dirname, './CounsellingProceduresWorkspace.tsx'), 'utf8');

  it('sends the current session.version as the expected Version on refresh-from-opd', () => {
    expect(src).toContain('counsellorsDeskApi.refreshSessionFromOpd(sessionId, session?.version)');
  });

  it('patches local session state with the bumped Version from the response', () => {
    expect(src).toMatch(/updateSessionVersion\(snap\.version\)/);
    expect(src).toContain('updateSessionVersion } = useCounsellingSession()');
  });

  it('stops on 409 with the shared concurrency helper and does not fall through to the generic error toast', () => {
    expect(src).toContain('isSessionConcurrencyConflict(err)');
    expect(src).toContain('getSessionConcurrencyMessage(err)');
    expect(src).toMatch(/if \(isSessionConcurrencyConflict\(err\)\)\s*\{[\s\S]{0,200}return;\s*\}/);
  });
});
