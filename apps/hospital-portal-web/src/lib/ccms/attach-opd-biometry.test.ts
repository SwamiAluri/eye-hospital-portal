import { describe, expect, it } from 'vitest';
import {
  BIOMETRY_DOCUMENT_TYPE,
  biometryPointerUrl,
  latestBiometryPerEye,
} from './attach-opd-biometry';

describe('attach-opd-biometry', () => {
  it('keeps the latest exam per eye', () => {
    const picked = latestBiometryPerEye([
      { id: 'old-od', eye: 'OD', examinationDate: '2026-01-01' },
      { id: 'new-od', eye: 'OD', examinationDate: '2026-08-24' },
      { id: 'os', eye: 'OS', examinationDate: '2026-08-20' },
    ]);
    expect(picked.map(r => r.id).sort()).toEqual(['new-od', 'os']);
  });

  it('skips rows without id', () => {
    expect(latestBiometryPerEye([{ id: '', eye: 'OD' }])).toEqual([]);
  });

  it('uses a pointer URL, not a copied measurement payload', () => {
    expect(BIOMETRY_DOCUMENT_TYPE).toBe('biometry_record');
    expect(biometryPointerUrl('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'))
      .toBe('biometry://record/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});
