import { describe, expect, it } from 'vitest';
import { resolveOtReturnedAction } from './ot-returned-action';

describe('resolveOtReturnedAction (lifecycle-aware)', () => {
  it('starts counselling when no session / no lifecycle', () => {
    expect(
      resolveOtReturnedAction({
        journeyId: 'journey-1',
        counselingSessionId: null,
      }),
    ).toEqual({
      kind: 'start-counselling',
      label: 'Start Counseling',
    });
  });

  it('does not use Open Journey for the no-session case', () => {
    const action = resolveOtReturnedAction({
      journeyId: 'journey-1',
      counselingSessionId: null,
    });
    expect(JSON.stringify(action)).not.toMatch(/Open [Jj]ourney/);
    expect(JSON.stringify(action)).not.toMatch(/ip-management\/journey/);
  });

  it('Continue for Processed + current owner', () => {
    expect(
      resolveOtReturnedAction({
        journeyId: 'j',
        counselingSessionId: 'sess-1',
        lifecycleStatus: 'Processed',
        counselorId: 'amelia',
        currentUserId: 'amelia',
      }),
    ).toMatchObject({
      kind: 'lifecycle',
      label: 'Continue',
      lifecycleKind: 'continue',
      sessionId: 'sess-1',
    });
  });

  it('Start Repeat for RepeatCounselling (Vasantha)', () => {
    const action = resolveOtReturnedAction({
      journeyId: 'j',
      counselingSessionId: 'sess-v',
      lifecycleStatus: 'RepeatCounselling',
      counselorId: 'amelia',
      currentUserId: 'amelia',
    });
    expect(action).toMatchObject({
      kind: 'lifecycle',
      label: 'Start Repeat',
      lifecycleKind: 'start-repeat',
    });
    expect(action.kind === 'lifecycle' && action.label).not.toBe('Start Counseling');
  });

  it('Re-evaluate is Done-tab lifecycle; Done is not OT membership', () => {
    expect(
      resolveOtReturnedAction({
        journeyId: 'j',
        counselingSessionId: 'sess-d',
        lifecycleStatus: 'Done',
        counselorId: 'amelia',
        currentUserId: 'amelia',
      }),
    ).toMatchObject({
      kind: 'lifecycle',
      label: 'Re-evaluate',
      lifecycleKind: 're-evaluate',
    });
  });

  it('never invents OT-specific action labels', () => {
    const action = resolveOtReturnedAction({
      journeyId: 'j',
      counselingSessionId: 's',
      lifecycleStatus: 'RepeatCounselling',
      counselorId: 'c',
      currentUserId: 'c',
    });
    const blob = JSON.stringify(action);
    expect(blob).not.toMatch(/OT Counselling|Resume OT|Resolve OT|Continue OT|Repeat OT/i);
  });

  it('create start action has no CounselorId field', () => {
    const action = resolveOtReturnedAction({
      journeyId: 'j',
      counselingSessionId: null,
    });
    expect(action).not.toHaveProperty('counselorId');
  });
});
