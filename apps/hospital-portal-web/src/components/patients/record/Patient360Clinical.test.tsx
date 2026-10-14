import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360ClinicalView } from '@/components/patients/record/Patient360Clinical';
import { Patient360SectionNav } from '@/components/patients/record/Patient360SectionNav';
import type { Patient360ClinicalBundle } from '@/lib/patients/patient-360-clinical';
import type { PatientSummary } from '@/types/patient-lookup';

const summary = {
  id: 'p1',
  firstName: 'Asha',
  lastName: 'Rao',
  mrn: 'MRN-7',
  dateOfBirth: '1980-01-15',
  gender: 'Female',
  clinicalAcuity: 'low',
  allergies: 'Penicillin on the registration form',
  activeEngagements: [],
  careProgramCodes: [],
  latestVitals: { visualAcuityOd: '6/9', iopOd: 14 },
  dataQuality: { isIncomplete: false, issues: [] },
} as PatientSummary;

function bundle(overrides: Partial<Patient360ClinicalBundle> = {}): Patient360ClinicalBundle {
  const empty = { state: 'ready' as const, rows: [] };
  const prescriptions = {
    state: 'ready' as const,
    rows: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 20,
  };
  return {
    vitals: empty,
    allergies: empty,
    examinations: empty,
    prescriptions,
    labs: empty,
    imaging: empty,
    optical: empty,
    notes: empty,
    ...overrides,
  };
}

