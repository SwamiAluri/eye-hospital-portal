export const EMERGENCY_FC_PERMISSION = 'ip.emergency_fc.apply';

/** Fail-closed. ward.checklist.edit must never imply Emergency FC. */
export function canApplyEmergencyFc(permissions: string[] | null | undefined): boolean {
  const list = permissions ?? [];
  return list.includes('*') || list.includes(EMERGENCY_FC_PERMISSION);
}
