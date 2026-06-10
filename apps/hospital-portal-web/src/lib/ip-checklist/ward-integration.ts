import type { CounselorLabOrderItem } from '@/lib/api/lab-orders.api';
import type { BiometryRecord } from '@/lib/api/biometry.api';
import type { PatientConsent } from '@/lib/api/patient-consents.api';
import type { ImagingOrderResponse } from '@/lib/api/imaging.api';
import type { OutpatientIntegrationHint, IntegrationSource } from '@/lib/ip-checklist/outpatient-integration';

export interface WardIntegrationContext {
  patientId?: string;
  sessionId?: string;
  financialState?: string;
  balanceDue?: number;
  emergencyFcApplied?: boolean;
  anaesthesiaType?: string;
}

export interface WardIntegrationData {
  labOrders: CounselorLabOrderItem[];
  biometry: BiometryRecord[];
  consents: PatientConsent[];
  imagingOrders?: ImagingOrderResponse[];
  hasRecentVitals?: boolean;
  hasActivePrescription?: boolean;
}

const LAB_ITEM_KEYWORDS: Record<string, string[]> = {
  blood_sugar: ['fbs', 'rbs', 'blood sugar', 'glucose'],
  hiv_done: ['hiv'],
  blood_urea: ['urea', 'bun'],
  serum_creatinine: ['creatinine'],
  hba1c_done: ['hba1c', 'a1c'],
  investigation_reports_available: ['hiv', 'hbsag', 'creatinine', 'urea', 'culture', 'serology'],
};

const IMAGING_KEYWORDS: Record<string, string[]> = {
  bscan_done: ['b-scan', 'bscan', 'ultrasound'],
  xray_ga_cases: ['x-ray', 'xray', 'chest'],
  ascan_done: ['a-scan', 'ascan', 'biometry'],
  ward_ascan_confirmed: ['a-scan', 'ascan', 'biometry'],
};

function labDone(orders: CounselorLabOrderItem[], keywords: string[]): boolean {
  return orders.some(o => o.status === 'Completed' && keywords.some(k =>
    `${o.testName} ${o.testCode ?? ''}`.toLowerCase().includes(k)));
}

function imagingDone(orders: ImagingOrderResponse[], keywords: string[]): boolean {
  return orders.some(o =>
    (o.status === 'Completed' || o.status === 'Reviewed')
    && keywords.some(k => `${o.imagingType} ${o.clinicalIndication ?? ''}`.toLowerCase().includes(k)));
}

function hasBiometry(biometry: BiometryRecord[]): boolean {
  return biometry.some(b => b.axialLength > 0);
}

function hasConsent(consents: PatientConsent[]): boolean {
  return consents.some(c =>
    c.isGranted && c.status === 'active'
    && /surgery|surgical|procedure|consent/i.test(`${c.consentType} ${c.consentName}`));
}

function billingCleared(ctx: WardIntegrationContext): boolean {
  if (ctx.emergencyFcApplied) return true;
  const ok = ['Paid', 'Settled', 'PartiallyPaid', 'Confirmed'];
  return !!ctx.financialState && ok.includes(ctx.financialState)
    && (ctx.balanceDue == null || ctx.balanceDue <= 0);
}