describe('patient 360 clinical presentation', () => {
  it('renders source groups, separated allergy text, and failure copy without empty-history claims', () => {
    const html = renderToStaticMarkup(
      <>
        <Patient360SectionNav active="clinical" onSelect={() => undefined} />
        <Patient360ClinicalView
          summary={summary}
          ipVitals={{ state: 'unavailable', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
          imagingFiles={{ state: 'unavailable', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
          bundle={bundle({
            vitals: { state: 'unavailable', rows: [] },
            allergies: {
              state: 'ready',
              rows: [{ id: 'a1', name: 'Sulfa', reaction: 'Itching', status: 'active', recorded: '2026-08-01' }],
            },
            prescriptions: {
              state: 'ready',
              totalCount: 1,
              pageNumber: 1,
              pageSize: 20,
              rows: [{
                id: 'rx1',
                when: '2026-08-02 10:00',
                status: 'completed',
                lines: [{
                  id: 'l1',
                  medicationName: 'Timolol',
                  genericName: 'Timolol maleate',
                  dosage: '0.5%',
                  form: 'eye drops',
                  route: 'ocular',
                  frequency: 'BD',
                  durationDays: 30,
                  startDate: '2026-08-02',
                  endDate: null,
                }],
              }],
            },
            labs: { state: 'ready', rows: [] },
            imaging: { state: 'unauthorized', rows: [] },
          })}
        />
      </>,
    );

    expect(html).toContain('role="tab"');
    for (const heading of [
      'Summary',
      'Vitals',
      'Allergies',
      'Examinations',
      'Medications',
      'Diagnoses',
      'Laboratory',
      'Imaging &amp; scans',
      'Optical',
      'Notes',
    ]) {
      expect(html).toContain(`>${heading}<`);
    }
    expect(html).toContain('Finding');
    expect(html).toContain('Right eye');
    expect(html).toContain('6/9');
    expect(html).toContain('OPD vitals are not available in Patient 360.');
    expect(html).toContain('IP vitals are not available in Patient 360.');
    expect(html).toContain('Allergen');
    expect(html).toContain('Sulfa');
    expect(html).toContain('Itching');
    expect(html).toContain('Registration allergy text');
    expect(html).toContain('Penicillin on the registration form');
    expect(html).not.toMatch(/NKDA|no known drug allerg/i);
    expect(html).toContain('Timolol');
    expect(html).toContain('0.5%');
    expect(html).toContain('completed');
    expect(html).not.toContain('Dr Sen');
    expect(html).not.toContain('Dispensed');
    expect(html).toContain('<th');
    expect(html).toContain('colSpan=');
    expect(html).toContain('No lab results recorded.');
    expect(html).not.toContain('Attach Report');
    expect(html).not.toContain('Loading lab reports...');
    expect(html).toContain('Imaging orders are not available to this sign-in.');
    expect(html).toContain('No examinations recorded.');
    expect(html).toContain('No optical orders recorded.');
    expect(html).toContain('No chart notes recorded.');
    expect(html).toContain('<table');
    expect(html).not.toContain('md:grid-cols-2');
    expect(html.match(/role="tab"/g)).toHaveLength(7);
    expect(html).not.toMatch(/No history|No documents|No counselling|No bills|No vitals|Diagnosis history|Coming Soon|Mark delivered|No scans/i);
  });

  it('keeps prescription states, fields, and pagination distinct from mutation controls', () => {
    const line = {
      id: 'l1',
      medicationName: 'Timolol',
      genericName: 'Timolol maleate',
      dosage: '0.5%',
      form: 'eye drops',
      route: 'ocular',
      frequency: 'BD',
      durationDays: 30,
      startDate: '2026-08-02',
      endDate: '2026-09-01',
    };
    const row = {
      id: 'rx1',
      when: '2026-08-02 10:00',
      status: 'active',
      lines: [line],
    };
    const unauthorized = renderToStaticMarkup(
      <Patient360ClinicalView
        summary={summary}
        ipVitals={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        imagingFiles={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        bundle={bundle({ prescriptions: { state: 'unauthorized', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 } })}
      />,
    );
    expect(unauthorized).toContain('Prescriptions are not available to this sign-in.');
    expect(unauthorized).not.toContain('No prescriptions recorded.');

    const unavailable = renderToStaticMarkup(
      <Patient360ClinicalView
        summary={summary}
        ipVitals={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        imagingFiles={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        bundle={bundle({ prescriptions: { state: 'unavailable', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 } })}
      />,
    );
    expect(unavailable).toContain('Prescriptions are not available in Patient 360.');
    expect(unavailable).not.toContain('No prescriptions recorded.');

    const empty = renderToStaticMarkup(
      <Patient360ClinicalView
        summary={summary}
        ipVitals={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        imagingFiles={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        bundle={bundle()}
      />,
    );
    expect(empty).toContain('No prescriptions recorded.');
    expect(empty).toContain('No examinations recorded.');
    expect(empty).toContain('No lab results recorded.');
    expect(empty).not.toContain('Attach Report');

    const paged = renderToStaticMarkup(
      <Patient360ClinicalView
        summary={summary}
        ipVitals={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        imagingFiles={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        bundle={bundle({
          prescriptions: { state: 'ready', rows: [row], totalCount: 21, pageNumber: 1, pageSize: 20 },
        })}
      />,
    );
    expect(paged).toContain('Timolol');
    expect(paged).toContain('Timolol maleate');
    expect(paged).toContain('ocular');
    expect(paged).toContain('30 days');
    expect(paged).toContain('Prescriptions pagination');
    expect(paged).not.toMatch(/Edit|Delete|Dispense|Print|Prescribe|Refill|Upload|Download/i);
    expect(paged).not.toContain('pharmacy');
    expect(paged).not.toContain('discount');
  });

  it('renders coded diagnosis as read-only context and does not treat failures as an empty history', () => {
    const row = {
      id: 'dx1',
      code: 'H25.011',
      description: 'Cortical age-related cataract, right eye',
      diagnosisType: 'rule-out',
      eyeSpecificity: 'OS',
      codeLaterality: 'OD',
      diagnosedAt: '2026-08-03 11:20',
    };
    const ready = renderToStaticMarkup(
      <Patient360ClinicalView
        summary={summary}
        ipVitals={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        imagingFiles={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        bundle={bundle()}
        codedDiagnoses={{ state: 'ready', rows: [row], totalCount: 1, pageNumber: 1, pageSize: 20 }}
      />,
    );
    expect(ready).toContain('>Diagnoses<');
    expect(ready).toContain('H25.011');
    expect(ready).toContain('Cortical age-related cataract, right eye');
    expect(ready).toContain('Rule-out');
    expect(ready).toContain('Eye OS');
    expect(ready).toContain('Code laterality OD');
    expect(ready).not.toContain('Complete diagnosis history');
    expect(ready).not.toContain('Add diagnosis');
    expect(ready).not.toContain('diagnosedBy');
    expect(ready).not.toContain('visitId');

    const empty = renderToStaticMarkup(
      <Patient360ClinicalView
        summary={summary}
        ipVitals={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        imagingFiles={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        bundle={bundle()}
        codedDiagnoses={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
      />,
    );
    expect(empty).toContain('No coded diagnoses recorded.');

    const unavailable = renderToStaticMarkup(
      <Patient360ClinicalView
        summary={summary}
        ipVitals={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        imagingFiles={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        bundle={bundle()}
        codedDiagnoses={{ state: 'unavailable', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
      />,
    );
    expect(unavailable).toContain('Coded diagnosis is not available in Patient 360.');
    expect(unavailable).not.toContain('No coded diagnoses recorded.');

    const unauthorized = renderToStaticMarkup(
      <Patient360ClinicalView
        summary={summary}
        ipVitals={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        imagingFiles={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
        bundle={bundle()}
        codedDiagnoses={{ state: 'unauthorized', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
      />,
    );
    expect(unauthorized).toContain('Coded diagnosis is not available to this sign-in.');
    expect(unauthorized).not.toContain('No coded diagnoses recorded.');
  });

  it('keeps Clinical anchors subordinate and uses DTO fields without mutation or header duplication', () => {
    const html = renderToStaticMarkup(
      <>
        <Patient360SectionNav active="clinical" onSelect={() => undefined} />
        <Patient360ClinicalView
          summary={summary}
          ipVitals={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
          imagingFiles={{ state: 'unavailable', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
          codedDiagnoses={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
          bundle={bundle({
            examinations: {
              state: 'ready',
              rows: [{
                id: 'e1',
                title: 'Slit lamp',
                when: '2026-08-01 09:00',
                provider: 'Dr Sen',
                eye: 'OD',
                finding: 'Nuclear sclerosis with a long supporting sentence for the sheet',
              }],
            },
            labs: {
              state: 'ready',
              rows: [{
                id: 'l1',
                title: 'CBC',
                when: '2026-08-03 11:00',
                status: 'completed',
                detail: '4.5 x10^9/L',
                reference: '4.0-11.0',
                reportUrl: null,
                canonicalDocumentId: null,
                canonicalFileName: null,
                canonicalMimeType: null,
              }],
            },
            optical: {
              state: 'ready',
              rows: [{
                id: 'o1',
                title: 'eyeglasses',
                when: '2026-08-05',
                status: 'ready',
                eye: 'OU',
                prescription: 'OD -1.00 · OS -1.25',
              }],
            },
            notes: {
              state: 'ready',
              rows: [{
                id: 'n1',
                kind: 'Chart note',
                noteType: 'clinical',
                title: 'Post visit',
                when: '2026-08-06 08:00',
                status: 'active',
                content: 'Reviewed at length with enough text to require the existing sheet',
                author: 'Nurse Patil',
              }],
            },
          })}
        />
      </>,
    );

    expect(html.match(/role="tab"/g)).toHaveLength(7);
    expect(html).toContain('aria-label="Section contents"');
    expect(html).not.toContain('role="tablist" aria-label="Clinical');
    expect(html.match(/>Clinical</g)?.length ?? 0).toBe(1);
    expect(html.match(/id="p360-clinical-summary"/g)).toHaveLength(1);
    expect(html.match(/id="p360-clinical-specialty"/g)).toHaveLength(1);
    expect(html).toContain('>Specialty diagnostics<');
    expect(html).toContain('>Temperature<');
    expect(html).not.toContain('>Temp<');
    expect(html).not.toContain('Chart facts');
    expect(html).not.toContain('>Field<');
    expect(html).not.toContain('>Value<');
    expect(html).toContain('Nuclear sclerosis');
    expect(html).toContain('View details');
    expect(html).toContain('4.5 x10^9/L');
    expect(html).toContain('4.0-11.0');
    expect(html).not.toContain('Attach Report');
    expect(html).not.toContain('critical');
    expect(html).toContain('OD -1.00 · OS -1.25');
    expect(html).toContain('Nurse Patil');
    expect(html).toContain('>clinical<');
    expect(html).toContain('View chart note');
    expect(html).toContain('Imaging files are not available in Patient 360.');
    expect(html).not.toMatch(/NKDA|Add allergy|Prescribe|Record diagnosis|Record examination|Record vitals|Upload/i);
    expect(html).not.toContain(summary.mrn);
    expect(html).not.toContain(summary.firstName);
  });
});
