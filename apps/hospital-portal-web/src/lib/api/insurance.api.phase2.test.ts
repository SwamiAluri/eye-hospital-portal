/**
 * Phase 2: legacy insurance.api write freeze.
 */
import { describe, expect, it } from 'vitest';
import { insuranceApi } from '@/lib/api/insurance.api';

describe('insurance.api Phase 2 write freeze', () => {
  it('blocks createPreAuthorization', async () => {
    await expect(
      insuranceApi.createPreAuthorization({
        patientId: 'p',
        insuranceProvider: 'x',
        policyNumber: '1',
        estimatedAmount: 1,
        surgeryType: 'cataract',
        surgeryDate: '2026-01-01',
        diagnosis: 'H25',
        requestedBy: 'u',
      }),
    ).rejects.toMatchObject({ code: 'CCMS_LEGACY_WRITE_FROZEN' });
  });

  it('blocks submitToTPA', async () => {
    await expect(
      insuranceApi.submitToTPA('id', {
        tpaName: 't',
        tpaContactPerson: 'c',
        tpaEmail: 'a@b.c',
        tpaPhone: '1',
        urgencyLevel: 'Normal',
      }),
    ).rejects.toMatchObject({ code: 'CCMS_LEGACY_WRITE_FROZEN' });
  });
});
