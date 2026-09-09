import { describe, expect, it } from 'vitest';
import { sessionTypeCodeToDb } from './counsellor-master-maps';

describe('sessionTypeCodeToDb', () => {
  it('maps INITIAL master code to DB Initial', () => {
    expect(sessionTypeCodeToDb('INITIAL')).toBe('Initial');
  });

  it('maps FOLLOW_UP to Followup', () => {
    expect(sessionTypeCodeToDb('FOLLOW_UP')).toBe('Followup');
  });

  it('maps repeat Start Session payload codes used by the Follow-Up dropdown', () => {
    // POST /Counseling/sessions/{id}/start must send DB values, not master codes.
    expect(sessionTypeCodeToDb('FOLLOW_UP')).toBe('Followup');
    expect(sessionTypeCodeToDb('INITIAL')).toBe('Initial');
    expect(sessionTypeCodeToDb('URGENT')).toBe('Urgent');
  });

  it('passes through already-valid DB values', () => {
    expect(sessionTypeCodeToDb('Initial')).toBe('Initial');
    expect(sessionTypeCodeToDb('Urgent')).toBe('Urgent');
  });

  it('defaults blank to Initial', () => {
    expect(sessionTypeCodeToDb('')).toBe('Initial');
    expect(sessionTypeCodeToDb(null)).toBe('Initial');
  });
});
