import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { CounsellingJourneyRail } from '@/components/counsellors-desk/session/CounsellingJourneyRail';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  JOURNEY_STAGE_ORDER,
  buildJourneyRailStages,
  getJourneyStageNavigationTarget,
  isJourneyStageCompleted,
  resolveCurrentJourneyStage,
} from './counselling-journey-rail';
import type { BuildJourneyRailInput } from './counselling-journey-rail';

const baseInput: BuildJourneyRailInput = {
  activeMainTab: 'counselling',
  activePhase: 'estimate',
  phaseCompletion: { estimate: false, decision: false, wrapup: false },
  showCoverageWorkflow: true,
  coverageProgress: {
    uploadedDocCount: 0,
    requiredDocCount: 3,
    ccmsState: 'DRAFT',
    preAuthSubmitted: false,
  },
  queueStatus: 'Processed',
  isRepeatState: false,
  isSurgeryDoneState: false,
  canGoToPhase: (phase) => phase === 'estimate',
};

describe('counselling-journey-rail', () => {
  it('maps current stage from tab and phase', () => {
    expect(resolveCurrentJourneyStage(baseInput)).toBe('quote');
    expect(resolveCurrentJourneyStage({ ...baseInput, activePhase: 'decision' })).toBe('decision');
    expect(resolveCurrentJourneyStage({ ...baseInput, activeMainTab: 'coverage' })).toBe('insurance');
    expect(resolveCurrentJourneyStage({ ...baseInput, activePhase: 'wrapup' })).toBe('notes');
    expect(
      resolveCurrentJourneyStage({
        ...baseInput,
        activePhase: 'wrapup',
        queueStatus: 'Done',
      }),
    ).toBe('notes');
    expect(
      resolveCurrentJourneyStage({
        ...baseInput,
        activePhase: 'wrapup',
        queueStatus: 'Done',
        finishSummaryActive: true,
      }),
    ).toBe('close');
  });

  it('uses macro progress on outpatient tab without mapping to Finish workspace', () => {
    expect(resolveCurrentJourneyStage({ ...baseInput, activeMainTab: 'outpatient' })).toBe('quote');
    expect(
      resolveCurrentJourneyStage({
        ...baseInput,
        activeMainTab: 'outpatient',
        phaseCompletion: { estimate: true, decision: false, wrapup: false },
      }),
    ).toBe('decision');
    expect(
      resolveCurrentJourneyStage({
        ...baseInput,
        activeMainTab: 'outpatient',
        phaseCompletion: { estimate: true, decision: true, wrapup: false },
      }),
    ).toBe('insurance');
    expect(
      resolveCurrentJourneyStage({
        ...baseInput,
        activeMainTab: 'outpatient',
        phaseCompletion: { estimate: true, decision: true, wrapup: true },
        showCoverageWorkflow: false,
      }),
    ).toBe('notes');
  });

  it('does not mark any stage current on outpatient tab', () => {
    const stages = buildJourneyRailStages({
      ...baseInput,
      activeMainTab: 'outpatient',
      activePhase: 'wrapup',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      canGoToPhase: () => true,
    });
    expect(stages.some((s) => s.status === 'current')).toBe(false);
  });

  it('exposes five primary workflow stages with Insurance and Finish labels', () => {
    const stages = buildJourneyRailStages(baseInput);
    expect(JOURNEY_STAGE_ORDER).toEqual(['quote', 'decision', 'insurance', 'notes', 'close']);
    expect(JOURNEY_STAGE_ORDER).not.toContain('history');
    expect(JOURNEY_STAGE_ORDER.join(',')).not.toContain('patient-context');
    expect(JOURNEY_STAGE_ORDER).toHaveLength(5);
    expect(stages.map((s) => s.id)).toEqual(['quote', 'decision', 'insurance', 'notes', 'close']);
    expect(stages.find((s) => s.id === 'insurance')?.label).toBe('Insurance');
    expect(stages.find((s) => s.id === 'notes')?.label).toBe('Notes');
    expect(stages.find((s) => s.id === 'close')?.label).toBe('Finish');
  });

  it('marks insurance as skipped when coverage payment type is not selected', () => {
    const stages = buildJourneyRailStages({
      ...baseInput,
      showCoverageWorkflow: false,
      coverageTabAvailable: false,
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      activePhase: 'wrapup',
    });
    const insurance = stages.find((s) => s.id === 'insurance');
    expect(insurance?.status).toBe('skipped');
  });

  it('keeps insurance viewable when pre-auth is not required but payment is coverage type', () => {
    const stages = buildJourneyRailStages({
      ...baseInput,
      showCoverageWorkflow: false,
      coverageTabAvailable: true,
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      activePhase: 'wrapup',
      queueStatus: 'Done',
      canGoToPhase: () => true,
    });
    const insurance = stages.find((s) => s.id === 'insurance');
    expect(insurance?.status).not.toBe('skipped');
    expect(insurance?.navigable).toBe(true);
    expect(
      isJourneyStageCompleted('insurance', {
        ...baseInput,
        showCoverageWorkflow: false,
        coverageTabAvailable: true,
        phaseCompletion: { estimate: true, decision: true, wrapup: true },
      }),
    ).toBe(true);
  });

  it('marks quote and decision completion from phaseCompletion', () => {
    const stages = buildJourneyRailStages({
      ...baseInput,
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      activePhase: 'decision',
      canGoToPhase: () => true,
    });
    expect(stages.find((s) => s.id === 'quote')?.status).toBe('completed');
    expect(stages.find((s) => s.id === 'decision')?.status).toBe('current');
    expect(isJourneyStageCompleted('quote', {
      ...baseInput,
      phaseCompletion: { estimate: true, decision: false, wrapup: false },
    })).toBe(true);
  });

  it('marks insurance complete after pre-auth submit', () => {
    const stages = buildJourneyRailStages({
      ...baseInput,
      activeMainTab: 'counselling',
      activePhase: 'wrapup',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      coverageProgress: {
        uploadedDocCount: 3,
        requiredDocCount: 3,
        ccmsState: 'PREAUTH_SENT',
        preAuthSubmitted: true,
      },
      canGoToPhase: () => true,
    });
    expect(stages.find((s) => s.id === 'insurance')?.status).toBe('completed');
  });

  it('maps navigation targets to existing tab/phase routes', () => {
    expect(getJourneyStageNavigationTarget('quote')).toEqual({
      tab: 'counselling',
      phase: 'estimate',
      finishSummaryActive: false,
    });
    expect(getJourneyStageNavigationTarget('decision')).toEqual({
      tab: 'counselling',
      phase: 'decision',
      finishSummaryActive: false,
    });
    expect(getJourneyStageNavigationTarget('insurance')).toEqual({
      tab: 'coverage',
      finishSummaryActive: false,
    });
    expect(getJourneyStageNavigationTarget('notes')).toEqual({
      tab: 'counselling',
      phase: 'wrapup',
      finishSummaryActive: false,
    });
    expect(getJourneyStageNavigationTarget('close')).toEqual({
      tab: 'counselling',
      finishSummaryActive: true,
    });
  });

  it('makes completed counselling stages navigable when canGoToPhase allows it', () => {
    const stages = buildJourneyRailStages({
      ...baseInput,
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: true, wrapup: false },
      canGoToPhase: () => true,
    });
    expect(stages.find((s) => s.id === 'decision')?.navigable).toBe(false);
    expect(stages.find((s) => s.id === 'quote')?.navigable).toBe(true);
    expect(stages.find((s) => s.id === 'notes')?.navigable).toBe(true);
    expect(stages.find((s) => s.id === 'close')?.navigable).toBe(false);
  });

  it('makes Finish navigable after counselling is completed', () => {
    const stages = buildJourneyRailStages({
      ...baseInput,
      queueStatus: 'Done',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      canGoToPhase: () => true,
    });
    expect(stages.find((s) => s.id === 'close')?.navigable).toBe(true);
  });

  it('keeps cross-tab journey navigation from coverage tab when canGoToPhase allows it', () => {
    const stages = buildJourneyRailStages({
      ...baseInput,
      activeMainTab: 'coverage',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      canGoToPhase: () => true,
    });
    expect(stages.find((s) => s.id === 'quote')?.navigable).toBe(true);
    expect(stages.find((s) => s.id === 'decision')?.navigable).toBe(true);
    expect(stages.find((s) => s.id === 'notes')?.navigable).toBe(true);
    expect(stages.find((s) => s.id === 'close')?.navigable).toBe(false);
  });

  it('does not mark completed stages navigable when canGoToPhase disagrees', () => {
    const stages = buildJourneyRailStages({
      ...baseInput,
      activeMainTab: 'coverage',
      phaseCompletion: { estimate: true, decision: true, wrapup: true },
      canGoToPhase: (phase) => phase === 'estimate',
    });
    expect(stages.find((s) => s.id === 'decision')?.status).toBe('completed');
    expect(stages.find((s) => s.id === 'decision')?.navigable).toBe(false);
    expect(stages.find((s) => s.id === 'notes')?.navigable).toBe(false);
  });

  it('blocks navigation in repeat and surgery-done states except Finish', () => {
    const repeatStages = buildJourneyRailStages({
      ...baseInput,
      isRepeatState: true,
      queueStatus: 'RepeatCounselling',
      canGoToPhase: () => true,
    });
    expect(repeatStages.filter((s) => s.id !== 'close').every((s) => !s.navigable)).toBe(true);
    expect(repeatStages.find((s) => s.id === 'close')?.navigable).toBe(true);

    const doneStages = buildJourneyRailStages({
      ...baseInput,
      isSurgeryDoneState: true,
      queueStatus: 'SurgeryDone',
      canGoToPhase: () => true,
    });
    expect(doneStages.filter((s) => s.id !== 'close').every((s) => !s.navigable)).toBe(true);
    expect(doneStages.find((s) => s.id === 'close')?.navigable).toBe(true);
  });
});

