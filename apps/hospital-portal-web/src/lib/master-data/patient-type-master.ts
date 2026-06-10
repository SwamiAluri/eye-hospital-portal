import type { MasterOption } from '@/hooks/use-master-values';
import type { PatientTypeConfig, PatientTypeConfigData } from '@/lib/api/patient-type-configs.api';

/** Maps master_value.code → legacy session/widget patientType string */
export const LEGACY_PATIENT_TYPE_BY_CODE: Record<string, string> = {
  CASH: 'Cash',
  INSURANCE: 'Insurance',
  COPAY: 'CoPay',
  ESH: 'ESH',
  CGHS: 'CGHS',
  AROGYASHREE: 'Arograshree',
  SGHS: 'SGHS',
  CAMP: 'Camp',
  RAILWAY: 'Railway',
  FREE: 'Free',
  TPA: 'TPA',
};

const LEGACY_CODE_BY_TYPE = Object.fromEntries(
  Object.entries(LEGACY_PATIENT_TYPE_BY_CODE).map(([code, legacy]) => [legacy.toUpperCase(), code]),
) as Record<string, string>;

function titleCaseCode(code: string): string {
  if (!code) return '';
  return code.charAt(0) + code.slice(1).toLowerCase();
}

/** Normalize code, legacy label, or master label to legacy patientType key used in sessions/widgets */
export function toLegacyPatientType(value: string): string {
  if (!value) return '';
  const upper = value.toUpperCase();
  if (LEGACY_PATIENT_TYPE_BY_CODE[upper]) return LEGACY_PATIENT_TYPE_BY_CODE[upper];
  if (LEGACY_CODE_BY_TYPE[upper]) return LEGACY_PATIENT_TYPE_BY_CODE[LEGACY_CODE_BY_TYPE[upper]];
  return value;
}

function asBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

/** Parse master_value.metadata (camelCase or legacy snake_case) into widget config shape */
export function parsePatientTypeMetadata(
  meta: Record<string, unknown> | undefined,
  label: string,
): PatientTypeConfigData {
  const m = meta ?? {};
  const requiresAdvance =
    asBool(m.requiresAdvancePayment) ??
    asBool(m.requires_advance_payment) ??
    false;
  const advancePct =
    asNumber(m.advancePercentage) ??
    asNumber(m.advance_percentage) ??
    0;
  const zeroAdvance =
    asBool(m.zeroAdvancePayment) ??
    asBool(m.zero_advance_payment) ??
    asBool(m.zero_cost_surgery) ??
    false;
  const requiresPreApproval =
    asBool(m.requiresPreApproval) ??
    asBool(m.requires_pre_approval) ??
    asBool(m.requires_pre_authorization) ??
    asBool(m.requires_claim_form) ??
    false;
  const docs =
    asStringArray(m.requiredDocuments).length > 0
      ? asStringArray(m.requiredDocuments)
      : asStringArray(m.required_documents);

  const category =
    typeof m.category === 'string'
      ? m.category
      : undefined;

  return {
    requiresAdvancePayment: requiresAdvance,
    advancePercentage: advancePct,
    requiredDocuments: docs,
    zeroAdvancePayment: zeroAdvance,
    requiresPreApproval,
    allowedIolTypes: asStringArray(m.allowedIolTypes),
    paymentNotes: typeof m.paymentNotes === 'string' ? m.paymentNotes : undefined,
    icon: typeof m.icon === 'string' ? m.icon : undefined,
    color: typeof m.color === 'string' ? m.color : undefined,
    category,
  };
}

export function masterOptionToPatientTypeConfig(
  option: MasterOption,
  index: number,
): PatientTypeConfig {
  const meta = (option.metadata ?? {}) as Record<string, unknown>;
  const legacyType =
    (typeof meta.legacyPatientType === 'string' && meta.legacyPatientType) ||
    toLegacyPatientType(option.value);
  const description =
    (typeof meta.description === 'string' && meta.description) || option.label;

  return {
    id: option.value,
    patientType: legacyType,
    displayName: option.label,
    description,
    configuration: parsePatientTypeMetadata(meta, option.label),
    isActive: true,
    displayOrder: option.sortOrder ?? index + 1,
  };
}

export function findPatientTypeConfig(
  configs: PatientTypeConfig[] | undefined,
  sessionValue: string,
): PatientTypeConfig | undefined {
  if (!configs?.length || !sessionValue) return undefined;
  const legacy = toLegacyPatientType(sessionValue);
  return configs.find(
    (c) =>
      c.patientType === sessionValue ||
      c.patientType === legacy ||
      c.id === sessionValue ||
      c.id.toUpperCase() === sessionValue.toUpperCase(),
  );
}
