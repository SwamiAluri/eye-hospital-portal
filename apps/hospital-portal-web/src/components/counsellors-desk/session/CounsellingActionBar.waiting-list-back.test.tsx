import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CounsellingActionBar } from './CounsellingActionBar';
import type { BuildSessionActionBarInput } from '@/lib/counsellors-desk/counselling-session-actions';

const baseInput: BuildSessionActionBarInput = {
  queueStatus: 'Processed',
  activeMainTab: 'counselling',
  activePhase: 'estimate',
  phaseCompletion: { estimate: false, decision: false, wrapup: false },
  isRepeatState: false,
  isSurgeryDoneState: false,
  decision: '',
  paymentType: 'Cash',
  insuranceCompany: '',
  finalPayableAmount: 0,
  showCoverageWorkflow: false,
  notRequiredPreAuth: false,
  coverageProgress: {
    uploadedDocCount: 0,
    requiredDocCount: 0,
    ccmsState: 'DRAFT',
    preAuthSubmitted: false,
  },
  canAdvancePhase: true,
  phaseAdvanceError: null,
  saveDisabledReason: null,
  saveDraftDisabledReason: null,
  printDisabledReason: null,
  canSubmitToClaims: false,
  submittingToClaims: false,
};

describe('CounsellingActionBar — Waiting List Back', () => {
  it('renders Back to Waiting List when from=waiting-list on estimate (no phase-back)', () => {
    const onClose = vi.fn();
    const html = renderToStaticMarkup(
      <CounsellingActionBar
        {...baseInput}
        isSaving={false}
        isSavingDraft={false}
        sessionFrom="waiting-list"
        onCloseSession={onClose}
      />,
    );
    expect(html).toContain('counselling-btn-back-to-waiting-list');
    expect(html).toContain('aria-label="Back to Waiting List"');
    expect(html).toContain('Back');
    expect(html).not.toContain('counselling-btn-close-session');
  });

  it('Back click uses Close handler only (no lifecycle)', () => {
    const onClose = vi.fn();
    // Static markup cannot click; contract: leave control always wires onCloseSession.
    const html = renderToStaticMarkup(
      <CounsellingActionBar
        {...baseInput}
        isSaving={false}
        isSavingDraft={false}
        sessionFrom="waiting-list"
        onCloseSession={onClose}
      />,
    );
    expect(html).toContain('counselling-btn-back-to-waiting-list');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps Close when phase-back is visible (decision) from waiting-list', () => {
    const html = renderToStaticMarkup(
      <CounsellingActionBar
        {...baseInput}
        activePhase="decision"
        phaseCompletion={{ estimate: true, decision: false, wrapup: false }}
        isSaving={false}
        isSavingDraft={false}
        sessionFrom="waiting-list"
        onCloseSession={vi.fn()}
        onPhaseBack={vi.fn()}
      />,
    );
    expect(html).toContain('counselling-btn-phase-back');
    expect(html).toContain('counselling-btn-close-session');
    expect(html).not.toContain('counselling-btn-back-to-waiting-list');
  });

  it('keeps Close for non–waiting-list origins', () => {
    const html = renderToStaticMarkup(
      <CounsellingActionBar
        {...baseInput}
        isSaving={false}
        isSavingDraft={false}
        sessionFrom="follow-up"
        onCloseSession={vi.fn()}
      />,
    );
    expect(html).toContain('counselling-btn-close-session');
    expect(html).toContain('Close');
    expect(html).not.toContain('counselling-btn-back-to-waiting-list');
  });
});
