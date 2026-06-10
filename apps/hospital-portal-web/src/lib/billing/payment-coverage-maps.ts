import type { MasterOption } from '@/hooks/use-master-values';
import type { PatientTypeConfig } from '@/lib/api/patient-type-configs.api';
import type { CombinedPaymentType } from '@/types/counsellors-desk';

export type PaymentCoverageGroupKey = 'self_pay' | 'insurance' | 'government' | 'special';

export interface PaymentCoverageOption {
  value: CombinedPaymentType;
  label: string;
  group: PaymentCoverageGroupKey;
  groupLabel: string;
}

export interface PaymentCoverageGroup {
  key: PaymentCoverageGroupKey;
  label: string;
  options: PaymentCoverageOption[];
}

const GROUP_LABELS: Record<PaymentCoverageGroupKey, string> = {
  self_pay: 'Self Pay',
  insurance: 'Insurance',
  government: 'Government Schemes',
  special: 'Special',
};

const GROUP_ORDER: PaymentCoverageGroupKey[] = ['self_pay', 'insurance', 'government', 'special'];

/** Legacy counsellor types not yet in patient.patient_type master (B1.4 supplemental). */
const LEGACY_SUPPLEMENTAL: PaymentCoverageOption[] = [
  { value: 'Staff', label: 'Staff', group: 'special', groupLabel: GROUP_LABELS.special },
  { value: 'ForeignNational', label: 'Foreign National', group: 'special', groupLabel: GROUP_LABELS.special },
  { value: 'Package', label: 'Custom Package', group: 'special', groupLabel: GROUP_LABELS.special },
];

function patientTypeToGroup(category: string | undefined, legacyType: string): PaymentCoverageGroupKey {
  if (category === 'government') return 'government';
  if (category === 'special') return 'special';
  if (legacyType === 'Insurance' || legacyType === 'CoPay' || legacyType === 'TPA') return 'insurance';
  return 'self_pay';
}

/** Build grouped payment/coverage choices from patient.patient_type + billing.payment_mode (Card/UPI). */
export function buildPaymentCoverageOptions(
  patientTypeConfigs: PatientTypeConfig[],
  paymentModeOptions: MasterOption[],
): PaymentCoverageGroup[] {
  const flat: PaymentCoverageOption[] = [];

  for (const cfg of patientTypeConfigs) {
    const legacy = cfg.patientType as CombinedPaymentType;
    const group = patientTypeToGroup(cfg.configuration.category, legacy);
    flat.push({
      value: legacy,
      label: cfg.displayName,
      group,
      groupLabel: GROUP_LABELS[group],
    });
  }

  for (const code of ['CARD', 'UPI'] as const) {
    const opt = paymentModeOptions.find((o) => o.value === code);
    if (!opt) continue;
    const legacy = code === 'CARD' ? 'Card' : 'UPI';
    if (flat.some((f) => f.value === legacy)) continue;
    flat.push({
      value: legacy as CombinedPaymentType,
      label: opt.label,
      group: 'self_pay',
      groupLabel: GROUP_LABELS.self_pay,
    });
  }

  for (const extra of LEGACY_SUPPLEMENTAL) {
    if (!flat.some((f) => f.value === extra.value)) flat.push(extra);
  }

  return GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    options: flat.filter((o) => o.group === key),
  })).filter((g) => g.options.length > 0);
}
