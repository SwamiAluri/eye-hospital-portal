import { describe, expect, it } from 'vitest';
import {
  canDirectoryOfferBookAppointment,
  canDirectoryOfferCheckIn,
  formatDirectoryPhoneDisplay,
  formatDirectorySexLabel,
  formatHubCurrentVisitStatusLine,
  formatHubLocationLines,
  formatHubMobileContextLine,
  formatHubNextAppointment,
  formatHubSchedule,
  formatHubVisitWhen,
  formatPatientHubIdentityLine,
  isDirectoryVisitCheckedIn,
  isDisplayableWaitingMinutes,
  pickPrimaryVisitEngagement,
} from '@/lib/patients/patient-hub-row-display';

describe('patient-hub-row-display', () => {
  it('formatPatientHubIdentityLine joins mrn age gender', () => {
    const line = formatPatientHubIdentityLine({
      mrn: 'MRN-001',
      dateOfBirth: '1990-01-15',
      gender: 'Male',
    });
    expect(line).toContain('MRN-001');
    expect(line).toContain('MALE');
    expect(line).not.toContain('Male');
  });

  it('normalizes directory sex labels to uppercase male/female only', () => {
    expect(formatDirectorySexLabel('male')).toBe('MALE');
    expect(formatDirectorySexLabel('Male')).toBe('MALE');
    expect(formatDirectorySexLabel('FEMALE')).toBe('FEMALE');
    expect(formatDirectorySexLabel('female')).toBe('FEMALE');
    expect(formatDirectorySexLabel('f')).toBe('FEMALE');
    expect(formatDirectorySexLabel('other')).toBe('Other');
    expect(formatDirectorySexLabel('non-binary')).toBe('Non-Binary');
    expect(formatDirectorySexLabel(null)).toBeNull();
  });

  it('formats Indian phones for Directory display without inventing foreign formats', () => {
    expect(formatDirectoryPhoneDisplay('+919800000003')).toBe('+91-9800000003');
    expect(formatDirectoryPhoneDisplay('9800000003')).toBe('+91-9800000003');
    expect(formatDirectoryPhoneDisplay('09800000003')).toBe('+91-9800000003');
    expect(formatDirectoryPhoneDisplay('+91-9800000003')).toBe('+91-9800000003');
    expect(formatDirectoryPhoneDisplay('+44 20 7946 0958')).toBe('+44 20 7946 0958');
    expect(formatDirectoryPhoneDisplay('')).toBe('');
  });

  it('pickPrimaryVisitEngagement prefers IP then queue', () => {
    const ip = pickPrimaryVisitEngagement([
      { type: 'opd', label: 'OPD' },
      { type: 'ip', label: 'IP' },
    ]);
    expect(ip?.type).toBe('ip');

    const queue = pickPrimaryVisitEngagement([
      { type: 'opd', label: 'OPD' },
      { type: 'queue', label: 'Queue' },
    ]);
    expect(queue?.type).toBe('queue');
  });

  it('formatHubSchedule returns dash for empty', () => {
    expect(formatHubSchedule(null)).toBe('—');
  });

  it('labels a checked-in visit without calling it a schedule', () => {
    const text = formatHubVisitWhen(
      {
        scheduledAt: '2026-06-02T04:35:00.000Z',
        primaryOpenVisitId: 'visit-1',
        waitingMinutes: 12,
      },
      new Date('2026-06-02T05:00:00.000Z'),
    );
    expect(text?.startsWith('Checked in · ')).toBe(true);
    expect(text).not.toMatch(/schedule/i);
    expect(text).not.toMatch(/appointment/i);
  });

  it('labels a future appointment by day without a schedule caption', () => {
    const text = formatHubVisitWhen(
      {
        scheduledAt: '2026-06-02T04:35:00.000Z',
        primaryOpenVisitId: null,
        waitingMinutes: null,
      },
      new Date('2026-06-01T05:00:00.000Z'),
    );
    expect(text).toBeTruthy();
    expect(text).not.toMatch(/schedule/i);
    expect(text).not.toMatch(/checked in/i);
  });

  it('uses Today when the appointment is the same local day', () => {
    const stamp = '2026-06-02T04:35:00.000Z';
    const text = formatHubVisitWhen(
      { scheduledAt: stamp, primaryOpenVisitId: null, waitingMinutes: null },
      new Date(stamp),
    );
    expect(text?.startsWith('Today · ')).toBe(true);
  });

  it('omits a visit time when scheduledAt is missing', () => {
    expect(formatHubVisitWhen({ scheduledAt: null, waitingMinutes: 4 })).toBeNull();
  });

  it('detects checked-in visits and gates the check-in action', () => {
    const checkedIn = {
      primaryOpenVisitId: 'visit-1',
      waitingMinutes: 8,
      scheduledAt: '2026-06-02T04:35:00.000Z',
    };
    expect(isDirectoryVisitCheckedIn(checkedIn)).toBe(true);
    expect(canDirectoryOfferCheckIn(checkedIn)).toBe(false);

    const scheduled = {
      primaryOpenVisitId: null,
      assignedVisitId: 'visit-2',
      waitingMinutes: null,
      scheduledAt: '2026-06-02T04:35:00.000Z',
    };
    expect(isDirectoryVisitCheckedIn(scheduled)).toBe(false);
    expect(canDirectoryOfferCheckIn(scheduled)).toBe(true);

    const bare = {
      primaryOpenVisitId: null,
      assignedVisitId: null,
      waitingMinutes: null,
      scheduledAt: null,
    };
    expect(isDirectoryVisitCheckedIn(bare)).toBe(false);
    expect(canDirectoryOfferCheckIn(bare)).toBe(false);
  });

  it('renders station, room, and a positive wait, and hides a zero wait', () => {
    expect(
      formatHubLocationLines({
        currentStation: 'Triage',
        roomNumber: '3',
        waitingMinutes: 12,
      }),
    ).toEqual(['Triage', 'Rm 3 · 12 min']);
    expect(
      formatHubLocationLines({
        currentStation: 'Triage',
        waitingMinutes: 0,
      }),
    ).toEqual(['Triage']);
  });

  it('omits obviously unusable waiting minutes from location display', () => {
    expect(isDisplayableWaitingMinutes(180733)).toBe(false);
    expect(isDisplayableWaitingMinutes(12)).toBe(true);
    expect(
      formatHubLocationLines({
        currentStation: 'Triage',
        roomNumber: '3',
        waitingMinutes: 180733,
      }),
    ).toEqual(['Triage', 'Rm 3']);
  });

  it('formats next appointment only when scheduledAt is not a check-in', () => {
    expect(
      formatHubNextAppointment({
        scheduledAt: '2026-06-02T04:35:00.000Z',
        primaryOpenVisitId: 'visit-1',
        waitingMinutes: 12,
      }),
    ).toBeNull();
    const appt = formatHubNextAppointment(
      {
        scheduledAt: '2026-06-02T04:35:00.000Z',
        primaryOpenVisitId: null,
        waitingMinutes: null,
      },
      new Date('2026-06-02T04:35:00.000Z'),
    );
    expect(appt?.startsWith('Today · ')).toBe(true);
  });

  it('offers Book appointment only when Next Appointment is empty', () => {
    expect(
      canDirectoryOfferBookAppointment({
        scheduledAt: '2026-06-02T04:35:00.000Z',
        primaryOpenVisitId: null,
        waitingMinutes: null,
      }),
    ).toBe(false);
    expect(
      canDirectoryOfferBookAppointment({
        scheduledAt: '2026-06-02T04:35:00.000Z',
        primaryOpenVisitId: 'visit-1',
        waitingMinutes: 8,
      }),
    ).toBe(true);
    expect(
      canDirectoryOfferBookAppointment({
        scheduledAt: null,
        primaryOpenVisitId: null,
        waitingMinutes: null,
      }),
    ).toBe(true);
  });

  it('compacts Current Visit status with engagement on one line', () => {
    const line = formatHubCurrentVisitStatusLine(
      {
        scheduledAt: '2026-06-02T04:35:00.000Z',
        primaryOpenVisitId: 'visit-1',
        waitingMinutes: 8,
        activeEngagements: [
          { type: 'queue', label: 'Queue', status: 'waiting' },
          { type: 'billing', label: 'Billing', status: 'open' },
        ],
      },
      new Date('2026-06-02T05:00:00.000Z'),
    );
    expect(line?.startsWith('Checked in · ')).toBe(true);
    expect(line).toContain('Queue +1');
  });

  it('renders an IP ward and omits an empty location', () => {
    expect(
      formatHubLocationLines({
        ipAdmission: { isAdmitted: true, wardName: 'Ward A' },
        currentStation: 'Triage',
        waitingMinutes: 40,
      }),
    ).toEqual(['Ward A']);
    expect(formatHubLocationLines({ waitingMinutes: 0 })).toEqual([]);
    expect(formatHubLocationLines({})).toEqual([]);
  });

  it('picks one mobile context line by reason, then place, then time', () => {
    expect(
      formatHubMobileContextLine({
        reasonForVisit: 'Follow-up review',
        currentStation: 'Triage',
      }),
    ).toBe('Follow-up review');
    expect(
      formatHubMobileContextLine({
        currentStation: 'Triage',
        waitingMinutes: 8,
      }),
    ).toBe('Triage');
    const whenOnly = formatHubMobileContextLine(
      { scheduledAt: '2026-06-02T04:35:00.000Z' },
      new Date('2026-06-02T04:35:00.000Z'),
    );
    expect(whenOnly?.startsWith('Today · ')).toBe(true);
  });
});
