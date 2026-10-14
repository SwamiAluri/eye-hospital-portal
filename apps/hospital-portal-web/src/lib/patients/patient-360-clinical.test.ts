import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  IP_VITALS_UNAVAILABLE,
  classifyReadError,
  clinicalEmptyMessage,
  clinicalUnavailableMessage,
  mapAllergyRecord,
  mapChartNote,
  mapCodedDiagnosis,
  codedDiagnosisTypeLabel,
  mapExamination,
  mapImagingOrder,
  mapLabReport,
  mapOpdVital,
  mapOpticalOrder,
  mapPrescription,
  unwrapList,
} from '@/lib/patients/patient-360-clinical';

describe('patient 360 clinical reads', () => {
  it('maps an OPD vital reading and keeps a failed read distinct from no data', () => {
    const vital = mapOpdVital({
      id: 'v1',
      measuredAt: '2026-09-01T08:15:00',
      bloodPressureSystolic: 118,
      bloodPressureDiastolic: 76,
      heartRate: 70,
    });
    expect(vital?.source).toBe('OPD');
    expect(vital?.measuredAt).toBe('2026-09-01 08:15');
    expect(vital?.measures).toEqual([
      { label: 'Blood pressure', value: '118/76' },
      { label: 'Heart rate', value: '70' },
    ]);
    expect(clinicalEmptyMessage('vitals')).toBe('No OPD vitals recorded.');
    expect(classifyReadError({ response: { status: 500 } })).toBe('unavailable');
    expect(clinicalUnavailableMessage('vitals')).toBe('OPD vitals are not available in Patient 360.');
    expect(clinicalUnavailableMessage('vitals')).not.toMatch(/No vitals/i);
    expect(IP_VITALS_UNAVAILABLE).toBe('IP vitals are not available in Patient 360.');
  });

  it('keeps allergy records separate from registration text and omits diagnosis fields', () => {
    expect(
      mapAllergyRecord({
        id: 'a1',
        allergenName: 'Penicillin',
        allergenType: 'medication',
        severity: 'mild',
        reaction: 'Rash',
        status: 'active',
        createdAt: '2026-08-01T09:00:00',
      }),
    ).toEqual({
      id: 'a1',
      name: 'Penicillin',
      reaction: 'Rash',
      status: 'active',
      recorded: '2026-08-01 09:00',
    });
    expect(clinicalEmptyMessage('allergies')).toBe('No allergy records recorded.');

    const exam = mapExamination({
      id: 'e1',
      examinationDate: '2026-08-01T09:00:00',
      chiefComplaint: 'Blurred vision',
      examiningDoctorName: 'Dr Sen',
      diagnosis: 'Cataract',
      treatmentPlan: 'Observe',
    });
    expect(exam).toEqual({
      id: 'e1',
      title: 'Blurred vision',
      when: '2026-08-01 09:00',
      provider: 'Dr Sen',
      eye: null,
      finding: null,
    });
    expect(
      mapExamination({
        id: 'e2',
        examinationType: 'Slit lamp',
        examinationDate: '2026-08-01T09:00:00',
        findings: 'Nuclear sclerosis',
        examinedByName: 'Dr Sen',
        laterality: 'OD',
        diagnosis: 'Cataract',
      }),
    ).toEqual({
      id: 'e2',
      title: 'Slit lamp',
      when: '2026-08-01 09:00',
      provider: 'Dr Sen',
      eye: 'OD',
      finding: 'Nuclear sclerosis',
    });
    expect(exam).not.toHaveProperty('diagnosis');

    const prescription = mapPrescription({
      id: 'rx1',
      prescriptionDate: '2026-08-02T10:00:00',
      status: 'completed',
      doctorName: 'Dr Sen',
      diagnosis: 'Cataract',
      notes: 'secret-note',
      pharmacyName: 'Main pharmacy',
      lines: [{
        id: 'l1',
        medicationName: 'Timolol',
        genericName: 'Timolol maleate',
        dosage: '0.5%',
        form: 'eye drops',
        route: 'ocular',
        frequency: 'BD',
        durationDays: 30,
        startDate: '2026-08-02T00:00:00',
        endDate: null,
        instructions: 'shake',
      }],
    });
    expect(prescription?.status).toBe('completed');
    expect(prescription?.when).toBe('2026-08-02 10:00');
    expect(prescription?.lines[0]?.medicationName).toBe('Timolol');
    expect(prescription?.lines[0]?.dosage).toBe('0.5%');
    expect(prescription).not.toHaveProperty('diagnosis');
    expect(prescription).not.toHaveProperty('doctorName');
    expect(prescription).not.toHaveProperty('provider');
    expect(prescription?.lines[0]).not.toHaveProperty('instructions');
    expect(clinicalEmptyMessage('prescriptions')).toBe('No prescriptions recorded.');
  });

  it('maps lab, imaging, optical, and chart notes without mutation or counselling fields', () => {
    expect(
      mapLabReport({
        id: 'l1',
        testName: 'CBC',
        status: 'completed',
        completedAt: '2026-08-03T11:00:00',
        resultValue: '4.5',
        resultUnit: 'x10^9/L',
        referenceRange: '4.0-11.0',
        reportUrl: 'https://reports.example/cbc.pdf',
        interpretation: 'critical',
      }),
    ).toMatchObject({
      id: 'l1',
      title: 'CBC',
      status: 'completed',
      detail: '4.5 x10^9/L',
      reference: '4.0-11.0',
      reportUrl: 'https://reports.example/cbc.pdf',
      canonicalDocumentId: null,
    });
    expect(
      mapLabReport({
        id: 'l1',
        testName: 'CBC',
        status: 'completed',
        resultValue: '4.5',
        resultUnit: 'x10^9/L',
        referenceRange: '4.0-11.0',
        interpretation: 'critical',
        canonicalDocumentId: 'can-lab-1',
        canonicalFileName: 'cbc.pdf',
        canonicalMimeType: 'application/pdf',
      }),
    ).toMatchObject({
      canonicalDocumentId: 'can-lab-1',
      canonicalFileName: 'cbc.pdf',
      canonicalMimeType: 'application/pdf',
    });
    expect(
      mapLabReport({
        id: 'l1',
        testName: 'CBC',
        status: 'completed',
        resultValue: '4.5',
        resultUnit: 'x10^9/L',
        referenceRange: '4.0-11.0',
        interpretation: 'critical',
      }),
    ).not.toHaveProperty('interpretation');
    expect(clinicalEmptyMessage('labs')).toBe('No lab results recorded.');
    expect(clinicalUnavailableMessage('labs')).toBe('Laboratory reports are not available in Patient 360.');

    expect(mapImagingOrder({ id: 'i1', imagingType: 'OCT Macula', status: 'Pending', orderedAt: '2026-08-04T12:00:00', laterality: 'OD' }).status).toBe('Pending');
    expect(mapOpticalOrder({ id: 'o1', orderType: 'eyeglasses', status: 'ready', orderDate: '2026-08-05', amount: 900, paidAmount: 100 })).toEqual({
      id: 'o1',
      title: 'eyeglasses',
      status: 'ready',
      when: '2026-08-05',
      eye: null,
      prescription: null,
    });
    expect(
      mapOpticalOrder({
        id: 'o2',
        orderType: 'eyeglasses',
        status: 'ready',
        odSphere: '-1.00',
        osSphere: '-1.25',
      }),
    ).toMatchObject({
      eye: 'OU',
      prescription: 'OD -1.00 · OS -1.25',
    });
    expect(mapChartNote({ id: 'n1', title: 'Post visit', noteType: 'clinical', status: 'active', content: 'Reviewed', createdAt: '2026-08-06T08:00:00', authorName: 'Nurse Patil' })).toMatchObject({
      kind: 'Chart note',
      noteType: 'clinical',
      title: 'Post visit',
      status: 'active',
      author: 'Nurse Patil',
    });
    expect(clinicalEmptyMessage('notes')).toBe('No chart notes recorded.');
    expect(clinicalUnavailableMessage('notes')).not.toMatch(/^No notes\.?$/i);
    expect(unwrapList([])).toEqual([]);
    expect(unwrapList({ items: [{ id: 'x' }] })).toEqual([{ id: 'x' }]);
    expect(unwrapList({ unexpected: true })).toBeNull();
  });

  it('maps coded diagnosis fields and keeps rule-out and the two laterality fields separate', () => {
    expect(codedDiagnosisTypeLabel('primary')).toBe('Primary');
    expect(codedDiagnosisTypeLabel('secondary')).toBe('Secondary');
    expect(codedDiagnosisTypeLabel('rule-out')).toBe('Rule-out');
    expect(codedDiagnosisTypeLabel('confirmed')).toBe('confirmed');
    const row = mapCodedDiagnosis({
      id: 'dx1',
      code: 'H25.011',
      description: 'Cortical age-related cataract, right eye',
      diagnosisType: 'rule-out',
      eyeSpecificity: 'OS',
      codeLaterality: 'OD',
      diagnosedAt: '2026-08-03T11:20:00',
      status: 'active',
      clinicalNotes: 'do not show',
      diagnosedByUserId: 'user-1',
      visitId: 'visit-1',
      billable: true,
    });
    expect(row).toEqual({
      id: 'dx1',
      code: 'H25.011',
      description: 'Cortical age-related cataract, right eye',
      diagnosisType: 'rule-out',
      eyeSpecificity: 'OS',
      codeLaterality: 'OD',
      diagnosedAt: '2026-08-03 11:20',
    });
    expect(row).not.toHaveProperty('status');
    expect(clinicalEmptyMessage('codedDiagnosis')).toBe('No coded diagnoses recorded.');
    expect(clinicalUnavailableMessage('codedDiagnosis')).toBe('Coded diagnosis is not available in Patient 360.');
    expect(clinicalUnavailableMessage('codedDiagnosis')).not.toMatch(/No coded diagnoses/i);
  });
});

