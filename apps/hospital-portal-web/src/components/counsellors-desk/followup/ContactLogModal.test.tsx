import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ContactLogModal — Phase 3I Slice 7 (PD-S7-02) Version concurrency.
 *
 * ContactLogModal is opened from a followup row that only carries sessionId/patientName/phone —
 * it has no session context of its own, so it must fetch the current CounselingSession.Version
 * lazily on open and send it back on the comm-log write. These are source-content contracts
 * (matching the existing test style for this module) rather than full render/interaction tests,
 * since this codebase does not use @testing-library/react for these dynamic() modal components.
 */
describe('ContactLogModal — Version concurrency (Phase 3I Slice 7)', () => {
  const src = readFileSync(resolve(__dirname, './ContactLogModal.tsx'), 'utf8');

  it('fetches the session Version lazily on open via getSession(skipCatalogFallback)', () => {
    expect(src).toContain('loadSessionVersion');
    expect(src).toMatch(
      /counsellorsDeskApi\s*\.getSession\(sessionId,\s*\{\s*skipCatalogFallback:\s*true\s*\}\)/,
    );
    expect(src).toMatch(/loadSessionVersion\(\);[\s\S]{0,80}\}, \[isOpen, sessionId/);
  });

  it('sends the fetched Version on logCommunication and updates local state from sessionVersion', () => {
    expect(src).toMatch(/logCommunication\(sessionId,\s*\{\s*\n?\s*version:\s*sessionVersion,/);
    expect(src).toContain('logResult.sessionVersion');
    expect(src).toContain('setSessionVersion(logResult.sessionVersion)');
  });

  it('blocks submission when the Version has not loaded (never sends an undefined expected Version)', () => {
    expect(src).toMatch(/typeof sessionVersion !== 'number'/);
    expect(src).toContain('disabled={saving || versionLoading || typeof sessionVersion !== \'number\'}');
  });

  it('surfaces 409 conflicts via the shared concurrency helper and refreshes the Version (no auto-retry of the write)', () => {
    expect(src).toContain('isSessionConcurrencyConflict(err)');
    expect(src).toContain('getSessionConcurrencyMessage(err)');
    expect(src).toMatch(/isSessionConcurrencyConflict\(err\)[\s\S]{0,400}loadSessionVersion\(\)/);
    // No retry of the logCommunication call itself inside the conflict branch.
    const conflictBranch = src.match(/else if \(isSessionConcurrencyConflict\(err\)\) \{[\s\S]*?\}/);
    expect(conflictBranch).toBeTruthy();
    expect(conflictBranch![0]).not.toContain('logCommunication');
  });

  it('resets Version state when the modal closes', () => {
    expect(src).toMatch(/resetForm[\s\S]{0,400}setSessionVersion\(undefined\)/);
  });
});
