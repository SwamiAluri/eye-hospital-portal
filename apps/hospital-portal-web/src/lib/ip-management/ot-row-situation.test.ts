import { describe, expect, it } from 'vitest';
import { resolveIpRoleActions } from './ip-role-actions';
import { describeOtNextAction, effectiveOtBoardFilter } from './ot-row-situation';

const otNurse = resolveIpRoleActions(['ot.safety.sign']);

describe('describeOtNextAction', () => {
  it('classifies awaiting acceptance as one-click Accept', () => {
    const next = describeOtNextAction(
      { clinicalState: 'SentToOT', otState: 'SentToOT', otDetailsSaved: false },
      otNurse,
    );
    expect(next).toEqual({
      kind: 'accept',
      label: 'Accept in OT',
      classification: 'one-click',
      executable: true,
    });
  });

  it('hard-stops start when OT details are missing', () => {
    const next = describeOtNextAction(
      { clinicalState: 'SentToOT', otState: 'Accepted', otDetailsSaved: false },
      otNurse,
    );
    expect(next.kind).toBe('details');
    expect(next.classification).toBe('hard-stop');
    expect(next.executable).toBe(false);
  });

  it('offers Start surgery when details are saved', () => {
    const next = describeOtNextAction(
      { clinicalState: 'SentToOT', otState: 'Accepted', otDetailsSaved: true },
      otNurse,
    );
    expect(next.kind).toBe('start');
    expect(next.executable).toBe(true);
  });

  it('does not treat Recovery as a one-click mutation', () => {
    const next = describeOtNextAction(
      { clinicalState: 'PostOp', otState: 'Completed', otDetailsSaved: true },
      otNurse,
    );
    expect(next.classification).toBe('workspace');
    expect(next.executable).toBe(false);
  });
});

describe('effectiveOtBoardFilter', () => {
  it('is a UI filter, not a new persisted state', () => {
    expect(effectiveOtBoardFilter({ clinicalState: 'SentToOT', otState: 'Accepted' })).toBe('OTAccepted');
    expect(effectiveOtBoardFilter({ clinicalState: 'InOT', otState: 'InProgress' })).toBe('InOT');
  });
});
