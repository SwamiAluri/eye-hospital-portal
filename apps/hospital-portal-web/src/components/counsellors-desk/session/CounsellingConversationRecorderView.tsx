'use client';

import { AlertTriangle, Loader2, Mic, Pause, Play, Square } from 'lucide-react';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import {
  formatRecordingElapsed,
  recordingPhaseLabel,
  type ConversationRecorderPhase,
} from '@/lib/counsellors-desk/counselling-recording';

export function CounsellingConversationRecorderView({
  phase,
  elapsedSeconds,
  supported,
  errorMessage,
  onStart,
  onPause,
  onResume,
  onStop,
  onRetry,
}: {
  phase: ConversationRecorderPhase;
  elapsedSeconds: number;
  supported: boolean;
  errorMessage: string | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetry: () => void;
}) {
  const label = recordingPhaseLabel(phase);
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="counselling-conversation-recorder"
      data-recording-phase={phase}
      aria-live="polite"
    >
      {phase === 'idle' || phase === 'saved' ? (
        <CounsellingButton
          type="button"
          size="sm"
          variant="primary"
          onClick={onStart}
          disabled={!supported}
          aria-label="Start recording"
          title="Start recording"
          className="h-8 w-8 min-h-8 rounded-full px-0"
        >
          <Mic className="h-4 w-4" aria-hidden />
        </CounsellingButton>
      ) : null}
      {phase === 'recording' && (
        <>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700" role="status">
            <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden />
            {label} {formatRecordingElapsed(elapsedSeconds)}
          </span>
          <CounsellingButton type="button" size="sm" variant="outline" onClick={onPause} aria-label="Pause recording" title="Pause recording" className="h-8 w-8 min-h-8 rounded-full px-0">
            <Pause className="h-3.5 w-3.5" aria-hidden />
          </CounsellingButton>
          <CounsellingButton type="button" size="sm" variant="outline" onClick={onStop} aria-label="Stop recording" title="Stop recording" className="h-8 w-8 min-h-8 rounded-full px-0">
            <Square className="h-3.5 w-3.5" aria-hidden />
          </CounsellingButton>
        </>
      )}
      {phase === 'paused' && (
        <>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" role="status">
            <Pause className="h-3.5 w-3.5" aria-hidden />
            {label} {formatRecordingElapsed(elapsedSeconds)}
          </span>
          <CounsellingButton type="button" size="sm" variant="outline" onClick={onResume} aria-label="Resume recording" title="Resume recording" className="h-8 w-8 min-h-8 rounded-full px-0">
            <Play className="h-3.5 w-3.5" aria-hidden />
          </CounsellingButton>
          <CounsellingButton type="button" size="sm" variant="outline" onClick={onStop} aria-label="Stop recording" title="Stop recording" className="h-8 w-8 min-h-8 rounded-full px-0">
            <Square className="h-3.5 w-3.5" aria-hidden />
          </CounsellingButton>
        </>
      )}
      {phase === 'stopping' && (
        <span className="inline-flex items-center gap-2 text-sm font-medium" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Stopping…
        </span>
      )}
      {phase === 'uploading' && (
        <span className="inline-flex items-center gap-2 text-sm font-medium" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Saving recording…
        </span>
      )}
      {phase === 'failed' && (
        <>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700" role="alert">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Recording failed
          </span>
          <CounsellingButton type="button" size="sm" variant="outline" onClick={onRetry} aria-label="Retry saving recording" className="h-8 min-h-8 px-2">
            Retry
          </CounsellingButton>
        </>
      )}
      {!supported && phase === 'idle' && (
        <span className="text-sm text-counselling-muted-foreground">Recording is not supported in this browser.</span>
      )}
    </div>
  );
}
