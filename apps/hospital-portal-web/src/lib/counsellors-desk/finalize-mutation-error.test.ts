import { describe, expect, it } from 'vitest';
import { finalizeMutationErrorMessage } from './finalize-mutation-error';

describe('WL-03 finalizeMutationErrorMessage', () => {
  it('prefers API response message', () => {
    const err = {
      response: { status: 409, data: { message: 'Scheduling conflict: Theatre booked.' } },
      message: 'Request failed with status code 409',
    };
    expect(finalizeMutationErrorMessage(err)).toBe('Scheduling conflict: Theatre booked.');
  });

  it('falls back when only Axios status text is present', () => {
    const err = new Error('Request failed with status code 500');
    expect(finalizeMutationErrorMessage(err, 'Action failed')).toBe('Action failed');
  });

  it('uses Error.message when actionable', () => {
    expect(finalizeMutationErrorMessage(new Error('Cannot confirm: not Finalised'), 'Action failed')).toBe(
      'Cannot confirm: not Finalised',
    );
  });
});
