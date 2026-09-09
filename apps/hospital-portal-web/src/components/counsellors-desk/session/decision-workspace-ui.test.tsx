import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CounsellingDecisionPhase } from '@/components/counsellors-desk/session/CounsellingDecisionPhase';
import { DecisionWorkspaceHeader } from '@/components/counsellors-desk/session/DecisionWorkspaceHeader';
import {
  CounsellingDecisionSection,
  CounsellingFollowUpSection,
  CounsellingPaymentSection,
  CounsellingScheduleSection,
} from '@/components/counsellors-desk/session/CounsellingWorkflowSections';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { CounsellingPhaseValidationContext } from '@/lib/counsellors-desk/counselling-progress';
import type { CombinedPaymentType, DecisionType } from '@/types/counsellors-desk';

vi.mock('@/hooks/use-payment-coverage-options', () => ({
  usePaymentCoverageOptions: () => ({
    groups: [
      {
        key: 'self_pay',
        label: 'Self Pay',
        options: [{ value: 'Cash', label: 'Cash', group: 'self_pay', groupLabel: 'Self Pay' }],
      },
      {
        key: 'insurance',
        label: 'Insurance',
        options: [
          { value: 'Insurance', label: 'Insurance', group: 'insurance', groupLabel: 'Insurance' },
        ],
      },
    ],
    loading: false,
    error: null,
  }),
}));

const baseContext: CounsellingPhaseValidationContext = {
  selectedVariantId: 'variant-1',
  hasActiveTemplate: false,
  selectedIolId: null,
  variantSubOption: null,
  iolOptionCount: 0,
  paymentType: 'Insurance',
  insuranceCompany: 'Star Health',
  decision: '',
  schedule: null,
  followUpReason: '',
  followUpDate: '',
  counsellorNotes: '',
  patientRemarks: '',
  wantToSeeDoctor: false,
  interestedToUpgrade: false,
  notRequiredPreAuth: false,
  procedureVariants: [],
};

function renderDecisionPhase(overrides: {
  decision?: DecisionType | '';
  paymentType?: CombinedPaymentType | '';
  insuranceCompany?: string;
  followUpReason?: string;
  followUpDate?: string;
  schedule?: CounsellingPhaseValidationContext['schedule'];
  isReadOnly?: boolean;
  phaseValidationContext?: CounsellingPhaseValidationContext;
}) {
  const decision = overrides.decision ?? '';
  const paymentType = overrides.paymentType ?? 'Cash';
  return renderToStaticMarkup(
    <CounsellingDecisionPhase
      paymentType={paymentType}
      setPaymentType={vi.fn()}
      insuranceCompany={overrides.insuranceCompany ?? ''}
      setInsuranceCompany={vi.fn()}
      insuranceProviderOptions={[{ value: 'star', label: 'Star Health' }]}
      freeSurgeryReason=""
      setFreeSurgeryReason={vi.fn()}
      decision={decision}
      setDecision={vi.fn()}
      followUpReason={overrides.followUpReason ?? ''}
      setFollowUpReason={vi.fn()}
      followUpDate={overrides.followUpDate ?? ''}
      setFollowUpDate={vi.fn()}
      schedule={overrides.schedule ?? null}
      setIsScheduleModalOpen={vi.fn()}
      isReadOnly={overrides.isReadOnly ?? false}
      markDirty={vi.fn()}
      phaseValidationContext={
        overrides.phaseValidationContext ?? {
          ...baseContext,
          decision,
          paymentType,
          insuranceCompany: overrides.insuranceCompany ?? '',
          followUpReason: overrides.followUpReason ?? '',
          followUpDate: overrides.followUpDate ?? '',
          schedule: overrides.schedule ?? null,
        }
      }
    />,
  );
}

