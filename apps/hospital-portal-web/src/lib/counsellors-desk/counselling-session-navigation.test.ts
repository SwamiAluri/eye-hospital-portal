import { describe, expect, it } from 'vitest';
import {
  resolveSessionBackTarget,
  shouldShowSessionBack,
} from './counselling-session-navigation';

describe('resolveSessionBackTarget', () => {
  it('does not leave the session from quote — Close handles exit', () => {
    expect(
      resolveSessionBackTarget({
        activeMainTab: 'counselling',
        activePhase: 'estimate',
        showCoverageWorkflow: true,
      }),
    ).toBeNull();
    expect(
      shouldShowSessionBack({
        activeMainTab: 'counselling',
        activePhase: 'estimate',
        showCoverageWorkflow: true,
      }),
    ).toBe(false);
  });

  it('goes from decision to quote', () => {
    expect(
      resolveSessionBackTarget({
        activeMainTab: 'counselling',
        activePhase: 'decision',
        showCoverageWorkflow: true,
      }),
    ).toEqual({ tab: 'counselling', phase: 'estimate', finishSummaryActive: false });
  });

  it('goes from insurance to decision', () => {
    expect(
      resolveSessionBackTarget({
        activeMainTab: 'coverage',
        activePhase: 'decision',
        showCoverageWorkflow: true,
      }),
    ).toEqual({ tab: 'counselling', phase: 'decision', finishSummaryActive: false });
  });

  it('goes from notes to insurance when coverage workflow is on', () => {
    expect(
      resolveSessionBackTarget({
        activeMainTab: 'counselling',
        activePhase: 'wrapup',
        showCoverageWorkflow: true,
      }),
    ).toEqual({ tab: 'coverage', finishSummaryActive: false });
  });

  it('goes from notes to insurance when coverage tab is viewable even if pre-auth not required', () => {
    expect(
      resolveSessionBackTarget({
        activeMainTab: 'counselling',
        activePhase: 'wrapup',
        showCoverageWorkflow: false,
        coverageTabAvailable: true,
      }),
    ).toEqual({ tab: 'coverage', finishSummaryActive: false });
  });

  it('goes from notes to decision when coverage payment type is not selected', () => {
    expect(
      resolveSessionBackTarget({
        activeMainTab: 'counselling',
        activePhase: 'wrapup',
        showCoverageWorkflow: false,
        coverageTabAvailable: false,
      }),
    ).toEqual({ tab: 'counselling', phase: 'decision', finishSummaryActive: false });
  });

  it('goes from outpatient to notes', () => {
    expect(
      resolveSessionBackTarget({
        activeMainTab: 'outpatient',
        activePhase: 'wrapup',
        showCoverageWorkflow: true,
      }),
    ).toEqual({ tab: 'counselling', phase: 'wrapup', finishSummaryActive: false });
  });

  it('goes from finish summary back to notes', () => {
    expect(
      resolveSessionBackTarget({
        activeMainTab: 'counselling',
        activePhase: 'wrapup',
        showCoverageWorkflow: true,
        finishSummaryActive: true,
      }),
    ).toEqual({ tab: 'counselling', phase: 'wrapup', finishSummaryActive: false });
  });
});
