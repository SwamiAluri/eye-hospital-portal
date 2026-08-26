'use client';

import { useEffect, useState } from 'react';
import { History, Loader2, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ipManagementApi } from '@/lib/api/ip-management.api';
import { usePreOpClearanceOptional } from '@/components/ip-management/preop/PreOpClearanceProvider';
import { buildPreOpAuditTimeline, type PreOpAuditEvent } from '@/lib/ip-management/preop-audit';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface PreOpAuditDrawerProps {
  journeyId: string;
  open: boolean;
  onClose: () => void;
}

function formatWhen(at: string): string {
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) return at;
  return t.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function kindLabel(kind: PreOpAuditEvent['kind']): string {
  switch (kind) {
    case 'completion':
      return 'Checklist';
    case 'section':
      return 'Clearance';
    case 'journey':
      return 'Journey';
    default:
      return 'Event';
  }
}

export function PreOpAuditDrawer({ journeyId, open, onClose }: PreOpAuditDrawerProps) {
  const clearance = usePreOpClearanceOptional();
  const [events, setEvents] = useState<PreOpAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let active = true;
    setLoading(true);

    void (async () => {
      const logs = await ipManagementApi.getJourneyAudit(journeyId).catch(() => []);
      if (!active) return;

      const timeline = buildPreOpAuditTimeline({
        completions: clearance?.detail?.completions,
        sectionClearances: clearance?.detail?.sectionClearances,
        journeyAudit: Array.isArray(logs) ? logs : [],
      });
      setEvents(timeline);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [open, journeyId, clearance?.detail]);

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="right"
        hideCloseButton
        overlayClassName="bg-black/30"
        data-testid={WARD_PREOP_TEST_IDS.auditDrawer}
        className="w-full p-0 sm:max-w-md flex flex-col"
      >
        <SheetTitle className="sr-only">Activity and audit</SheetTitle>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-gray-500" aria-hidden="true" />
            <h2 id="preop-audit-title" className="text-sm font-semibold text-gray-900">
              Activity &amp; audit
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity log"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading activity…
            </div>
          ) : events.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No recorded activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {events.map(event => (
                <li
                  key={event.id}
                  data-testid={WARD_PREOP_TEST_IDS.auditEntry(event.id)}
                  className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{event.title}</p>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                      {kindLabel(event.kind)}
                    </span>
                  </div>
                  {event.detail && (
                    <p className="mt-1 text-xs text-gray-600">{event.detail}</p>
                  )}
                  <p className="mt-1 text-[11px] text-gray-400">
                    {formatWhen(event.at)}
                    {event.actor ? ` · ${event.actor}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
