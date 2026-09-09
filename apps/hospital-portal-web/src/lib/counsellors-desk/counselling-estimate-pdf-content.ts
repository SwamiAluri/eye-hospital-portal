import type { EstimateLine } from '@/lib/counsellors-desk/estimate-engine';
import {
  hasDoctorRecommendationConflict,
  hasQuotedProcedureOverride,
} from '@/lib/counsellors-desk/package-preview';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import type { InvestigationItem } from '@/types/counsellors-desk';

/**
 * Letterhead assets — SVG is canonical (see public/brand/README.md).
 * PNG at hospital-letterhead.png is optional; loaded if SVG fails in print preview.
 */
export const COUNSELLING_LETTERHEAD_PATH = '/brand/hospital-letterhead.svg';
export const COUNSELLING_LETTERHEAD_PNG_PATH = '/brand/hospital-letterhead.png';
export const COUNSELLING_LETTERHEAD_FALLBACK = '/auth/ophthalmocare-logo.svg';
export const DEFAULT_HOSPITAL_NAME = 'OphthalmoCare Hospital';

export interface CounsellingEstimatePdfLine {
  item: string;
  eye: string;
  unit: string;
  amount: number;
  /** Catalog procedure price when a quoted override applies */
  catalogAmount?: number;
}

export interface CounsellingEstimatePdfData {
  estimateNumber: string;
  issueDate: Date;
  validityDate: Date;
  hospitalName: string;
  patientName: string;
  uhid: string;
  age?: number;
  gender?: string;
  visitDate?: string;
  counsellorName?: string;
  doctorRecommendationName?: string;
  paymentType?: string;
  lines: CounsellingEstimatePdfLine[];
  itemizedSubtotal: number;
  bundleSavings: number;
  packageName?: string;
  packageAmount?: number;
  isPackageMode: boolean;
  quotedProcedureOverride?: number | null;
  procedureCatalogPrice?: number | null;
  discountAmount: number;
  discountLabel?: string;
  finalPayable: number;
  hasDoctorConflict: boolean;
  /** Quote print vs Finish patient counselling summary print. */
  documentKind?: 'estimate' | 'counselling-summary';
  procedureName?: string;
  eyeLabel?: string;
  surgeonName?: string;
  scheduleSummary?: string;
  operationTheatre?: string;
  decisionLabel?: string;
  outcomeLabel?: string;
  fundingSource?: string;
  insurerName?: string;
  coverageStatusLabel?: string;
  documentsSummary?: string;
  notesRecorded?: boolean;
  nextSteps?: string[];
}

export interface BilingualTerm {
  en: string;
  te: string;
}

export const COUNSELLING_ESTIMATE_TERMS: BilingualTerm[] = [
  {
    en: 'This estimate is valid for 3 calendar days from the date of issue. Please confirm your intent to proceed within this period by contacting the hospital or visiting in person. After expiry, prices and availability may change.',
    te: 'ఈ అంచనా జారీ తేదీ నుండి 3 క్యాలెండర్ రోజులు వరకు చెల్లుబాటు అవుతుంది. ఈ అవధిలో మీ సమ్మతిని ధృవీకరించడానికి ఆసుపత్రిని సంప్రదించండి లేదా వ్యక్తిగతంగా రండి. గడువు ముగిసిన తర్వాత ధరలు మరియు లభ్యత మారవచ్చు.',
  },
  {
    en: 'Amounts are indicative for counselling purposes. Final billing may vary based on clinical findings, consumables used, anesthesia, stay duration, and insurance/pre-authorization outcomes.',
    te: 'ఈ మొత్తాలు కౌన్సెలింగ్ ప్రయోజనాల కోసం సూచనాత్మకమైనవి. తుది బిల్లింగ్ క్లినికల్ పరిశీలనలు, వినియోగించిన సామగ్రి, అనస్థీషియా, అడుగు కాల వ్యవధి మరియు బీమా/ప్రీ-ఆథరైజేషన్ పరిణామాలపై ఆధారపడి మారవచ్చు.',
  },
  {
    en: 'Listed investigations and imaging are included for estimate purposes only. Orders will be placed only after patient confirmation and scheduling.',
    te: 'జాబితా చేసిన పరీక్షలు మరియు ఇమేజింగ్ అంచనా ప్రయోజనాల కోసం మాత్రమే చేర్చబడ్డాయి. రోగి నిర్ధారణ మరియు షెడ్యూలింగ్ తర్వాత మాత్రమే ఆర్డర్లు చేయబడతాయి.',
  },
  {
    en: 'Package rates represent bundled pricing. Discounts shown are as agreed during counselling and apply to this estimate only.',
    te: 'ప్యాకేజీ ధరలు బండిల్ ధరలను సూచిస్తాయి. చూపిన తగ్గింపులు కౌన్సెలింగ్ సమయంలో అంగీకరించినవి మరియు ఈ అంచనాకు మాత్రమే వర్తిస్తాయి.',
  },
  {
    en: 'Subject to hospital cancellation, rescheduling, and refund policies. For queries, contact the counselling desk.',
    te: 'ఆసుపత్రి రద్దు, రీషెడ్యూల్ మరియు రీఫండ్ విధానాలకు లోబడి ఉంటుంది. ప్రశ్నల కోసం కౌన్సెలింగ్ డెస్క్‌ను సంప్రదించండి.',
  },
];

export function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatEstimateDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatValidityEn(validityDate: Date): string {
  return `Valid until ${formatEstimateDate(validityDate)} (3 calendar days from issue date).`;
}

export function formatValidityTe(validityDate: Date): string {
  const teDate = validityDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `${teDate} వరకు చెల్లుబాటు (జారీ తేదీ నుండి 3 క్యాలెండర్ రోజులు).`;
}

