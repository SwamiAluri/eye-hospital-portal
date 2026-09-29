import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { CounsellingConversationsView } from './CounsellingConversationsPanel';
import {
  shouldPollTranscription,
  transcriptionAction,
  transcriptSpeakerLabel,
  transcriptStatusLabel,
  activeTranscriptSegmentIndex,
  transcriptMatchIndexes,
} from '@/lib/counsellors-desk/counselling-recording';

const conversations = [
  {
    id: 'c1',
    sequenceNumber: 1,
    startedAt: '2026-09-27T03:40:00',
    endedAt: null,
    status: 'Active',
    createdAt: '2026-09-27T03:40:00',
    counsellorName: 'Amelia',
    recordings: [
      { id: 'r1', createdAt: '2026-09-27T03:42:00', durationSeconds: 30, recordingState: 'Uploaded', transcriptionStatus: 'Completed' },
      { id: 'r2', createdAt: '2026-09-27T03:50:00', durationSeconds: 20, recordingState: 'Uploaded', transcriptionStatus: 'InProgress' },
      { id: 'r3', createdAt: '2026-09-27T03:55:00', durationSeconds: 10, recordingState: 'Uploaded', transcriptionStatus: 'NotRequested' },
    ],
  },
];

describe('counselling transcription presentation', () => {
  it('labels each recording without treating the conversation as one transcript', () => {
    const html = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      playingId: null,
      onPlay: () => undefined,
      conversations,
    }));
    expect(html).not.toContain('data-testid="recording-transcript-state"');
    expect(html).not.toContain('Transcript ready');
    expect(html).not.toContain('Transcribing');
    expect(html).not.toContain('data-testid="conversation-summary"');
    expect(html).not.toContain('AI Summary');
    expect(html).not.toContain('Waiting for transcripts');
    expect(html).not.toContain('Generate Summary');
    expect(html).not.toContain('Generating');

    const first = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      playingId: null,
      detailRecordingId: 'r1',
      onPlay: () => undefined,
      onCloseDetails: () => undefined,
      conversations,
    }));
    const firstStatus = first.slice(first.indexOf('data-testid="recording-transcript-status"'), first.indexOf('data-testid="recording-transcript-status"') + 280);
    expect(firstStatus).toContain('data-recording-id="r1"');
    expect(firstStatus).toContain('Transcript ready');
    expect(firstStatus).not.toContain('Transcribing');
    expect(first).not.toContain('AI Summary');

    const second = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      playingId: null,
      detailRecordingId: 'r2',
      onPlay: () => undefined,
      onCloseDetails: () => undefined,
      conversations,
    }));
    const secondStatus = second.slice(second.indexOf('data-testid="recording-transcript-status"'), second.indexOf('data-testid="recording-transcript-status"') + 280);
    expect(secondStatus).toContain('data-recording-id="r2"');
    expect(secondStatus).toContain('Transcribing');
    expect(secondStatus).not.toContain('Transcript ready');
  });

  it('offers start only before transcription and retry only after failure', () => {
    expect(transcriptionAction('NotRequested', 'Uploaded')).toBe('start');
    expect(transcriptionAction('Pending', 'Uploaded')).toBe('none');
    expect(transcriptionAction('InProgress', 'Uploaded')).toBe('none');
    expect(transcriptionAction('Completed', 'Uploaded')).toBe('none');
    expect(transcriptionAction('Failed', 'Uploaded')).toBe('retry');
    expect(transcriptionAction('NotRequested', 'Created')).toBe('none');
    expect(transcriptStatusLabel('Pending')).toBe('Queued');
    expect(transcriptStatusLabel('Failed')).toBe('Transcription failed');
    expect(shouldPollTranscription('Pending')).toBe(true);
    expect(shouldPollTranscription('InProgress')).toBe(true);
    expect(shouldPollTranscription('Completed')).toBe(false);
    expect(shouldPollTranscription('Failed')).toBe(false);

    const ready = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      playingId: null,
      detailRecordingId: 'r1',
      onPlay: () => undefined,
      onCloseDetails: () => undefined,
      onStartTranscription: () => undefined,
      onRetryTranscription: () => undefined,
      transcriptLines: [{ speaker: 'speaker_1', startSeconds: 76, text: 'First recording line' }],
      conversations,
    }));
    expect(ready).not.toContain('Start transcription');
    expect(ready).not.toContain('Retry transcription');
    expect(ready).toContain('First recording line');
    expect(ready).toContain('Search transcript');
    expect(ready).not.toContain('AI Summary');
    const transcript = ready.slice(ready.indexOf('recording-transcript-panel'));
    expect(transcript).toContain('Speaker 1');
    expect(transcript).toContain('1:16');
    expect(transcript).not.toContain('Counsellor');
    expect(transcript).not.toContain('Patient');

    const queued = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      playingId: null,
      detailRecordingId: 'r3',
      onPlay: () => undefined,
      onCloseDetails: () => undefined,
      onStartTranscription: () => undefined,
      conversations,
    }));
    expect(queued).toContain('Start transcription');
    expect(queued).not.toContain('Retry transcription');

    const active = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      playingId: null,
      detailRecordingId: 'r2',
      onPlay: () => undefined,
      onCloseDetails: () => undefined,
      onStartTranscription: () => undefined,
      conversations,
    }));
    expect(active).toContain('Transcribing');
    expect(active).not.toContain('Start transcription');

    const failed = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      playingId: null,
      detailRecordingId: 'r2',
      onPlay: () => undefined,
      onCloseDetails: () => undefined,
      onRetryTranscription: () => undefined,
      transcriptLines: [{ text: 'First recording line' }],
      conversations: [{
        ...conversations[0],
        recordings: [
          { id: 'r2', createdAt: '2026-09-27T03:50:00', durationSeconds: 20, recordingState: 'Uploaded', transcriptionStatus: 'Failed' },
        ],
      }],
    }));
    expect(failed).toContain('Retry transcription');
    expect(failed).toContain('Transcription could not be completed.');
    expect(failed).not.toContain('First recording line');
    expect(failed).not.toContain('AI Summary');
    expect(failed).not.toContain('Generate Summary');
    expect(failed).not.toContain('Not started');
  });

  it('stops polling on terminal states and does not call Azure from the browser', () => {
    expect(transcriptSpeakerLabel('speaker_2')).toBe('Speaker 2');
    expect(transcriptSpeakerLabel('Counsellor')).toBeNull();
    const panel = readFileSync(resolve(__dirname, './CounsellingConversationsPanel.tsx'), 'utf8');
    expect(panel).toContain('shouldPollTranscription');
    expect(panel).toContain('clearInterval');
    expect(panel).toContain('transcriptionApi.getTranscriptionStatus');
    expect(panel).toContain("toast.error('Transcription could not be completed.')");
    expect(panel).not.toContain('window.location');
    expect(panel).not.toContain('cognitive.microsoft');
    expect(panel).not.toContain('openai');
    const api = readFileSync(resolve(__dirname, '../../../lib/api/transcription.api.ts'), 'utf8');
    expect(api).toContain('/transcription/status/');
    expect(api).toContain('/transcription/start/');
    expect(api).toContain('skipForbiddenRedirect: true');
    expect(api).not.toContain('speechtotext');
    const hook = readFileSync(resolve(__dirname, '../../../hooks/use-transcription.ts'), 'utf8');
    expect(hook).toContain("status === 'Pending'");
    expect(hook).not.toContain('Running');
  });

  it('follows playback and finds transcript matches', () => {
    const lines = [
      { startSeconds: 0, endSeconds: 10, text: 'First line' },
      { startSeconds: 10, endSeconds: 20, text: 'Cost concern' },
    ];
    expect(activeTranscriptSegmentIndex(lines, 11)).toBe(1);
    expect(activeTranscriptSegmentIndex([{ text: 'No time' }], 1)).toBe(-1);
    expect(transcriptMatchIndexes(lines, 'cost')).toEqual([1]);
    expect(transcriptMatchIndexes(lines, '   ')).toEqual([]);
    const panel = readFileSync(resolve(__dirname, './CounsellingConversationsPanel.tsx'), 'utf8');
    expect(panel).toContain('onSeekTranscript');
    expect(panel).toContain('setSeekRequest');
  });
});
