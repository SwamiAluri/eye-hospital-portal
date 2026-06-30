import type { EstimateLine } from '@/lib/counsellors-desk/estimate-engine';

import type { InvestigationItem } from '@/types/counsellors-desk';

import type { CounsellingCoverageContext } from '@/lib/counsellors-desk/build-coverage-preview';

import type { CoveragePanelForm } from '@/lib/counsellors-desk/coverage-form-mappers';



export type CoverageSyncSource = 'counselling' | 'manual';



/** Single estimate row synced from counselling or edited in Coverage. */

export interface CoverageEstimateLineItem {

  key: string;

  label: string;

  kind: 'procedure' | 'iol' | 'investigation';

  detail?: string;

  amount: number;

  syncSource?: CoverageSyncSource;

}



export type CoverageEstimateFieldKey =

  | 'estimatedSurgery'

  | 'estimatedLab'

  | 'estimatedOther'

  | 'estimatedAmount'

  | 'surgeryProcedureLabel'

  | 'procedureCode';



export interface CoverageEstimateSnapshot {

  surgeryProcedure: string;

  procedureCode?: string;

  packageName?: string;

  estimateMode?: 'custom' | 'package';

  lineItems: CoverageEstimateLineItem[];

  estimatedSurgery: number;

  estimatedLab: number;

  estimatedOther: number;

  estimatedAmount: number;

  surgeryDate?: string;

}



function roundMoney(n: number): number {

  return Math.round(Math.max(0, n) * 100) / 100;

}



function investigationCategory(inv: InvestigationItem): 'imaging' | 'lab' {

  const type = (inv.testType ?? '').toLowerCase();

  if (type === 'lab') return 'lab';

  return 'imaging';

}



function investigationLines(ctx: CounsellingCoverageContext): CoverageEstimateLineItem[] {

  return (ctx.investigations ?? []).map((inv) => ({

    key: inv.catalogId ?? inv.id ?? inv.testName,

    label: inv.testName,

    kind: 'investigation' as const,

    detail: investigationCategory(inv) === 'lab' ? 'Lab' : 'Imaging',

    amount: roundMoney(inv.price ?? 0),

    syncSource: 'counselling' as const,

  }));

}



function estimateLinesFromContext(ctx: CounsellingCoverageContext): CoverageEstimateLineItem[] {
  let lines: CoverageEstimateLineItem[];

  if (ctx.estimateLines?.length) {
    lines = mapEstimateLines(ctx.estimateLines);
  } else {
    const items: CoverageEstimateLineItem[] = [];
    const procedureLabel = ctx.procedureName ?? ctx.packageName ?? ctx.surgery ?? 'Procedure';

    if (ctx.procedureAmount != null && ctx.procedureAmount > 0) {
      items.push({
        key: 'procedure',
        label: procedureLabel,
        kind: 'procedure',
        detail: ctx.eye,
        amount: roundMoney(ctx.procedureAmount),
        syncSource: 'counselling',
      });
    } else if (
      ctx.surgery &&
      ctx.isPackageMode &&
      ctx.packageAmount != null &&
      ctx.packageAmount > 0
    ) {
      items.push({
        key: 'procedure',
        label: ctx.packageName ?? ctx.surgery,
        kind: 'procedure',
        detail: ctx.eye,
        amount: roundMoney(ctx.packageAmount),
        syncSource: 'counselling',
      });
    }

    if (ctx.iolAmount != null && ctx.iolAmount > 0) {
      items.push({
        key: 'iol',
        label: ctx.iolLabel ?? 'IOL',
        kind: 'iol',
        amount: roundMoney(ctx.iolAmount),
        syncSource: 'counselling',
      });
    }

    const invLines = investigationLines(ctx);
    if (items.length === 0 && invLines.length === 0 && ctx.finalPayable != null && ctx.finalPayable > 0) {
      items.push({
        key: 'procedure',
        label: procedureLabel,
        kind: 'procedure',
        detail: ctx.eye,
        amount: roundMoney(ctx.finalPayable),
        syncSource: 'counselling',
      });
    }

    lines = [...items, ...invLines];
  }

  lines = enrichProcedureLineLabels(lines, ctx);
  lines = reconcileEstimateLinesWithFinalPayable(lines, ctx);
  return enrichProcedureLineLabels(lines, ctx);
}

