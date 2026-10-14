import { canDirectoryOfferCheckIn } from '@/lib/patients/patient-hub-row-display';

export function resolvePatient360PrimaryActions(input: {
  assignedVisitId?: string | null;
  scheduledAt?: string | null;
}): { canContinueEncounter: boolean; canOfferCheckIn: boolean } {
  const canContinueEncounter = Boolean(input.assignedVisitId?.trim());
  const canOfferCheckIn =
    !canContinueEncounter &&
    canDirectoryOfferCheckIn({
      assignedVisitId: input.assignedVisitId,
      scheduledAt: input.scheduledAt,
    });
  return { canContinueEncounter, canOfferCheckIn };
}
