'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CounsellingConversationRecorderView } from '@/components/counsellors-desk/session/CounsellingConversationRecorderView';
import { counsellingRecordingApi } from '@/lib/api/counselling-recording.api';
import {
  conversationRecordingStartsAutomatically,
  extensionForAudioType,
  interactionHasRecording,
  interactionReminderKey,
  RECORDING_REMINDER_DELAY_MS,
  recordingNavigationBlock,
  resolveRecorderPhase,
  shouldOfferRecordingReminder,
  type ConversationRecorderPhase,
} from '@/lib/counsellors-desk/counselling-recording';
import { getSessionConcurrencyMessage, isSessionConcurrencyConflict } from '@/lib/counsellors-desk/session-concurrency';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';

const REMINDER_COPY = 'No conversation recording started. Start recording if you want to capture this conversation.';

export function CounsellingConversationRecorder({
  sessionId,
  expectedVersion,
  onPhaseChange,
  onSaved,
  onRegisterStart,
}: {
  sessionId: string;
  expectedVersion: number;
  onPhaseChange?: (phase: ConversationRecorderPhase) => void;
  onSaved?: () => void;
  onRegisterStart?: (start: () => void) => void;
}) {
  const recorder = useAudioRecorder();
  const [phase, setPhase] = useState<ConversationRecorderPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingBlob = useRef<Blob | null>(null);
  const uploadedBlob = useRef<Blob | null>(null);
  const uploadStarted = useRef<Blob | null>(null);
  const announcedSaves = useRef(new WeakSet<Blob>());
  const saveToastSeq = useRef(0);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const openedAt = useRef(Date.now());

  const uploadBlob = useCallback(async (blob: Blob, durationSeconds: number) => {
    if (uploadStarted.current === blob) return;
    uploadStarted.current = blob;
    pendingBlob.current = blob;
    setPhase('uploading');
    setErrorMessage(null);
    try {
      await counsellingRecordingApi.upload({
        sessionId,
        audio: blob,
        fileName: `recording.${extensionForAudioType(blob.type || 'audio/webm')}`,
        durationSeconds,
        version: expectedVersion,
      });
      uploadedBlob.current = blob;
      setPhase('saved');
      if (!announcedSaves.current.has(blob)) {
        announcedSaves.current.add(blob);
        saveToastSeq.current += 1;
        toast.success('Recording saved successfully.', {
          id: `counselling-recording-saved-${sessionId}-${saveToastSeq.current}`,
        });
        onSavedRef.current?.();
      }
    } catch (error) {
      setPhase('failed');
      const message = isSessionConcurrencyConflict(error)
        ? getSessionConcurrencyMessage(error)
        : 'Recording could not be saved.';
      setErrorMessage(message);
      toast.error(message);
    }
  }, [expectedVersion, sessionId]);

  useEffect(() => {
    if (conversationRecordingStartsAutomatically) return;
    if (phase !== 'uploading' && phase !== 'stopping') return;
    if (recorder.state !== 'stopped' || !recorder.audioBlob) return;
    if (uploadedBlob.current === recorder.audioBlob) return;
    void uploadBlob(recorder.audioBlob, recorder.duration);
  }, [phase, recorder.audioBlob, recorder.duration, recorder.state, uploadBlob]);

  const handleStart = useCallback(() => {
    setErrorMessage(null);
    pendingBlob.current = null;
    uploadStarted.current = null;
    void recorder.startRecording();
    setPhase('recording');
  }, [recorder.startRecording]);

  const handlePause = () => {
    recorder.pauseRecording();
    setPhase('paused');
  };

  const handleResume = () => {
    recorder.resumeRecording();
    setPhase('recording');
  };

  const handleStop = () => {
    recorder.stopRecording();
    setPhase('stopping');
  };

  const handleRetry = () => {
    const blob = pendingBlob.current ?? recorder.audioBlob;
    if (!blob) return;
    uploadStarted.current = null;
    void uploadBlob(blob, recorder.duration);
  };

  const visiblePhase = resolveRecorderPhase(phase, recorder.state);

  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  const reportedPhase = useRef<ConversationRecorderPhase | null>(null);

  useEffect(() => {
    if (reportedPhase.current === visiblePhase) return;
    reportedPhase.current = visiblePhase;
    onPhaseChangeRef.current?.(visiblePhase);
  }, [visiblePhase]);

  useEffect(() => {
    onRegisterStart?.(handleStart);
  }, [handleStart, onRegisterStart]);

  useEffect(() => {
    const block = recordingNavigationBlock(visiblePhase);
    if (!block) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [visiblePhase]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void counsellingRecordingApi.list(sessionId).then((history) => {
        if (cancelled || visiblePhase !== 'idle') return;
        const key = interactionReminderKey(history.conversations);
        const storageKey = `counselling-recording-reminder:${sessionId}`;
        const dismissedKey = window.sessionStorage.getItem(storageKey);
        if (!shouldOfferRecordingReminder({
          eligible: true,
          elapsedMs: Date.now() - openedAt.current,
          dismissedKey,
          interactionKey: key,
          hasRecording: interactionHasRecording(history.conversations),
        })) return;
        toast.custom((t) => (
          <div className="rounded-md border border-counselling-border bg-white px-3 py-2 text-sm shadow-sm" role="status">
            <p>{REMINDER_COPY}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-md border px-2 py-1"
                onClick={() => {
                  toast.dismiss(t.id);
                  window.sessionStorage.setItem(storageKey, key);
                  handleStart();
                }}
              >
                Start Recording
              </button>
              <button
                type="button"
                className="rounded-md border px-2 py-1"
                onClick={() => {
                  toast.dismiss(t.id);
                  window.sessionStorage.setItem(storageKey, key);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ), { duration: Infinity, id: `recording-reminder-${sessionId}-${key}` });
      }).catch(() => undefined);
    }, RECORDING_REMINDER_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [handleStart, sessionId, visiblePhase]);

  const status = (
    <CounsellingConversationRecorderView
      phase={visiblePhase}
      elapsedSeconds={recorder.duration}
      supported={recorder.isSupported}
      errorMessage={errorMessage}
      onStart={handleStart}
      onPause={handlePause}
      onResume={handleResume}
      onStop={handleStop}
      onRetry={handleRetry}
    />
  );

  return status;
}
