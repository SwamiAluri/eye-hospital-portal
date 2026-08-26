/**
 * E4 / F6 — implant usage vs compatibility flags.
 * Usage, charge, and stock follow journey_implant_usage (Record implant).
 */

export type IpImplantFieldClass =
  | 'usage_record'
  | 'planned_clinical'
  | 'process_tick'
  | 'legacy_compatibility';

export interface IpImplantFieldMeta {
  field: string;
  classification: IpImplantFieldClass;
  canonicalOwner: 'IP registry' | 'IP journey';
  notes: string;
}

export const IP_IMPLANT_FIELD_CLASSIFICATION: readonly IpImplantFieldMeta[] = [
  {
    field: 'JourneyImplantUsage',
    classification: 'usage_record',
    canonicalOwner: 'IP registry',
    notes:
      'Per-patient implant/IOL usage. Record implant writes this row and emits ImplantUsed.',
  },
  {
    field: 'PatientJourney.IolPower',
    classification: 'planned_clinical',
    canonicalOwner: 'IP journey',
    notes: 'Planned lens power from OPD/counselling. Not a usage or charge record.',
  },
  {
    field: 'PatientJourney.IolIssuedFromIp',
    classification: 'process_tick',
    canonicalOwner: 'IP journey',
    notes: 'OT tick for where the lens was drawn. Not usage, inventory, or billing truth.',
  },
  {
    field: 'PatientJourney.IolBarcode',
    classification: 'legacy_compatibility',
    canonicalOwner: 'IP registry',
    notes: 'Compatibility / planned-model hint. Do not persist scanned barcodes here.',
  },
  {
    field: 'PatientJourney.IolBarcodeVerified',
    classification: 'legacy_compatibility',
    canonicalOwner: 'IP registry',
    notes: 'Compatibility flag. Record implant is the usage event.',
  },
  {
    field: 'IntraOpNote.ImplantUsed',
    classification: 'legacy_compatibility',
    canonicalOwner: 'IP registry',
    notes: 'Free-text leftover. Server ignores writes and overlays the registry on GET.',
  },
  {
    field: 'IntraOpNote.ImplantPower',
    classification: 'legacy_compatibility',
    canonicalOwner: 'IP registry',
    notes: 'Free-text leftover. Server ignores writes and overlays registry power on GET.',
  },
] as const;

export function classifyIpImplantField(field: string): IpImplantFieldMeta | undefined {
  return IP_IMPLANT_FIELD_CLASSIFICATION.find(
    (f) => f.field.toLowerCase() === field.trim().toLowerCase(),
  );
}

export function implantFieldWritesAreFrozen(field: string): boolean {
  return classifyIpImplantField(field)?.classification === 'legacy_compatibility';
}
