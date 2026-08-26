import { describe, expect, it } from 'vitest';
import axios from 'axios';
import {
  defaultFollowUpLocalInput,
  followUpBookErrorMessage,
  isActiveClinicAppointment,
} from './follow-up-appointment';

describe('follow-up appointment helpers', () => {
  it('maps Auth conflict copy to the discharge workspace message', () => {
    const err = {
      isAxiosError: true,
      response: { status: 409, data: { message: 'Doctor is not available at the selected time.' } },
      message: 'Request failed',
    };
    Object.setPrototypeOf(err, axios.AxiosError.prototype);
    expect(followUpBookErrorMessage(err)).toBe('That time is not available.');
  });

  it('treats cancelled and deleted as not bookable for linking', () => {
    expect(isActiveClinicAppointment('Scheduled')).toBe(true);
    expect(isActiveClinicAppointment('Cancelled')).toBe(false);
    expect(isActiveClinicAppointment('Deleted')).toBe(false);
  });

  it('defaults the book dialog to tomorrow 09:00 local', () => {
    const from = new Date(2026, 7, 25, 15, 30, 0);
    expect(defaultFollowUpLocalInput(from)).toBe('2026-08-26T09:00');
  });
});
