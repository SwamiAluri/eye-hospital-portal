import { describe, expect, it } from 'vitest';
import {
  resolveCounsellingJourneyNext,
  resolveCounsellingJourneyPrevious,
} from '@/lib/counsellors-desk/counselling-journey-navigation';

describe('counselling-journey-navigation', () => {
  const base = {
    activeMainTab: 'counselling' as const,
    activePhase: 'estimate' as const,
    phaseCompletion: { estimate: true, decision: false, wrapup: false },
    showCoverageWorkflow: false,
    coverageTabAvailable: false,
    finishSummaryActive: false,
  };

  it('Quote → Decision even when decision field is partially set', () => {
    const next = resolveCounsellingJourneyNext({
      ...base,
      decision: 'NeedsTime',
      phaseCompletion: { estimate: true, decision: false, wrapup: false },
    });
    expect(next).toEqual({
      kind: 'phase_next',
      label: 'Next: Patient Decision',
    });
  });

  it('Quote → Decision even after decision is complete (revisit path)', () => {
    const next = resolveCounsellingJourneyNext({
      ...base,
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
      coverageTabAvailable: true,
      showCoverageWorkflow: true,
    });
    expect(next?.kind).toBe('phase_next');
    expect(next?.label).toBe('Next: Patient Decision');
  });

  it('Decision → Notes for cash (no insurance tab)', () => {
    const next = resolveCounsellingJourneyNext({
      ...base,
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
      paymentType: 'Cash',
      showCoverageWorkflow: false,
      coverageTabAvailable: false,
    });
    expect(next).toEqual({
      kind: 'navigate',
      label: 'Next: Notes',
      navigateTab: 'counselling',
      navigatePhase: 'wrapup',
    });
  });

  it('Decision → Insurance when insurance payment type (coverage tab available)', () => {
    const next = resolveCounsellingJourneyNext({
      ...base,
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
      showCoverageWorkflow: true,
      coverageTabAvailable: true,
    });
    expect(next).toEqual({
      kind: 'navigate',
      label: 'Next: Insurance',
      navigateTab: 'coverage',
    });
  });

  it('Decision → Insurance when insurance + pre-auth not required', () => {
    const next = resolveCounsellingJourneyNext({
      ...base,
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      decision: 'DateForSurgery',
      showCoverageWorkflow: false,
      coverageTabAvailable: true,
    });
    expect(next?.label).toBe('Next: Insurance');
    expect(next).toMatchObject({ kind: 'navigate', navigateTab: 'coverage' });
  });

  it('Insurance → Notes', () => {
    const next = resolveCounsellingJourneyNext({
      ...base,
      activeMainTab: 'coverage',
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      coverageTabAvailable: true,
      showCoverageWorkflow: true,
    });
    expect(next).toEqual({
      kind: 'navigate',
      label: 'Next: Notes',
      navigateTab: 'counselling',
      navigatePhase: 'wrapup',
    });
  });

  it('Decision incomplete stays on phase_next (does not skip to Notes)', () => {
    const next = resolveCounsellingJourneyNext({
      ...base,
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: false, wrapup: false },
      decision: 'NeedsTime',
      coverageTabAvailable: false,
    });
    expect(next?.kind).toBe('phase_next');
    expect(next?.label).toBe('Next: Session Notes');
  });

  it('Back: Notes → Decision for cash', () => {
    expect(
      resolveCounsellingJourneyPrevious({
        activeMainTab: 'counselling',
        activePhase: 'wrapup',
        showCoverageWorkflow: false,
        coverageTabAvailable: false,
      }),
    ).toEqual({ tab: 'counselling', phase: 'decision', finishSummaryActive: false });
  });

  it('Back: Notes → Insurance when coverage tab available', () => {
    expect(
      resolveCounsellingJourneyPrevious({
        activeMainTab: 'counselling',
        activePhase: 'wrapup',
        showCoverageWorkflow: false,
        coverageTabAvailable: true,
      }),
    ).toEqual({ tab: 'coverage', finishSummaryActive: false });
  });

  it('Back: Decision → Quote', () => {
    expect(
      resolveCounsellingJourneyPrevious({
        activeMainTab: 'counselling',
        activePhase: 'decision',
        showCoverageWorkflow: false,
        coverageTabAvailable: false,
      }),
    ).toEqual({ tab: 'counselling', phase: 'estimate', finishSummaryActive: false });
  });
});
