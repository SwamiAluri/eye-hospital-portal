import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveIpRoleActions, nextPermittedClinicalAction } from './ip-role-actions';

describe('resolveIpRoleActions', () => {
  it('does not let view-only mutate', () => {
    const a = resolveIpRoleActions(['ip_management.view']);
    expect(a.canAdmit).toBe(false);
    expect(a.canSendToOt).toBe(false);
    expect(a.canAcceptOt).toBe(false);
    expect(a.canDischarge).toBe(false);
    expect(a.canApplyEmergencyFc).toBe(false);
    expect(a.canRefund).toBe(false);
  });

  it('lets ward edit cover admit / send / discharge fallbacks', () => {
    const a = resolveIpRoleActions(['ward.checklist.edit']);
    expect(a.canAdmit).toBe(true);
    expect(a.canReadyForOt).toBe(true);
    expect(a.canSendToOt).toBe(true);
    expect(a.canDischarge).toBe(true);
    expect(a.canAcceptOt).toBe(false);
    expect(a.canApplyEmergencyFc).toBe(false);
    expect(a.canDischargeOverride).toBe(false);
    expect(a.canUnmarkReady).toBe(false);
  });

  it('requires ip.ot.unmark_ready for revert, not ward edit', () => {
    expect(resolveIpRoleActions(['ip.ot.unmark_ready']).canUnmarkReady).toBe(true);
    expect(resolveIpRoleActions(['*']).canUnmarkReady).toBe(true);
  });

  it('lets OT sign cover accept / start / complete', () => {
    const a = resolveIpRoleActions(['ot.safety.sign']);
    expect(a.canAcceptOt).toBe(true);
    expect(a.canStartSurgery).toBe(true);
    expect(a.canCompleteSurgery).toBe(true);
    expect(a.canAdmit).toBe(false);
  });

  it('keeps refund and emergency FC fail-closed', () => {
    expect(resolveIpRoleActions([]).canRefund).toBe(false);
    expect(resolveIpRoleActions([]).canAuthorizeRefund).toBe(false);
    expect(resolveIpRoleActions([]).canApplyEmergencyFc).toBe(false);
    expect(resolveIpRoleActions(['bill.update']).canRefund).toBe(false);
    expect(resolveIpRoleActions(['bill.update']).canAuthorizeRefund).toBe(false);
    expect(resolveIpRoleActions(['opd_bill.refund']).canRefund).toBe(true);
    expect(resolveIpRoleActions(['opd_bill.refund']).canAuthorizeRefund).toBe(false);
    expect(resolveIpRoleActions(['opd_bill.refund.authorize']).canAuthorizeRefund).toBe(true);
  });

  it('keeps IOL mismatch override fail-closed', () => {
    expect(resolveIpRoleActions([]).canOverrideImplantMismatch).toBe(false);
    expect(resolveIpRoleActions(['ot.safety.sign', 'ip.surgery.complete']).canOverrideImplantMismatch).toBe(false);
    expect(resolveIpRoleActions(['ip.implant.mismatch.override']).canOverrideImplantMismatch).toBe(true);
    expect(resolveIpRoleActions(['*']).canOverrideImplantMismatch).toBe(true);
  });

  it('keeps wristband print fail-closed without ward-edit fallback', () => {
    expect(resolveIpRoleActions([]).canPrintSafetyToken).toBe(false);
    expect(resolveIpRoleActions(['ward.checklist.edit', 'ip.admit']).canPrintSafetyToken).toBe(false);
    expect(resolveIpRoleActions(['ip.safety_token.print']).canPrintSafetyToken).toBe(true);
    expect(resolveIpRoleActions(['*']).canPrintSafetyToken).toBe(true);
  });

  it('keeps post-op taper write fail-closed without ward-edit fallback', () => {
    expect(resolveIpRoleActions([]).canManagePostOp).toBe(false);
    expect(resolveIpRoleActions(['ward.checklist.edit', 'ip.discharge']).canManagePostOp).toBe(false);
    expect(resolveIpRoleActions(['ip.postop.manage']).canManagePostOp).toBe(true);
    expect(resolveIpRoleActions(['*']).canManagePostOp).toBe(true);
  });

  it('keeps follow-up book/link fail-closed without ward-edit fallback', () => {
    expect(resolveIpRoleActions([]).canBookFollowUp).toBe(false);
    expect(resolveIpRoleActions([]).canLinkFollowUp).toBe(false);
    expect(resolveIpRoleActions(['ward.checklist.edit', 'ip.discharge']).canBookFollowUp).toBe(false);
    expect(resolveIpRoleActions(['appointment.create']).canBookFollowUp).toBe(true);
    expect(resolveIpRoleActions(['appointment.view']).canLinkFollowUp).toBe(true);
    expect(resolveIpRoleActions(['*']).canBookFollowUp).toBe(true);
  });

  it('requires bill.create to create an IP bill, fail-closed', () => {
    expect(resolveIpRoleActions(['bill.update', 'ip.billing.collect']).canCreateBill).toBe(false);
    expect(resolveIpRoleActions(['bill.create']).canCreateBill).toBe(true);
    expect(resolveIpRoleActions(['*']).canCreateBill).toBe(true);
  });

  describe('empty claim (SEC-041 fail-closed)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('grants nothing at all when the JWT carries no permissions', () => {
      const a = resolveIpRoleActions([]);
      expect(Object.values(a).every(v => v === false)).toBe(true);
    });

    it('treats null and undefined the same as empty', () => {
      expect(resolveIpRoleActions(null).canAdmit).toBe(false);
      expect(resolveIpRoleActions(undefined).canBill).toBe(false);
    });

    it('renders no next clinical action for a permissionless user', () => {
      const none = resolveIpRoleActions([]);
      for (const state of ['Expected', 'Admitted', 'ReadyForSurgery', 'SentToOT',
        'InOT', 'SurgeryCompleted', 'PostOp', 'ReadyForDischarge']) {
        expect(nextPermittedClinicalAction(state, null, none)).toBeNull();
      }
    });

    it('does not fail open in production even with the flag set', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('NEXT_PUBLIC_PERMISSIONS_FAIL_OPEN', 'true');
      expect(resolveIpRoleActions([]).canAdmit).toBe(false);
      expect(resolveIpRoleActions([]).canBill).toBe(false);
    });

    it('restores operational access in development when the flag is set', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_PERMISSIONS_FAIL_OPEN', 'true');
      const a = resolveIpRoleActions([]);
      expect(a.canAdmit).toBe(true);
      expect(a.canBill).toBe(true);
      // Privileged actions stay closed regardless of the flag.
      expect(a.canRefund).toBe(false);
      expect(a.canDischargeOverride).toBe(false);
      expect(a.canApplyEmergencyFc).toBe(false);
      expect(a.canAdjustFinance).toBe(false);
      expect(a.canUnmarkReady).toBe(false);
      expect(a.canCreateBill).toBe(false);
      expect(a.canOverrideImplantMismatch).toBe(false);
      expect(a.canPrintSafetyToken).toBe(false);
      expect(a.canManagePostOp).toBe(false);
      expect(a.canBookFollowUp).toBe(false);
      expect(a.canLinkFollowUp).toBe(false);
    });
  });

  it('picks the next clinical action only when the role can perform it', () => {
    const ward = resolveIpRoleActions(['ward.checklist.edit']);
    expect(nextPermittedClinicalAction('Admitted', 'NotSent', ward)?.kind).toBe('ready');
    expect(nextPermittedClinicalAction('SentToOT', 'SentToOT', ward)).toBeNull();
    const ot = resolveIpRoleActions(['ot.safety.sign']);
    expect(nextPermittedClinicalAction('SentToOT', 'SentToOT', ot)?.kind).toBe('accept');
    expect(nextPermittedClinicalAction('InOT', 'InProgress', ot)?.kind).toBe('complete');
  });
});
