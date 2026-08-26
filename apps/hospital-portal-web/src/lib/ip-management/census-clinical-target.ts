/** Maps census primary-action kinds onto the clinical state they attempt. */
export const CENSUS_CLINICAL_TARGET: Record<
  'admit' | 'ready' | 'send' | 'complete' | 'postop' | 'readyDc' | 'discharge',
  string
> = {
  admit: 'Admitted',
  ready: 'ReadyForSurgery',
  send: 'SentToOT',
  complete: 'SurgeryCompleted',
  postop: 'PostOp',
  readyDc: 'ReadyForDischarge',
  discharge: 'Discharged',
};

export type CensusGatedKind = keyof typeof CENSUS_CLINICAL_TARGET;

export function censusTargetState(
  kind: string | undefined,
): string | undefined {
  if (!kind) return undefined;
  return CENSUS_CLINICAL_TARGET[kind as CensusGatedKind];
}

/** Admit and Mark ready open the pre-op workspace (S-05), not a one-click mutation. */
export function censusOpensWorkspace(kind: string | undefined): boolean {
  return kind === 'admit' || kind === 'ready';
}
