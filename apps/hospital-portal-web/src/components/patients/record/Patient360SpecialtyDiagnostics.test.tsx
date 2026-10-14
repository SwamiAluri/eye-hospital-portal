import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360SectionNav } from '@/components/patients/record/Patient360SectionNav';
import { Patient360Section } from '@/components/patients/record/Patient360RecordTable';
import { Patient360SpecialtyDiagnosticsView } from '@/components/patients/record/Patient360SpecialtyDiagnostics';
import type { SpecialtyListResult } from '@/lib/patients/patient-360-specialty-diagnostics';
import type { BiometryContextRow, OctContextRow, RetinopathyContextRow } from '@/lib/patients/patient-360-specialty-diagnostics';

function page<T>(rows: T[], state: SpecialtyListResult<T>['state'] = 'ready', total = rows.length): SpecialtyListResult<T> {
  return { state, rows, totalCount: total, pageNumber: 1, pageSize: 20 };
}

const biometryRow: BiometryContextRow = {
  id: 'b1',
  when: '2026-09-02 08:30',
  eye: 'OD',
  status: 'active',
  device: 'IOL Master',
  deviceModel: '700',
  measures: [
    { label: 'Axial length', value: '23.5' },
    { label: 'Calculated IOL', value: '20.5' },
    { label: 'Selected formula', value: 'SRK-T' },
  ],
};

const octRow: OctContextRow = {
  id: 'o1',
  when: '2026-07-01 09:15',
  eye: 'OU',
  scanType: 'Macula',
  scanPattern: 'Raster',
  scanSize: '6x6mm',
  device: 'Cirrus',
  deviceModel: '5000',
  status: 'active',
};

const screeningRow: RetinopathyContextRow = {
  id: 'r1',
  when: '2026-08-14 10:00',
  eye: 'OS',
  status: 'completed',
  device: 'Fundus camera',
  deviceModel: 'A1',
  drGrade: 'Mild NPDR',
  macularEdema: 'None',
  hemorrhagesCount: '2',
  microaneurysmsCount: null,
  findings: ['Hard exudates'],
  referralRequired: 'Yes',
};

describe('patient 360 specialty diagnostics presentation', () => {
  it('renders implemented sources inside Clinical without mutation controls or omitted modalities', () => {
    const html = renderToStaticMarkup(
      <>
        <Patient360SectionNav active="clinical" onSelect={() => undefined} />
        <Patient360Section id="p360-clinical-specialty" title="Specialty diagnostics">
          <Patient360SpecialtyDiagnosticsView
            biometry={page([biometryRow])}
            retinopathy={page([screeningRow])}
            oct={page([octRow])}
          />
        </Patient360Section>
      </>,
    );

    expect(html).toContain('>Clinical<');
    expect(html).toContain('Specialty diagnostics');
    expect(html).toContain('>Biometry<');
    expect(html).toContain('Retinopathy screening');
    expect(html).toContain('>OCT<');
    expect(html).toContain('Source: OCT');
    expect(html).toContain('Macula');
    expect(html).toContain('Raster');
    expect(html).toContain('6x6mm');
    expect(html).toContain('Cirrus · 5000');
    expect(html).toContain('Source: Biometry');
    expect(html).toContain('Source: Retinopathy screening');
    expect(html).toContain('OD');
    expect(html).toContain('2026-09-02 08:30');
    expect(html).toContain('IOL Master · 700');
    expect(html).toContain('23.5');
    expect(html).toContain('SRK-T');
    expect(html).toContain('active');
    expect(html).toContain('Mild NPDR');
    expect(html).toContain('Hard exudates');
    expect(html).toContain('Referral required');
    expect(html.match(/role="tab"/g)).toHaveLength(7);
    expect(html).not.toMatch(/Electrophysiology|Edit|Delete|Upload|Download|Preview|Viewer|Interpret|secret|imagePaths|thumbnailPath|dataFilePath/i);
  });

  it('keeps empty, unauthorized, and unavailable distinct', () => {
    const empty = renderToStaticMarkup(
      <Patient360SpecialtyDiagnosticsView biometry={page([])} retinopathy={page([])} oct={page([])} />,
    );
    const denied = renderToStaticMarkup(
      <Patient360SpecialtyDiagnosticsView
        biometry={page([], 'unauthorized')}
        retinopathy={page([], 'unauthorized')}
        oct={page([], 'unauthorized')}
      />,
    );
    const failed = renderToStaticMarkup(
      <Patient360SpecialtyDiagnosticsView
        biometry={page([], 'unavailable')}
        retinopathy={page([], 'unavailable')}
        oct={page([], 'unavailable')}
      />,
    );

    expect(empty).toContain('No biometry records found.');
    expect(empty).toContain('No retinopathy screening records found.');
    expect(empty).toContain('No OCT scans recorded.');
    expect(denied).toContain('Biometry records are not available to this sign-in.');
    expect(denied).toContain('Retinopathy screening records are not available to this sign-in.');
    expect(denied).toContain('OCT scans are not available to this sign-in.');
    expect(denied).not.toContain('No biometry records found.');
    expect(denied).not.toContain('No retinopathy screening records found.');
    expect(denied).not.toContain('No OCT scans recorded.');
    expect(failed).toContain('Biometry records are not available in Patient 360.');
    expect(failed).toContain('Retinopathy screening records are not available in Patient 360.');
    expect(failed).toContain('OCT scans are not available in Patient 360.');
    expect(failed).not.toContain('No biometry records found.');
    expect(failed).not.toContain('No retinopathy screening records found.');
    expect(failed).not.toContain('No OCT scans recorded.');
    expect(htmlHasNoMutation(empty + denied + failed)).toBe(true);
  });

  it('paginates a ready list and hides paging when the source is unavailable', () => {
    const paged = renderToStaticMarkup(
      <Patient360SpecialtyDiagnosticsView
        biometry={page([biometryRow], 'ready', 40)}
        retinopathy={page([])}
        oct={page([octRow], 'ready', 40)}
      />,
    );
    const failed = renderToStaticMarkup(
      <Patient360SpecialtyDiagnosticsView
        biometry={page([], 'unavailable', 40)}
        retinopathy={page([])}
        oct={page([], 'unavailable', 40)}
      />,
    );
    expect(paged).toContain('Biometry pagination');
    expect(paged).toContain('OCT pagination');
    expect(failed).not.toContain('Biometry pagination');
    expect(failed).not.toContain('OCT pagination');
    expect(failed).toContain('Biometry records are not available in Patient 360.');
  });
});

function htmlHasNoMutation(html: string): boolean {
  return !/Edit|Delete|Upload|Interpret|type="file"/i.test(html);
}
