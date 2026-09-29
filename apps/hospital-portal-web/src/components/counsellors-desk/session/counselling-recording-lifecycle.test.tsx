import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { CounsellingConversationsPanel, CounsellingConversationsView } from './CounsellingConversationsPanel';
import {
  RECORDING_DELETE_SUPPORTED,
  RECORDING_REMINDER_DELAY_MS,
  approvedRetentionLabel,
  conversationArchiveName,
  recordingDownloadKind,
  toggleRecordingSelection,
  recordingNavigationBlock,
  releasePlayback,
  resolveRecorderPhase,
  seekPlaybackTime,
  resolvePlaybackDuration,
  shouldOfferRecordingReminder,
} from '@/lib/counsellors-desk/counselling-recording';

describe('recording playback lifecycle', () => {
  it('seeks backward and forward by 10 seconds within the duration', () => {
    expect(seekPlaybackTime(20, -10, 90)).toBe(10);
    expect(seekPlaybackTime(2, -10, 90)).toBe(0);
    expect(seekPlaybackTime(85, 10, 90)).toBe(90);
  });

  it('keeps the known recording duration when media metadata is not finite', () => {
    expect(resolvePlaybackDuration(Number.POSITIVE_INFINITY, 71)).toBe(71);
    expect(resolvePlaybackDuration(71, 90)).toBe(71);
    expect(resolvePlaybackDuration(Number.NaN, 0)).toBe(0);
  });

  it('shows a failed content load instead of replacing the recording', () => {
    const source = readFileSync(resolve(__dirname, 'CounsellingRecordingPlayer.tsx'), 'utf8');
    expect(source).toContain('openContent(sessionId, recordingId)');
    expect(source).toContain("setError('Recording could not be played.')");
    expect(source).not.toContain('/summary/generate');
  });

  it('stops playback by pausing, clearing the source, and revoking the object URL', () => {
    const calls: string[] = [];
    releasePlayback(
      {
        pause: () => calls.push('pause'),
        removeAttribute: (name) => calls.push(`remove:${name}`),
        load: () => calls.push('load'),
      },
      'blob:local',
      (url) => calls.push(`revoke:${url}`),
    );
    expect(calls).toEqual(['pause', 'remove:src', 'load', 'revoke:blob:local']);
  });
});

describe('recording navigation and reminder', () => {
  it('blocks leaving while recording or saving, and not after a terminal state', () => {
    expect(recordingNavigationBlock('recording')).toBe('recording');
    expect(recordingNavigationBlock('paused')).toBe('recording');
    expect(recordingNavigationBlock('stopping')).toBe('recording');
    expect(recordingNavigationBlock('uploading')).toBe('saving');
    expect(recordingNavigationBlock('saved')).toBeNull();
    expect(recordingNavigationBlock('failed')).toBeNull();
    expect(recordingNavigationBlock('idle')).toBeNull();
  });

  it('offers the reminder once after the delay and not when a recording exists', () => {
    expect(RECORDING_REMINDER_DELAY_MS).toBe(120_000);
    const base = {
      eligible: true,
      elapsedMs: RECORDING_REMINDER_DELAY_MS,
      dismissedKey: null,
      interactionKey: 'none',
      hasRecording: false,
    };
    expect(shouldOfferRecordingReminder({ ...base, elapsedMs: 60_000 })).toBe(false);
    expect(shouldOfferRecordingReminder(base)).toBe(true);
    expect(shouldOfferRecordingReminder({ ...base, hasRecording: true })).toBe(false);
    expect(shouldOfferRecordingReminder({ ...base, dismissedKey: 'none' })).toBe(false);
    expect(shouldOfferRecordingReminder({ ...base, eligible: false })).toBe(false);
  });
});

