import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import type { IpRoleActions } from './ip-role-actions';

/** S-17: reversible clinical revert — nudge against "ok" / "asdf". */
export const UNMARK_READY_MIN_REASON_LENGTH = 10;

export function canUnmarkReady(
  journey: Pick<PatientJourneyRowDto, 'clinicalState' | 'otState' | 'isLocked'>,
  actions: Pick<IpRoleActions, 'canUnmarkReady'>,
): boolean {
  if (!actions.canUnmarkReady) return false;
  if (journey.isLocked) return false;
  if (journey.clinicalState !== 'ReadyForSurgery') return false;
  return journey.otState === 'NotSent' || !journey.otState;
}
