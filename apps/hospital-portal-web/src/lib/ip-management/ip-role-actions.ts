import { canApplyEmergencyFc } from '@/lib/ip-management/emergency-fc-access';
import { permissionsFailOpen } from '@/lib/permissions-fail-open';

export const IP_ROLE_PERMISSIONS = {
  admit: 'ip.admit',
  transfer: 'ip.bed.transfer',
  readyForOt: 'ip.ot.mark_ready',
  unmarkReady: 'ip.ot.unmark_ready',
  sendToOt: 'ip.ot.send',
  acceptOt: 'ip.ot.accept',
  surgeryStart: 'ip.surgery.start',
  surgeryComplete: 'ip.surgery.complete',
  discharge: 'ip.discharge',
  dischargeOverride: 'ip.discharge.override',
  billing: 'ip.billing.collect',
  refund: 'ip.billing.refund',
  financialAdjustment: 'ip.billing.adjust',
  wardEdit: 'ward.checklist.edit',
  otSign: 'ot.safety.sign',
  otOverride: 'ot.safety.override',
  implantMismatchOverride: 'ip.implant.mismatch.override',
  safetyTokenPrint: 'ip.safety_token.print',
  postOpManage: 'ip.postop.manage',
  appointmentCreate: 'appointment.create',
  appointmentView: 'appointment.view',
  billUpdate: 'bill.update',
  billCreate: 'bill.create',
  opdRefund: 'opd_bill.refund',
  opdRefundAuthorize: 'opd_bill.refund.authorize',
} as const;

function has(permissions: string[], code: string): boolean {
  return permissions.includes('*') || permissions.includes(code);
}

function hasAny(permissions: string[], codes: string[]): boolean {
  return codes.some(c => has(permissions, c));
}

/**
 * Fails closed on an empty JWT. The dev flag is the only way to get the old
 * permissive behaviour, and never applies to privileged money/override actions
 * below, which require an explicit code regardless.
 */
function operational(permissions: string[], codes: string[]): boolean {
  if (!permissions?.length) return permissionsFailOpen();
  return hasAny(permissions, codes);
}

export type IpRoleActions = {
  canAdmit: boolean;
  canTransfer: boolean;
  canReadyForOt: boolean;
  canUnmarkReady: boolean;
  canSendToOt: boolean;
  canAcceptOt: boolean;
  canStartSurgery: boolean;
  canCompleteSurgery: boolean;
  canDischarge: boolean;
  canDischargeOverride: boolean;
  canApplyEmergencyFc: boolean;
  canBill: boolean;
  canCreateBill: boolean;
  canRefund: boolean;
  canAuthorizeRefund: boolean;
  canAdjustFinance: boolean;
  canOverrideImplantMismatch: boolean;
  canPrintSafetyToken: boolean;
  canManagePostOp: boolean;
  canBookFollowUp: boolean;
  canLinkFollowUp: boolean;
};

export function resolveIpRoleActions(permissions: string[] | null | undefined): IpRoleActions {
  const list = permissions ?? [];
  return {
    canAdmit: operational(list, [IP_ROLE_PERMISSIONS.admit, IP_ROLE_PERMISSIONS.wardEdit]),
    canTransfer: operational(list, [IP_ROLE_PERMISSIONS.transfer, IP_ROLE_PERMISSIONS.wardEdit]),
    canReadyForOt: operational(list, [IP_ROLE_PERMISSIONS.readyForOt, IP_ROLE_PERMISSIONS.wardEdit]),
    canUnmarkReady: hasAny(list, [IP_ROLE_PERMISSIONS.unmarkReady]),
    canSendToOt: operational(list, [IP_ROLE_PERMISSIONS.sendToOt, IP_ROLE_PERMISSIONS.wardEdit]),
    canAcceptOt: operational(list, [IP_ROLE_PERMISSIONS.acceptOt, IP_ROLE_PERMISSIONS.otSign]),
    canStartSurgery: operational(list, [IP_ROLE_PERMISSIONS.surgeryStart, IP_ROLE_PERMISSIONS.otSign]),
    canCompleteSurgery: operational(list, [IP_ROLE_PERMISSIONS.surgeryComplete, IP_ROLE_PERMISSIONS.otSign]),
    canDischarge: operational(list, [IP_ROLE_PERMISSIONS.discharge, IP_ROLE_PERMISSIONS.wardEdit]),
    canDischargeOverride: hasAny(list, [IP_ROLE_PERMISSIONS.dischargeOverride, IP_ROLE_PERMISSIONS.otOverride]),
    canApplyEmergencyFc: canApplyEmergencyFc(list),
    canBill: operational(list, [IP_ROLE_PERMISSIONS.billing, IP_ROLE_PERMISSIONS.billUpdate]),
    canCreateBill: hasAny(list, [IP_ROLE_PERMISSIONS.billCreate]),
    canRefund: hasAny(list, [IP_ROLE_PERMISSIONS.refund, IP_ROLE_PERMISSIONS.opdRefund]),
    canAuthorizeRefund: hasAny(list, [IP_ROLE_PERMISSIONS.opdRefundAuthorize]),
    canAdjustFinance: hasAny(list, [IP_ROLE_PERMISSIONS.financialAdjustment, IP_ROLE_PERMISSIONS.billUpdate]),
    canOverrideImplantMismatch: hasAny(list, [IP_ROLE_PERMISSIONS.implantMismatchOverride]),
    canPrintSafetyToken: hasAny(list, [IP_ROLE_PERMISSIONS.safetyTokenPrint]),
    canManagePostOp: hasAny(list, [IP_ROLE_PERMISSIONS.postOpManage]),
    canBookFollowUp: hasAny(list, [IP_ROLE_PERMISSIONS.appointmentCreate]),
    canLinkFollowUp: hasAny(list, [IP_ROLE_PERMISSIONS.appointmentView]),
  };
}

export function nextPermittedClinicalAction(
  clinicalState: string,
  otState: string | null | undefined,
  actions: IpRoleActions,
): { label: string; kind: 'admit' | 'ready' | 'send' | 'accept' | 'start' | 'complete' | 'postop' | 'readyDc' | 'discharge' } | null {
  switch (clinicalState) {
    case 'Expected':
      return actions.canAdmit ? { label: 'Admit to ward', kind: 'admit' } : null;
    case 'Admitted':
      return actions.canReadyForOt ? { label: 'Mark ready for OT', kind: 'ready' } : null;
    case 'ReadyForSurgery':
      return actions.canSendToOt ? { label: 'Send to OT', kind: 'send' } : null;
    case 'SentToOT':
      return actions.canAcceptOt ? { label: 'Accept in OT', kind: 'accept' } : null;
    case 'InOT':
      if (otState === 'InProgress') {
        return actions.canCompleteSurgery ? { label: 'Complete surgery', kind: 'complete' } : null;
      }
      return actions.canStartSurgery ? { label: 'Start surgery', kind: 'start' } : null;
    case 'SurgeryCompleted':
      return actions.canDischarge ? { label: 'Move to post-op', kind: 'postop' } : null;
    case 'PostOp':
      return actions.canDischarge ? { label: 'Mark ready for discharge', kind: 'readyDc' } : null;
    case 'ReadyForDischarge':
      return actions.canDischarge ? { label: 'Discharge patient', kind: 'discharge' } : null;
    default:
      return null;
  }
}