function mapEstimateLines(lines: EstimateLine[]): CoverageEstimateLineItem[] {
  return lines.map((line) => ({
    key: line.key,
    label: line.label,
    kind: line.kind === 'iol' ? 'iol' : line.kind === 'investigation' ? 'investigation' : 'procedure',
    detail: line.detail,
    amount: roundMoney(line.amount),
    syncSource: 'counselling' as const,
  }));
}



export function aggregateLineItems(items: CoverageEstimateLineItem[]): {

  estimatedSurgery: number;

  estimatedLab: number;

  estimatedOther: number;

  total: number;

} {

  let estimatedSurgery = 0;

  let estimatedLab = 0;

  let estimatedOther = 0;



  for (const item of items) {

    if (item.kind === 'procedure' || item.kind === 'iol') {

      estimatedSurgery += item.amount;

    } else if (item.detail === 'Lab') {

      estimatedLab += item.amount;

    } else {

      estimatedOther += item.amount;

    }

  }



  return {

    estimatedSurgery: roundMoney(estimatedSurgery),

    estimatedLab: roundMoney(estimatedLab),

    estimatedOther: roundMoney(estimatedOther),

    total: roundMoney(estimatedSurgery + estimatedLab + estimatedOther),

  };

}



export interface GroupedCoverageLineItems {

  procedurePackage: CoverageEstimateLineItem[];

  imaging: CoverageEstimateLineItem[];

  labs: CoverageEstimateLineItem[];

}



/** Group coverage line items for billing display (procedure · imaging · lab). */

export function groupCoverageLineItemsForDisplay(

  items: CoverageEstimateLineItem[],

): GroupedCoverageLineItems {

  const procedurePackage = items.filter((l) => l.kind === 'procedure' || l.kind === 'iol');

  const imaging = items.filter(

    (l) => l.kind === 'investigation' && (l.detail === 'Imaging' || l.detail === 'Scan'),

  );

  const labs = items.filter((l) => l.kind === 'investigation' && l.detail === 'Lab');

  return { procedurePackage, imaging, labs };

}



export function sumCoverageLineGroup(items: CoverageEstimateLineItem[]): number {

  return roundMoney(items.reduce((sum, item) => sum + item.amount, 0));

}



export function humanizeProcedureCode(code: string): string {
  return code.replace(/-/g, ' ').trim();
}

function isGenericProcedureLabel(label?: string): boolean {
  const normalized = label?.trim().toLowerCase();
  return !normalized || normalized === 'procedure';
}

export function resolveProcedureDisplayName(
  ctx: CounsellingCoverageContext,
  lines: CoverageEstimateLineItem[],
): string {
  const procLine = lines.find((l) => l.kind === 'procedure' || l.kind === 'iol');
  const procLineLabel = procLine?.label?.trim();
  const codeLabel = ctx.procedureCode?.trim()
    ? humanizeProcedureCode(ctx.procedureCode.trim())
    : '';
  return (
    ctx.procedureName?.trim() ||
    ctx.packageName?.trim() ||
    ctx.surgery?.trim() ||
    (!isGenericProcedureLabel(procLineLabel) ? procLineLabel : '') ||
    codeLabel ||
    'Procedure'
  );
}

function enrichProcedureLineLabels(
  lines: CoverageEstimateLineItem[],
  ctx: CounsellingCoverageContext,
): CoverageEstimateLineItem[] {
  const displayName = resolveProcedureDisplayName(ctx, lines);
  if (isGenericProcedureLabel(displayName)) return lines;

  return lines.map((line) => {
    if (line.kind !== 'procedure' && line.kind !== 'iol') return line;
    if (isGenericProcedureLabel(line.label)) {
      return { ...line, label: displayName, syncSource: 'counselling' as const };
    }
    return line;
  });
}

function resolveSurgeryProcedureLabel(
  ctx: CounsellingCoverageContext,
  lines: CoverageEstimateLineItem[],
): string {
  const name = resolveProcedureDisplayName(ctx, lines);
  const parts = [name];
  const eye = ctx.eye?.trim();
  if (eye && eye !== name && !name.includes(eye)) {
    parts.push(eye);
  }
  if (ctx.doctor?.trim()) parts.push(ctx.doctor.trim());
  return parts.join(' · ');
}

