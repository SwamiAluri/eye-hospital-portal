import { describe, expect, it } from 'vitest';
import {
  callbackChannelToDb,
  callbackTypeCodeToDb,
  contactOutcomeToDb,
  sessionTypeCodeToDb,
} from './counsellor-master-maps';

describe('sessionTypeCodeToDb', () => {
  it('maps INITIAL master code to DB Initial', () => {
    expect(sessionTypeCodeToDb('INITIAL')).toBe('Initial');
  });

  it('maps FOLLOW_UP to Followup', () => {
    expect(sessionTypeCodeToDb('FOLLOW_UP')).toBe('Followup');
  });

  it('maps repeat Start Session payload codes used by the Follow-Up dropdown', () => {
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

describe('callbackTypeCodeToDb', () => {
  it('maps Reminder Call master code REMINDER to General', () => {
    expect(callbackTypeCodeToDb('REMINDER')).toBe('General');
  });

  it('maps all master counsellor.callback_type codes onto migration-70 allowlist', () => {
    expect(callbackTypeCodeToDb('SCHEDULED')).toBe('General');
    expect(callbackTypeCodeToDb('FOLLOW_UP')).toBe('General');
    expect(callbackTypeCodeToDb('NO_SHOW')).toBe('DelayReason');
    expect(callbackTypeCodeToDb('URGENT')).toBe('General');
  });

  it('passes through DB allowlist values', () => {
    expect(callbackTypeCodeToDb('PreSurgery')).toBe('PreSurgery');
    expect(callbackTypeCodeToDb('General')).toBe('General');
  });
});

describe('callbackChannelToDb', () => {
  it('keeps Phone and maps Email to Phone for callback CHECK', () => {
    expect(callbackChannelToDb('Phone')).toBe('Phone');
    expect(callbackChannelToDb('Email')).toBe('Phone');
  });
});

describe('contactOutcomeToDb', () => {
  it('maps UI shorthand outcomes onto communication_log CHECK values', () => {
    expect(contactOutcomeToDb('Answered')).toBe('Answered');
    expect(contactOutcomeToDb('LeftMessage')).toBe('Voicemail');
    expect(contactOutcomeToDb('Declined')).toBe('DeclinedContact');
  });
});
