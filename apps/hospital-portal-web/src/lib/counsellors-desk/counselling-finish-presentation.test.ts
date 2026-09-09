import { describe, expect, it } from 'vitest';
import {
  buildFinishPatientNextSteps,
  summarizeEstimateAmounts,
} from '@/lib/counsellors-desk/counselling-finish-presentation';
import { buildCounsellingEstimatePdfData } from '@/lib/counsellors-desk/counselling-estimate-pdf-content';

describe('counselling finish presentation', () => {
  it('summarizes persisted estimate lines without inventing totals', () => {
    expect(
      summarizeEstimateAmounts([
        { key: 'p', kind: 'procedure', label: 'Phaco', amount: 50000 },
        { key: 'i', kind: 'investigation', label: 'OCT', amount: 2000 },
        { key: 'iol', kind: 'iol', label: 'IOL', amount: 0 },
      ]),
    ).toEqual({
      procedureAmount: 50000,
      investigationAmount: 2000,
      otherAmount: 0,
    });
  });

  it('builds patient next steps from schedule and coverage', () => {
    const steps = buildFinishPatientNextSteps({
      queueStatus: 'Done',
      scheduleSummary: '25 Jun 2026 · 10:50 · OT1 · Dr Test',
      showCoverageWorkflow: true,
      coverageLabel: 'Waiting for TPA',
      preAuthSubmitted: true,
      docsIncomplete: false,
    });
    expect(steps.some((s) => s.includes('Surgery scheduled'))).toBe(true);
    expect(steps.some((s) => s.includes('Waiting for TPA'))).toBe(true);
  });
});

describe('counselling summary pdf data', () => {
  it('marks documentKind counselling-summary with outcome fields', () => {
    const data = buildCounsellingEstimatePdfData({
      sessionId: 'abcdefgh-1234',
      session: {
        patientName: 'Pat',
        uhid: 'UH1',
        age: 60,
        gender: 'F',
      },
      selectedEye: 'RE',
      selectedVariantId: 'v1',
      selectedInvestigations: new Map(),
      estimateLines: [{ key: 'p', kind: 'procedure', label: 'Phaco', amount: 10000, detail: '' }],
      itemizedSubtotal: 10000,
      bundleSavings: 0,
      baseBeforeDiscount: 10000,
      discountAmount: 0,
      finalPayable: 10000,
      isPackageMode: false,
      activeTemplate: null,
      documentKind: 'counselling-summary',
      procedureName: 'Phaco',
      eyeLabel: 'Right eye',
      outcomeLabel: 'Counselling completed',
      coverageStatusLabel: 'Waiting for TPA',
      nextSteps: ['Contact counselling desk'],
    });
    expect(data.documentKind).toBe('counselling-summary');
    expect(data.outcomeLabel).toBe('Counselling completed');
    expect(data.coverageStatusLabel).toBe('Waiting for TPA');
    expect(data.finalPayable).toBe(10000);
  });
});
