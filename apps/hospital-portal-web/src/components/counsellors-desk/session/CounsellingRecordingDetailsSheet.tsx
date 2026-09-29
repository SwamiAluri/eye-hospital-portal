'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Share2, Trash2, X } from 'lucide-react';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import {
  CounsellingDialog,
  CounsellingDialogContent,
  CounsellingDialogDescription,
  CounsellingDialogHeader,
  CounsellingDialogTitle,
  CounsellingSheet,
  CounsellingSheetContent,
} from '@/components/counsellors-desk/session/primitives';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';
import {
  activeTranscriptSegmentIndex,
  formatRecordingElapsed,
  formatTranscriptTimestamp,
  recordingDetailFields,
  recordingPatientFields,
  recordingStateLabel,
  recordingTechnicalFields,
  transcriptionAction,
  transcriptMatchIndexes,
  transcriptSpeakerLabel,
  transcriptStatusLabel,
  type RecordingPatientFieldsInput,
} from '@/lib/counsellors-desk/counselling-recording';

type DetailTab = 'details' | 'patient' | 'technical';

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'patient', label: 'Patient' },
  { id: 'technical', label: 'Technical' },
];

export interface CounsellingRecordingDetailsModel {
  id: string;
  createdAt: string;
  durationSeconds?: number | null;
  contentType?: string | null;
  fileSizeBytes?: number | null;
  updatedAt?: string | null;
  recordingState: string;
  transcriptionStatus?: string | null;
}

export interface TranscriptLineView {
  speaker?: string | null;
  startSeconds?: number | null;
  endSeconds?: number | null;
  text: string;
}

const footerButton = 'h-8 min-h-8 px-2';

