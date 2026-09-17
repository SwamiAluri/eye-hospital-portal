import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CounsellingFinishSummary } from '@/components/counsellors-desk/session/CounsellingFinishSummary';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { isCounsellingTerminalOutcome, shouldAutoOpenFinishSummary } from '@/lib/counsellors-desk/counselling-finish-outcome';
import { resolveFinishCoverageLabel } from '@/lib/counsellors-desk/counselling-finish-presentation';

describe('counselling finish outcome', () => {
  it('treats Done / Repeat / AddOn / SurgeryDone as terminal', () => {
    expect(isCounsellingTerminalOutcome('Done')).toBe(true);
    expect(isCounsellingTerminalOutcome('RepeatCounselling')).toBe(true);
    expect(isCounsellingTerminalOutcome('AddOnSurgery')).toBe(true);
    expect(isCounsellingTerminalOutcome('SurgeryDone')).toBe(true);
    expect(isCounsellingTerminalOutcome('Processed')).toBe(false);
  });

  it('auto-opens Finish for all terminal outcomes including RepeatCounselling', () => {
    expect(shouldAutoOpenFinishSummary('RepeatCounselling')).toBe(true);
    expect(shouldAutoOpenFinishSummary('Done')).toBe(true);
    expect(shouldAutoOpenFinishSummary('AddOnSurgery')).toBe(true);
    expect(shouldAutoOpenFinishSummary('SurgeryDone')).toBe(true);
    expect(shouldAutoOpenFinishSummary('Processed')).toBe(false);
  });
});

describe('finish coverage label', () => {
  it('uses Waiting for TPA from CCMS state instead of Pre-auth submitted flag', () => {
    const label = resolveFinishCoverageLabel({
      showCoverageWorkflow: true,
      notRequiredPreAuth: false,
      coverageProgress: {
        uploadedDocCount: 4,
        requiredDocCount: 4,
        ccmsState: 'WAITING_APPROVAL',
        preAuthSubmitted: true,
      },
    });
    expect(label).toBe('Waiting for TPA');
    expect(label).not.toBe('Pre-auth submitted');
  });
});

describe('CounsellingFinishSummary', () => {
  it('renders compact terminal widgets without Apply Discount', () => {
    const html = renderToStaticMarkup(
      <CounsellingFinishSummary
        queueStatus="Done"
        decision="DateForSurgery"
        paymentType="Insurance"
        insuranceCompany="Star Health"
        schedule={{
          selectedDate: '2026-06-25',
          surgeryStartTime: '10:50',
          operationTheatre: 'OT1',
          doctor: 'Dr Test',
          avoidTimeFrom: '',
          avoidTimeTo: '',
        }}
        finalPayableAmount={72800}
        showCoverageWorkflow
        coverageProgress={{
          uploadedDocCount: 4,
          requiredDocCount: 4,
          ccmsState: 'WAITING_APPROVAL',
          preAuthSubmitted: true,
        }}
        counsellorNotes="ok"
        patientRemarks=""
        doctorNotes=""
        patientName="Test Patient"
        procedureName="Phaco + IOL"
        selectedEye="RE"
        estimateLines={[
          { key: 'p1', kind: 'procedure', label: 'Phaco', amount: 70000 },
          { key: 'i1', kind: 'investigation', label: 'OCT', amount: 2800 },
        ]}
        itemizedSubtotal={72800}
        discountAmount={0}
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.finishWorkspace}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.finishOutcomeWidget}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.finishSummaryWidget}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.finishFinancialWidget}"`);
    expect(html).toContain('Counselling completed');
    expect(html).toContain('Surgery date agreed');
    expect(html).toContain('Waiting for TPA');
    expect(html).not.toContain('Pre-auth submitted');
    expect(html).not.toContain('Apply Discount');
    expect(html).not.toContain('Session completed');
  });
});
