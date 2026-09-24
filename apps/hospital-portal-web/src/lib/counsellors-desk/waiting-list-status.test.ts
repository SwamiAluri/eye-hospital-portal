import { describe, expect, it } from 'vitest';
import {
  deriveWaitingListStatus,
  isOtReturnedActionableStatus,
  isWaitingListActionableStatus,
} from './waiting-list-status';

describe('deriveWaitingListStatus', () => {
  it('maps queue Completed + agreed → Done', () => {
    expect(
      deriveWaitingListStatus({
        queueStatus: 'Completed',
        patientAgreedToSurgery: true,
      }),
    ).toBe('Done');
  });

  it('maps queue Completed + not agreed → RepeatCounselling (Vasantha)', () => {
    expect(
      deriveWaitingListStatus({
        queueStatus: 'Completed',
        patientAgreedToSurgery: false,
      }),
    ).toBe('RepeatCounselling');
  });

  it('maps session Completed + not agreed when queue missing → RepeatCounselling', () => {
    expect(
      deriveWaitingListStatus({
        sessionStatus: 'Completed',
        patientAgreedToSurgery: false,
      }),
    ).toBe('RepeatCounselling');
  });

  it('maps Waiting → Pending and InProgress → Processed', () => {
    expect(deriveWaitingListStatus({ queueStatus: 'Waiting' })).toBe('Pending');
    expect(deriveWaitingListStatus({ queueStatus: 'InProgress' })).toBe('Processed');
  });

  it('marks Waiting List vs OT Returned actionable statuses correctly', () => {
    expect(isWaitingListActionableStatus('RepeatCounselling')).toBe(true);
    expect(isWaitingListActionableStatus('Done')).toBe(true);
    expect(isOtReturnedActionableStatus('RepeatCounselling')).toBe(true);
    expect(isOtReturnedActionableStatus('Processed')).toBe(true);
    expect(isOtReturnedActionableStatus('Pending')).toBe(true);
    expect(isOtReturnedActionableStatus('Done')).toBe(false);
    expect(isOtReturnedActionableStatus('SurgeryDone')).toBe(false);
    expect(isWaitingListActionableStatus('SurgeryDone')).toBe(false);
    expect(isWaitingListActionableStatus('AddOnSurgery')).toBe(false);
  });
});