function openingTag(html: string, marker: string): string {
  const at = html.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf('<', at), html.indexOf('>', at) + 1);
}

describe('contextual destinations are not journey steps', () => {
  function renderDestination(destination: 'patient-context' | 'history') {
    return renderToStaticMarkup(
      createElement(CounsellingJourneyRail, { ...baseInput, contextualDestination: destination }),
    );
  }

  it('keeps aria-current on the certified stage when Patient Context or History is selected', () => {
    expect(JOURNEY_STAGE_ORDER).toEqual(['quote', 'decision', 'insurance', 'notes', 'close']);

    for (const destination of ['patient-context', 'history'] as const) {
      const html = renderDestination(destination);
      const patientTag = openingTag(html, 'aria-label="Patient Context"');
      const historyTag = openingTag(html, `aria-label="${counsellingCopy.sessionHistoryAria}"`);
      const quoteTag = openingTag(html, `data-testid="${counsellingTestIds.journeyStage('quote')}"`);

      expect(patientTag).not.toContain('aria-current');
      expect(historyTag).not.toContain('aria-current');
      expect(patientTag).not.toContain('data-journey-status');
      expect(historyTag).not.toContain('data-journey-status');
      expect(html.match(/data-journey-status=/g)).toHaveLength(5);
      expect(html.match(/data-testid="counselling-journey-stage-/g)).toHaveLength(5);
      expect(quoteTag).toContain('data-journey-status="current"');
      const quoteStart = html.indexOf(`data-testid="${counsellingTestIds.journeyStage('quote')}"`);
      const decisionStart = html.indexOf(`data-testid="${counsellingTestIds.journeyStage('decision')}"`);
      const quoteStage = html.slice(quoteStart, decisionStart);
      expect(quoteStage).toContain('aria-current="step"');
      expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    }
  });
});
