import { describe, expect, it } from 'vitest';
import {
  FINALIZE_OT_MUTATE_PERMISSION,
  FINALIZE_OUTPATIENT_CHECKLIST_EDIT_PERMISSION,
  canEditFinalizeOutpatientChecklist,
  canMutateFinalizeOt,
  resolveFinalizeChecklistReadOnly,
  resolveFinalizeOtFormLocked,
  resolveFinalizeQueuePrimaryAction,
} from './finalize-ot-authorization';

describe('FS-03 Finalize OT authorization alignment', () => {
  it('Test 1 — counseling_sessions.update grants mutate without checklist edit', () => {
    const perms = [FINALIZE_OT_MUTATE_PERMISSION];
    expect(canMutateFinalizeOt(perms)).toBe(true);
    expect(canEditFinalizeOutpatientChecklist(perms)).toBe(false);
    expect(
      resolveFinalizeOtFormLocked({ isStatusLocked: false, canMutateOt: true }),
    ).toBe(false);
    expect(resolveFinalizeQueuePrimaryAction('NotConfirmed', true).action).toBe('confirm');
    expect(resolveFinalizeQueuePrimaryAction('Confirmed', true).action).toBe('finalise');
  });

  it('Test 2 — without counseling_sessions.update, mutations are not actionable', () => {
    const perms = ['counseling_sessions.read'];
    expect(canMutateFinalizeOt(perms)).toBe(false);
    expect(
      resolveFinalizeOtFormLocked({ isStatusLocked: false, canMutateOt: false }),
    ).toBe(true);
    expect(resolveFinalizeQueuePrimaryAction('NotConfirmed', false)).toEqual({
      label: 'Open',
      openModal: true,
      variant: 'ghost',
    });
    expect(resolveFinalizeQueuePrimaryAction('Confirmed', false).action).toBeUndefined();
    expect(resolveFinalizeQueuePrimaryAction('OTPrepared', false).action).toBeUndefined();
  });

  it('Test 3 — outpatient checklist edit alone does NOT grant Finalize mutations', () => {
    const perms = [FINALIZE_OUTPATIENT_CHECKLIST_EDIT_PERMISSION];
    expect(canEditFinalizeOutpatientChecklist(perms)).toBe(true);
    expect(canMutateFinalizeOt(perms)).toBe(false);
    expect(
      resolveFinalizeOtFormLocked({ isStatusLocked: false, canMutateOt: false }),
    ).toBe(true);
    expect(resolveFinalizeQueuePrimaryAction('NotConfirmed', false).label).toBe('Open');
  });

  it('Test 4 — Prepare OT / confirm / reopen share mutate permission contract', () => {
    expect(FINALIZE_OT_MUTATE_PERMISSION).toBe('counseling_sessions.update');
    expect(canMutateFinalizeOt([FINALIZE_OT_MUTATE_PERMISSION])).toBe(true);
    expect(resolveFinalizeQueuePrimaryAction('OTPrepared', true).action).toBe('reopen');
    expect(resolveFinalizeQueuePrimaryAction('Cancelled', true).action).toBe('reopen');
  });

  it('keeps checklist editability independent of OT mutate lock', () => {
    expect(
      resolveFinalizeChecklistReadOnly({
        isStatusLocked: false,
        canEditChecklist: true,
      }),
    ).toBe(false);
    expect(
      resolveFinalizeChecklistReadOnly({
        isStatusLocked: false,
        canEditChecklist: false,
      }),
    ).toBe(true);
    expect(
      resolveFinalizeChecklistReadOnly({
        isStatusLocked: true,
        canEditChecklist: true,
      }),
    ).toBe(true);
  });

  it('wildcard permission grants mutate', () => {
    expect(canMutateFinalizeOt(['*'])).toBe(true);
  });
});
