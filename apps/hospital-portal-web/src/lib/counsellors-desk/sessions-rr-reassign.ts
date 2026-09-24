/**
 * Phase 3I Slice 13 Package B (PD-S13-A = C, PD-S13-D = C).
 *
 * Sessions Reassign CTA gating for the authoritative RR population.
 * When `reassignmentRequired=true`, the Sessions list is server-filtered by
 * Slice 12 RR predicates — do not invent a second frontend RR detector.
 * Waiting List Reassign eligibility remains unchanged (separate helper).
 */
export function canShowSessionsRrReassign(input: {
  reassignmentRequiredFilter: boolean;
  hasReassignPermission: boolean;
  counselorId?: string | null;
}): boolean {
  return (
    Boolean(input.reassignmentRequiredFilter) &&
    Boolean(input.hasReassignPermission) &&
    Boolean(input.counselorId)
  );
}
