import { describe, expect, it } from 'vitest';
import { sessionTypeCodeToDb } from './counsellor-master-maps';

describe('sessionTypeCodeToDb', () => {
  it('maps INITIAL master code to DB Initial', () => {
    expect(sessionTypeCodeToDb('INITIAL')).toBe('Initial');
  });

  it('maps FOLLOW_UP to Followup', () => {
    expect(sessionTypeCodeToDb('FOLLOW_UP')).toBe('Followup');
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
