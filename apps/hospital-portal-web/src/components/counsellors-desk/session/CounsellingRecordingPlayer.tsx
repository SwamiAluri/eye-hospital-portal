'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, RotateCw, Square, Volume2, VolumeX } from 'lucide-react';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { counsellingRecordingApi } from '@/lib/api/counselling-recording.api';
import {
  formatRecordingElapsed,
  PLAYBACK_SEEK_STEP_SECONDS,
  releasePlayback,
  seekPlaybackTime,
  resolvePlaybackDuration,
} from '@/lib/counsellors-desk/counselling-recording';

export function CounsellingRecordingPlayer({
  sessionId,
  recordingId,
  knownDurationSeconds,
  controlName = 'recording',
  seekRequest = null,
  onPosition,
}: {
  sessionId: string;
  recordingId: string;
  knownDurationSeconds?: number | null;
  controlName?: string;
  seekRequest?: { seconds: number; token: number } | null;
  onPosition?: (seconds: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(knownDurationSeconds ?? 0);

  useEffect(() => {
    const audio = audioRef.current;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlaying(false);
    setCurrent(0);

    void counsellingRecordingApi.openContent(sessionId, recordingId).then((blob) => {
      if (cancelled || !audio) return;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      audio.src = url;
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setLoading(false);
        setError('Recording could not be played.');
      }
    });

    return () => {
      cancelled = true;
      releasePlayback(audio, urlRef.current, (url) => URL.revokeObjectURL(url));
      urlRef.current = null;
      setPlaying(false);
    };
  }, [sessionId, recordingId]);

  useEffect(() => {
    if (!seekRequest) return;
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    audio.currentTime = seekRequest.seconds;
    setCurrent(seekRequest.seconds);
    onPosition?.(seekRequest.seconds);
    void audio.play().catch(() => undefined);
  }, [seekRequest, onPosition]);

  const seek = (next: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = seekPlaybackTime(0, next, resolvePlaybackDuration(audio.duration, duration));
    audio.currentTime = clamped;
    setCurrent(clamped);
  };

  return (
    <div className="min-w-0 max-w-full" data-testid="counselling-recording-player">
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => {
          setCurrent(event.currentTarget.currentTime);
          onPosition?.(event.currentTarget.currentTime);
        }}
        onDurationChange={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration);
        }}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      {loading ? <p className="text-sm" role="status">Loading recording</p> : null}
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 rounded-full bg-counselling-muted/50 px-2 py-1.5">
        <CounsellingButton
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 min-h-8 w-auto min-w-8 shrink-0 rounded-full px-1.5"
          aria-label="Seek backward 10 seconds"
          title="Seek backward 10 seconds"
          disabled={loading || !!error}
          onClick={() => seek(seekPlaybackTime(current, -PLAYBACK_SEEK_STEP_SECONDS, duration))}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          <span className="text-[10px] font-semibold leading-none">10</span>
        </CounsellingButton>
        <CounsellingButton
          type="button"
          size="sm"
          variant="primary"
          className="h-8 w-8 min-h-8 shrink-0 rounded-full px-0"
          aria-label={playing ? `Pause ${controlName}` : `Play ${controlName}`}
          title={playing ? `Pause ${controlName}` : `Play ${controlName}`}
          disabled={loading || !!error}
          onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            if (audio.paused) void audio.play().catch(() => setError('Recording could not be played.'));
            else audio.pause();
          }}
        >
          {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        </CounsellingButton>
        <CounsellingButton
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 min-h-8 w-auto min-w-8 shrink-0 rounded-full px-1.5"
          aria-label="Seek forward 10 seconds"
          title="Seek forward 10 seconds"
          disabled={loading || !!error}
          onClick={() => seek(seekPlaybackTime(current, PLAYBACK_SEEK_STEP_SECONDS, duration))}
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          <span className="text-[10px] font-semibold leading-none">10</span>
        </CounsellingButton>
        <CounsellingButton
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 min-h-8 shrink-0 rounded-full px-0"
          aria-label="Stop recording playback"
          title="Stop recording playback"
          disabled={loading || !!error}
          onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            audio.pause();
            audio.currentTime = 0;
            setCurrent(0);
            setPlaying(false);
          }}
        >
          <Square className="h-3.5 w-3.5" aria-hidden />
        </CounsellingButton>
        <CounsellingButton
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 min-h-8 shrink-0 rounded-full px-0"
          aria-label={muted ? `Unmute ${controlName}` : `Mute ${controlName}`}
          title={muted ? `Unmute ${controlName}` : `Mute ${controlName}`}
          aria-pressed={muted}
          disabled={loading || !!error}
          onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            audio.muted = !audio.muted;
            setMuted(audio.muted);
          }}
        >
          {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
        </CounsellingButton>
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0)}
          step={0.1}
          value={Math.min(current, duration || 0)}
          aria-label="Recording position"
          aria-valuemin={0}
          aria-valuemax={Math.max(duration, 0)}
          aria-valuenow={Math.min(current, duration || 0)}
          disabled={loading || !!error || duration <= 0}
          className="h-2 min-w-[6rem] flex-1 accent-counselling-primary focus-visible:outline focus-visible:outline-2"
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span className="shrink-0 text-xs tabular-nums text-counselling-muted-foreground" aria-live="polite">
          {formatRecordingElapsed(current)} / {formatRecordingElapsed(duration)}
        </span>
      </div>
    </div>
  );
}
