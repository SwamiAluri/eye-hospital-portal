import type { IpRoleActions } from './ip-role-actions';

export type OtNextKind = 'accept' | 'start' | 'complete' | 'details' | 'postop' | 'recovery' | 'none';

export type OtNextClass = 'one-click' | 'workspace' | 'hard-stop' | 'navigation' | 'none';

export interface OtRowNextAction {
  kind: OtNextKind;
  label: string;
  classification: OtNextClass;
  /** When false the list must not render a mutation control for this kind. */
  executable: boolean;
}

export function describeOtNextAction(
  journey: {
    clinicalState: string;
    otState: string;
    otDetailsSaved: boolean;
  },
  actions?: Pick<IpRoleActions, 'canAcceptOt' | 'canStartSurgery' | 'canCompleteSurgery' | 'canManagePostOp'>,
): OtRowNextAction {
  const { clinicalState, otState, otDetailsSaved } = journey;

  if (clinicalState === 'SentToOT' && otState === 'SentToOT') {
    const permitted = actions ? actions.canAcceptOt : true;
    return {
      kind: 'accept',
      label: 'Accept in OT',
      classification: 'one-click',
      executable: permitted,
    };
  }

  if (clinicalState === 'SentToOT' && otState === 'Accepted') {
    if (!otDetailsSaved) {
      return {
        kind: 'details',
        label: 'Complete OT details',
        classification: 'hard-stop',
        executable: false,
      };
    }
    const permitted = actions ? actions.canStartSurgery : true;
    return {
      kind: 'start',
      label: 'Start surgery',
      classification: 'one-click',
      executable: permitted,
    };
  }

  if (clinicalState === 'InOT') {
    const permitted = actions ? actions.canCompleteSurgery : true;
    return {
      kind: 'complete',
      label: 'Complete surgery',
      classification: 'one-click',
      executable: permitted,
    };
  }

  if (clinicalState === 'SurgeryCompleted') {
    const permitted = actions ? (actions.canManagePostOp || actions.canCompleteSurgery) : true;
    return {
      kind: 'postop',
      label: 'Move to post-op',
      classification: 'one-click',
      executable: permitted,
    };
  }

  if (clinicalState === 'PostOp') {
    return {
      kind: 'recovery',
      label: 'Recovery',
      classification: 'workspace',
      executable: false,
    };
  }

  return { kind: 'none', label: '—', classification: 'none', executable: false };
}

/** UI filters only — not persisted OT states. */
export type OtBoardFilter = 'All' | 'SentToOT' | 'OTAccepted' | 'InOT' | 'SurgeryCompleted' | 'PostOp';

export const OT_BOARD_CLINICAL_STATES = ['SentToOT', 'InOT', 'SurgeryCompleted', 'PostOp'] as const;

export function effectiveOtBoardFilter(j: { clinicalState: string; otState: string }): OtBoardFilter {
  if (j.clinicalState === 'SentToOT' && j.otState === 'Accepted') return 'OTAccepted';
  if ((OT_BOARD_CLINICAL_STATES as readonly string[]).includes(j.clinicalState)) {
    return j.clinicalState as OtBoardFilter;
  }
  return 'All';
}