function TranscriptBlock({
  recording,
  lines,
  loading,
  busy,
  playbackSeconds,
  onStart,
  onRetry,
  onSeek,
}: {
  recording: CounsellingRecordingDetailsModel;
  lines: TranscriptLineView[] | null;
  loading: boolean;
  busy: boolean;
  playbackSeconds?: number | null;
  onStart?: () => void;
  onRetry?: () => void;
  onSeek?: (seconds: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [matchCursor, setMatchCursor] = useState(0);
  const activeRef = useRef<HTMLLIElement | null>(null);
  const action = transcriptionAction(recording.transcriptionStatus, recording.recordingState);
  const label = transcriptStatusLabel(recording.transcriptionStatus);
  const matches = lines ? transcriptMatchIndexes(lines, query) : [];
  const activeIndex = lines && playbackSeconds != null
    ? activeTranscriptSegmentIndex(lines, playbackSeconds)
    : -1;
  const currentMatch = matches.length === 0 ? -1 : matches[matchCursor % matches.length];

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const seekMatch = (index: number) => {
    const line = lines?.[index];
    if (line?.startSeconds == null) return;
    onSeek?.(line.startSeconds);
  };

  return (
    <div className="mt-4 border-t border-counselling-border pt-3" data-testid="recording-transcript-panel">
      <h4 className="text-xs font-medium text-counselling-foreground">Transcript</h4>
      <p
        className="mt-0.5 text-xs text-counselling-muted-foreground"
        role="status"
        data-testid="recording-transcript-status"
        data-recording-id={recording.id}
      >
        {busy ? 'Starting' : label}
      </p>
      {action === 'start' && onStart ? (
        <CounsellingButton type="button" size="sm" variant="outline" className="mt-2 h-8 min-h-8" disabled={busy} onClick={onStart}>
          Start transcription
        </CounsellingButton>
      ) : null}
      {action === 'retry' && onRetry ? (
        <CounsellingButton type="button" size="sm" variant="outline" className="mt-2 h-8 min-h-8" disabled={busy} onClick={onRetry}>
          Retry transcription
        </CounsellingButton>
      ) : null}
      {loading ? <p className="mt-2 text-sm text-counselling-muted-foreground">Loading transcript</p> : null}
      {recording.transcriptionStatus === 'Failed' ? (
        <p className="mt-2 text-sm text-counselling-foreground">Transcription could not be completed.</p>
      ) : null}
      {recording.transcriptionStatus === 'Completed' && lines && lines.length > 0 ? (
        <div className="mt-2">
          <label className="block text-xs text-counselling-muted-foreground" htmlFor={`transcript-search-${recording.id}`}>
            Search transcript
          </label>
          <input
            id={`transcript-search-${recording.id}`}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setMatchCursor(0);
            }}
            className="mt-1 h-8 w-full rounded-md border border-counselling-border bg-counselling-card px-2 text-sm"
            aria-label="Search transcript"
          />
          {query.trim() ? (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-xs text-counselling-muted-foreground" role="status">
                {matches.length === 0 ? '0 matches' : `${matchCursor % matches.length + 1} of ${matches.length}`}
              </p>
              <button type="button" className="text-xs underline" aria-label="Previous match" onClick={() => {
                const next = matches.length === 0 ? 0 : (matchCursor - 1 + matches.length) % matches.length;
                setMatchCursor(next);
                seekMatch(matches[next]);
              }}>Previous</button>
              <button type="button" className="text-xs underline" aria-label="Next match" onClick={() => {
                const next = matches.length === 0 ? 0 : (matchCursor + 1) % matches.length;
                setMatchCursor(next);
                seekMatch(matches[next]);
              }}>Next</button>
            </div>
          ) : null}
          <ol className="mt-2 max-h-64 space-y-2 overflow-y-auto">
            {lines.map((line, index) => {
              const speaker = transcriptSpeakerLabel(line.speaker);
              const time = formatTranscriptTimestamp(line.startSeconds);
              const active = index === activeIndex;
              return (
                <li
                  key={`${index}-${line.text.slice(0, 12)}`}
                  ref={active ? activeRef : undefined}
                  data-testid="transcript-segment"
                  data-active={active ? 'true' : 'false'}
                  className={`text-sm text-counselling-foreground ${active ? 'rounded-md bg-counselling-primary/10 px-2 py-1' : ''}`}
                >
                  {line.startSeconds == null ? (
                    <span>{line.text}</span>
                  ) : (
                    <button
                      type="button"
                      className="text-left"
                      aria-current={active ? 'true' : undefined}
                      aria-label={`Seek transcript to ${time ?? line.startSeconds}`}
                      onClick={() => onSeek?.(line.startSeconds as number)}
                    >
                      {speaker || time ? (
                        <span className="mr-2 text-xs text-counselling-muted-foreground">
                          {[speaker, time].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                      <span className={index === currentMatch ? 'bg-counselling-primary/20' : undefined}>{line.text}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export function CounsellingRecordingDetailsPanel({
  title,
  recording,
  conversationLabel,
  counsellorName,
  sessionLabel,
  patient,
  transcriptLines = null,
  transcriptLoading = false,
  transcriptionBusy = false,
  playbackSeconds = null,
  onSeekTranscript,
  onStartTranscription,
  onRetryTranscription,
  onDownload,
  onDelete,
  onClose,
}: {
  title: string;
  recording: CounsellingRecordingDetailsModel;
  conversationLabel: string;
  counsellorName?: string | null;
  sessionLabel?: string | null;
  patient?: RecordingPatientFieldsInput | null;
  transcriptLines?: TranscriptLineView[] | null;
  transcriptLoading?: boolean;
  transcriptionBusy?: boolean;
  playbackSeconds?: number | null;
  onSeekTranscript?: (seconds: number) => void;
  onStartTranscription?: () => void;
  onRetryTranscription?: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('details');
  const [shareOpen, setShareOpen] = useState(false);
  const durationLabel = recording.durationSeconds == null
    ? '—'
    : formatRecordingElapsed(recording.durationSeconds);
  const status = recordingStateLabel(recording.recordingState);
  const details = recordingDetailFields({
    createdAt: recording.createdAt,
    durationLabel,
    counsellorName,
    conversationLabel,
    sessionLabel,
    status,
    recordingId: recording.id,
    updatedAt: recording.updatedAt,
  });
  const technical = recordingTechnicalFields({
    contentType: recording.contentType,
    durationLabel,
    recordingId: recording.id,
    createdAt: recording.createdAt,
    fileSizeBytes: recording.fileSizeBytes,
    updatedAt: recording.updatedAt,
  });
  const patientFields = recordingPatientFields(patient ?? {});
  const fields = tab === 'patient' ? patientFields : tab === 'technical' ? technical : details;

  const moveTab = (direction: 1 | -1) => {
    const index = tabs.findIndex((item) => item.id === tab);
    const next = tabs[(index + direction + tabs.length) % tabs.length];
    setTab(next.id);
  };

  return (
    <section
      className={cn(counsellingSessionTokens.sessionWidget, 'flex h-full min-h-[16rem] flex-col overflow-hidden')}
      data-testid="counselling-recording-details"
      aria-label={`${title} details`}
    >
      <header className="flex items-start justify-between gap-2 border-b border-counselling-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-counselling-foreground">{title}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-counselling-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${status === 'Saved' ? 'bg-emerald-600' : 'bg-counselling-muted-foreground'}`} aria-hidden />
            <span>{status} · {durationLabel}</span>
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-counselling-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
            aria-label="Close recording details"
            title="Close recording details"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </header>
      <div
        className="flex gap-1 border-b border-counselling-border px-3"
        role="tablist"
        aria-label="Recording information"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            moveTab(1);
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            moveTab(-1);
          }
        }}
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`recording-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`recording-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            className={`min-h-9 border-b-2 px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40 ${
              tab === item.id
                ? 'border-counselling-primary font-medium text-counselling-foreground'
                : 'border-transparent text-counselling-muted-foreground'
            }`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
        role="tabpanel"
        id={`recording-panel-${tab}`}
        aria-labelledby={`recording-tab-${tab}`}
      >
        {fields.length === 0 ? (
          <p className="text-sm text-counselling-muted-foreground">No additional information is available.</p>
        ) : (
          <dl className="space-y-3">
            {fields.map((field) => (
              <div key={field.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-sm">
                <dt className="text-counselling-muted-foreground">{field.label}</dt>
                <dd className="break-all text-counselling-foreground">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <TranscriptBlock
          recording={recording}
          lines={transcriptLines}
          loading={transcriptLoading}
          busy={transcriptionBusy}
          playbackSeconds={playbackSeconds}
          onSeek={onSeekTranscript}
          onStart={onStartTranscription}
          onRetry={onRetryTranscription}
        />
      </div>
      <div className="flex flex-wrap gap-2 border-t border-counselling-border px-3 py-3">
        <CounsellingButton type="button" size="sm" variant="outline" className={footerButton} aria-label="Download recording" title="Download recording" onClick={onDownload}>
          <Download className="mr-1 h-4 w-4" aria-hidden />
          Download
        </CounsellingButton>
        <CounsellingButton type="button" size="sm" variant="outline" className={footerButton} aria-label="Delete recording" title="Delete recording" onClick={onDelete}>
          <Trash2 className="mr-1 h-4 w-4" aria-hidden />
          Delete
        </CounsellingButton>
        <CounsellingButton
          type="button"
          size="sm"
          variant="outline"
          className={footerButton}
          aria-label="Share recording"
          title="Share recording"
          onClick={() => setShareOpen(true)}
        >
          <Share2 className="mr-1 h-4 w-4" aria-hidden />
          Share
        </CounsellingButton>
      </div>
      {shareOpen ? (
        <CounsellingDialog open onOpenChange={setShareOpen}>
          <CounsellingDialogContent>
            <CounsellingDialogHeader>
              <CounsellingDialogTitle>Share recording</CounsellingDialogTitle>
              <CounsellingDialogDescription>
                Sharing destinations are not available yet. No recording or patient information was shared.
              </CounsellingDialogDescription>
            </CounsellingDialogHeader>
          </CounsellingDialogContent>
        </CounsellingDialog>
      ) : null}
    </section>
  );
}

/** Narrow viewports only. Desktop uses the in-workspace panel so the conversation stays visible. */
export function CounsellingRecordingDetailsSheet({
  open,
  onOpenChange,
  ...panel
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & Omit<Parameters<typeof CounsellingRecordingDetailsPanel>[0], 'onClose'>) {
  return (
    <CounsellingSheet open={open} onOpenChange={onOpenChange}>
      <CounsellingSheetContent side="right" className="counsellor-scrollbar w-full gap-0 overflow-hidden p-0 sm:max-w-md">
        <CounsellingRecordingDetailsPanel {...panel} onClose={() => onOpenChange(false)} />
      </CounsellingSheetContent>
    </CounsellingSheet>
  );
}
