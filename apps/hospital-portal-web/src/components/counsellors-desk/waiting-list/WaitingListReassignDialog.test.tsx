import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CounsellingStatusMessage } from '@/components/counsellors-desk/session/primitives/CounsellingStatusMessage';
import { REASSIGN_REASON_OPTIONS } from '@/lib/counsellors-desk/reassign-dialog-form';

/**
 * Slice 6 Reassign dialog — UX refinement + prior CounsellingStatusMessage regression.
 */
describe('WaitingListReassignDialog — UX + CounsellingStatusMessage usage', () => {
  const src = readFileSync(resolve(__dirname, './WaitingListReassignDialog.tsx'), 'utf8');

  it('does not pass unsupported tone="muted" (root cause of Reassign crash)', () => {
    expect(src).not.toContain('tone="muted"');
    expect(src).not.toContain("tone='muted'");
  });

  it('uses title prop API matching Assign dialog (not children-as-message)', () => {
    expect(src).toContain('tone="loading"');
    expect(src).toContain('title="Loading counsellors…"');
    expect(src).toContain('tone="error"');
    expect(src).toContain('title={listError');
    expect(src).toContain('title="No eligible counsellors available"');
  });

  it('uses a single New owner CounsellingSelect without standalone search', () => {
    expect(src).not.toContain('CounsellingSearchInput');
    expect(src).not.toContain('waiting-list-reassign-search');
    expect(src).not.toContain('setSearchQuery');
    expect(src).toContain('waiting-list-reassign-select');
    expect(src).toContain('placeholder="Select counsellor"');
    expect(src).toContain('excludeCurrentOwnerFromTargets');
    expect(src).toContain("setSelectedId('')");
  });

  it('uses structured Reason select with Other additional reason', () => {
    expect(src).toContain('waiting-list-reassign-reason');
    expect(src).toContain('waiting-list-reassign-additional-reason');
    expect(src).toContain('REASSIGN_REASON_OPTIONS');
    expect(src).toContain('REASSIGN_OTHER_REASON');
    expect(src).toContain('placeholder="Select reason"');
    expect(src).toContain('Additional reason');
    for (const option of REASSIGN_REASON_OPTIONS) {
      expect(REASSIGN_REASON_OPTIONS).toContain(option);
    }
  });

  it('preserves Reassign contract fields (expectedCounselorId + reason string only)', () => {
    expect(src).toContain('reassignSession');
    expect(src).toContain('expectedCounselorId');
    expect(src).toContain('reason: resolved.reason');
    expect(src).not.toContain('reasonCode');
    expect(src).not.toContain('reasonId');
    expect(src).toContain('waiting-list-reassign-dialog');
    expect(src).toContain('waiting-list-reassign-submit');
    expect(src).toContain("toast.success('Session reassigned')");
  });

  it('sends the expected Version and surfaces 409s via the shared concurrency helper (Phase 3I Slice 7)', () => {
    expect(src).toContain('version: sessionVersion');
    expect(src).toContain('isSessionConcurrencyConflict');
    expect(src).toContain('getSessionConcurrencyMessage');
    expect(src).toContain('sessionVersion?: number');
  });

  it('enables submit from validation helpers, not by dropping owner/reason checks', () => {
    expect(src).toContain('canSubmitReassignForm');
    expect(src).toContain('disabled={!canSubmit}');
    expect(src).not.toContain('listState !== \'ready\'');
  });

  it('Reassign loading/empty/error status paths render without invalid element', () => {
    expect(() =>
      renderToStaticMarkup(
        <CounsellingStatusMessage tone="loading" title="Loading counsellors…" />,
      ),
    ).not.toThrow();
    expect(() =>
      renderToStaticMarkup(
        <CounsellingStatusMessage
          tone="info"
          title="No eligible counsellors available"
        />,
      ),
    ).not.toThrow();
    expect(() =>
      renderToStaticMarkup(
        <CounsellingStatusMessage
          tone="error"
          title="Could not load counsellors."
        />,
      ),
    ).not.toThrow();
  });
});
