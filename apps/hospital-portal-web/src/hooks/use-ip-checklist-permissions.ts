'use client';

import { useAuthStore } from '@/lib/auth-store';
import { canApplyEmergencyFc as hasEmergencyFcPermission, EMERGENCY_FC_PERMISSION } from '@/lib/ip-management/emergency-fc-access';
import { permissionsFailOpen } from '@/lib/permissions-fail-open';

export const IP_CHECKLIST_PERMISSIONS = {
  wardEdit: 'ward.checklist.edit',
  investigationEnter: 'ward.investigation.enter',
  investigationVerify: 'ward.investigation.verify',
  otSafetySign: 'ot.safety.sign',
  surgeryComplete: 'ip.surgery.complete',
  pacEdit: 'anaesthesia.pac.edit',
  monitoringEdit: 'anaesthesia.monitoring.edit',
  counsellorOutpatientEdit: 'counsellor.outpatient_checklist.edit',
  otSafetyOverride: 'ot.safety.override',
  clinicalEvaluationSign: 'ward.clinical_evaluation.sign',
  emergencyFcApply: EMERGENCY_FC_PERMISSION,
} as const;

function can(permissions: string[], code: string): boolean {
  if (permissions.includes('*')) return true;
  return permissions.includes(code);
}

/** Fails closed on an empty JWT; the dev flag is the only way back to permissive. */
function canWard(permissions: string[], code: string): boolean {
  if (!permissions?.length) return permissionsFailOpen();
  return can(permissions, code);
}

export function useIpChecklistPermissions() {
  const permissions = useAuthStore(s => s.permissions);

  return {
    canEditWardChecklist: canWard(permissions, IP_CHECKLIST_PERMISSIONS.wardEdit),
    canEnterInvestigation: canWard(permissions, IP_CHECKLIST_PERMISSIONS.investigationEnter)
      || canWard(permissions, IP_CHECKLIST_PERMISSIONS.wardEdit),
    canVerifyInvestigation: canWard(permissions, IP_CHECKLIST_PERMISSIONS.investigationVerify)
      || canWard(permissions, IP_CHECKLIST_PERMISSIONS.wardEdit),
    canSignOtSafety: canWard(permissions, IP_CHECKLIST_PERMISSIONS.otSafetySign),
    canRecordImplant: canWard(permissions, IP_CHECKLIST_PERMISSIONS.otSafetySign)
      || canWard(permissions, IP_CHECKLIST_PERMISSIONS.surgeryComplete),
    canEditPac: canWard(permissions, IP_CHECKLIST_PERMISSIONS.pacEdit),
    canEditMonitoring: canWard(permissions, IP_CHECKLIST_PERMISSIONS.monitoringEdit),
    canEditCounsellorOutpatient: canWard(permissions, IP_CHECKLIST_PERMISSIONS.counsellorOutpatientEdit),
    canOverrideWhoTimeout: canWard(permissions, IP_CHECKLIST_PERMISSIONS.otSafetyOverride),
    canSignClinicalEvaluation: canWard(permissions, IP_CHECKLIST_PERMISSIONS.clinicalEvaluationSign),
    canAmendClinicalEvaluationInOt:
      canWard(permissions, IP_CHECKLIST_PERMISSIONS.clinicalEvaluationSign)
      && canWard(permissions, IP_CHECKLIST_PERMISSIONS.otSafetyOverride),
    /** Privileged — never granted by empty JWT or ward.checklist.edit. */
    canApplyEmergencyFc: hasEmergencyFcPermission(permissions ?? []),
  };
}
