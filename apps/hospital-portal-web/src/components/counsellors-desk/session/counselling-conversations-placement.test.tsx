import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CounsellingJourneyRail } from './CounsellingJourneyRail';
import { CounsellingConversationRecorderView } from './CounsellingConversationRecorderView';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';

const railProps = {
  activeMainTab: 'counselling' as const,
  activePhase: 'estimate' as const,
  phaseCompletion: { estimate: false, decision: false, wrapup: false },
  showCoverageWorkflow: true,
  coverageProgress: {
    uploadedDocCount: 0,
    requiredDocCount: 3,
    ccmsState: 'DRAFT' as const,
    preAuthSubmitted: false,
  },
  queueStatus: 'Processed' as const,
  isRepeatState: false,
  isSurgeryDoneState: false,
  canGoToPhase: () => true,
};

function railHtml(destination: 'none' | 'patient-context' | 'history' | 'conversations' = 'none') {
  return renderToStaticMarkup(createElement(CounsellingJourneyRail, {
    ...railProps,
    contextualDestination: destination,
  }));
}

function recordingControl() {
  return createElement(CounsellingConversationRecorderView, {
    phase: 'idle',
    elapsedSeconds: 0,
    supported: true,
    errorMessage: null,
    onStart: () => undefined,
    onPause: () => undefined,
    onResume: () => undefined,
    onStop: () => undefined,
    onRetry: () => undefined,
  });
}

function railWithControl(destination: 'none' | 'patient-context' | 'history' | 'conversations') {
  return renderToStaticMarkup(createElement(CounsellingJourneyRail, {
    ...railProps,
    contextualDestination: destination,
    recordingAction: recordingControl(),
  }));
}

describe('counselling conversations placement', () => {
  const page = readFileSync(resolve(__dirname, './CounsellingSessionPageContent.tsx'), 'utf8');

  it('renders Conversations in the workflow navigation', () => {
    const html = railHtml('none');
    expect(html).toContain(counsellingCopy.sessionConversations);
    expect(html).toContain(`aria-label="${counsellingCopy.sessionConversationsAria}"`);
    const conversationsAt = html.indexOf(`aria-label="${counsellingCopy.sessionConversationsAria}"`);
    expect(html.indexOf(`aria-label="${counsellingCopy.sessionHistoryAria}"`)).toBeLessThan(conversationsAt);
    expect(html).toContain('Patient Context');
    expect(html).toContain('Quote');
    expect(html).toContain('Decision');
    expect(html).toContain('Insurance');
    expect(html).toContain('Finish');
  });

  it('selects Conversations from the existing workflow destination', () => {
    const html = railHtml('conversations');
    const at = html.indexOf(`aria-label="${counsellingCopy.sessionConversationsAria}"`);
    const button = html.slice(html.lastIndexOf('<button', at), html.indexOf('>', at));
    expect(button).toContain('data-workflow-active="true"');
    expect(page).toContain("setContextualDestination('conversations')");
    expect(page).toContain("ctx.sessionFrom === 'waiting-list'");
    expect(page).toContain("? 'patient-context'");
  });

  it('renders conversation content only when Conversations is the destination', () => {
    expect(page).toContain("contextualDestination === 'conversations'");
    expect(page).toContain('<CounsellingConversationsPanel');
    expect(page).toContain("contextualDestination === 'patient-context'");
    expect(page).toContain('<ClinicalRecommendationsContent');
  });

  it('places one icon-only recording control in the workflow rail when Conversations is active', () => {
    const html = railWithControl('conversations');
    const conversationsAt = html.indexOf(`aria-label="${counsellingCopy.sessionConversationsAria}"`);
    const actionAt = html.indexOf('data-testid="counselling-session-recording-action"');
    const cardAt = html.indexOf('data-testid="counselling-conversation-card"');
    expect(actionAt).toBeGreaterThan(conversationsAt);
    expect(cardAt).toBe(-1);
    expect(html.match(/data-testid="counselling-conversation-recorder"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Start recording"');
    expect(html).toContain('title="Start recording"');
    expect(html).not.toContain('>Start Recording<');
    expect(html).not.toContain('>Start recording<');
  });

  it('hides the recording control when the session cannot record', () => {
    const html = railHtml('patient-context');
    expect(html).not.toContain('aria-label="Start recording"');
    const panel = readFileSync(resolve(__dirname, './CounsellingConversationsPanel.tsx'), 'utf8');
    expect(panel).not.toContain('CounsellingConversationRecorder');
    expect(panel).not.toContain('>Conversations<');
    const pageText = page;
    expect(pageText).toContain('recordingAction={canRecordConversation ?');
    expect(pageText).not.toContain("contextualDestination === 'conversations' && recordingVersion");
    expect(pageText.match(/<CounsellingConversationRecorder/g)).toHaveLength(1);
  });

  it('keeps one icon-only recording control on every counselling workflow', () => {
    for (const destination of ['patient-context', 'none', 'history', 'conversations'] as const) {
      const html = railWithControl(destination === 'none' ? 'none' : destination);
      expect(html.match(/data-testid="counselling-conversation-recorder"/g)).toHaveLength(1);
      expect(html).toContain('aria-label="Start recording"');
      expect(html).not.toContain('>Start Recording<');
      expect(html).not.toContain('data-testid="counselling-conversation-card"');
    }
  });

  it('keeps recording handlers on the existing recorder', () => {
    const recorder = readFileSync(resolve(__dirname, './CounsellingConversationRecorder.tsx'), 'utf8');
    expect(recorder).toContain('useAudioRecorder');
    expect(recorder).toContain('pauseRecording');
    expect(recorder).toContain('resumeRecording');
    expect(recorder).toContain('stopRecording');
    expect(recorder).toContain('onPause={handlePause}');
    expect(page).toContain('onPhaseChange={setRecordingPhase}');
    expect(page).toContain('recordingNavigationBlock');
  });

  it('keeps Patient Context and the other workflow stages selectable', () => {
    const html = railHtml('patient-context');
    const patientAt = html.indexOf('aria-label="Patient Context"');
    const patient = html.slice(html.lastIndexOf('<button', patientAt), html.indexOf('>', patientAt));
    expect(patient).toContain('data-workflow-active="true"');
    const conversationsAt = html.indexOf(`aria-label="${counsellingCopy.sessionConversationsAria}"`);
    const conversations = html.slice(html.lastIndexOf('<button', conversationsAt), html.indexOf('>', conversationsAt));
    expect(conversations).toContain('data-workflow-active="false"');
    expect(html.match(/data-journey-status=/g)).toHaveLength(5);
    expect(html).toContain('aria-label="Go to Quote"');
  });
});
