import type { CombinedPaymentType, WaitingListStatus } from '@/types/counsellors-desk';
import type { MasterOption } from '@/hooks/use-master-values';
import type { PatientTypeConfig } from '@/lib/api/patient-type-configs.api';
import { findPatientTypeConfig, toLegacyPatientType } from '@/lib/master-data/patient-type-master';

/** Resolve stored package label/code to master option code for Select value. */
export function resolvePackageSelectValue(
  packageName: string,
  options: MasterOption[],
): string | undefined {
  if (!packageName) return undefined;
  const byLabel = options.find((o) => o.label === packageName);
  if (byLabel) return byLabel.value;
  const byCode = options.find((o) => o.value === packageName);
  if (byCode) return byCode.value;
  return undefined;
}

export const INSURANCE_PAYMENT_TYPES: CombinedPaymentType[] = ['Insurance', 'CoPay', 'CGHS', 'TPA', 'SGHS', 'ESH', 'Arograshree', 'Railway'];

/** Payment types that open counsellor Coverage tab and sync a CCMS case. Aligned with IP admit gate (except ESI). */
export const COVERAGE_PAYMENT_TYPES = [
  'Insurance', 'TPA', 'CoPay', 'CGHS', 'SGHS', 'GovernmentScheme',
  'ESH', 'Arograshree', 'Railway',
] as const;

export function isCoveragePaymentTypeValue(paymentType: string | null | undefined): boolean {
  if (!paymentType) return false;
  return (COVERAGE_PAYMENT_TYPES as readonly string[]).includes(paymentType);
}

/** Whether counsellor session should show insurance company picker (B1.4 — master-driven when configs supplied). */
export function requiresInsuranceCompany(
  paymentType: CombinedPaymentType | string,
  configs?: PatientTypeConfig[],
): boolean {
  if (!paymentType) return false;
  const legacy = toLegacyPatientType(paymentType) as CombinedPaymentType;
  const config = findPatientTypeConfig(configs, legacy);
  if (config?.configuration.requiresPreApproval) return true;
  return INSURANCE_PAYMENT_TYPES.includes(legacy);
}

export function derivePaymentType(paymentMode: string, patientType: string): CombinedPaymentType | '' {
  if (paymentMode) {
    const fromMode = toLegacyPatientType(paymentMode);
    if (fromMode === 'TPA') return 'Insurance';
    if (fromMode) return fromMode as CombinedPaymentType;
  }
  if (patientType === 'Staff') return 'Staff';
  if (patientType === 'Foreigner' || patientType.toUpperCase() === 'FOREIGNER') return 'ForeignNational';
  const fromPatient = toLegacyPatientType(patientType);
  return (fromPatient as CombinedPaymentType) || '';
}

export const STATUS_BADGE_MAP = {
  Pending:           { label: 'Pending',            cls: 'bg-yellow-400 text-yellow-900' },
  Processed:         { label: 'Processing',          cls: 'bg-sky-300 text-sky-900' },
  Done:              { label: 'Done',                cls: 'bg-green-400 text-green-900' },
  AddOnSurgery:      { label: 'Add-On Surgery',      cls: 'bg-purple-400 text-purple-900' },
  RepeatCounselling: { label: 'Repeat Counselling',  cls: 'bg-orange-400 text-orange-900' },
  SurgeryDone:       { label: 'Surgery Done',         cls: 'bg-teal-400 text-teal-900' },
} as const satisfies Record<string, { label: string; cls: string }>;

export function getStatusBadge(queueStatus: WaitingListStatus) {
  return STATUS_BADGE_MAP[queueStatus as keyof typeof STATUS_BADGE_MAP]
    ?? { label: queueStatus, cls: 'bg-gray-300 text-gray-900' };
}

export function formatTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}