/** Ensure line items sum matches counselling final payable (insert/update procedure row). */
export function reconcileEstimateLinesWithFinalPayable(
  lines: CoverageEstimateLineItem[],
  ctx: CounsellingCoverageContext,
): CoverageEstimateLineItem[] {
  const finalPayable =
    ctx.finalPayable != null && ctx.finalPayable > 0 ? roundMoney(ctx.finalPayable) : 0;
  if (finalPayable <= 0) return lines;

  const agg = aggregateLineItems(lines);
  const lineSum = roundMoney(agg.estimatedSurgery + agg.estimatedLab + agg.estimatedOther);
  const gap = roundMoney(finalPayable - lineSum);
  if (gap <= 0.01) return lines;

  const procedureLabel = resolveProcedureDisplayName(ctx, lines);
  const procedureIdx = lines.findIndex((l) => l.kind === 'procedure' || l.kind === 'iol');

  if (procedureIdx >= 0) {
    return lines.map((line, i) =>
      i === procedureIdx
        ? {
            ...line,
            label: isGenericProcedureLabel(line.label) ? procedureLabel : line.label,
            amount: roundMoney(line.amount + gap),
            syncSource: 'counselling' as const,
          }
        : line,
    );
  }

  return [
    {
      key: 'procedure',
      label: procedureLabel,
      kind: 'procedure',
      detail: ctx.eye,
      amount: gap,
      syncSource: 'counselling',
    },
    ...lines,
  ];
}



export function buildCoverageEstimateSnapshot(

  ctx: CounsellingCoverageContext,

): CoverageEstimateSnapshot {

  const lineItems = estimateLinesFromContext(ctx);

  const agg = aggregateLineItems(lineItems);

  const total =

    ctx.finalPayable != null && ctx.finalPayable > 0

      ? roundMoney(ctx.finalPayable)

      : agg.total;



  return {

    surgeryProcedure: resolveProcedureDisplayName(ctx, lineItems),

    procedureCode: ctx.procedureCode,

    packageName: ctx.packageName,

    estimateMode: ctx.estimateMode,

    lineItems,

    estimatedSurgery: agg.estimatedSurgery,

    estimatedLab: agg.estimatedLab,

    estimatedOther: agg.estimatedOther,

    estimatedAmount: total,

    surgeryDate: ctx.surgeryDate,

  };

}



function lineItemsEqual(a: CoverageEstimateLineItem[], b: CoverageEstimateLineItem[]): boolean {

  if (a.length !== b.length) return false;

  return a.every((item, i) => {

    const other = b[i];

    return (

      item.key === other.key &&

      item.label === other.label &&

      item.kind === other.kind &&

      item.amount === other.amount

    );

  });

}



function mergeLineItems(

  current: CoverageEstimateLineItem[] | undefined,

  next: CoverageEstimateLineItem[],

  prevSnapshot: CoverageEstimateSnapshot | null,

): CoverageEstimateLineItem[] {

  if (!current?.length) return next;

  if (!prevSnapshot) return next;



  const prevByKey = new Map(prevSnapshot.lineItems.map((l) => [l.key, l]));

  const nextByKey = new Map(next.map((l) => [l.key, l]));



  const merged: CoverageEstimateLineItem[] = [];

  const seen = new Set<string>();



  for (const item of current) {

    const prev = prevByKey.get(item.key);

    const incoming = nextByKey.get(item.key);

    seen.add(item.key);



    if (item.syncSource === 'manual') {

      merged.push(item);

    } else if (incoming && prev && item.amount === prev.amount) {

      merged.push(incoming);

    } else if (incoming && !prev) {

      merged.push(item);

    } else {

      merged.push(item);

    }

  }



  for (const item of next) {

    if (!seen.has(item.key)) merged.push(item);

  }



  return merged;

}



function mergeNumericField(

  current: number | undefined,

  next: number,

  prev: number | undefined,

  syncSource: CoverageSyncSource | undefined,

): { value: number | undefined; syncSource: CoverageSyncSource } {

  if (syncSource === 'manual') {

    return { value: current, syncSource: 'manual' };

  }

  if (current == null || current === 0) {

    return { value: next > 0 ? next : undefined, syncSource: 'counselling' };

  }

  if (prev != null && current === prev) {

    return { value: next > 0 ? next : undefined, syncSource: 'counselling' };

  }

  return { value: current, syncSource: syncSource ?? 'manual' };

}



