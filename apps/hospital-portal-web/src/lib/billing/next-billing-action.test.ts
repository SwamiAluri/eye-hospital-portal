import { describe, expect, it } from 'vitest';
import { resolveNextBillingAction } from './next-billing-action';

describe('resolveNextBillingAction', () => {
  it('collects when the ledger has a due balance and the clerk can collect', () => {
    const action = resolveNextBillingAction({
      bill: { balanceDue: 10000, isFinalized: false, amountPaid: 0, status: 'pending' },
      canCollect: true,
    });
    expect(action.kind).toBe('collect');
    expect(action.label).toBe('Collect payment');
  });

  it('does not collect without permission', () => {
    const action = resolveNextBillingAction({
      bill: { balanceDue: 10000, isFinalized: false, amountPaid: 0, status: 'pending' },
      canCollect: false,
    });
    expect(action.kind).toBe('none');
    expect(action.reason).toMatch(/permission/i);
  });

  it('offers finalize when paid in full even without collect permission', () => {
    const action = resolveNextBillingAction({
      bill: { balanceDue: 0, isFinalized: false, amountPaid: 10000, status: 'paid' },
      canCollect: false,
    });
    expect(action.kind).toBe('finalize');
  });

  it('closes collection after finalize', () => {
    const action = resolveNextBillingAction({
      bill: { balanceDue: 5000, isFinalized: true, amountPaid: 5000, status: 'partial' },
      canCollect: true,
    });
    expect(action.kind).toBe('none');
    expect(action.label).toMatch(/finalized/i);
  });

  it('does not invent a next action when no bill is selected', () => {
    const action = resolveNextBillingAction({ bill: null, canCollect: true });
    expect(action.kind).toBe('none');
  });
});
