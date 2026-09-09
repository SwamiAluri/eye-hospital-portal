import { describe, expect, it } from 'vitest';
import { planCounsellingDualDraftSave } from './counselling-dual-draft-save';

describe('planCounsellingDualDraftSave (Option 1)', () => {
  it('always saves counselling when draft is allowed', () => {
    const plan = planCounsellingDualDraftSave({
      draftDisabled: false,
      coverageWorkflowActive: false,
      coveragePanelReady: false,
    });
    expect(plan.saveCounselling).toBe(true);
    expect(plan.saveCoverage).toBe(false);
    expect(plan.coverageSoftWarn).toBe(false);
  });

  it('saves counselling + coverage when workflow on and panel ready', () => {
    const plan = planCounsellingDualDraftSave({
      draftDisabled: false,
      coverageWorkflowActive: true,
      coveragePanelReady: true,
      coverageEditable: true,
    });
    expect(plan.saveCounselling).toBe(true);
    expect(plan.saveCoverage).toBe(true);
    expect(plan.coverageSoftWarn).toBe(false);
    expect(plan.coverageSkippedLocked).toBe(false);
  });

  it('soft-warns coverage when workflow on but panel not ready', () => {
    const plan = planCounsellingDualDraftSave({
      draftDisabled: false,
      coverageWorkflowActive: true,
      coveragePanelReady: false,
    });
    expect(plan.saveCounselling).toBe(true);
    expect(plan.saveCoverage).toBe(false);
    expect(plan.coverageSoftWarn).toBe(true);
  });

  it('skips coverage quietly when case is locked (Waiting for TPA)', () => {
    const plan = planCounsellingDualDraftSave({
      draftDisabled: false,
      coverageWorkflowActive: true,
      coveragePanelReady: true,
      coverageEditable: false,
    });
    expect(plan.saveCounselling).toBe(true);
    expect(plan.saveCoverage).toBe(false);
    expect(plan.coverageSoftWarn).toBe(false);
    expect(plan.coverageSkippedLocked).toBe(true);
  });

  it('saves nothing when draft is disabled', () => {
    const plan = planCounsellingDualDraftSave({
      draftDisabled: true,
      coverageWorkflowActive: true,
      coveragePanelReady: true,
    });
    expect(plan.saveCounselling).toBe(false);
    expect(plan.saveCoverage).toBe(false);
    expect(plan.coverageSoftWarn).toBe(false);
  });

  it('also flushes outpatient when requested', () => {
    const plan = planCounsellingDualDraftSave({
      draftDisabled: false,
      coverageWorkflowActive: true,
      coveragePanelReady: true,
      flushOutpatient: true,
    });
    expect(plan.flushOutpatient).toBe(true);
  });
});