function mergeStringField(

  current: string | undefined,

  next: string,

  prev?: string,

  syncSource?: CoverageSyncSource,

): { value: string | undefined; syncSource: CoverageSyncSource } {

  const cur = current?.trim() ?? '';

  if (syncSource === 'manual') {

    return { value: current, syncSource: 'manual' };

  }

  if (!cur) return { value: next || undefined, syncSource: 'counselling' };

  if (prev != null && cur === prev.trim()) return { value: next || undefined, syncSource: 'counselling' };

  return { value: current, syncSource: syncSource ?? 'manual' };

}



/** Merge counselling estimate snapshot into coverage form (counselling is source of truth). */
export function mergeCoverageEstimateFromCounselling(
  form: CoveragePanelForm,
  ctx: CounsellingCoverageContext,
  _prevCtx: CounsellingCoverageContext | null,
): CoveragePanelForm {
  const snapshot = buildCoverageEstimateSnapshot(ctx);

  if (snapshot.lineItems.length === 0 && snapshot.estimatedAmount <= 0) {
    return form;
  }

  const counsellingLineItems = snapshot.lineItems.map((item) => ({
    ...item,
    syncSource: 'counselling' as const,
  }));
  const agg = aggregateLineItems(counsellingLineItems);

  const next: CoveragePanelForm = {
    ...form,
    estimateLineItems: counsellingLineItems,
    estimatedSurgery: agg.estimatedSurgery > 0 ? agg.estimatedSurgery : undefined,
    estimatedLab: agg.estimatedLab > 0 ? agg.estimatedLab : undefined,
    estimatedOther: agg.estimatedOther > 0 ? agg.estimatedOther : undefined,
    estimatedAmount: snapshot.estimatedAmount > 0 ? snapshot.estimatedAmount : undefined,
    estimateSyncSources: {
      estimatedSurgery: 'counselling',
      estimatedLab: 'counselling',
      estimatedOther: 'counselling',
      estimatedAmount: 'counselling',
      surgeryProcedureLabel: 'counselling',
      procedureCode: 'counselling',
    },
  };

  if (snapshot.surgeryProcedure) {
    next.surgeryProcedureLabel = snapshot.surgeryProcedure;
  }
  if (snapshot.procedureCode) {
    next.procedureCode = snapshot.procedureCode;
  } else if (form.procedureCode?.trim()) {
    next.procedureCode = form.procedureCode.trim();
  }
  if (snapshot.surgeryDate) {
    next.surgeryDate = snapshot.surgeryDate;
  }

  return next;
}



export function isFieldSyncedWithCounselling(

  current: number | undefined,

  counselling: number | undefined,

  syncSource?: CoverageSyncSource,

): boolean {

  if (syncSource === 'manual') return false;

  if (syncSource === 'counselling') return true;

  if (counselling == null || counselling <= 0) return false;

  return roundMoney(current ?? 0) === roundMoney(counselling);

}



export function isLineItemSynced(

  item: CoverageEstimateLineItem,

  counsellingItems: CoverageEstimateLineItem[],

): boolean {

  if (item.syncSource === 'manual') return false;

  if (item.syncSource === 'counselling') return true;

  const match = counsellingItems.find((c) => c.key === item.key);

  if (!match) return false;

  return item.amount === match.amount && item.label === match.label;

}



export function isStringFieldSyncedWithCounselling(

  current: string | undefined,

  counselling: string | undefined,

  syncSource?: CoverageSyncSource,

): boolean {

  if (syncSource === 'manual') return false;

  if (syncSource === 'counselling') return true;

  if (!counselling?.trim()) return false;

  return (current?.trim() ?? '') === counselling.trim();

}



export function buildEstimateLinesFromInvestigations(

  investigations: InvestigationItem[],

): EstimateLine[] {

  return investigations.map((inv) => ({

    key: inv.catalogId ?? inv.id ?? inv.testName,

    label: inv.testName,

    detail: inv.testType,

    amount: inv.price ?? 0,

    kind: 'investigation' as const,

  }));

}



export function counsellingSnapshotsEqual(

  a: CoverageEstimateSnapshot,

  b: CoverageEstimateSnapshot,

): boolean {

  return (

    a.surgeryProcedure === b.surgeryProcedure &&

    a.procedureCode === b.procedureCode &&

    a.estimatedAmount === b.estimatedAmount &&

    a.estimatedSurgery === b.estimatedSurgery &&

    a.estimatedLab === b.estimatedLab &&

    a.estimatedOther === b.estimatedOther &&

    a.surgeryDate === b.surgeryDate &&

    lineItemsEqual(a.lineItems, b.lineItems)

  );

}


