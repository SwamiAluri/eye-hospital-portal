import { describe, expect, it } from 'vitest';
import type { PatientJourneyDetailDto } from '@/lib/api/ip-management.api';
import {
  completeSurgeryWithCurrentVersion,
  planCompleteSurgery,
  planReturnFromOt,
  returnFromOtWithCurrentVersion,
} from './ot-complete-surgery';
import { otMutationError } from './ot-mutation-result';

function journey(partial: Partial<PatientJourneyDetailDto>): PatientJourneyDetailDto {
  return {
    id: 'j1',
    clinicalState: 'InOT',
    otState: 'InProgress',
    updatedAt: '2026-08-26T02:46:00.000Z',
    ...partial,
  } as PatientJourneyDetailDto;
}

describe('planCompleteSurgery', () => {
  it('uses the current journey version, not a caller-supplied stale stamp', () => {
    const plan = planCompleteSurgery(journey({ updatedAt: '2026-08-26T02:48:00.000Z' }));
    expect(plan).toEqual({
      kind: 'ready',
      expectedUpdatedAt: '2026-08-26T02:48:00.000Z',
      journey: expect.objectContaining({ updatedAt: '2026-08-26T02:48:00.000Z' }),
    });
  });

  it('does not complete when the journey is no longer InOT', () => {
    const plan = planCompleteSurgery(journey({ clinicalState: 'SentToOT', otState: 'Accepted' }));
    expect(plan.kind).toBe('invalid');
  });
});

describe('completeSurgeryWithCurrentVersion', () => {
  it('submits Complete Surgery with the fresh post-implant updatedAt', async () => {
    const stale = '2026-08-26T02:46:00.000Z';
    const current = '2026-08-26T02:48:00.544Z';
    const calls: string[] = [];
    const result = await completeSurgeryWithCurrentVersion('j1', {
      getJourneyDetail: async () => journey({ updatedAt: current }),
      transitionWithGates: async (_id, req) => {
        calls.push(req.expectedUpdatedAt ?? '');
        expect(req.expectedUpdatedAt).not.toBe(stale);
        return journey({
          clinicalState: 'SurgeryCompleted',
          otState: 'Completed',
          updatedAt: '2026-08-26T02:49:00.000Z',
        });
      },
    });
    expect(calls).toEqual([current]);
    expect(result.clinicalState).toBe('SurgeryCompleted');
  });

  it('retries once with the fresh version after a genuine conflict, then succeeds', async () => {
    const versions = [
      journey({ updatedAt: '2026-08-26T02:48:00.000Z' }),
      journey({ updatedAt: '2026-08-26T02:48:30.000Z' }),
    ];
    const sent: string[] = [];
    const result = await completeSurgeryWithCurrentVersion('j1', {
      getJourneyDetail: async () => versions.shift() ?? null,
      transitionWithGates: async (_id, req) => {
        sent.push(req.expectedUpdatedAt ?? '');
        if (sent.length === 1) throw otMutationError('This journey was updated by another user. Reload and try again.', true);
        return journey({
          clinicalState: 'SurgeryCompleted',
          otState: 'Completed',
          updatedAt: req.expectedUpdatedAt,
        });
      },
    });
    expect(sent).toEqual(['2026-08-26T02:48:00.000Z', '2026-08-26T02:48:30.000Z']);
    expect(result.clinicalState).toBe('SurgeryCompleted');
  });

  it('does not retry when the journey is no longer completable', async () => {
    const details = [
      journey({ updatedAt: '2026-08-26T02:48:00.000Z' }),
      journey({ clinicalState: 'SentToOT', otState: 'Accepted', updatedAt: '2026-08-26T02:48:30.000Z' }),
    ];
    await expect(completeSurgeryWithCurrentVersion('j1', {
      getJourneyDetail: async () => details.shift() ?? null,
      transitionWithGates: async () => {
        throw otMutationError('This journey was updated by another user. Reload and try again.', true);
      },
    })).rejects.toThrow(/can no longer be completed/);
  });

  it('does not post a second completion when refetch shows SurgeryCompleted', async () => {
    let posts = 0;
    const details = [
      journey({ updatedAt: '2026-08-26T02:48:00.000Z' }),
      journey({ clinicalState: 'SurgeryCompleted', otState: 'Completed', updatedAt: '2026-08-26T02:49:00.000Z' }),
    ];
    const result = await completeSurgeryWithCurrentVersion('j1', {
      getJourneyDetail: async () => details.shift() ?? null,
      transitionWithGates: async () => {
        posts += 1;
        throw otMutationError('This journey was updated by another user. Reload and try again.', true);
      },
    });
    expect(posts).toBe(1);
    expect(result.clinicalState).toBe('SurgeryCompleted');
  });
});

describe('returnFromOtWithCurrentVersion', () => {
  it('uses the current journey version instead of a stale list-row stamp', async () => {
    const stale = '2026-08-26T02:40:00.000Z';
    const current = '2026-08-26T02:48:00.000Z';
    const sent: Array<{ version?: string; reason?: string }> = [];
    expect(planReturnFromOt(journey({ clinicalState: 'SentToOT', otState: 'Accepted', updatedAt: current })).kind).toBe('ready');
    const result = await returnFromOtWithCurrentVersion('j1', 'Equipment failure', {
      getJourneyDetail: async () => journey({ clinicalState: 'SentToOT', otState: 'Accepted', updatedAt: current }),
      transitionWithGates: async (_id, req) => {
        sent.push({ version: req.expectedUpdatedAt, reason: req.reason });
        expect(req.expectedUpdatedAt).not.toBe(stale);
        return journey({ clinicalState: 'ReadyForSurgery', updatedAt: '2026-08-26T02:49:00.000Z' });
      },
    });
    expect(sent).toEqual([{ version: current, reason: 'Equipment failure' }]);
    expect(result.clinicalState).toBe('ReadyForSurgery');
  });

  it('retries once after a conflict and does not loop', async () => {
    const versions = [
      journey({ clinicalState: 'InOT', updatedAt: '2026-08-26T02:48:00.000Z' }),
      journey({ clinicalState: 'InOT', updatedAt: '2026-08-26T02:48:30.000Z' }),
    ];
    const sent: string[] = [];
    await returnFromOtWithCurrentVersion('j1', 'Anaesthesia issue', {
      getJourneyDetail: async () => versions.shift() ?? null,
      transitionWithGates: async (_id, req) => {
        sent.push(req.expectedUpdatedAt ?? '');
        if (sent.length === 1) throw otMutationError('This journey was updated by another user. Reload and try again.', true);
        return journey({ clinicalState: 'ReadyForSurgery', updatedAt: req.expectedUpdatedAt });
      },
    });
    expect(sent).toEqual(['2026-08-26T02:48:00.000Z', '2026-08-26T02:48:30.000Z']);
  });
});
