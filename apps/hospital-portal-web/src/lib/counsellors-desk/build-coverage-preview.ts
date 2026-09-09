import type { UpdateCoverageCaseRequest } from '@/lib/api/ccms/ccms-coverage-cases.api';

import type { EstimateLine } from '@/lib/counsellors-desk/estimate-engine';

import {

  mergeCoverageEstimateFromCounselling,

  type CoverageEstimateLineItem,

} from '@/lib/counsellors-desk/coverage-estimate-sync';

import type { CoveragePanelForm } from '@/lib/counsellors-desk/coverage-form-mappers';

import type { InvestigationItem } from '@/types/counsellors-desk';



export type { CoverageEstimateLineItem };



/** Counselling → coverage sync payload (line-item breakdown). */

export interface CounsellingCoverageLineSync {

  surgeryProcedure: string;

  procedureCode?: string;

  eye?: string;

  procedureAmount: number;

  investigationLines: { name: string; amount: number; category: 'imaging' | 'lab' }[];

  investigationTotal: number;

  packageName?: string;

  estimateMode: 'custom' | 'package';

  finalPayable: number;

  surgeryDate?: string;

  insurerName?: string;

}



export interface CounsellingCoverageContext {

  insuranceCompany?: string;

  insuranceProviderId?: string;

  paymentType?: string;

  finalPayable?: number;

  packageRate?: number;

  packageAmount?: number;

  isPackageMode?: boolean;

  estimateMode?: 'custom' | 'package';

  packageName?: string;

  procedureName?: string;

  procedureCode?: string;

  procedureAmount?: number;

  iolAmount?: number;

  iolLabel?: string;

  surgery?: string;

  surgeryDate?: string;

  doctor?: string;

  theatre?: string;

  eye?: string;

  investigations?: InvestigationItem[];

  estimateLines?: EstimateLine[];

}



export interface CoveragePreviewSnapshot {

  insurerName?: string;

  insuranceProviderId?: string;

  estimatedAmount?: number;

  surgeryDate?: string;

  paymentType?: string;

  procedureLabel?: string;

  investigationSummary?: string;

}



export function resolveCounsellingEstimateAmount(ctx: CounsellingCoverageContext): number | undefined {

  if (ctx.finalPayable != null && ctx.finalPayable > 0) return ctx.finalPayable;

  if (ctx.packageRate != null && ctx.packageRate > 0) return ctx.packageRate;

  if (ctx.packageAmount != null && ctx.packageAmount > 0) return ctx.packageAmount;

  return undefined;

}

/** Prefer saved session total when live estimate lacks a procedure line (variant not restored yet). */
export function resolveCoverageSessionFinalPayable(params: {
  liveFinalPayable: number;
  savedFinalPayable?: number;
  estimateLines: EstimateLine[];
}): number | undefined {
  const live = Math.max(0, params.liveFinalPayable);
  const saved = Math.max(0, params.savedFinalPayable ?? 0);
  const hasProcedureLine = params.estimateLines.some(
    (line) => line.kind === 'procedure' || line.kind === 'iol',
  );

  if (!hasProcedureLine && saved > live) return saved;
  if (live > 0) return live;
  if (saved > 0) return saved;
  return undefined;
}

/**
 * Counselling quote final payable for display (chrome, coverage mirror).
 * Live quote is authoritative; saved total is only used while the live estimate is still zero.
 */
export function resolveCounsellingQuoteFinalPayable(params: {
  liveFinalPayable: number;
  savedFinalPayable?: number;
  estimateLines: EstimateLine[];
}): number | undefined {
  const live = Math.max(0, params.liveFinalPayable);
  if (live > 0) return live;
  return resolveCoverageSessionFinalPayable(params);
}



