import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360ClinicalView } from '@/components/patients/record/Patient360Clinical';
import type { Patient360ClinicalBundle } from '@/lib/patients/patient-360-clinical';
import {
  classifyIpVitalsError,
  ipVitalsEmptyMessage,
  ipVitalsUnavailableMessage,
  mapIpVital,
  type IpVitalsListResult,
} from '@/lib/patients/patient-360-ip-vitals';
import type { PatientSummary } from '@/types/patient-lookup';

const summary = {
  id: 'p1',
  firstName: 'Asha',
  lastName: 'Rao',
  mrn: 'MRN-7',
  dateOfBirth: '1980-01-15',
  gender: 'Female',
  clinicalAcuity: 'low',
  allergies: '',
  activeEngagements: [],
  careProgramCodes: [],
  dataQuality: { isIncomplete: false, issues: [] },
} as PatientSummary;

function bundle(): Patient360ClinicalBundle {
  const empty = { state: 'ready' as const, rows: [] };
  return {
    vitals: {
      state: 'ready',
      rows: [{ id: 'opd-1', source: 'OPD', measuredAt: '2026-09-01 08:00', measures: [{ label: 'Heart rate', value: '70' }] }],
    },
    allergies: empty,
    examinations: empty,
    prescriptions: { state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 },
    labs: empty,
    imaging: empty,
    optical: empty,
    notes: empty,
  };
}

function page(overrides: Partial<IpVitalsListResult> = {}): IpVitalsListResult {
  return {
    state: 'ready',
    rows: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 20,
    ...overrides,
  };
}

function render(ipVitals: IpVitalsListResult) {
  return renderToStaticMarkup(
    <Patient360ClinicalView
      summary={summary}
      bundle={bundle()}
      ipVitals={ipVitals}
      onIpVitalsPageChange={() => undefined}
      imagingFiles={{ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 }}
    />,
  );
}

describe('patient 360 IP vitals presentation', () => {
  it('keeps IP rows separate from OPD and shows the approved labels', () => {
    const row = mapIpVital({
      id: 'v1',
      recordedAt: '2026-09-02T09:30:00',
      context: 'Ward',
      temperature: 36.5,
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      pulseRate: 72,
      respiratoryRate: 16,
      oxygenSaturation: 98,
      weight: 70,
      height: 160,
      notes: 'hidden note',
      recordedByUserId: 'staff-1',
    });
    expect(row?.context).toBe('Ward');
    expect(row?.measures.map((measure) => measure.label)).toEqual([
      'Temperature',
      'Blood pressure',
      'Pulse rate',
      'Respiratory rate',
      'Oxygen saturation',
      'Weight',
      'Height',
    ]);
    expect(row?.measures.find((measure) => measure.label === 'Temperature')?.value).toBe('36.5 °C');
    expect(row?.measures.find((measure) => measure.label === 'Blood pressure')?.value).toBe('120/80');
    expect(row?.measures.find((measure) => measure.label === 'Pulse rate')?.value).toBe('72');
    expect(row?.measures.find((measure) => measure.label === 'Oxygen saturation')?.value).toBe('98%');
    expect(row?.measures.find((measure) => measure.label === 'Weight')?.value).toBe('70 kg');
    expect(row?.measures.find((measure) => measure.label === 'Height')?.value).toBe('160 cm');
    expect(JSON.stringify(row)).not.toMatch(/hidden note|staff-1|Heart rate|bmi/i);

    const preop = mapIpVital({ id: 'v2', recordedAt: '2026-09-01T07:00:00', context: 'PreOp' });
    expect(preop?.context).toBe('PreOp');

    const html = render(
      page({
        rows: [row!, preop!],
        totalCount: 25,
        pageSize: 20,
      }),
    );
    expect(html).toContain('>OPD<');
    expect(html).toContain('>IP Vitals<');
    expect(html).toContain('Heart rate');
    expect(html).toContain('Ward');
    expect(html).toContain('PreOp');
    expect(html).toContain('Pulse rate');
    expect(html).toContain('aria-label="IP vitals pagination"');
    expect(html).not.toMatch(/Admit|Discharge|Add vital|Clearance|hidden note|staff-1/);
  });

  it('keeps empty, unauthorized, and unavailable distinct', () => {
    expect(render(page())).toContain(ipVitalsEmptyMessage());
    expect(render(page({ state: 'unauthorized' }))).toContain('IP vitals are not available to this sign-in.');
    expect(render(page({ state: 'unavailable' }))).toContain(ipVitalsUnavailableMessage());
    expect(render(page({ state: 'unavailable' }))).not.toContain(ipVitalsEmptyMessage());
    expect(classifyIpVitalsError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyIpVitalsError({ response: { status: 500 } })).toBe('unavailable');
  });

  it('loads from the clinical panel without changing other sections or adding writes', () => {
    const root = resolve(__dirname, '../../..');
    const pageSource = readFileSync(resolve(root, 'components/patients/record/PatientRecordPage.tsx'), 'utf8');
    const clinical = readFileSync(resolve(__dirname, 'Patient360Clinical.tsx'), 'utf8');
    const reads = readFileSync(resolve(root, 'lib/patients/patient-360-ip-vitals.ts'), 'utf8');
    expect(pageSource).toContain('Patient360ClinicalPanel');
    expect(pageSource).toContain("section === 'clinical'");
    expect(clinical).toContain('loadPatient360IpVitals');
    expect(reads).toContain('/patient-journeys/patients/');
    expect(reads).toContain('/patient-360/ip-vitals');
    expect(reads).not.toContain('/journeys/');
    expect(clinical).not.toMatch(/Add vital|ward\.checklist|nurse_record/);
  });
});