export function canPrintCounsellingEstimate(params: {
  selectedVariantId: string | null;
  packageTemplateId: string | null;
  lineCount: number;
}): boolean {
  const hasSelection = !!(params.selectedVariantId || params.packageTemplateId);
  return hasSelection && params.lineCount > 0;
}

function eyeLabelForLine(
  kind: EstimateLine['kind'],
  detail: string | undefined,
  selectedEye: 'RE' | 'LE' | 'BE',
  investigations: Map<string, InvestigationItem>,
  lineKey: string,
): string {
  if (kind === 'procedure') {
    return selectedEye === 'BE' ? 'Both' : selectedEye;
  }
  if (kind === 'investigation') {
    const inv = investigations.get(lineKey);
    if (inv?.eye) return inv.eye === 'BE' ? 'Both' : inv.eye;
    return '—';
  }
  return '—';
}

function unitLabelForLine(kind: EstimateLine['kind'], eye: string): string {
  if (kind === 'investigation') return '1';
  if (kind === 'procedure' && eye !== '—' && eye !== 'Both') return 'Per eye';
  if (kind === 'procedure') return '1';
  return '1';
}

export function buildCounsellingEstimatePdfData(params: {
  sessionId: string;
  session: {
    patientName: string;
    uhid: string;
    age?: number;
    gender?: string;
    visitDate?: string;
    surgeries?: Array<{ isRecommended?: boolean; variantId?: string; surgeryName?: string }>;
  };
  selectedEye: 'RE' | 'LE' | 'BE';
  selectedVariantId: string | null;
  selectedInvestigations: Map<string, InvestigationItem>;
  estimateLines: EstimateLine[];
  itemizedSubtotal: number;
  bundleSavings: number;
  baseBeforeDiscount: number;
  discountAmount: number;
  discountType?: 'flat' | 'percent' | null;
  discountValue?: number;
  finalPayable: number;
  isPackageMode: boolean;
  activeTemplate: CounsellingPackageTemplate | null;
  procedureOverridePrice?: number | null;
  procedureCatalogPrice?: number | null;
  paymentType?: string;
  counsellorName?: string;
  hospitalName?: string;
  issueDate?: Date;
  documentKind?: 'estimate' | 'counselling-summary';
  procedureName?: string;
  eyeLabel?: string;
  surgeonName?: string;
  scheduleSummary?: string;
  operationTheatre?: string;
  decisionLabel?: string;
  outcomeLabel?: string;
  fundingSource?: string;
  insurerName?: string;
  coverageStatusLabel?: string;
  documentsSummary?: string;
  notesRecorded?: boolean;
  nextSteps?: string[];
}): CounsellingEstimatePdfData {
  const issueDate = params.issueDate ?? new Date();
  const validityDate = addCalendarDays(issueDate, 3);

  const recommendedIds = (params.session.surgeries ?? [])
    .filter((s) => s.isRecommended && s.variantId)
    .map((s) => s.variantId as string);
  const doctorRec = (params.session.surgeries ?? []).find((s) => s.isRecommended);

  const lines: CounsellingEstimatePdfLine[] = params.estimateLines.map((line) => {
    const eye = eyeLabelForLine(
      line.kind,
      line.detail,
      params.selectedEye,
      params.selectedInvestigations,
      line.key,
    );
    const catalogAmount =
      line.kind === 'procedure' &&
      hasQuotedProcedureOverride(
        params.procedureCatalogPrice ?? 0,
        params.procedureOverridePrice,
      )
        ? params.procedureCatalogPrice!
        : undefined;

    return {
      item: line.label,
      eye,
      unit: unitLabelForLine(line.kind, eye),
      amount: line.amount,
      catalogAmount,
    };
  });

  let discountLabel: string | undefined;
  if (params.discountAmount > 0) {
    if (params.discountType === 'percent' && params.discountValue) {
      discountLabel = `${params.discountValue}%`;
    } else if (params.discountType === 'flat') {
      discountLabel = 'Flat ₹';
    }
  }

  return {
    estimateNumber: params.sessionId.slice(0, 8).toUpperCase(),
    issueDate,
    validityDate,
    hospitalName: params.hospitalName ?? DEFAULT_HOSPITAL_NAME,
    patientName: params.session.patientName,
    uhid: params.session.uhid,
    age: params.session.age,
    gender: params.session.gender,
    visitDate: params.session.visitDate,
    counsellorName: params.counsellorName,
    doctorRecommendationName: doctorRec?.surgeryName,
    paymentType: params.paymentType,
    lines,
    itemizedSubtotal: params.itemizedSubtotal,
    bundleSavings: params.bundleSavings,
    packageName: params.activeTemplate?.name ?? undefined,
    packageAmount: params.isPackageMode ? params.baseBeforeDiscount : undefined,
    isPackageMode: params.isPackageMode,
    quotedProcedureOverride: params.procedureOverridePrice,
    procedureCatalogPrice: params.procedureCatalogPrice,
    discountAmount: params.discountAmount,
    discountLabel,
    finalPayable: params.finalPayable,
    hasDoctorConflict: hasDoctorRecommendationConflict(recommendedIds, params.selectedVariantId),
    documentKind: params.documentKind ?? 'estimate',
    procedureName: params.procedureName,
    eyeLabel: params.eyeLabel,
    surgeonName: params.surgeonName,
    scheduleSummary: params.scheduleSummary,
    operationTheatre: params.operationTheatre,
    decisionLabel: params.decisionLabel,
    outcomeLabel: params.outcomeLabel,
    fundingSource: params.fundingSource,
    insurerName: params.insurerName,
    coverageStatusLabel: params.coverageStatusLabel,
    documentsSummary: params.documentsSummary,
    notesRecorded: params.notesRecorded,
    nextSteps: params.nextSteps,
  };
}