describe('conversation history presentation', () => {
  const sample = [
    {
      id: 'c1',
      sequenceNumber: 1,
      startedAt: '2026-09-27T03:42:00',
      endedAt: '2026-09-27T04:00:00',
      status: 'Ended',
      createdAt: '2026-09-27T03:42:00',
      counsellorName: 'Amelia',
      recordings: [
        { id: 'r1', createdAt: '2026-09-27T03:42:00', durationSeconds: 30, recordingState: 'Uploaded', transcriptionStatus: 'NotRequested' },
        { id: 'r2', createdAt: '2026-09-27T03:50:00', durationSeconds: 20, recordingState: 'Uploaded', transcriptionStatus: 'NotRequested' },
      ],
    },
    {
      id: 'c2',
      sequenceNumber: 2,
      startedAt: '2026-09-27T09:10:00',
      endedAt: null,
      status: 'Active',
      createdAt: '2026-09-27T09:10:00',
      counsellorName: 'Amelia',
      recordings: [
        { id: 'r3', createdAt: '2026-09-27T09:12:00', durationSeconds: 15, recordingState: 'Uploaded', transcriptionStatus: 'NotRequested' },
      ],
    },
  ];

  it('keeps recordings under their conversation and does not collapse them', () => {
    const now = new Date('2026-09-27T10:00:00');
    const html = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      now,
      playingId: null,
      onPlay: () => undefined,
      conversations: sample,
    }));
    expect(html.indexOf('Conversation 1')).toBeLessThan(html.indexOf('Conversation 2'));
    expect(html).not.toContain('Start recording');
    expect(html).not.toContain('counselling-conversations-header');
    expect(html).not.toContain('>Conversations<');
    expect(html.match(/data-testid="counselling-recording-row"/g)).toHaveLength(3);
    expect(html).not.toContain('data-testid="conversation-transcript-summary"');
    expect(html).not.toContain('data-testid="recording-transcript-state"');
    expect(html).not.toContain('>Transcript<');
    expect(html).not.toContain('AI Summary');
    expect(html).not.toContain('Waiting for transcripts');
    expect(html).not.toContain('Generate Summary');
    expect(html).not.toContain('Transcript Not started · Summary');
    expect(html).toContain('Play');
    expect(html).not.toContain('Playing recording');
    expect(html).not.toContain('data-testid="counselling-recording-player"');
    expect(html).toContain('Recording 1');
    expect(html).toContain('Recording 2');
    expect(html).toContain('Recording 1');
    expect(html.match(/Recording \d/g)).toHaveLength(3);
    expect(html).not.toContain('>Saved<');
    expect(html).not.toContain('Active');
    expect(html).not.toContain('Amelia');
    expect(html).not.toContain('Total ');
    expect(html).not.toContain('recording-selection-toolbar');
    expect(html).toContain('Select recording 1');
    expect(html).not.toContain('Delete recording');
    expect(html).not.toContain('Available until');
    expect(RECORDING_DELETE_SUPPORTED).toBe(true);
    expect(approvedRetentionLabel(undefined)).toBeNull();
    expect(approvedRetentionLabel('not-a-date')).toBeNull();
    expect(html).not.toContain('blob.core.windows.net');
    expect(html).not.toContain('sig=');

    const playingFirst = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      now,
      playingId: 'r1',
      onPlay: () => undefined,
      conversations: sample,
    }));
    expect(playingFirst).toContain('Playing recording 1');
    expect(playingFirst).not.toContain('Playing recording 2');
    expect(playingFirst.match(/Playing recording/g)).toHaveLength(1);

    const playingSecond = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      now,
      playingId: 'r2',
      onPlay: () => undefined,
      conversations: sample,
    }));
    expect(playingSecond).toContain('Playing recording 2');
    expect(playingSecond).not.toContain('Playing recording 1');
    expect(playingSecond.match(/Playing recording/g)).toHaveLength(1);
    expect(playingSecond).not.toContain('Start recording');
    expect(playingSecond.match(/data-testid="counselling-recording-player"/g) ?? []).toHaveLength(0);
    expect(playingSecond).toContain('Playing recording 2');
    expect(playingSecond).not.toContain('counselling-conversations-header');
    expect(playingSecond).not.toContain('data-testid="counselling-recording-details"');
    expect(playingSecond).toContain('data-details-open="false"');
  });

  it('shows an empty history and a failed recording status without a playback url', () => {
    const empty = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      now: new Date('2026-09-27T10:00:00'),
      playingId: null,
      onPlay: () => undefined,
      conversations: [],
    }));
    expect(empty).toContain('No conversations recorded yet.');
    expect(empty).not.toContain('Start recording');
    expect(empty).not.toContain('>Conversations<');
    expect(empty).not.toContain('recording-selection-toolbar');

    const failed = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      now: new Date('2026-09-27T10:00:00'),
      playingId: 'r1',
      onPlay: () => undefined,
      conversations: [{
        id: 'c1',
        sequenceNumber: 1,
        startedAt: '2026-09-27T03:42:00',
        endedAt: null,
        status: 'Active',
        createdAt: '2026-09-27T03:42:00',
        recordings: [
          { id: 'r1', createdAt: '2026-09-27T03:42:00', durationSeconds: null, recordingState: 'Failed', transcriptionStatus: null, contentType: 'audio/webm' },
        ],
      }],
    }));
    expect(failed).toContain('Recording 1');
    expect(failed).toContain('disabled="" aria-disabled="true" type="button" aria-label="Play recording 1"');
    expect(failed).not.toContain('counselling-recording-player');
    expect(failed).not.toContain('Failed');
    expect(failed).not.toContain('data-testid="conversation-transcript-summary"');
    expect(failed).not.toContain('AI Summary');
    expect(failed).not.toContain('Transcript Not started · Summary');
    expect(failed).not.toContain('blob.core.windows.net');
    expect(failed).not.toContain('sig=');
    expect(failed).not.toContain('audio/webm');
  });

  it('loads through GET and keeps API failures generic', () => {
    const loading = renderToStaticMarkup(createElement(CounsellingConversationsPanel, {
      sessionId: 's1',
    }));
    expect(loading).toContain('Loading conversations');

    const api = readFileSync(resolve(__dirname, '../../../lib/api/counselling-recording.api.ts'), 'utf8');
    const list = api.slice(api.indexOf('async list'), api.indexOf('async upload'));
    expect(list).toContain('getApi().get');
    expect(list).toContain('/conversations');
    expect(list).not.toContain('.post(');
    expect(list).not.toContain('fileUrl');
    expect(list).not.toContain('sas');

    const panel = readFileSync(resolve(__dirname, './CounsellingConversationsPanel.tsx'), 'utf8');
    expect(panel).toContain("setError('Conversations could not be loaded.')");
    expect(panel).not.toContain('error.message');
    expect(panel).toContain('setPlayingId');
    expect(panel).not.toContain('AI Summary');
    expect(panel).not.toContain('/summary/generate');

    const player = readFileSync(resolve(__dirname, './CounsellingRecordingPlayer.tsx'), 'utf8');
    expect(player).toContain('releasePlayback');
    expect(player).toContain('Mute');
    expect(player).not.toContain('<audio controls');
    expect(resolveRecorderPhase('paused', 'paused')).toBe('paused');
    expect(resolveRecorderPhase('recording', 'paused')).toBe('paused');
    expect(resolveRecorderPhase('stopping', 'paused')).toBe('stopping');
    const recorder = readFileSync(resolve(__dirname, './CounsellingConversationRecorder.tsx'), 'utf8');
    expect(recorder).toContain('beforeunload');
    expect(recorder).not.toContain('createPortal');
    const page = readFileSync(resolve(__dirname, './CounsellingSessionPageContent.tsx'), 'utf8');
    expect(page).toContain('recordingNavigationBlock');
    expect(page).toContain('recordingAction={canRecordConversation ?');
    const rail = readFileSync(resolve(__dirname, './CounsellingJourneyRail.tsx'), 'utf8');
    expect(rail).toContain('data-testid="counselling-session-recording-action"');
    expect(rail.lastIndexOf('sessionConversations}')).toBeLessThan(
      rail.indexOf('data-testid="counselling-session-recording-action"'),
    );
    expect(rail).toContain('{recordingAction}');
    const apiSource = readFileSync(resolve(__dirname, '../../../lib/api/counselling-recording.api.ts'), 'utf8');
    expect(apiSource).toContain('/recordings/download');
    expect(apiSource).toContain('/recordings/delete');
    expect(apiSource).not.toMatch(/blob\.core\.windows\.net|SharedAccessSignature/i);
  });

  it('selects recordings without playback and clears the whole selection', () => {
    expect(toggleRecordingSelection([], 'r1')).toEqual(['r1']);
    expect(toggleRecordingSelection(['r1'], 'r2')).toEqual(['r1', 'r2']);
    expect(toggleRecordingSelection(['r1', 'r2'], 'r1')).toEqual(['r2']);
    expect(recordingDownloadKind(['r1'])).toBe('file');
    expect(recordingDownloadKind(['r1', 'r2'])).toBe('archive');
    expect(conversationArchiveName(1)).toBe('Counselling-Conversation-1-Recordings.zip');
    expect(conversationArchiveName(null)).toBe('Counselling-Recordings.zip');

    const selected = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      now: new Date('2026-09-27T10:00:00'),
      playingId: null,
      selectedIds: ['r1', 'r2', 'r3'],
      onPlay: () => undefined,
      conversations: sample,
    }));
    expect(selected).toContain('3 selected');
    expect(selected).toContain('Download selected recordings');
    expect(selected).toContain('Delete selected recordings');
    expect(selected).toContain('Clear selection');
    expect(selected).not.toContain('Playing recording');

    const onePlaying = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      now: new Date('2026-09-27T10:00:00'),
      playingId: 'r2',
      selectedIds: ['r1'],
      onPlay: () => undefined,
      conversations: sample,
    }));
    expect(onePlaying).toContain('1 selected');
    expect(onePlaying).toContain('Playing recording 2');
    expect(onePlaying).not.toContain('Playing recording 1');

    const confirming = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      now: new Date('2026-09-27T10:00:00'),
      playingId: null,
      selectedIds: ['r1', 'r2', 'r3'],
      deleteConfirmCount: 3,
      onPlay: () => undefined,
      conversations: sample,
    }));
    const panelSource = readFileSync(resolve(__dirname, './CounsellingConversationsPanel.tsx'), 'utf8');
    expect(panelSource).toContain('Delete ${deleteConfirmCount} recordings?');
    expect(panelSource).toContain('onCancelDelete');
    expect(panelSource).toContain('deleteSelected');
    expect(panelSource).toContain('downloadSelected');
    expect(panelSource).toContain('CounsellingRecordingDetailsSheet');
    expect(confirming).not.toContain('data-testid="counselling-recording-details"');
  });

  it('shows conversation identity, status, duration, count, and counsellor without a second heading', () => {
    const html = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      now: new Date('2026-09-27T10:00:00'),
      playingId: null,
      onPlay: () => undefined,
      conversations: sample,
    }));
    expect(html).toContain('Conversation 1');
    expect(html).toContain('Conversation 2');
    expect(html).not.toContain('Active');
    expect(html).not.toContain('Amelia');
    expect(html).not.toContain('Based on:');
    expect(html).not.toContain('AI Summary');
    expect(html.match(/data-testid="counselling-recording-row"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Play recording 1"');
    expect(html).toContain('aria-label="View recording details"');
    expect(html).toContain('View details');
    expect(html.match(/aria-label="View recording details"/g)).toHaveLength(3);
    expect(html).not.toContain('aria-haspopup="menu"');
    expect(html).not.toContain('Actions for recording');
    expect(html).toContain('data-testid="counselling-conversations-workspace"');
    expect(html).toContain('data-details-open="false"');
    expect(html).toContain('rounded-xl');
    expect(html).not.toContain('lg:grid-cols-5');
    expect(html).not.toContain('data-testid="counselling-recording-details-pane"');
    expect(html).not.toContain('Select a recording');
    expect(html).not.toContain('Total ');
    expect(html).not.toContain('aria-modal');
    expect(html).not.toContain('data-testid="counselling-recording-details"');
    expect(html).not.toContain('Windows');
    expect(html).not.toContain('WhatsApp');
    expect(html).not.toContain('Hospital Portal (Web)');

    const focused = renderToStaticMarkup(createElement(CounsellingConversationsView, {
      now: new Date('2026-09-27T10:00:00'),
      playingId: 'r1',
      detailRecordingId: 'r1',
      onPlay: () => undefined,
      onCloseDetails: () => undefined,
      conversations: sample,
    }));
    expect(focused.match(/data-recording-selected="true"/g)).toHaveLength(1);
    expect(focused).toContain('data-testid="counselling-recording-details"');
    expect(focused).toContain('Counsellor');
    expect(focused).toContain('Amelia');
    expect(focused).toContain('Close recording details');
    expect(focused).toContain('Download recording');
    expect(focused).toContain('Delete recording');
    expect(focused).toContain('Share recording');
    expect(focused).toContain('lg:grid-cols-5');
    expect(focused).toContain('lg:col-span-2');
    expect(focused).toContain('data-details-open="true"');
    expect(focused).not.toContain('Select a recording');
    expect(focused).not.toContain('aria-modal');
    expect(focused).toContain('Playing recording 1');
    expect(focused).not.toContain('Playing recording 2');
  });
});

