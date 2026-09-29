import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CounsellingJourneyRail } from './CounsellingJourneyRail';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';

const activeClass = counsellingSessionTokens.journeyTabCurrent;

function rail(input: {
  contextualDestination?: 'none' | 'patient-context' | 'history' | 'conversations';
  activePhase?: 'estimate' | 'decision' | 'wrapup';
  phaseCompletion?: { estimate: boolean; decision: boolean; wrapup: boolean };
}) {
  return renderToStaticMarkup(createElement(CounsellingJourneyRail, {
    activeMainTab: 'counselling',
    activePhase: input.activePhase ?? 'estimate',
    phaseCompletion: input.phaseCompletion ?? { estimate: false, decision: false, wrapup: false },
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
    canGoToPhase: () => true,
    contextualDestination: input.contextualDestination ?? 'none',
  }));
}

function activeCount(html: string) {
  return html.split('data-workflow-active="true"').length - 1;
}

describe('counselling workflow active tab', () => {
  it('selects only Conversations when that section is current', () => {
    const html = rail({
      contextualDestination: 'conversations',
      activePhase: 'estimate',
      phaseCompletion: { estimate: true, decision: false, wrapup: false },
    });
    expect(activeCount(html)).toBe(1);
    expect(html).toContain('data-workflow-active="true"');
    const conversationsAt = html.indexOf(`aria-label="${counsellingCopy.sessionConversationsAria}"`);
    const conversations = html.slice(conversationsAt, conversationsAt + 500);
    expect(conversations).toContain('data-workflow-active="true"');
    expect(conversations).toContain(activeClass);
    expect(html).toContain('data-testid="counselling-journey-stage-quote"');
    const quote = html.slice(
      html.indexOf('data-testid="counselling-journey-stage-quote"'),
      html.indexOf('data-testid="counselling-journey-stage-decision"'),
    );
    expect(quote).toContain('data-workflow-active="false"');
    expect(quote).not.toContain(activeClass);
    expect(quote).toContain(counsellingSessionTokens.journeyTabComplete);
  });

  it('selects only Quote when that stage is current', () => {
    const html = rail({ contextualDestination: 'none', activePhase: 'estimate' });
    expect(activeCount(html)).toBe(1);
    const quote = html.slice(
      html.indexOf('data-testid="counselling-journey-stage-quote"'),
      html.indexOf('data-testid="counselling-journey-stage-decision"'),
    );
    expect(quote).toContain('data-workflow-active="true"');
    expect(quote).toContain(activeClass);
    const conversations = html.slice(html.lastIndexOf(`aria-label="${counsellingCopy.sessionConversationsAria}"`), html.lastIndexOf(`aria-label="${counsellingCopy.sessionConversationsAria}"`) + 500);
    expect(conversations).toContain('data-workflow-active="false"');
    expect(conversations).not.toContain(activeClass);
  });

  it('selects only Decision when that stage is current', () => {
    const html = rail({
      contextualDestination: 'none',
      activePhase: 'decision',
      phaseCompletion: { estimate: true, decision: false, wrapup: false },
    });
    expect(activeCount(html)).toBe(1);
    const quote = html.slice(
      html.indexOf('data-testid="counselling-journey-stage-quote"'),
      html.indexOf('data-testid="counselling-journey-stage-decision"'),
    );
    const decision = html.slice(
      html.indexOf('data-testid="counselling-journey-stage-decision"'),
      html.indexOf('data-testid="counselling-journey-stage-insurance"'),
    );
    expect(quote).toContain('data-workflow-active="false"');
    expect(quote).not.toContain(activeClass);
    expect(decision).toContain('data-workflow-active="true"');
    expect(decision).toContain(activeClass);
    const conversations = html.slice(html.lastIndexOf(`aria-label="${counsellingCopy.sessionConversationsAria}"`), html.lastIndexOf(`aria-label="${counsellingCopy.sessionConversationsAria}"`) + 500);
    expect(conversations).toContain('data-workflow-active="false"');
  });

  it('keeps Patient Context active from the waiting list without selecting Quote', () => {
    const html = rail({
      contextualDestination: 'patient-context',
      activePhase: 'estimate',
      phaseCompletion: { estimate: false, decision: true, wrapup: false },
    });
    expect(activeCount(html)).toBe(1);
    const patientAt = html.indexOf('aria-label="Patient Context"');
    const patient = html.slice(html.lastIndexOf('<button', patientAt), html.indexOf('>', patientAt));
    expect(patient).toContain('data-workflow-active="true"');
    expect(patient).toContain(activeClass);
    const quote = html.slice(
      html.indexOf('data-testid="counselling-journey-stage-quote"'),
      html.indexOf('data-testid="counselling-journey-stage-decision"'),
    );
    expect(quote).toContain('data-workflow-active="false"');
    expect(quote).not.toContain(activeClass);
    expect(quote).toContain('data-journey-status="current"');
    expect(quote).not.toContain('stroke-width="2.5"');
    const decision = html.slice(
      html.indexOf('data-testid="counselling-journey-stage-decision"'),
      html.indexOf('data-testid="counselling-journey-stage-insurance"'),
    );
    expect(decision).toContain('data-workflow-active="false"');
    expect(decision).not.toContain(activeClass);
    expect(decision).toContain(counsellingSessionTokens.journeyTabComplete);
    expect(decision).toContain('stroke-width="2.5"');
  });
});
