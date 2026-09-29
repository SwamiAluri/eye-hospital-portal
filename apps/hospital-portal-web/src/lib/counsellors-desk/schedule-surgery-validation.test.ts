import { describe, expect, it } from 'vitest';
import { validateScheduleSurgerySubmission } from './schedule-surgery-validation';

const base = {
  selectedDate: '2026-09-20',
  operationTheatre: 'OT-1',
  doctor: 'Dr. A',
  surgeryStartTime: '09:00',
};

describe('validateScheduleSurgerySubmission', () => {
  it('A1 — date, doctor, OT, and start time remain valid', () => {
    const result = validateScheduleSurgerySubmission(base);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('A2 — date and doctor without OT or start time is a valid counselling plan', () => {
    const result = validateScheduleSurgerySubmission({
      ...base,
      operationTheatre: '',
      surgeryStartTime: '',
    });
    expect(result.ok).toBe(true);
    expect(result.errors.operationTheatre).toBeUndefined();
    expect(result.errors.surgeryStartTime).toBeUndefined();
  });

  it('A3 — missing date still blocks', () => {
    const result = validateScheduleSurgerySubmission({ ...base, selectedDate: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.date).toBeTruthy();
  });

  it('A4 — missing doctor still blocks', () => {
    const result = validateScheduleSurgerySubmission({ ...base, doctor: '   ' });
    expect(result.ok).toBe(false);
    expect(result.errors.doctor).toBeTruthy();
  });

  it('A5 — missing OT is not a validation error', () => {
    const result = validateScheduleSurgerySubmission({ ...base, operationTheatre: '' });
    expect(result.errors.operationTheatre).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it('A6 — missing start time is not a validation error', () => {
    const result = validateScheduleSurgerySubmission({ ...base, surgeryStartTime: '' });
    expect(result.errors.surgeryStartTime).toBeUndefined();
    expect(result.ok).toBe(true);
  });
});
