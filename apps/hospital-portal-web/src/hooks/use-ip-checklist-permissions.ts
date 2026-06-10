'use client';

import { useAuthStore } from '@/lib/auth-store';

export const IP_CHECKLIST_PERMISSIONS = {
  wardEdit: 'ward.checklist.edit',
  otSafetySign: 'ot.safety.sign',
  pacEdit: 'anaesthesia.pac.edit',
  monitoringEdit: 'anaesthesia.monitoring.edit',
  counsellorOutpatientEdit: 'counsellor.outpatient_checklist.edit',
  otSafetyOverride: 'ot.safety.override',
} as const;

function can(permissions: string[], code: string): boolean {
  if (!permissions?.length) return true;
  if (permissions.includes('*')) return true;
  return permissions.includes(code);
}

export function useIpChecklistPermissions() {
  const permissions = useAuthStore(s => s.permissions);

  return {
    canEditWardChecklist: can(permissions, IP_CHECKLIST_PERMISSIONS.wardEdit),
    canSignOtSafety: can(permissions, IP_CHECKLIST_PERMISSIONS.otSafetySign),
    canEditPac: can(permissions, IP_CHECKLIST_PERMISSIONS.pacEdit),
    canEditMonitoring: can(permissions, IP_CHECKLIST_PERMISSIONS.monitoringEdit),
    canEditCounsellorOutpatient: can(permissions, IP_CHECKLIST_PERMISSIONS.counsellorOutpatientEdit),
    canOverrideWhoTimeout: can(permissions, IP_CHECKLIST_PERMISSIONS.otSafetyOverride),
  };
}
