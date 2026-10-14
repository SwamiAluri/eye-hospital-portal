import { describe, expect, it } from 'vitest';
import {
  biometryEmptyMessage,
  biometryUnavailableMessage,
  classifySpecialtyError,
  mapBiometryContext,
  mapOctContext,
  mapRetinopathyContext,
  octEmptyMessage,
  octUnauthorizedMessage,
  octUnavailableMessage,
  retinopathyEmptyMessage,
  retinopathyUnavailableMessage,
  retinopathyUnauthorizedMessage,
} from '@/lib/patients/patient-360-specialty-diagnostics';

describe('patient 360 specialty diagnostic reads', () => {
  it('maps stored biometry measurements and leaves failures distinct from an empty list', () => {
    const row = mapBiometryContext({
      id: 'b1',
      examinationDate: '2026-09-02T08:30:00',
      eye: 'OD',
      status: 'active',
      device: 'IOL Master',
      deviceModel: '700',
      axialLength: 23.5,
      k1: 43.1,
      k2: 44.2,
      calculatedIol: 20.5,
      selectedFormula: 'SRK-T',
      notes: 'secret-note',
      examinerId: 'examiner',
      branchId: 'branch',
      iolCalculations: [{ formula: 'secret' }],
    });
    expect(row).toMatchObject({
      id: 'b1',
      when: '2026-09-02 08:30',
      eye: 'OD',
      status: 'active',
      device: 'IOL Master',
      deviceModel: '700',
    });
    expect(row?.measures).toEqual(
      expect.arrayContaining([
        { label: 'Axial length', value: '23.5' },
        { label: 'Calculated IOL', value: '20.5' },
        { label: 'Selected formula', value: 'SRK-T' },
      ]),
    );
    expect(row).not.toHaveProperty('notes');
    expect(row).not.toHaveProperty('iolCalculations');
    expect(JSON.stringify(row)).not.toContain('secret-note');
    expect(classifySpecialtyError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifySpecialtyError({ response: { status: 500 } })).toBe('unavailable');
    expect(biometryEmptyMessage()).toBe('No biometry records found.');
    expect(biometryUnavailableMessage()).not.toMatch(/No biometry records found/i);
  });

  it('maps stored retinopathy fields and omits image, AI, and treatment text', () => {
    const row = mapRetinopathyContext({
      id: 'r1',
      screeningDate: '2026-08-14T10:00:00',
      eye: 'OS',
      status: 'completed',
      device: 'Fundus camera',
      drGrade: 'Mild NPDR',
      macularEdema: 'None',
      hemorrhagesCount: 2,
      hardExudates: true,
      softExudates: false,
      referralRequired: true,
      imagePaths: ['secret-path'],
      thumbnailPath: 'secret-thumb',
      aiGrade: 'secret-ai',
      treatmentRecommended: 'secret-treatment',
      notes: 'secret-note',
      followUpMonths: 6,
    });
    expect(row).toMatchObject({
      id: 'r1',
      when: '2026-08-14 10:00',
      eye: 'OS',
      status: 'completed',
      drGrade: 'Mild NPDR',
      macularEdema: 'None',
      hemorrhagesCount: '2',
      findings: ['Hard exudates'],
      referralRequired: 'Yes',
    });
    expect(row?.findings).not.toContain('Soft exudates');
    expect(JSON.stringify(row)).not.toMatch(/secret-path|secret-thumb|secret-ai|secret-treatment|secret-note/);
    expect(retinopathyEmptyMessage()).toBe('No retinopathy screening records found.');
    expect(retinopathyUnavailableMessage()).not.toBe(retinopathyEmptyMessage());
    expect(retinopathyUnauthorizedMessage()).not.toBe(retinopathyEmptyMessage());
  });

  it('maps OCT metadata and drops storage, notes, diagnosis, and measurements', () => {
    const row = mapOctContext({
      id: 'o1',
      scanDate: '2026-07-01T09:15:00',
      eye: 'OU',
      scanType: 'Macula',
      scanPattern: 'Raster',
      scanSize: '6x6mm',
      device: 'Cirrus',
      deviceModel: '5000',
      status: 'active',
      imagePaths: ['secret-path'],
      thumbnailPath: 'secret-thumb',
      dataFilePath: 'secret-file',
      notes: 'secret-note',
      diagnosis: 'secret-diagnosis',
      centralThickness: 250,
      pathologyDetected: true,
      technicianId: 'secret-tech',
    });
    expect(row).toEqual({
      id: 'o1',
      when: '2026-07-01 09:15',
      eye: 'OU',
      scanType: 'Macula',
      scanPattern: 'Raster',
      scanSize: '6x6mm',
      device: 'Cirrus',
      deviceModel: '5000',
      status: 'active',
    });
    expect(JSON.stringify(row)).not.toMatch(/secret-path|secret-thumb|secret-file|secret-note|secret-diagnosis|secret-tech|250/);
    expect(octEmptyMessage()).toBe('No OCT scans recorded.');
    expect(octUnauthorizedMessage()).not.toBe(octEmptyMessage());
    expect(octUnavailableMessage()).not.toBe(octEmptyMessage());
    expect(classifySpecialtyError({ response: { status: 401 } })).toBe('unauthorized');
    expect(classifySpecialtyError({ response: { status: 500 } })).toBe('unavailable');
  });
});
