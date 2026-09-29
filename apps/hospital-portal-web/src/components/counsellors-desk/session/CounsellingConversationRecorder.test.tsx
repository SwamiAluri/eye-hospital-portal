import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CounsellingConversationRecorderView } from './CounsellingConversationRecorderView';

vi.mock('next/link', () => ({ default: ({ children }: { children: unknown }) => children }));

describe('counselling conversation recorder', () => {
  const view = (phase: 'idle' | 'recording' | 'paused' | 'stopping' | 'uploading' | 'saved' | 'failed') =>
    renderToStaticMarkup(
      createElement(CounsellingConversationRecorderView, {
        phase,
        elapsedSeconds: 65,
        supported: true,
        errorMessage: phase === 'failed' ? 'Recording could not be saved.' : null,
        onStart: () => undefined,
        onPause: () => undefined,
        onResume: () => undefined,
        onStop: () => undefined,
        onRetry: () => undefined,
      }),
    );

  it('idle shows an explicit start action and does not show a live recording', () => {
    const html = view('idle');
    expect(html).toContain('aria-label="Start recording"');
    expect(html).toContain('title="Start recording"');
    expect(html).not.toContain('>Start recording<');
    expect(html).not.toContain('>Start Recording<');
    expect(html).not.toContain('Recording 1:05');
  });

  it('recording shows elapsed time, pause, and stop on the same recording', () => {
    const html = view('recording');
    expect(html).toContain('Recording 1:05');
    expect(html).toContain('Pause recording');
    expect(html).toContain('Stop');
    expect(html).not.toContain('Start recording');
  });

  it('paused recording keeps the captured duration and offers resume or stop', () => {
    const html = view('paused');
    expect(html).toContain('Paused 1:05');
    expect(html).toContain('Resume recording');
    expect(html).toContain('Stop recording');
    expect(html).not.toContain('Start recording');
  });

  it('stopping, saving, saved, and failed states are visible', () => {
    expect(view('stopping')).toContain('Stopping');
    expect(view('uploading')).toContain('Saving recording');
    expect(view('saved')).not.toContain('Recording saved');
    expect(view('saved')).toContain('Start recording');
    expect(view('failed')).toContain('Retry');
    expect(view('failed')).toContain('Recording failed');
    const recorder = readFileSync(resolve(__dirname, './CounsellingConversationRecorder.tsx'), 'utf8');
    expect(recorder).toContain('Recording saved successfully.');
  });

  it('starts recording only from the explicit start handler', () => {
    const src = readFileSync(resolve(__dirname, './CounsellingConversationRecorder.tsx'), 'utf8');
    expect(src).toContain('conversationRecordingStartsAutomatically');
    const withoutStartHandler = src.replace(
      /const handleStart = useCallback\(\(\) => \{[\s\S]*?\}, \[recorder\.startRecording\]\);/,
      '',
    );
    expect(withoutStartHandler).not.toContain('startRecording');
    const page = readFileSync(resolve(__dirname, './CounsellingSessionPageContent.tsx'), 'utf8');
    expect(page).toContain("ctx.queueStatus === 'Processed'");
    expect(page).toContain('ctx.isSessionOwner');
    expect(page).not.toContain('startRecording()');
    const pause = src.match(/const handlePause = \(\) => \{[\s\S]*?\n  \};/);
    expect(pause?.[0]).toContain('pauseRecording()');
    expect(pause?.[0]).not.toContain('startRecording');
    const resume = src.match(/const handleResume = \(\) => \{[\s\S]*?\n  \};/);
    expect(resume?.[0]).toContain('resumeRecording()');
    expect(resume?.[0]).not.toContain('startRecording');
    const stop = src.match(/const handleStop = \(\) => \{[\s\S]*?\n  \};/);
    expect(stop?.[0]).toContain("setPhase('stopping')");
    expect(stop?.[0]).not.toContain('startRecording');
    expect(stop?.[0]).not.toContain('toast.success');
    const hook = readFileSync(resolve(__dirname, '../../../hooks/use-audio-recorder.ts'), 'utf8');
    expect(hook).toContain('mediaRecorderRef.current.pause()');
    expect(hook).toContain('mediaRecorderRef.current.resume()');
    expect(hook).toContain('clearInterval(durationIntervalRef.current)');
    const api = readFileSync(resolve(__dirname, '../../../lib/api/counselling-recording.api.ts'), 'utf8');
    expect(api).toContain('/Counseling/sessions/${input.sessionId}/recordings');
    expect(api).toContain('/recordings/${recordingId}/content');
    expect(api).toContain("responseType: 'blob'");
    expect(api).not.toMatch(/blob\.core\.windows\.net|SharedAccessSignature|AccountKey|sasToken/i);
    const player = readFileSync(resolve(__dirname, './CounsellingRecordingPlayer.tsx'), 'utf8');
    expect(player).toContain('openContent');
    expect(player).toContain('releasePlayback');
    expect(player).not.toMatch(/blob\.core\.windows\.net|SharedAccessSignature/i);
  });
});
