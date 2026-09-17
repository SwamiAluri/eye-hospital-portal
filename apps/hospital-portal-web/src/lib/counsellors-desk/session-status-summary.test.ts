import { describe, expect, it } from 'vitest';
import {
  buildSessionStatusSummary,
  formatCounsellorCoverageStatus,
  formatDecisionLabel,
  formatDocumentProgressLabel,
  formatPayableLabel,
  isPreAuthSubmittedState,
} from './session-status-summary';

const baseInput = {
  queueStatus: 'Processed' as const,
  activeMainTab: 'counselling' as const,
  activePhase: 'estimate' as const,
  phaseCompletion: { estimate: false, decision: false, wrapup: false },
  isRepeatState: false,
  isSurgeryDoneState: false,
  decision: '' as const,
  paymentType: 'Insurance',
  insuranceCompany: 'Star Health',
  finalPayableAmount: null,
  showCoverageWorkflow: true,
  notRequiredPreAuth: false,
  coverageProgress: {
    uploadedDocCount: 0,
    requiredDocCount: 3,
    ccmsState: 'DRAFT',
    preAuthSubmitted: false,
  },
  admission: null,
};

describe('session-status-summary', () => {
  it('formats payable and decision in counsellor language', () => {
    expect(formatPayableLabel(null)).toBe('Not quoted yet');
    expect(formatPayableLabel(125000)).toBe('₹1,25,000');
    expect(formatDecisionLabel('DateForSurgery')).toBe('Surgery date agreed');
    expect(formatDecisionLabel('')).toBe('Decision pending');
  });

  it('describes outstanding documents with warning tone', () => {
    expect(formatDocumentProgressLabel(2, 3)).toEqual({
      label: '1 outstanding',
      tone: 'warning',
    });
    expect(formatDocumentProgressLabel(3, 3)).toEqual({
      label: 'All documents uploaded',
      tone: 'success',
    });
  });

  it('detects submitted pre-auth states', () => {
    expect(isPreAuthSubmittedState('PREAUTH_SENT')).toBe(true);
    expect(isPreAuthSubmittedState('DRAFT')).toBe(false);
  });

  it('guides quote-first when estimate incomplete', () => {
    const summary = buildSessionStatusSummary(baseInput);
    expect(summary.statusLine).toBe('Build quote');
    expect(summary.headline).toBe('Build quote');
    expect(summary.nextAction).toMatch(/Build surgical quote/i);
    expect(summary.nextActionPhase).toBe('estimate');
    expect(summary.chips.length).toBeLessThanOrEqual(4);
  });

  it('keeps counselling journey next when insurance docs are outstanding', () => {
    const summary = buildSessionStatusSummary({
      ...baseInput,
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      activePhase: 'wrapup',
      decision: 'DateForSurgery',
      finalPayableAmount: 85000,
      coverageProgress: {
        uploadedDocCount: 1,
        requiredDocCount: 3,
        ccmsState: 'POLICY_CAPTURED',
        preAuthSubmitted: false,
      },
    });
    expect(summary.nextAction).toBe('Complete Session');
    expect(summary.nextActionTab).toBe('counselling');
    expect(summary.nextActionPhase).toBe('wrapup');
    expect(summary.nextAction).not.toMatch(/Upload missing documents/i);
    expect(summary.chips.some((c) => c.id === 'documents' && c.tone === 'warning')).toBe(true);
    expect(summary.chips.find((c) => c.id === 'documents')?.value).toBe('2 outstanding');
    expect(summary.chips.length).toBeLessThanOrEqual(4);
  });

  it('on Insurance tab with outstanding docs points to Notes, not upload-as-block', () => {
    const summary = buildSessionStatusSummary({
      ...baseInput,
      activeMainTab: 'coverage',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      decision: 'DateForSurgery',
      coverageProgress: {
        uploadedDocCount: 1,
        requiredDocCount: 3,
        ccmsState: 'POLICY_CAPTURED',
        preAuthSubmitted: false,
      },
    });
    expect(summary.nextAction).toMatch(/Notes/i);
    expect(summary.nextAction).not.toMatch(/Upload missing documents/i);
    expect(summary.nextActionTab).toBe('counselling');
    expect(summary.chips.some((c) => c.id === 'documents')).toBe(false);
  });

  it('still guides to Insurance when coverage case is draft and not yet on Notes', () => {
    const summary = buildSessionStatusSummary({
      ...baseInput,
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
      coverageProgress: {
        uploadedDocCount: 0,
        requiredDocCount: 4,
        ccmsState: 'DRAFT',
        preAuthSubmitted: false,
      },
    });
    expect(summary.nextAction).toMatch(/Insurance/i);
    expect(summary.nextActionTab).toBe('coverage');
  });

  it('uses Waiting for TPA after pre-auth submit (not prose or raw codes)', () => {
    const summary = buildSessionStatusSummary({
      ...baseInput,
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      activePhase: 'wrapup',
      decision: 'Interested',
      coverageProgress: {
        uploadedDocCount: 3,
        requiredDocCount: 3,
        ccmsState: 'WAITING_APPROVAL',
        preAuthSubmitted: true,
      },
      admission: {
        allowed: false,
        decision: 'BLOCK',
        blockReason: 'Coverage authorization is not ready',
        coverageState: 'WAITING_APPROVAL',
      },
    });
    expect(summary.nextAction).toBe('');
    const coverage = summary.chips.find((c) => c.id === 'coverage');
    expect(coverage?.value).toBe('Waiting for TPA');
    expect(coverage?.tone).toBe('info');
    expect(coverage?.value).not.toMatch(/WAITING_APPROVAL|pre-auth not ready|—/);
  });

  it('maps coverage states to machine status titles', () => {
    expect(
      formatCounsellorCoverageStatus({
        showCoverageWorkflow: true,
        notRequiredPreAuth: false,
        ccmsState: 'WAITING_APPROVAL',
        preAuthSubmitted: true,
      }),
    ).toEqual({ label: 'Waiting for TPA', tone: 'info' });
    expect(
      formatCounsellorCoverageStatus({
        showCoverageWorkflow: true,
        notRequiredPreAuth: false,
        ccmsState: 'PREAUTH_SENT',
        preAuthSubmitted: true,
      }),
    ).toEqual({ label: 'Pre-Auth Sent', tone: 'info' });
    expect(
      formatCounsellorCoverageStatus({
        showCoverageWorkflow: true,
        notRequiredPreAuth: false,
        ccmsState: 'DRAFT',
        preAuthSubmitted: false,
      }),
    ).toEqual({ label: 'Draft', tone: 'warning' });
    expect(
      formatCounsellorCoverageStatus({
        showCoverageWorkflow: true,
        notRequiredPreAuth: false,
        ccmsState: 'REJECTED',
        preAuthSubmitted: true,
      }),
    ).toEqual({ label: 'Rejected', tone: 'danger' });
  });

  it('shows session complete without next action when queue is done', () => {
    const summary = buildSessionStatusSummary({
      ...baseInput,
      queueStatus: 'Done',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      decision: 'DateForSurgery',
    });
    expect(summary.statusLine).toBe('Session complete');
    expect(summary.nextAction).toBe('');
  });
});
