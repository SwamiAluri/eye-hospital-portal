import { describe, expect, it } from 'vitest';
import {
  resolveWaitingListEmptyCopy,
  resolveWaitingListQueueTitle,
} from './waiting-list-empty-copy';
import {
  filterOtReturnedOperationalRows,
  resolveOtReturnedMembership,
} from './ot-returned-membership';
import { resolveOtReturnedAction } from './ot-returned-action';
import { deriveWaitingListStatus } from './waiting-list-status';

describe('waiting-list-empty-copy', () => {
  it('uses concise OT Returned empty title', () => {
    expect(
      resolveWaitingListEmptyCopy({
        activeTab: 'OtReturned',
        hasRestrictiveClientScope: false,
        hasAnyPatientsInBranch: true,
      }),
    ).toEqual({ title: 'No OT-returned patients' });
  });

  it('covers every status tab with user-friendly copy', () => {
    const cases: Array<[string, string]> = [
      ['All', 'No patients found'],
      ['Pending', 'No pending patients'],
      ['Processed', 'No patients in progress'],
      ['Done', 'No completed counselling sessions'],
      ['RepeatCounselling', 'No repeat counselling cases'],
      ['AddOnSurgery', 'No add-on surgery cases'],
      ['SurgeryDone', 'No surgery-completed cases'],
      ['OtReturned', 'No OT-returned patients'],
      ['PreAuthQueue', 'No patients awaiting pre-authorization'],
    ];
    for (const [activeTab, title] of cases) {
      expect(
        resolveWaitingListEmptyCopy({
          activeTab,
          hasRestrictiveClientScope: false,
          hasAnyPatientsInBranch: false,
        }).title,
      ).toBe(title);
    }
  });

  it('uses No patients found when filters/search restrict the view', () => {
    expect(
      resolveWaitingListEmptyCopy({
        activeTab: 'Pending',
        hasRestrictiveClientScope: true,
        hasAnyPatientsInBranch: true,
      }).title,
    ).toBe('No patients found');
  });

  it('queue titles mirror tab labels (no Patient Queue)', () => {
    expect(resolveWaitingListQueueTitle('OtReturned')).toBe('OT Returned');
    expect(resolveWaitingListQueueTitle('Pending')).toBe('Pending');
    expect(resolveWaitingListQueueTitle('Processed')).toBe('Processing');
    expect(resolveWaitingListQueueTitle('All')).toBe('All');
    expect(resolveWaitingListQueueTitle('PreAuthQueue')).toBe('Pre-Auth Queue');
  });
});

describe('Vasantha FRESH-004 runtime membership (authoritative lifecycle)', () => {
  /**
   * Runtime audit 2026-09-22 (Azure hospitalportal):
   * Journey ReadyForSurgery + otReturnReason present + counselingSessionId NULL
   * Session Completed + patient_agreed_to_surgery=true + queue status Completed
   * → Waiting List Done (not RepeatCounselling — agreement wins over queue_type)
   */
  const vasanthaSessions = [
    {
      id: 'bb000001-2222-2222-2222-000000000004',
      status: 'Completed',
      patientAgreedToSurgery: true,
      queueStatus: 'Completed',
      counselorId: 'owner',
      createdAt: '2026-04-01T16:13:10Z',
      updatedAt: '2026-09-22T11:40:45Z',
      additionalNotes: '[Re-queue 2026-09-21] Slice10 UAT G ReQueue reason',
    },
  ];

  it('derives Done from Completed + agreed (not Repeat from queue_type alone)', () => {
    expect(
      deriveWaitingListStatus({
        queueStatus: 'Completed',
        sessionStatus: 'Completed',
        patientAgreedToSurgery: true,
      }),
    ).toBe('Done');
  });

  it('hides Vasantha from OT Returned when Done with no actionable lifecycle', () => {
    const m = resolveOtReturnedMembership({
      otReturnReason: 'Uncontrolled Blood Sugar',
      counselingSessionId: null,
      sessions: vasanthaSessions,
      waitingListStatus: 'Done',
      waitingListSessionId: 'bb000001-2222-2222-2222-000000000004',
    });
    expect(m).toEqual({ include: false });
  });

  it('OT count equals actionable rows only (Vasantha excluded)', () => {
    const projected = filterOtReturnedOperationalRows(
      [
        {
          id: 'dd000001-4444-4444-4444-000000000002',
          patientId: 'aa000001-1111-1111-1111-000000000004',
          otReturnReason: 'Uncontrolled Blood Sugar',
          counselingSessionId: null as string | null,
        },
      ],
      new Map([['aa000001-1111-1111-1111-000000000004', vasanthaSessions]]),
      new Map([
        [
          'aa000001-1111-1111-1111-000000000004',
          {
            id: 'bb000001-2222-2222-2222-000000000004',
            status: 'Done' as const,
            counselorId: 'owner',
          },
        ],
      ]),
    );
    expect(projected).toHaveLength(0);
  });

  it('still shows Start Repeat when lifecycle is truly RepeatCounselling', () => {
    const m = resolveOtReturnedMembership({
      otReturnReason: 'Uncontrolled Blood Sugar',
      counselingSessionId: null,
      sessions: [
        {
          id: 'sess-repeat',
          status: 'Completed',
          patientAgreedToSurgery: false,
          counselorId: 'amelia',
        },
      ],
    });
    expect(m.include).toBe(true);
    if (!m.include) return;
    expect(m.lifecycleStatus).toBe('RepeatCounselling');
    expect(
      resolveOtReturnedAction({
        journeyId: 'j',
        counselingSessionId: m.effectiveSessionId,
        lifecycleStatus: m.lifecycleStatus,
        counselorId: 'amelia',
        currentUserId: 'amelia',
      }),
    ).toMatchObject({ lifecycleKind: 'start-repeat', label: 'Start Repeat' });
  });
});