describe('patient 360 clinical module boundaries', () => {
  it('loads clinical reads only from the clinical panel and does not add mutations or aggregators', () => {
    const root = resolve(__dirname, '../..');
    const page = readFileSync(resolve(root, 'components/patients/record/PatientRecordPage.tsx'), 'utf8');
    const clinical = readFileSync(resolve(root, 'components/patients/record/Patient360Clinical.tsx'), 'utf8');
    const reads = readFileSync(resolve(root, 'lib/patients/patient-360-clinical.ts'), 'utf8');
    const joined = `${clinical}\n${reads}`;

    expect(page).toContain("section === 'clinical'");
    expect(page).toContain('Patient360ClinicalPanel');
    expect(page).not.toContain('Existing record tools');
    expect(reads).toContain('/vitals/patient/');
    expect(reads).toContain('patientAllergiesApi.getByPatient');
    expect(reads).toContain('examinationApi.getByPatient');
    expect(reads).toContain('/prescriptions/patients/');
    expect(reads).toContain('/diagnoses/patients/');
    expect(reads).toContain('/patient-360');
    expect(reads).not.toContain('prescriptionsApi.getByPatient');
    expect(reads).toContain('labReportsApi.getByPatient');
    expect(reads).toContain('imagingApi.getPatientOrders');
    expect(reads).toContain('opticalOrdersApi.getByPatient');
    expect(reads).toContain('patientNotesApi.getByPatient');
    expect(clinical).toContain('overflow-x-hidden');
    expect(clinical).toContain('id="p360-clinical-specialty"');

    for (const banned of [
      'PharmacyTab',
      'PrescriptionsTab',
      '.deliver',
      'markDispensed',
      'opdBillsApi',
      'patient-medical-history',
      'octimaging',
      'CounselorId',
      'Diagnosis history',
      'Coming Soon',
      'patient_events',
      'getMedicalHistoryTimeline',
    ]) {
      expect(joined, banned).not.toContain(banned);
    }
  });
});
