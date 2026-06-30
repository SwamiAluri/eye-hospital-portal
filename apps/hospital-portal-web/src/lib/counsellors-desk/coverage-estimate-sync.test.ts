import { describe, expect, it } from 'vitest';

import {

  aggregateLineItems,

  groupCoverageLineItemsForDisplay,

  buildCoverageEstimateSnapshot,

  isLineItemSynced,

  mergeCoverageEstimateFromCounselling,

  reconcileEstimateLinesWithFinalPayable,

} from '@/lib/counsellors-desk/coverage-estimate-sync';

import {

  type CounsellingCoverageContext,

  reconcileClinicalNotesFromContext,

} from '@/lib/counsellors-desk/build-coverage-preview';

import type { CoveragePanelForm } from '@/lib/counsellors-desk/coverage-form-mappers';



describe('coverage-estimate-sync', () => {

  const ctx: CounsellingCoverageContext = {

    surgery: 'Phaco + IOL',

    procedureName: 'Phaco + IOL',

    procedureCode: 'PHACO-001',

    eye: 'RE',

    estimateMode: 'custom',

    finalPayable: 45000,

    estimateLines: [

      { key: 'procedure', label: 'Phaco + IOL', detail: 'RE', amount: 40000, kind: 'procedure' },

      { key: 'inv-1', label: 'OCT', detail: 'Scan', amount: 3000, kind: 'investigation' },

      { key: 'inv-2', label: 'CBC', detail: 'Lab', amount: 500, kind: 'investigation' },

    ],

  };



  it('builds line items and category totals from estimate lines', () => {

    const snapshot = buildCoverageEstimateSnapshot(ctx);

    expect(snapshot.lineItems).toHaveLength(3);

    expect(snapshot.lineItems.every((l) => l.syncSource === 'counselling')).toBe(true);

    expect(snapshot.estimatedSurgery).toBe(41500);

    expect(snapshot.estimatedLab).toBe(500);

    expect(snapshot.estimatedOther).toBe(3000);

    expect(snapshot.estimatedAmount).toBe(45000);

    expect(snapshot.procedureCode).toBe('PHACO-001');

  });



  it('aggregates line items into breakdown fields', () => {

    const agg = aggregateLineItems(buildCoverageEstimateSnapshot(ctx).lineItems);

    expect(agg.total).toBe(45000);

  });



  it('groupCoverageLineItemsForDisplay splits procedure, imaging, and labs', () => {

    const grouped = groupCoverageLineItemsForDisplay(buildCoverageEstimateSnapshot(ctx).lineItems);

    expect(grouped.procedurePackage).toHaveLength(1);

    expect(grouped.imaging).toHaveLength(1);

    expect(grouped.labs).toHaveLength(1);

  });



  it('always mirrors counselling estimate (no manual override retention)', () => {
    const base: CoveragePanelForm = {
      estimatedSurgery: 38000,
      estimateLineItems: [
        { key: 'procedure', label: 'Phaco + IOL', kind: 'procedure', amount: 38000, syncSource: 'manual' },
        { key: 'inv-1', label: 'OCT', kind: 'investigation', detail: 'Scan', amount: 3000, syncSource: 'counselling' },
      ],
      estimateSyncSources: { estimatedSurgery: 'manual' },
    };

    const nextCtx: CounsellingCoverageContext = {
      ...ctx,
      estimateLines: [
        { key: 'procedure', label: 'Phaco + IOL', detail: 'RE', amount: 41000, kind: 'procedure' },
        { key: 'inv-1', label: 'OCT', detail: 'Scan', amount: 3200, kind: 'investigation' },
      ],
      finalPayable: 44200,
    };

    const merged = mergeCoverageEstimateFromCounselling(base, nextCtx, ctx);
    expect(merged.estimatedSurgery).toBe(41000);
    const oct = merged.estimateLineItems?.find((l) => l.key === 'inv-1');
    expect(oct?.amount).toBe(3200);
    expect(oct?.syncSource).toBe('counselling');
    expect(merged.estimatedAmount).toBe(44200);
  });



  it('tracks manual line items via syncSource', () => {

    const manual = {

      key: 'inv-1',

      label: 'OCT',

      kind: 'investigation' as const,

      amount: 2500,

      syncSource: 'manual' as const,

    };

    expect(isLineItemSynced(manual, buildCoverageEstimateSnapshot(ctx).lineItems)).toBe(false);

  });

  it('reconciles line items when final payable exceeds line sum', () => {
    const gapCtx: CounsellingCoverageContext = {
      procedureName: 'Premium Multifocal Toric',
      procedureCode: 'PREM-MULTI-TORIC',
      eye: 'LE',
      finalPayable: 138100,
      estimateLines: [
        { key: 'inv-1', label: 'OCT', detail: 'Scan', amount: 3100, kind: 'investigation' },
        { key: 'inv-2', label: 'Biometry', detail: 'Scan', amount: 2000, kind: 'investigation' },
      ],
    };

    const snapshot = buildCoverageEstimateSnapshot(gapCtx);
    expect(snapshot.estimatedAmount).toBe(138100);
    expect(snapshot.lineItems.find((l) => l.kind === 'procedure')?.amount).toBe(133000);
    expect(snapshot.surgeryProcedure).toContain('Premium Multifocal Toric');
    expect(snapshot.surgeryProcedure).not.toContain('LE');
  });

  it('uses procedure line label instead of eye-only surgery label', () => {
    const eyeOnlyCtx: CounsellingCoverageContext = {
      eye: 'LE',
      procedureCode: 'PREM-MULTI-TORIC',
      finalPayable: 50000,
      estimateLines: [
        { key: 'procedure', label: 'Premium Multifocal Toric', detail: 'LE', amount: 50000, kind: 'procedure' },
      ],
    };

    const snapshot = buildCoverageEstimateSnapshot(eyeOnlyCtx);
    expect(snapshot.surgeryProcedure).toMatch(/Premium Multifocal Toric/);
  });

  it('reconcileEstimateLinesWithFinalPayable bumps existing procedure row', () => {
    const lines = [
      { key: 'procedure', label: 'Phaco', kind: 'procedure' as const, amount: 40000, syncSource: 'counselling' as const },
      { key: 'inv-1', label: 'OCT', kind: 'investigation' as const, detail: 'Scan', amount: 3000, syncSource: 'counselling' as const },
    ];
    const reconciled = reconcileEstimateLinesWithFinalPayable(lines, { finalPayable: 45000 });
    expect(reconciled.find((l) => l.key === 'procedure')?.amount).toBe(42000);
  });

  it('uses humanized procedure code when name is missing', () => {
    const codeOnlyCtx: CounsellingCoverageContext = {
      procedureCode: 'ICL-NONTORIC-IMP',
      eye: 'RE',
      doctor: 'Dr. Smith',
      finalPayable: 80000,
      estimateLines: [
        { key: 'inv-1', label: 'OCT', detail: 'Scan', amount: 1500, kind: 'investigation' },
      ],
    };

    const snapshot = buildCoverageEstimateSnapshot(codeOnlyCtx);
    expect(snapshot.surgeryProcedure).toBe('ICL NONTORIC IMP');
    expect(snapshot.lineItems.find((l) => l.kind === 'procedure')?.label).toBe('ICL NONTORIC IMP');
  });

  it('relabels generic procedure line items from counselling estimate lines', () => {
    const genericCtx: CounsellingCoverageContext = {
      procedureCode: 'ICL-NONTORIC-IMP',
      finalPayable: 120000,
      estimateLines: [
        { key: 'procedure', label: 'Procedure', detail: 'RE', amount: 50000, kind: 'procedure' },
        { key: 'inv-1', label: 'Biometry', detail: 'Scan', amount: 1500, kind: 'investigation' },
      ],
    };
    const snapshot = buildCoverageEstimateSnapshot(genericCtx);
    const procedure = snapshot.lineItems.find((l) => l.key === 'procedure');
    expect(procedure?.label).toBe('ICL NONTORIC IMP');
    expect(procedure?.amount).toBe(118500);
  });

});



describe('reconcileClinicalNotesFromContext', () => {

  it('replaces investigations line when counselling selection changes', () => {

    const prev: CounsellingCoverageContext = {

      procedureName: 'Phaco',

      investigations: [{ id: '1', testName: 'OCT', testType: 'Scan', price: 100 }],

    };

    const next: CounsellingCoverageContext = {

      procedureName: 'Phaco',

      investigations: [

        { id: '1', testName: 'OCT', testType: 'Scan', price: 100 },

        { id: '2', testName: 'CBC', testType: 'Lab', price: 50 },

      ],

    };

    const current = 'Procedure: Phaco\nInvestigations: OCT';

    const reconciled = reconcileClinicalNotesFromContext(current, next, prev);

    expect(reconciled).toContain('OCT, CBC');

  });

});

