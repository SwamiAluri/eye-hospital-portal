import type { CombinedPaymentType, WaitingListStatus } from '@/types/counsellors-desk';

export const INSURANCE_COMPANY_FALLBACK = [
  'Star Health', 'HDFC Ergo', 'New India Assurance', 'United India',
  'Max Bupa', 'Care Health', 'SBI General', 'Oriental Insurance', 'ECHS', 'CGHS',
].map(name => ({ value: name, label: name }));

export const PACKAGE_OPTIONS = [
  'Phaco Standard', 'Phaco Premium', 'LASIK Basic', 'LASIK Advanced',
  'Retina Package', 'Cornea Package', 'Glaucoma Package',
];

export const INSURANCE_PAYMENT_TYPES: CombinedPaymentType[] = ['Insurance', 'CoPay', 'CGHS'];

export const COVERAGE_PAYMENT_TYPES = [
  'Insurance', 'TPA', 'CoPay', 'CGHS', 'SGHS', 'GovernmentScheme',
] as const;

export function derivePaymentType(paymentMode: string, patientType: string): CombinedPaymentType | '' {
  const modeMap: Record<string, CombinedPaymentType> = {
    Cash: 'Cash', Card: 'Card', UPI: 'UPI',
    Insurance: 'Insurance', TPA: 'Insurance',
    Free: 'Free', Package: 'Package',
    CGHS: 'CGHS', SGHS: 'SGHS', ESH: 'ESH',
    Railway: 'Railway', Camp: 'Camp', Arograshree: 'Arograshree', CoPay: 'CoPay',
  };
  if (paymentMode && modeMap[paymentMode]) return modeMap[paymentMode];
  if (patientType === 'Staff') return 'Staff';
  if (patientType === 'Foreigner') return 'ForeignNational';
  return '';
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
