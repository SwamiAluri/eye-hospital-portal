import { describe, expect, it } from 'vitest';

import {
  filterOtReturnedOperationalRows,
  resolveOtReturnedMembership,
} from './ot-returned-membership';
import { resolveOtReturnedAction } from './ot-returned-action';
import { buildOtReturnedCreateSessionPayload } from './start-ot-returned-counselling';
import { resolveWaitingListLifecycleAction } from './waiting-list-lifecycle-action';

describe('ot-returned-membership (resolved Done hides)', () => {
  it('excludes journeys without otReturnReason', () => {
    expect(
      resolveOtReturnedMembership({
        otReturnReason: null,
        counselingSessionId: null,
        sessions: [],
      }),
    ).toEqual({ include: false });
  });

  it('includes no-session as Start Counseling', () => {
    const m = resolveOtReturnedMembership({
      otReturnReason: 'BP high',
      counselingSessionId: null,
      sessions: [],
    });
    expect(m.include).toBe(true);
    if (!m.include) return;
    expect(m.needsSessionCreate).toBe(true);
    expect(
      resolveOtReturnedAction({
        journeyId: 'j1',
        counselingSessionId: m.effectiveSessionId,
        lifecycleStatus: m.lifecycleStatus,
      }).kind,
    ).toBe('start-counselling');
  });

  it('includes Processing as Continue', () => {
    const m = resolveOtReturnedMembership({
      otReturnReason: 'Anaesthesia Contraindication',
      counselingSessionId: null,
      sessions: [
        {
          id: 'sess-open',
          status: 'InProgress',
          patientAgreedToSurgery: null,
          counselorId: 'amelia',
          createdAt: '2026-09-22T10:00:00Z',
        },
      ],
    });
    expect(m.include).toBe(true);
    if (!m.include) return;
    expect(m.lifecycleStatus).toBe('Processed');
    expect(
      resolveOtReturnedAction({
        journeyId: 'j1',
        counselingSessionId: m.effectiveSessionId,
        lifecycleStatus: m.lifecycleStatus,
        counselorId: 'amelia',
        currentUserId: 'amelia',
      }),
    ).toMatchObject({ kind: 'lifecycle', lifecycleKind: 'continue', label: 'Continue' });
  });

  it('UAT Meena: Re-evaluate complete → Done → excluded from OT Returned (Done tab unaffected)', () => {
    const journeys = [
      {
        id: 'journey-meena',
        patientId: 'patient-meena',
        otReturnReason: 'Uncontrolled Blood Sugar',
        counselingSessionId: 'sess-meena' as string | null,
      },
    ];

    // Mid Re-evaluate (Processing) — still OT attention
    let projected = filterOtReturnedOperationalRows(
      journeys,
      new Map([
        [
          'patient-meena',
          [
            {
              id: 'sess-meena',
              status: 'InProgress',
              patientAgreedToSurgery: null,
              counselorId: 'amelia',
              createdAt: '2026-09-20T10:00:00Z',
            },
          ],
        ],
      ]),
      new Map([
        [
          'patient-meena',
          {
            id: 'sess-meena',
            status: 'Processed' as const,
            counselorId: 'amelia',
            counselorName: 'Amelia',
          },
        ],
      ]),
    );
    expect(projected).toHaveLength(1);
    expect(projected[0]!.lifecycleStatus).toBe('Processed');

    // After complete → Done — OT Resolved / Hidden; historical reason untouched
    projected = filterOtReturnedOperationalRows(
      journeys,
      new Map([
        [
          'patient-meena',
          [
            {
              id: 'sess-meena',
              status: 'Completed',
              patientAgreedToSurgery: true,
              counselorId: 'amelia',
              createdAt: '2026-09-20T10:00:00Z',
              updatedAt: '2026-09-22T15:00:00Z',
            },
          ],
        ],
      ]),
      new Map([
        [
          'patient-meena',
          {
            id: 'sess-meena',
            status: 'Done' as const,
            counselorId: 'amelia',
            counselorName: 'Amelia',
          },
        ],
      ]),
    );
    expect(projected).toHaveLength(0);
    expect(journeys[0]!.otReturnReason).toBe('Uncontrolled Blood Sugar');

    // Done list still has Re-evaluate via shared lifecycle (not OT membership)
    expect(
      resolveWaitingListLifecycleAction({
        status: 'Done',
        counselorId: 'amelia',
        currentUserId: 'amelia',
        activeTab: 'Done',
        canAssign: true,
      }),
    ).toEqual({ label: 'Re-evaluate', kind: 're-evaluate' });
  });

  it('Done alone is excluded from OT Returned (resolved)', () => {
    expect(
      resolveOtReturnedMembership({
        otReturnReason: 'Equipment delay',
        counselingSessionId: 'sess-done',
        sessions: [
          {
            id: 'sess-done',
            status: 'Completed',
            patientAgreedToSurgery: true,
            counselorId: 'amelia',
          },
        ],
        waitingListStatus: 'Done',
        waitingListSessionId: 'sess-done',
      }),
    ).toEqual({ include: false });
  });

  it('Vasantha: RepeatCounselling → Start Repeat and remains while actionable', () => {
    const m = resolveOtReturnedMembership({
      otReturnReason: 'Anaesthesia Contraindication',
      counselingSessionId: null,
      sessions: [
        {
          id: 'sess-vasantha',
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
    ).toMatchObject({ kind: 'lifecycle', lifecycleKind: 'start-repeat', label: 'Start Repeat' });
  });

  it('Vasantha: Repeat completed to Done → excluded', () => {
    expect(
      resolveOtReturnedMembership({
        otReturnReason: 'Anaesthesia Contraindication',
        counselingSessionId: 'sess-vasantha',
        sessions: [
          {
            id: 'sess-vasantha',
            status: 'Completed',
            patientAgreedToSurgery: true,
            counselorId: 'amelia',
          },
        ],
        waitingListStatus: 'Done',
        waitingListSessionId: 'sess-vasantha',
      }),
    ).toEqual({ include: false });
  });

  it('Continue completed to Done → excluded', () => {
    const journeys = [
      {
        id: 'j-c',
        patientId: 'p-c',
        otReturnReason: 'BP high',
        counselingSessionId: 'sess-c' as string | null,
      },
    ];
    expect(
      filterOtReturnedOperationalRows(
        journeys,
        new Map([
          [
            'p-c',
            [
              {
                id: 'sess-c',
                status: 'Completed',
                patientAgreedToSurgery: true,
              },
            ],
          ],
        ]),
      ),
    ).toHaveLength(0);
  });

  it('Start Counselling completed to Done → excluded', () => {
    expect(
      resolveOtReturnedMembership({
        otReturnReason: 'BP high',
        counselingSessionId: null,
        sessions: [
          {
            id: 'sess-new',
            status: 'Completed',
            patientAgreedToSurgery: true,
            additionalNotes: 'OT Returned: BP high',
          },
        ],
      }),
    ).toEqual({ include: false });
  });

  it('multiple sessions: Done + RepeatCounselling → SHOW Start Repeat', () => {
    const m = resolveOtReturnedMembership({
      otReturnReason: 'Returned from holding',
      counselingSessionId: null,
      sessions: [
        {
          id: 'sess-old-done',
          status: 'Completed',
          patientAgreedToSurgery: true,
          createdAt: '2026-09-01T10:00:00Z',
        },
        {
          id: 'sess-repeat',
          status: 'Completed',
          patientAgreedToSurgery: false,
          createdAt: '2026-09-20T10:00:00Z',
          counselorId: 'amelia',
        },
      ],
    });
    expect(m.include).toBe(true);
    if (!m.include) return;
    expect(m.lifecycleStatus).toBe('RepeatCounselling');
    expect(m.effectiveSessionId).toBe('sess-repeat');
  });

  it('multiple sessions: all Done → HIDE', () => {
    expect(
      resolveOtReturnedMembership({
        otReturnReason: 'BP high',
        counselingSessionId: null,
        sessions: [
          {
            id: 's1',
            status: 'Completed',
            patientAgreedToSurgery: true,
            createdAt: '2026-09-01T10:00:00Z',
          },
          {
            id: 's2',
            status: 'Completed',
            patientAgreedToSurgery: true,
            createdAt: '2026-09-20T10:00:00Z',
          },
        ],
      }),
    ).toEqual({ include: false });
  });

  it('create payload does not send CounselorId; reason untouched', () => {
    const payload = buildOtReturnedCreateSessionPayload({
      patientId: 'p',
      referredByDoctorId: 'd',
      otReturnReason: 'x',
    });
    expect(Object.keys(payload)).not.toContain('counselorId');
    expect(payload.addToQueue).toBe(false);
  });

  it('universal return reasons share resolved/hide rules', () => {
    for (const otReturnReason of [
      'Anaesthesia Contraindication',
      'Uncontrolled Blood Sugar',
      'Equipment delay',
    ]) {
      expect(
        resolveOtReturnedMembership({
          otReturnReason,
          counselingSessionId: 's1',
          sessions: [{ id: 's1', status: 'Completed', patientAgreedToSurgery: true }],
        }).include,
      ).toBe(false);
      expect(
        resolveOtReturnedMembership({
          otReturnReason,
          counselingSessionId: 's1',
          sessions: [{ id: 's1', status: 'Completed', patientAgreedToSurgery: false }],
        }).include,
      ).toBe(true);
    }
  });
});