export function buildWardIntegrationHints(
  data: WardIntegrationData,
  ctx: WardIntegrationContext,
  itemKeys: string[],
): OutpatientIntegrationHint[] {
  const hints: OutpatientIntegrationHint[] = [];

  for (const key of itemKeys) {
    if (LAB_ITEM_KEYWORDS[key]) {
      const done = labDone(data.labOrders, LAB_ITEM_KEYWORDS[key]);
      if (done || data.labOrders.some(o => LAB_ITEM_KEYWORDS[key].some(k =>
        `${o.testName} ${o.testCode ?? ''}`.toLowerCase().includes(k)))) {
        hints.push({
          itemKey: key,
          source: 'lab' as IntegrationSource,
          suggestedComplete: done,
          label: done ? 'Lab complete' : 'Lab ordered',
        });
      }
    }

    if (IMAGING_KEYWORDS[key]) {
      if (key === 'xray_ga_cases') {
        const isGa = (ctx.anaesthesiaType ?? '').toLowerCase().includes('general')
          || (ctx.anaesthesiaType ?? '').toLowerCase().includes('ga');
        if (!isGa) continue;
      }
      const imagingOrders = data.imagingOrders ?? [];
      const keywords = IMAGING_KEYWORDS[key];
      if (key.includes('ascan') && hasBiometry(data.biometry)) {
        hints.push({ itemKey: key, source: 'optometry', suggestedComplete: true, label: 'Biometry on file' });
      } else if (imagingOrders.length > 0) {
        const done = imagingDone(imagingOrders, keywords);
        if (done || imagingOrders.some(o => keywords.some(k =>
          `${o.imagingType} ${o.clinicalIndication ?? ''}`.toLowerCase().includes(k)))) {
          hints.push({
            itemKey: key,
            source: 'optometry' as IntegrationSource,
            suggestedComplete: done,
            label: done ? 'Imaging complete' : 'Imaging ordered',
          });
        }
      }
    }

    if (key === 'consent_confirmed' || key === 'consent_patient_signed') {
      if (hasConsent(data.consents)) {
        hints.push({ itemKey: key, source: 'consent', suggestedComplete: true, label: 'Consent on file' });
      }
    }

    if (key === 'bill_payment_confirmed' && billingCleared(ctx)) {
      hints.push({ itemKey: key, source: 'payment', suggestedComplete: true, label: 'Billing cleared' });
    }

    if (key === 'bp_checked' && data.hasRecentVitals) {
      hints.push({ itemKey: key, source: 'lab', suggestedComplete: true, label: 'Vitals recorded' });
    }

    if (key === 'postop_medication_prescribed' && data.hasActivePrescription) {
      hints.push({ itemKey: key, source: 'lab', suggestedComplete: false, label: 'Active prescription on file' });
    }
  }

  return hints;
}

/** OT Before Anaesthesia integration hints (read-only badges). */
export interface OtSafetyIntegrationHint {
  field: string;
  label: string;
  suggestedValue?: boolean | string;
}

export function buildOtSafetyHints(
  ctx: {
    patientName?: string;
    eyeOperated?: string;
    allergies?: string;
    hasConsent?: boolean;
    hasBiometry?: boolean;
    hasTopicalAntibiotics?: boolean;
    financialState?: string;
    balanceDue?: number;
    emergencyFcApplied?: boolean;
  },
): OtSafetyIntegrationHint[] {
  const hints: OtSafetyIntegrationHint[] = [];
  if (ctx.patientName) hints.push({ field: 'identity', label: 'Patient identity from master', suggestedValue: true });
  if (ctx.eyeOperated) hints.push({ field: 'eye', label: `Operative eye: ${ctx.eyeOperated}`, suggestedValue: true });
  if (ctx.allergies) hints.push({ field: 'allergy', label: `Allergies: ${ctx.allergies}`, suggestedValue: true });
  if (ctx.hasConsent) hints.push({ field: 'consent', label: 'Consent on file', suggestedValue: true });
  if (ctx.hasBiometry) hints.push({ field: 'ascan', label: 'A-Scan / biometry available', suggestedValue: true });
  if (ctx.hasTopicalAntibiotics) hints.push({ field: 'topicalAntibiotics', label: 'Med log has topical antibiotics', suggestedValue: true });
  const billingOk = ctx.emergencyFcApplied
    || (['Paid', 'Settled', 'PartiallyPaid', 'Confirmed'].includes(ctx.financialState ?? '')
        && (ctx.balanceDue == null || ctx.balanceDue <= 0));
  if (billingOk) hints.push({ field: 'billing', label: 'Auto-verified from billing', suggestedValue: true });
  return hints;
}
