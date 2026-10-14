import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PATIENT_360_SECTIONS } from '@/lib/patients/patient-360-sections';
import {
  classifyCommunicationError,
  communicationEmptyMessage,
  communicationUnauthorizedMessage,
  communicationUnavailableMessage,
  mapCommunication,
} from '@/lib/patients/patient-360-communication';

describe('patient 360 communication reads', () => {
  it('maps returned chart-communication fields and keeps failure distinct from no data', () => {
    const row = mapCommunication({
      id: 'c1',
      communicationType: 'sms',
      direction: 'outbound',
      subject: 'Appointment reminder',
      message: 'Your visit is tomorrow.',
      status: 'delivered',
      sender: 'Front desk',
      recipient: '9990001111',
      sentAt: '2026-09-20T09:00:00',
      priority: 'high',
    });

    expect(row).toMatchObject({
      id: 'c1',
      channel: 'sms',
      direction: 'outbound',
      subject: 'Appointment reminder',
      status: 'delivered',
      sender: 'Front desk',
      recipient: '9990001111',
      when: '2026-09-20 09:00',
      preview: 'Your visit is tomorrow.',
    });
    expect(row).not.toHaveProperty('priority');
    expect(communicationEmptyMessage()).toBe('No communications recorded.');
    expect(classifyCommunicationError({ response: { status: 403 } })).toBe('unauthorized');
    expect(communicationUnauthorizedMessage()).toBe('Communications are not available to this sign-in.');
    expect(communicationUnauthorizedMessage()).not.toMatch(/No communications/i);
    expect(classifyCommunicationError({ response: { status: 500 } })).toBe('unavailable');
    expect(communicationUnavailableMessage()).toBe('Communications are not available in Patient 360.');
  });
});

describe('patient 360 communication boundaries', () => {
  it('keeps communication inside Care and does not add a section, mutation, or timeline change', () => {
    const root = resolve(__dirname, '../..');
    const page = readFileSync(resolve(root, 'components/patients/record/PatientRecordPage.tsx'), 'utf8');
    const panel = readFileSync(resolve(root, 'components/patients/record/Patient360Communication.tsx'), 'utf8');
    const reads = readFileSync(resolve(root, 'lib/patients/patient-360-communication.ts'), 'utf8');
    const timeline = readFileSync(resolve(root, 'components/patients/tabs/TimelineTab.tsx'), 'utf8');
    const joined = `${panel}\n${reads}`;

    expect(PATIENT_360_SECTIONS.map((section) => section.key)).toEqual([
      'overview',
      'clinical',
      'care',
      'documents',
      'coverage',
      'administration',
      'timeline',
    ]);
    expect(page).toContain("section === 'care'");
    expect(page).toContain('Patient360CarePanel');
    const care = readFileSync(resolve(root, 'components/patients/record/Patient360Care.tsx'), 'utf8');
    expect(care).toContain('Patient360CommunicationPanel');
    expect(page).not.toContain('Existing record tools');
    expect(reads).toContain('patientCommunicationsApi.getByPatient');
    expect(reads.match(/patientCommunicationsApi\.getByPatient/g)).toHaveLength(1);
    expect(timeline).toContain('patientCommunicationsApi.getByPatient(patientId)');
    expect(timeline).not.toContain('Patient360Communication');

    for (const banned of [
      'patientCommunicationsApi.create',
      'patientCommunicationsApi.update',
      'patientCommunicationsApi.delete',
      'NotificationHub',
      'patient_events',
      'Send message',
      'Resend',
    ]) {
      expect(joined, banned).not.toContain(banned);
    }
  });
});