export function buildCoveragePreviewSnapshot(

  ctx: CounsellingCoverageContext,

): CoveragePreviewSnapshot {

  const parts: string[] = [];

  const name = ctx.procedureName ?? ctx.packageName ?? ctx.surgery;

  if (name) parts.push(name);

  if (ctx.eye) parts.push(ctx.eye);

  if (ctx.doctor) parts.push(ctx.doctor);



  const inv =

    ctx.investigations && ctx.investigations.length > 0

      ? ctx.investigations.map((i) => i.testName).filter(Boolean).join(', ')

      : undefined;



  return {

    insurerName: ctx.insuranceCompany?.trim() || undefined,

    insuranceProviderId: ctx.insuranceProviderId,

    estimatedAmount: resolveCounsellingEstimateAmount(ctx),

    surgeryDate: ctx.surgeryDate,

    paymentType: ctx.paymentType,

    procedureLabel: parts.length > 0 ? parts.join(' · ') : undefined,

    investigationSummary: inv,

  };

}



function buildClinicalNotesFromContext(ctx: CounsellingCoverageContext): string {

  const parts: string[] = [];

  const procedure = ctx.procedureName ?? ctx.packageName ?? ctx.surgery;

  if (procedure) parts.push(`Procedure: ${procedure}`);

  if (ctx.estimateMode === 'package' && ctx.packageName) {

    parts.push(`Package: ${ctx.packageName}`);

  }

  if (ctx.eye) parts.push(`Eye: ${ctx.eye}`);

  if (ctx.doctor) parts.push(`Surgeon: ${ctx.doctor}`);

  if (ctx.theatre) parts.push(`OT: ${ctx.theatre}`);

  if (ctx.investigations?.length) {

    parts.push(`Investigations: ${ctx.investigations.map((i) => i.testName).join(', ')}`);

  }

  return parts.join('\n');

}



const INVESTIGATIONS_LINE = /^Investigations:\s*.+$/m;



/** Fill or reconcile clinical notes when counselling data changes. */

export function reconcileClinicalNotesFromContext(

  current: string | undefined,

  ctx: CounsellingCoverageContext,

  prevCtx: CounsellingCoverageContext | null,

): string {

  const nextAuto = buildClinicalNotesFromContext(ctx);

  const prevAuto = prevCtx ? buildClinicalNotesFromContext(prevCtx) : '';

  const cur = current?.trim() ?? '';



  if (!cur) return nextAuto;

  if (cur === prevAuto.trim()) return nextAuto;



  const nextInv = ctx.investigations?.map((i) => i.testName).filter(Boolean).join(', ') ?? '';

  const prevInv = prevCtx?.investigations?.map((i) => i.testName).filter(Boolean).join(', ') ?? '';



  if (nextInv !== prevInv) {

    const invLine = nextInv ? `Investigations: ${nextInv}` : '';

    if (INVESTIGATIONS_LINE.test(cur)) {

      const updated = cur.replace(INVESTIGATIONS_LINE, invLine).trim();

      return updated || nextAuto;

    }

    return invLine ? `${cur}\n${invLine}`.trim() : cur;

  }



  return current ?? '';

}



/** Overlay counselling session values onto a CCMS draft form (preview or post-save sync). */

export function mergeFormWithCounsellingSession(

  base: CoveragePanelForm,

  ctx: CounsellingCoverageContext,

  prevCtx?: CounsellingCoverageContext | null,

): CoveragePanelForm {

  const preview = buildCoveragePreviewSnapshot(ctx);

  let next: CoveragePanelForm = { ...base };



  if (preview.insurerName) {

    next.insurerName = preview.insurerName;

  }

  if (preview.insuranceProviderId) {

    next.insuranceProviderId = preview.insuranceProviderId;

  }

  if (preview.paymentType) {

    next.paymentType = preview.paymentType;

  }



  next = mergeCoverageEstimateFromCounselling(next, ctx, prevCtx ?? null);



  next.clinicalNotes = reconcileClinicalNotesFromContext(

    next.clinicalNotes,

    ctx,

    prevCtx ?? null,

  );



  return next;

}



export function buildPreviewFormFromCounselling(

  ctx: CounsellingCoverageContext,

): UpdateCoverageCaseRequest {

  return mergeFormWithCounsellingSession({ isDraft: true }, ctx);

}


