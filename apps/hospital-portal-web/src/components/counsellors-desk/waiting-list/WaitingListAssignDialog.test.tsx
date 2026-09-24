import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Waiting List open guard + Assign dialog (Slice 3 final)', () => {
  it('Pending/Processing+Unassigned row click opens Assign dialog directly (no toast, no navigate)', () => {
    const page = readFileSync(
      resolve(__dirname, '../../../app/dashboard/counsellors-desk/waiting-list/page.tsx'),
      'utf8',
    );
    const rowClickMatch = page.match(
      /const handleRowClick = useCallback\(\(patient: WaitingListPatient\) => \{[\s\S]*?\}, \[canAssign, navigateToSession\]\);/,
    );
    expect(rowClickMatch).toBeTruthy();
    const handleRowClick = rowClickMatch![0];

    expect(handleRowClick).toContain('isWaitingListEligibleForInitialAssign(patient)');
    expect(handleRowClick).toContain('setSelectedId(patient.id)');
    expect(handleRowClick).toContain('if (canAssign) setAssignPatient(patient)');
    expect(handleRowClick).toContain('return');
    expect(handleRowClick).not.toContain('Assign this session before opening it.');
    expect(handleRowClick).not.toContain('toast.error');

    const eligibleBlock = handleRowClick.match(
      /if \(isWaitingListEligibleForInitialAssign\(patient\)\) \{[\s\S]*?return;\s*\}/,
    );
    expect(eligibleBlock).toBeTruthy();
    expect(eligibleBlock![0]).not.toContain('router.push');
    expect(eligibleBlock![0]).not.toContain('counsellingAzureApi.start');
    expect(eligibleBlock![0]).not.toContain('assign(');
    expect(eligibleBlock![0]).not.toContain('CounselorId');

    expect(page).toContain('sessionBranchId={assignPatient?.branchId}');
  });

  it('Assign dialog excludes self from peer list and gates Assign to me', () => {
    const src = readFileSync(resolve(__dirname, './WaitingListAssignDialog.tsx'), 'utf8');
    expect(src).toContain('canShowCounsellingAssignToMe');
    expect(src).toContain('Assign to me');
    expect(src).toContain('c.id !== currentUserId');
    expect(src).toContain('getCounselors(sessionBranchId)');
    expect(src).toContain('Session assigned to you.');
    expect(src).not.toContain('Claim');
  });

  it('Pending+Unassigned Assign supports current counsellor OR another counsellor', () => {
    const src = readFileSync(resolve(__dirname, './WaitingListAssignDialog.tsx'), 'utf8');
    expect(src).toContain('data-testid="waiting-list-assign-to-me"');
    expect(src).toContain('handleAssignToMe');
    expect(src).toContain('completeAssign(currentUserId');
    expect(src).toContain('data-testid="waiting-list-assign-counsellor"');
    expect(src).toContain('data-testid="waiting-list-assign-confirm"');
    expect(src).toContain('handleConfirmPeer');
    expect(src).toContain('completeAssign(selectedId');
    expect(src).toContain('counsellorsDeskApi.assignSession(sessionId, targetId, sessionVersion)');
  });
});

describe('Waiting List Assign dialog — UAT UX refinement', () => {
  const src = readFileSync(resolve(__dirname, './WaitingListAssignDialog.tsx'), 'utf8');

  it('shows patient context and Counselling owner label', () => {
    expect(src).toContain('Assign session');
    expect(src).toContain('patientName');
    expect(src).toContain('Counselling owner');
  });

  it('uses eligible count from API result and client-side search', () => {
    expect(src).toContain('formatEligibleCounsellorCount');
    expect(src).toContain('filterCounselorsByQuery');
    expect(src).toContain('CounsellingSearchInput');
    expect(src).toContain('waiting-list-assign-search');
    expect(src).toContain('waiting-list-assign-eligible-count');
  });

  it('distinguishes loading, empty, no-match, and error states', () => {
    expect(src).toContain('resolveAssignCounsellorListState');
    expect(src).toContain('No eligible counsellors available');
    expect(src).toContain('No counsellors match');
    expect(src).toContain("tone=\"loading\"");
    expect(src).toContain('listError');
  });

  it('disables Assign when there is no valid target', () => {
    expect(src).toContain('assignDisabled');
    expect(src).toContain("listState === 'empty'");
    expect(src).toContain('disabled={assignDisabled}');
  });

  it('does not change Assign API contract (counselorId + optional Version only, no object body)', () => {
    expect(src).toContain('assignSession(sessionId, targetId, sessionVersion)');
    expect(src).not.toContain('reason:');
    expect(src).not.toMatch(/assignSession\([^)]+,\s*\{/);
  });

  it('surfaces 409 concurrency conflicts via the shared session-concurrency helper (Phase 3I Slice 7)', () => {
    expect(src).toContain('isSessionConcurrencyConflict');
    expect(src).toContain('getSessionConcurrencyMessage');
    expect(src).toContain('sessionVersion?: number');
  });
});