describe('Decision workspace UI (Wave 2E-DEC)', () => {
  it('renders required status when no decision selected', () => {
    const html = renderToStaticMarkup(<DecisionWorkspaceHeader isComplete={false} blocker="Decision required" />);
    expect(html).toContain(`data-testid="${counsellingTestIds.decisionWorkspaceStatus}"`);
    expect(html).toContain('Required');
    expect(html).toContain(`data-testid="${counsellingTestIds.decisionInlineBlocker}"`);
  });

  it('renders recorded status when decision phase is complete', () => {
    const html = renderToStaticMarkup(<DecisionWorkspaceHeader isComplete blocker={null} />);
    expect(html).toContain('Recorded');
    expect(html).not.toContain(`data-testid="${counsellingTestIds.decisionInlineBlocker}"`);
  });

  it('uses distinct workspace test id (not phase nav id)', () => {
    const html = renderDecisionPhase({});
    expect(html).toContain(`data-testid="${counsellingTestIds.decisionWorkspace}"`);
    expect(html).not.toContain(`data-testid="${counsellingTestIds.phase('decision')}"`);
  });

  it('renders decision as session widgets without nested workspace panels', () => {
    const html = renderDecisionPhase({ decision: 'DateForSurgery', paymentType: 'Cash' });
    expect(html).toContain('rounded-xl border border-counselling-border/70 bg-counselling-card shadow-sm');
    expect(html).toContain(`data-testid="counselling-decision-funding-widget"`);
    expect(html).toContain(`data-testid="counselling-decision-schedule-widget"`);
    expect(html).not.toContain('rounded-lg border border-counselling-border/70 bg-counselling-card shadow-sm px-3 py-2.5');
  });

  it('renders proceed / needs time / not interested options with radio semantics', () => {
    const html = renderToStaticMarkup(
      <CounsellingDecisionSection
        embedded
        decision=""
        setDecision={vi.fn()}
        followUpReason=""
        setFollowUpReason={vi.fn()}
        followUpDate=""
        setFollowUpDate={vi.fn()}
        isReadOnly={false}
        markDirty={vi.fn()}
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.decisionOption('DateForSurgery')}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.decisionOption('NeedsTime')}"`);
    expect(html).toContain(`data-testid="${counsellingTestIds.decisionOption('NotInterested')}"`);
    expect(html).toContain('role="radiogroup"');
  });

  it('shows follow-up section only for Needs Time and Not Interested', () => {
    const needsTime = renderDecisionPhase({ decision: 'NeedsTime' });
    expect(needsTime).toContain(`data-testid="${counsellingTestIds.decisionFollowUpSection}"`);
    expect(needsTime).toContain(`data-testid="counselling-decision-followup-widget"`);

    const proceed = renderDecisionPhase({ decision: 'DateForSurgery', paymentType: 'Cash' });
    expect(proceed).not.toContain(`data-testid="${counsellingTestIds.decisionFollowUpSection}"`);
  });

  it('shows schedule section for proceed and interested decisions', () => {
    const proceed = renderDecisionPhase({ decision: 'DateForSurgery', paymentType: 'Cash' });
    expect(proceed).toContain('Select a schedule');

    const interested = renderDecisionPhase({ decision: 'Interested', paymentType: 'Cash' });
    expect(interested).toContain('Select a schedule');

    const notInterested = renderDecisionPhase({ decision: 'NotInterested', paymentType: 'Cash' });
    expect(notInterested).not.toContain('Select a schedule');
  });

  it('does not show insurance coverage handoff prose', () => {
    const html = renderDecisionPhase({ paymentType: 'Insurance', insuranceCompany: 'Star Health' });
    expect(html).not.toContain(`data-testid="${counsellingTestIds.decisionFundingHandoff}"`);
    expect(html).not.toContain('Complete policy details in Coverage');
  });

  it('renders funding section for cash without handoff', () => {
    const html = renderDecisionPhase({ paymentType: 'Cash' });
    expect(html).not.toContain(`data-testid="${counsellingTestIds.decisionFundingHandoff}"`);
  });

  it('renders decision summary strip when a decision is selected', () => {
    const html = renderDecisionPhase({
      decision: 'DateForSurgery',
      paymentType: 'Insurance',
      insuranceCompany: 'Star Health',
    });
    expect(html).toContain(`data-testid="${counsellingTestIds.decisionSummaryStrip}"`);
  });

  it('renders follow-up controls in dedicated section', () => {
    const html = renderToStaticMarkup(
      <CounsellingFollowUpSection
        embedded
        followUpReason=""
        setFollowUpReason={vi.fn()}
        followUpDate=""
        setFollowUpDate={vi.fn()}
        isReadOnly={false}
        markDirty={vi.fn()}
      />,
    );
    expect(html).toContain(`data-testid="${counsellingTestIds.followUpDate}"`);
  });

  it('renders compact schedule section without large card chrome', () => {
    const html = renderToStaticMarkup(
      <CounsellingScheduleSection
        embedded
        compact
        required
        schedule={null}
        setIsScheduleModalOpen={vi.fn()}
      />,
    );
    expect(html).toContain('Select a schedule');
    expect(html).not.toContain('rounded-xl border border-counselling-border bg-counselling-card');
  });

  it('renders payment section without nested card wrapper when embedded', () => {
    const html = renderToStaticMarkup(
      <CounsellingPaymentSection
        embedded
        paymentType="Cash"
        setPaymentType={vi.fn()}
        insuranceCompany=""
        setInsuranceCompany={vi.fn()}
        insuranceProviderOptions={[]}
        freeSurgeryReason=""
        setFreeSurgeryReason={vi.fn()}
        isReadOnly={false}
        markDirty={vi.fn()}
      />,
    );
    expect(html).toContain('Payment Type');
    expect(html).not.toContain('rounded-xl border border-counselling-border bg-counselling-card p-4');
  });
});
