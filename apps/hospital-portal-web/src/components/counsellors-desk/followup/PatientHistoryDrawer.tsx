'use client';

import { useEffect, useState } from 'react';
import { X, Phone, MessageSquare, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

interface HistoryEntry {
  id: string;
  channel: string;
  direction: string;
  outcome: string | null;
  communicationAt: string;
  messageBody: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  callDurationMinutes: number | null;
}

interface PatientHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  patientName: string;
}

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  Phone: <Phone className="w-4 h-4" />,
  WhatsApp: <MessageSquare className="w-4 h-4 text-emerald-700" />,
  SMS: <MessageSquare className="w-4 h-4 text-counselling-primary" />,
};

const OUTCOME_COLOR: Record<string, string> = {
  Answered: counsellingSessionTokens.statusPillComplete,
  NoAnswer: counsellingSessionTokens.statusPillRequired,
  Busy: 'bg-orange-100 text-orange-900',
  LeftMessage: counsellingSessionTokens.statusPillInfo,
  Declined: counsellingSessionTokens.statusPillDanger,
};

export default function PatientHistoryDrawer({
  isOpen,
  onClose,
  sessionId,
  patientName,
}: PatientHistoryDrawerProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sessionId) return;
    setLoading(true);
    setError(null);
    counsellorsDeskApi
      .getSessionCommHistory(sessionId)
      .then((data) => setEntries(data))
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false));
  }, [isOpen, sessionId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="counselling-session" data-testid="followup-history-drawer">
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden
        data-testid="followup-history-backdrop"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="followup-history-title"
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-[min(420px,100vw)] flex-col',
          'border-l border-counselling-border/70 bg-counselling-card shadow-lg',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-counselling-border/60 bg-counselling-muted/30 px-4 py-3">
          <div className="min-w-0">
            <h2
              id="followup-history-title"
              className="text-sm font-semibold text-counselling-foreground"
            >
              Contact History
            </h2>
            <p className="mt-0.5 truncate text-xs text-counselling-muted-foreground">
              {patientName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-counselling-muted-foreground transition-colors hover:bg-counselling-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
            aria-label="Close history"
            data-testid="followup-history-close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {loading && (
            <div className="flex h-48 items-center justify-center text-sm text-counselling-muted-foreground">
              Loading history…
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-counselling-muted-foreground">
              <Phone className="h-8 w-8 text-counselling-border" />
              No contact history yet
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div className="relative">
              <div className="absolute bottom-0 left-[17px] top-0 w-px bg-counselling-border/60" />
              <div className="space-y-3">
                {entries.map((entry) => {
                  const outcomeCls =
                    OUTCOME_COLOR[entry.outcome ?? ''] ??
                    'bg-counselling-muted/70 text-counselling-foreground';
                  return (
                    <div key={entry.id} className="flex gap-3">
                      <div className="z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-counselling-border bg-counselling-card">
                        {CHANNEL_ICON[entry.channel] ?? (
                          <Phone className="h-4 w-4 text-counselling-muted-foreground" />
                        )}
                      </div>
                      <div
                        className={cn(
                          counsellingSessionTokens.sessionWidget,
                          'flex-1 p-3 shadow-sm',
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-counselling-foreground">
                              {entry.channel}
                            </span>
                            {entry.outcome && (
                              <span
                                className={cn(
                                  counsellingSessionTokens.statusPill,
                                  outcomeCls,
                                )}
                              >
                                {entry.outcome}
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1 text-xs text-counselling-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(entry.communicationAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </div>

                        {entry.callDurationMinutes != null && (
                          <p className="mb-1 text-xs text-counselling-muted-foreground">
                            Duration: {entry.callDurationMinutes} min
                          </p>
                        )}

                        {entry.messageBody && (
                          <p className="mt-1 text-sm text-counselling-foreground">
                            {entry.messageBody}
                          </p>
                        )}

                        {entry.nextAction && (
                          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-counselling-primary/10 px-2 py-1 text-xs text-counselling-primary">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Next: {entry.nextAction}
                            {entry.nextActionDate && (
                              <span className="ml-1 opacity-80">
                                —{' '}
                                {new Date(entry.nextActionDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
