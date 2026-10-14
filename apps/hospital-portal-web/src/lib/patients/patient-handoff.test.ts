import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildCounsellorHandoffHref,
  buildFrontDeskCheckInHref,
  loadCounsellorHandoffHref,
  readCheckInPatientId,
  resolveCounsellorSessionHandoff,
  shouldClearCheckInSelection,
} from './patient-handoff';

const webRoot = resolve(__dirname, '../..');

function readWeb(relativePath: string): string {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

describe('check-in handoff', () => {
  it('directory check-in uses patient.id on the existing Front Office route', () => {
    const patientId = '74c014cf-9570-4824-bdf9-b369ea11a8f4';
    expect(buildFrontDeskCheckInHref(patientId)).toBe(
      `/dashboard/frontdesk/check-in?patientId=${patientId}`,
    );
    expect(buildFrontDeskCheckInHref('  ')).toBe('/dashboard/frontdesk/check-in');
  });

  it('check-in reads the same patientId query and ignores a missing value', () => {
    const params = new URLSearchParams('patientId=pat-1&emergency=1');
    expect(readCheckInPatientId(params)).toBe('pat-1');
    expect(readCheckInPatientId(new URLSearchParams('emergency=1'))).toBeNull();
    expect(shouldClearCheckInSelection('', 'pat-1')).toBe(false);
    expect(shouldClearCheckInSelection('', null)).toBe(true);
    expect(shouldClearCheckInSelection('sam', 'pat-1')).toBe(false);
  });

  it('directory and preview both use the canonical Front Office check-in href', () => {
    const actions = readWeb('components/patients/lookup/PatientHubRowActions.tsx');
    const table = readWeb('components/patients/lookup/PatientHubTable.tsx');
    const mobile = readWeb('components/patients/lookup/PatientHubMobileCards.tsx');
    const preview = readWeb('components/patients/lookup/PatientPreviewPanel.tsx');
    const checkIn = readWeb('components/frontdesk/CheckInComponent.tsx');
    expect(actions).toContain('buildFrontDeskCheckInHref');
    expect(actions).toContain('canDirectoryOfferCheckIn');
    expect(actions).toContain('Print Card');
    expect(actions).toContain('registrationCardPatient');
    expect(table).toContain('PatientHubRowActions');
    expect(mobile).toContain('PatientHubRowActions');
    expect(preview).toContain('buildFrontDeskCheckInHref(patient.id)');
    expect(checkIn).toContain('readCheckInPatientId(searchParams)');
    expect(checkIn).toContain('`/patients/${linkedPatientId}`');
    expect(checkIn).not.toContain('getMockPatientById');
  });
});

describe('counselling handoff', () => {
  it('uses the waiting-list entry and patient.id', () => {
    const patientId = '74c014cf-9570-4824-bdf9-b369ea11a8f4';
    expect(buildCounsellorHandoffHref(patientId)).toBe(
      `/dashboard/counsellors-desk/waiting-list?patientId=${patientId}`,
    );
  });

  it('opens the single existing session without ownership or lifecycle params', () => {
    const target = resolveCounsellorSessionHandoff('pat-1', [
      { id: 'sess-9', patientId: 'pat-1' },
    ]);
    expect(target).toEqual({
      kind: 'session',
      sessionId: 'sess-9',
      href: '/dashboard/counsellors-desk/sess-9?from=waiting-list',
    });
    expect(target.href).not.toContain('lifecycle');
    expect(target.href).not.toContain('counselorId');
  });

  it('leaves zero or several sessions on the waiting list', () => {
    expect(resolveCounsellorSessionHandoff('pat-1', []).kind).toBe('list');
    const many = resolveCounsellorSessionHandoff('pat-1', [
      { id: 'sess-1', patientId: 'pat-1' },
      { id: 'sess-2', patientId: 'pat-1' },
    ]);
    expect(many).toEqual({
      kind: 'list',
      href: '/dashboard/counsellors-desk/waiting-list?patientId=pat-1',
    });
  });

  it('ignores a session that belongs to another patient', () => {
    const target = resolveCounsellorSessionHandoff('pat-1', [
      { id: 'sess-other', patientId: 'pat-2' },
    ]);
    expect(target.kind).toBe('list');
  });

  it('does not navigate when session lookup fails', async () => {
    const getSessions = vi.fn().mockRejectedValue(new Error('forbidden'));
    await expect(loadCounsellorHandoffHref('pat-1', getSessions)).rejects.toThrow('forbidden');
    expect(getSessions).toHaveBeenCalledWith('pat-1');
  });

  it('returns a view-only href for one session and null when the list should stay', async () => {
    const one = await loadCounsellorHandoffHref('pat-1', async () => [
      { id: 'sess-9', patientId: 'pat-1' },
    ]);
    expect(one).toBe('/dashboard/counsellors-desk/sess-9?from=waiting-list');

    const none = await loadCounsellorHandoffHref('pat-1', async () => []);
    expect(none).toBeNull();
  });

  it('record toolbar hands off to counsellor desk instead of the placeholder tab', () => {
    const record = readWeb('components/patients/record/PatientRecordPage.tsx');
    const care = readWeb('components/patients/record/Patient360Care.tsx');
    const toolbar = readWeb('components/patients/QuickActionsToolbar.tsx');
    const placeholder = readWeb('components/patients/tabs/CounselingTab.tsx');
    const waitingList = readWeb('app/dashboard/counsellors-desk/waiting-list/page.tsx');
    expect(record).not.toContain('buildCounsellorHandoffHref(summary.id)');
    expect(record).not.toContain('Open Counselling');
    expect(record).not.toContain("onOpenCounseling={() => setTabWithUrl('counseling')}");
    expect(care).toContain('buildCounsellorHandoffHref(patientId)');
    expect(toolbar).toContain('buildCounsellorHandoffHref(patientId)');
    expect(toolbar).not.toContain('/dashboard/counsellors-desk?patientId=');
    expect(placeholder).toContain('buildCounsellorHandoffHref(patientId)');
    expect(waitingList).toContain('loadCounsellorHandoffHref');
    expect(waitingList).toContain('COUNSELLING_SESSIONS_READ_PERMISSION');
  });
});
