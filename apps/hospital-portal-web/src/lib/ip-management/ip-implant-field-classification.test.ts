import { describe, expect, it } from 'vitest';
import {
  IP_IMPLANT_FIELD_CLASSIFICATION,
  classifyIpImplantField,
  implantFieldWritesAreFrozen,
} from './ip-implant-field-classification';

describe('ip-implant-field-classification (E4 / F6)', () => {
  it('treats journey_implant_usage as the usage record', () => {
    const meta = classifyIpImplantField('JourneyImplantUsage');
    expect(meta?.classification).toBe('usage_record');
    expect(meta?.canonicalOwner).toBe('IP registry');
  });

  it('keeps planned IOL power as clinical plan, not usage', () => {
    const meta = classifyIpImplantField('PatientJourney.IolPower');
    expect(meta?.classification).toBe('planned_clinical');
    expect(implantFieldWritesAreFrozen('PatientJourney.IolPower')).toBe(false);
  });

  it('freezes barcode flags and intra-op implant free-text', () => {
    expect(implantFieldWritesAreFrozen('PatientJourney.IolBarcode')).toBe(true);
    expect(implantFieldWritesAreFrozen('PatientJourney.IolBarcodeVerified')).toBe(true);
    expect(implantFieldWritesAreFrozen('IntraOpNote.ImplantUsed')).toBe(true);
    expect(implantFieldWritesAreFrozen('IntraOpNote.ImplantPower')).toBe(true);
  });

  it('lists every E4 field', () => {
    const fields = IP_IMPLANT_FIELD_CLASSIFICATION.map((f) => f.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'JourneyImplantUsage',
        'PatientJourney.IolPower',
        'PatientJourney.IolIssuedFromIp',
        'PatientJourney.IolBarcode',
        'PatientJourney.IolBarcodeVerified',
        'IntraOpNote.ImplantUsed',
        'IntraOpNote.ImplantPower',
      ]),
    );
  });
});