describe('recording details fields', () => {
  it('uses only supplied session and recording values', async () => {
    const {
      recordingDetailFields,
      recordingPatientFields,
      recordingTechnicalFields,
    } = await import('@/lib/counsellors-desk/counselling-recording');
    const details = recordingDetailFields({
      createdAt: '2026-09-27T03:42:00',
      durationLabel: '0:30',
      counsellorName: 'Amelia',
      conversationLabel: 'Conversation 1',
      status: 'Saved',
      recordingId: 'r1',
    });
    expect(details.map((field) => field.label)).toEqual([
      'Recorded on',
      'Duration',
      'Counsellor',
      'Conversation',
      'Status',
      'Recording ID',
      'Created at',
    ]);
    expect(details.some((field) => field.value === 'r1')).toBe(true);
    expect(details.some((field) => /location|device|browser|file size/i.test(field.label))).toBe(false);

    const patient = recordingPatientFields({
      patientName: 'KCR CM',
      mrn: 'MRN-2026-08-A244A',
      ageLabel: '34 years',
      sex: 'Male',
      eye: 'RE',
    });
    expect(patient.map((field) => field.value)).toEqual(['KCR CM', 'MRN-2026-08-A244A', '34 years · Male', 'RE']);
    expect(recordingPatientFields({}).map((field) => field.label)).toEqual([]);

    const technical = recordingTechnicalFields({
      contentType: 'audio/webm',
      durationLabel: '0:30',
      recordingId: 'r1',
      createdAt: '2026-09-27T03:42:00',
    });
    expect(technical.map((field) => field.label)).toEqual(['Audio format', 'Duration', 'Recording ID', 'Created at']);
    expect(technical.find((field) => field.label === 'Audio format')?.value).toBe('audio/webm');
    expect(technical.some((field) => /windows|chrome|opus|mb/i.test(field.value))).toBe(false);
    const sized = recordingTechnicalFields({
      contentType: 'audio/webm;codecs=opus',
      durationLabel: '0:30',
      recordingId: 'r1',
      createdAt: '2026-09-27T03:42:00',
      fileSizeBytes: 1024,
      updatedAt: '2026-09-27T03:43:00',
    });
    expect(sized.find((field) => field.label === 'Audio format')?.value).toBe('audio/webm (opus)');
    expect(sized.find((field) => field.label === 'File size')?.value).toBe('1.0 KB');
    expect(sized.some((field) => field.label === 'Updated at')).toBe(true);
    expect(sized.some((field) => field.label === 'Device')).toBe(false);

    const sheet = readFileSync(resolve(__dirname, './CounsellingRecordingDetailsSheet.tsx'), 'utf8');
    expect(sheet).toContain('Details');
    expect(sheet).toContain('Patient');
    expect(sheet).toContain('Technical');
    expect(sheet).toContain('Sharing destinations are not available yet');
    expect(sheet).toContain('No recording or patient information was shared');
    expect(sheet).not.toContain('Windows 11');
    expect(sheet).not.toContain('Hospital Portal (Web)');
    expect(sheet).not.toContain('blob.core.windows.net');
    const workspace = readFileSync(resolve(__dirname, './CounsellingConversationsPanel.tsx'), 'utf8');
    expect(workspace).toContain('lg:grid-cols-5');
    expect(workspace).toContain('lg:col-span-3');
    expect(workspace).toContain('lg:col-span-2');
    expect(workspace).toContain("matchMedia('(max-width: 1023px)')");
    expect(workspace).toContain('CounsellingRecordingDetailsPanel');
    const api = readFileSync(resolve(__dirname, '../../../lib/api/counselling-recording.api.ts'), 'utf8');
    expect(api).toContain('fileSizeBytes');
    expect(api).toContain('updatedAt');

    const player = readFileSync(resolve(__dirname, './CounsellingRecordingPlayer.tsx'), 'utf8');
    expect(player).toContain('aria-label="Seek backward 10 seconds"');
    expect(player).toContain('aria-label="Seek forward 10 seconds"');
    expect(player).toContain('Mute');
    expect(player).toContain('releasePlayback');
  });
});
