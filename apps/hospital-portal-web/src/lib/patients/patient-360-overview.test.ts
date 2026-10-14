import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PatientRecentVisit, PatientSummary } from '@/types/patient-lookup';
import {
  buildPatient360Overview,
  classifyRecentActivityFailure,
  recentActivityMessage,
} from '@/lib/patients/patient-360-overview';

function summary(overrides: Partial<PatientSummary> = {}): PatientSummary {
  return {
    id: 'p1',
    firstName: 'Asha',
    lastName: 'Rao',
    mrn: 'MRN-7',
    dateOfBirth: '1980-01-15',
    gender: 'Female',
    phone: '9990001111',
    email: 'asha@example.com',
    bloodGroup: 'O+',
    allergies: 'Penicillin',
    emergencyContactName: 'Ravi Rao',
    emergencyContactPhone: '9990002222',
    emergencyContactRelationship: 'Spouse',
    clinicalAcuity: 'low',
    activeEngagements: [
      { type: 'queue', label: 'Queue', status: 'waiting' },
      { type: 'counselling', label: 'Counselling', status: 'open' },
    ],
    careProgramCodes: ['CATARACT'],
    reasonForVisit: 'Blurred vision',
    scheduledAt: '2026-09-30T09:30:00',
    assignedVisitId: 'v1',
    assignedProviderName: 'Dr Sen',
    assignedProviderRole: 'Doctor',
    currentStation: 'Optometry',
    ipAdmission: { isAdmitted: true, wardName: 'Ward A', clinicalState: 'pre-op' },
    latestVitals: {
      recordedAt: '2026-09-01T08:00:00',
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      heartRate: 72,
      visualAcuityOd: '6/6',
      isStale: true,
    },
    dataQuality: { isIncomplete: true, issues: ['Missing phone number'] },
    ...overrides,
  };
}

const visits: PatientRecentVisit[] = [
  {
    id: 'v1',
    checkedInAt: '2026-09-28T10:00:00',
    status: 'Checked-in',
    visitType: 'OPD',
    currentStation: 'Optometry',
    tokenNumber: '12',
  },
  {
    id: 'v2',
    checkedInAt: '2026-09-01T10:00:00',
    status: 'Completed',
    visitType: 'Review',
  },
  {
    id: 'v3',
    status: 'Waiting',
    visitType: 'OPD',
  },
  {
    id: 'v4',
    status: 'Completed',
    visitType: 'OPD',
  },
];

describe('patient 360 overview model', () => {
  it('exposes Now from scheduledAt and programs, not header identity or engagements', () => {
    const model = buildPatient360Overview(summary(), visits);

    expect(model.showNow).toBe(true);
    expect(model.now.scheduledAt).toBe('2026-09-30 09:30');
    expect(model.now.programs).toEqual(['Cataract']);
    expect(model.now.engagements).toEqual([]);
    expect(model.context.ip).toContain('Ward A');
    expect(model.diagnosisIncluded).toBe(false);
    expect(model.showNextStep).toBe(false);
    expect(model.showDataQuality).toBe(false);
  });

  it('omits Now when scheduledAt and programs are absent', () => {
    const model = buildPatient360Overview(
      summary({ scheduledAt: null, careProgramCodes: [] }),
      visits,
    );
    expect(model.showNow).toBe(false);
  });

  it('builds at most three recent-visit rows with existing DTO fields and encounter handoff', () => {
    const model = buildPatient360Overview(summary(), visits);

    expect(model.recentActivity).toHaveLength(3);
    expect(model.recentActivity[0]).toMatchObject({
      id: 'v1',
      date: '2026-09-28 10:00',
      visit: 'OPD',
      stationReason: 'Optometry',
      status: 'Checked-in',
      encounterHref: '/dashboard/patients/p1/encounter/v1',
    });
    expect(model.recentActivity[1].encounterHref).toBeNull();
    expect(model.visits).toHaveLength(4);
    expect(model.hasClinicalFlags).toBe(true);
    expect(model.clinical.opdVitals.some((row) => row.value === '120/80')).toBe(true);
    expect(model.clinical.opdStale).toBe(true);
    expect(model.clinical.draftExam.some((row) => row.value === '6/6')).toBe(true);
    expect(model.clinical.registrationAllergyText).toBe('Penicillin');
  });

  it('omits unwired and empty clinical flags instead of empty-history claims', () => {
    const model = buildPatient360Overview(
      summary({
        allergies: '  ',
        latestVitals: null,
        scheduledAt: null,
        assignedVisitId: null,
        ipAdmission: null,
        activeEngagements: [],
        careProgramCodes: [],
        dataQuality: { isIncomplete: false, issues: [] },
        insuranceProvider: 'Some payer',
      }),
      [],
    );

    expect(model.hasClinicalFlags).toBe(false);
    expect(model.clinical.opdVitals).toEqual([]);
    expect(model.clinical.registrationAllergyText).toBeNull();
    expect(model.clinical.draftExam).toEqual([]);
    expect(model.showNow).toBe(false);
    expect(model.recentActivityEmpty).toBe(true);
    expect(model.showNextStep).toBe(false);
    expect(JSON.stringify(model)).not.toMatch(/insurance|outstanding|balance|bill|claim|CounselorId/i);
    expect(JSON.stringify(model)).not.toMatch(/No history|No documents|No counselling|No bills|Diagnosis history/i);
  });
});

describe('patient 360 recent activity honesty', () => {
  it('distinguishes recorded absence, unauthorized, and unavailable', () => {
    expect(recentActivityMessage('empty')).toBe('No visits recorded.');
    expect(recentActivityMessage('unauthorized')).toBe('Recent activity is not available to this sign-in.');
    expect(recentActivityMessage('unavailable')).toBe('Recent activity is not available in Patient 360.');
    expect(classifyRecentActivityFailure({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyRecentActivityFailure({ response: { status: 500 } })).toBe('unavailable');
    expect(classifyRecentActivityFailure(new Error('network'))).toBe('unavailable');
  });
});

describe('patient 360 overview does not add domain reads', () => {
  it('overview components stay on the summary and recent-visits context', () => {
    const overview = readFileSync(
      resolve(__dirname, '../../components/patients/record/Patient360Overview.tsx'),
      'utf8',
    );
    const page = readFileSync(
      resolve(__dirname, '../../components/patients/record/PatientRecordPage.tsx'),
      'utf8',
    );
    const joined = `${overview}\n${page}`;
    expect(overview).toContain('usePatientRecord');
    for (const banned of [
      'appointmentsApi',
      'opdBillsApi',
      'examinationApi',
      'prescriptionsApi',
      'patientInsurance',
      'surgeryRequestsApi',
      'labReportsApi',
      'patient-allergies',
      'counselling',
      'TimelineTab',
    ]) {
      expect(overview, banned).not.toContain(banned);
    }
    expect(page).toContain('Patient360OverviewPanel');
    expect(joined).not.toContain('Overview content is not loaded in this view.');
  });
});
