import type { IpPersona } from './ip-persona';
import type { IpRoleActions } from './ip-role-actions';
import { nextPermittedClinicalAction } from './ip-role-actions';

export type RailPrimaryKind = 'clinical' | 'billing' | 'record';

export interface RailPrimaryAction {
  label: string;
  kind: RailPrimaryKind;
}

/**
 * Exactly one filled primary per persona. Capability still comes from
 * `resolveIpRoleActions` — persona only chooses which permitted action is emphasised.
 */
export function resolveRailPrimary(
  persona: IpPersona,
  clinicalState: string,
  otState: string | null | undefined,
  actions: IpRoleActions,
  financialState: string,
): RailPrimaryAction {
  const clinical = nextPermittedClinicalAction(clinicalState, otState, actions);

  if (persona === 'cashier') {
    if (actions.canBill) {
      if (financialState === 'NotCreated') {
        if (actions.canCreateBill) {
          return { kind: 'billing', label: 'Create bill and collect' };
        }
        return { kind: 'record', label: 'Open full record' };
      }
      return { kind: 'billing', label: 'Collect payment' };
    }
    return { kind: 'record', label: 'Open full record' };
  }

  if (clinical) return { kind: 'clinical', label: clinical.label };
  return { kind: 'record', label: 'Open full record' };
}
