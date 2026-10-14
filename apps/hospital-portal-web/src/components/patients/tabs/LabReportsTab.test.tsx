import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Slice 4 Laboratory Clinical vs Documents placement', () => {
  it('keeps attach-report API and dialog; does not put Attach Report on mock laboratory page', () => {
    const dialog = readFileSync(resolve(__dirname, 'LabAttachReportDialog.tsx'), 'utf8');
    const api = readFileSync(resolve(__dirname, '../../../lib/api/lab-reports.api.ts'), 'utf8');
    const laboratoryPage = readFileSync(
      resolve(__dirname, '../../../app/dashboard/laboratory/page.tsx'),
      'utf8',
    );

    expect(dialog).toContain('Attach Report');
    expect(dialog).toContain('type="file"');
    expect(api).toContain('attach-report');
    expect(api).toContain('report/content');
    expect(laboratoryPage).not.toContain('Attach Report');
    expect(laboratoryPage).not.toContain('attach-report');
  });

  it('mounts Attach Report on Documents Laboratory, not Clinical Laboratory', () => {
    const clinical = readFileSync(
      resolve(__dirname, '../record/Patient360Clinical.tsx'),
      'utf8',
    );
    const documents = readFileSync(
      resolve(__dirname, '../record/Patient360Documents.tsx'),
      'utf8',
    );
    const areas = readFileSync(
      resolve(__dirname, '../../../lib/patients/patient-360-document-areas.ts'),
      'utf8',
    );

    expect(clinical).toContain('id="p360-clinical-lab"');
    expect(clinical).not.toContain('LabReportsTab');
    expect(clinical).not.toContain('Attach Report');
    expect(clinical).not.toContain('LabAttachReportDialog');
    expect(clinical).toContain('Patient360RecordTable');

    expect(documents).toContain('LabAttachReportDialog');
    expect(documents).toContain('Attach Report');
    expect(documents).toContain('labReportsApi.attachReport');
    expect(documents).toContain('patient.update');
    expect(documents).toContain('onLabAttach');

    expect(areas).toContain("id: 'laboratory'");
    expect(areas).toContain('writable: false');
  });
});
