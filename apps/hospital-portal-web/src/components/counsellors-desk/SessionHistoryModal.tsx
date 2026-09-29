'use client';

import { useState, useLayoutEffect } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { SessionAuditEntry } from '@/types/counsellors-desk';
import { formatOwnershipParty } from '@/lib/counsellors-desk/ownership-display-name';
import { cn } from '@/lib/utils';

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: SessionAuditEntry[];
  isLoading: boolean;
  anchorRef?: React.RefObject<HTMLButtonElement>;
  /** id → display name for ownership From/To (from getCounselors + session). */
  counselorNameById?: Record<string, string>;
}

const ACTION_CONFIG: Record<string, { label: string; tone: string }> = {
  StartCounselling: { label: 'Session Started', tone: 'text-emerald-800' },
  SaveCounselling: { label: 'Session Saved', tone: 'text-blue-800' },
  Decision: { label: 'Decision Recorded', tone: 'text-orange-800' },
  Schedule: { label: 'Surgery Scheduled', tone: 'text-green-800' },
  PriceOverride: { label: 'Price Override', tone: 'text-amber-800' },
  ReEvaluate: { label: 'Session Re-opened', tone: 'text-purple-800' },
  AddOnSurgery: { label: 'Add-On Surgery', tone: 'text-pink-800' },
  UpdatePackage: { label: 'Package Updated', tone: 'text-indigo-800' },
  PatientTypeChanged: { label: 'Payment Type Changed', tone: 'text-teal-800' },
  StatusChanged: { label: 'Status Changed', tone: 'text-sky-800' },
  FieldChanged: { label: 'Field Changed', tone: 'text-gray-800' },
  OwnershipEstablishedOnCreate: {
    label: 'Ownership established',
    tone: 'text-violet-800',
  },
  OwnershipAssigned: { label: 'Assigned', tone: 'text-violet-800' },
  OwnershipClaimed: {
    label: 'Lifecycle ownership claimed',
    tone: 'text-violet-800',
  },
  OwnershipReassigned: {
    label: 'Ownership reassigned',
    tone: 'text-violet-800',
  },
  OwnershipRequeued: {
    label: 'Re-queued',
    tone: 'text-violet-800',
  },
};

const OWNERSHIP_CHANGE_TYPES = new Set([
  'OwnershipEstablishedOnCreate',
  'OwnershipAssigned',
  'OwnershipClaimed',
  'OwnershipReassigned',
  'OwnershipRequeued',
]);

const FIELD_LABELS: Record<string, string> = {
  paymentType: 'Payment Type',
  insuranceCompany: 'Insurance Company',
  freeSurgeryReason: 'Free Surgery Reason',
  packageName: 'Package Name',
  packageRate: 'Package Rate (₹)',
  decision: 'Decision',
  wantsCounselling: 'Wants Counselling',
  scheduledDate: 'Scheduled Date',
  scheduledTime: 'Scheduled Time',
  surgeryEye: 'Surgery Eye',
  surgeonName: 'Surgeon Name',
  counsellorNotes: 'Counsellor Notes',
  investigations: 'Investigations',
  stage: 'Stage',
  selectedSurgeryId: 'Surgery / Procedure',
  selectedEye: 'Eye',
  schedule: 'Tentative Surgery Date',
  followUpDate: 'Follow-up Date',
  followUpReason: 'Follow-up Reason',
  patientRemarks: 'Patient Remarks',
  doctorNotes: 'Doctor Notes',
  wantToSeeDoctor: 'Wants to See Doctor',
  interestedToUpgrade: 'Interested to Upgrade',
  notRequiredPreAuth: 'No Pre-Auth Required',
  estimateMode: 'Estimate Mode',
  packageTemplateId: 'Package Template',
  discountType: 'Discount Type',
  discountValue: 'Discount Value',
  discountReason: 'Discount Reason',
  discountAmount: 'Discount Applied (₹)',
  finalPayableAmount: 'Final Payable (₹)',
};

const VALUE_LABELS: Record<string, string> = {
  DateForSurgery: 'Date for Surgery',
  Interested: 'Interested',
  NotInterested: 'Not Interested',
  NeedsTime: 'Needs Time',
  true: 'Yes',
  false: 'No',
  RE: 'Right Eye (RE)',
  LE: 'Left Eye (LE)',
  BE: 'Both Eyes (BE)',
  Cash: 'Cash',
  Insurance: 'Insurance',
  CoPay: 'Co-Pay',
  custom: 'Custom estimate',
  package: 'Package estimate',
  percent: 'Percentage (%)',
  flat: 'Flat amount (₹)',
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function formatFieldValue(fieldName: string | undefined, val: string | null): string {
  if (!val) return '—';
  if (VALUE_LABELS[val]) return VALUE_LABELS[val];

  const eyeMatch = val.match(/[_-](RE|LE|BE)$/i);
  const eyeSuffix = eyeMatch ? ` (${eyeMatch[1].toUpperCase()})` : '';

  if (UUID_RE.test(val)) {
    if (fieldName === 'selectedSurgeryId' || fieldName === 'selectedEye') {
      return `Procedure selection${eyeSuffix}`;
    }
    if (fieldName === 'packageName' || fieldName === 'packageRate') {
      return `Package ID${eyeSuffix}`;
    }
    const uuidMatch = val.match(UUID_RE);
    const shortHash = uuidMatch ? uuidMatch[0].slice(0, 8) + '…' : val.slice(0, 10) + '…';
    return `[${shortHash}]${eyeSuffix}`;
  }

  return val;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return (
      d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    );
  } catch {
    return iso;
  }
}

function fmtPrice(n: number | undefined): string {
  if (n === undefined) return '?';
  return '₹' + n.toLocaleString('en-IN');
}

function FieldChangeRow({ entry }: { entry: SessionAuditEntry }) {
  const label = entry.fieldName ? (FIELD_LABELS[entry.fieldName] ?? entry.fieldName) : 'Field';
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
      <span className="font-medium text-foreground shrink-0">{label}:</span>
      {entry.oldValue && (
        <span className="line-through text-red-700">{formatFieldValue(entry.fieldName, entry.oldValue)}</span>
      )}
      {entry.oldValue && entry.newValue && <span aria-hidden>→</span>}
      {entry.newValue && (
        <span className="font-medium text-emerald-800">
          {formatFieldValue(entry.fieldName, entry.newValue)}
        </span>
      )}
    </div>
  );
}

function OwnershipDetails({
  entry,
  nameById,
}: {
  entry: SessionAuditEntry;
  nameById: Record<string, string>;
}) {
  const from = formatOwnershipParty(entry.oldValue, nameById);
  const to = formatOwnershipParty(entry.newValue, nameById);
  const isClaim = entry.changeType === 'OwnershipClaimed';
  const isReassign = entry.changeType === 'OwnershipReassigned';
  const isRequeue = entry.changeType === 'OwnershipRequeued';

  // ReQueue: operational History event — Reason + prior owner release. Actor is the table column
  // (changedBy). Do not surface OwnershipRequeued / CounselorId / raw AdditionalNotes markers.
  if (isRequeue) {
    return (
      <div className="space-y-1 text-xs text-muted-foreground">
        {entry.reason ? (
          <div>
            <span className="text-muted-foreground/80">Reason</span>{' '}
            <span className="font-medium text-foreground">{entry.reason}</span>
          </div>
        ) : null}
        <div>
          <span className="text-muted-foreground/80">Requeued by</span>{' '}
          <span className="font-medium text-foreground">{entry.changedBy || '—'}</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span>
            <span className="text-muted-foreground/80">From</span>{' '}
            <span className="font-medium text-foreground">{from}</span>
          </span>
          <span>
            <span className="text-muted-foreground/80">To</span>{' '}
            <span className="font-medium text-foreground">{to}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span>
          <span className="text-muted-foreground/80">From</span>{' '}
          <span className="font-medium text-foreground">{from}</span>
        </span>
        <span>
          <span className="text-muted-foreground/80">To</span>{' '}
          <span className="font-medium text-foreground">{to}</span>
        </span>
      </div>
      {isClaim && entry.reason ? (
        <div>
          <span className="text-muted-foreground/80">Intent</span>{' '}
          <span className="font-medium text-foreground">{entry.reason}</span>
        </div>
      ) : null}
      {isReassign ? (
        <>
          <div>
            <span className="text-muted-foreground/80">Intent</span>{' '}
            <span className="font-medium text-foreground">General Reassign</span>
          </div>
          {entry.reason ? (
            <div>
              <span className="text-muted-foreground/80">Reason</span>{' '}
              <span className="font-medium text-foreground">{entry.reason}</span>
            </div>
          ) : null}
          <div>
            <span className="text-muted-foreground/80">Source</span>{' '}
            <span className="font-medium text-foreground">Reassign</span>
          </div>
        </>
      ) : isClaim ? (
        <div>
          <span className="text-muted-foreground/80">Source</span>{' '}
          <span className="font-medium text-foreground">Lifecycle Claim</span>
        </div>
      ) : entry.reason ? (
        <div>
          <span className="text-muted-foreground/80">Source</span>{' '}
          <span className="font-medium text-foreground">{entry.reason}</span>
        </div>
      ) : null}
    </div>
  );
}

function ChangeDetails({
  entry,
  nameById,
  expanded,
  onToggle,
}: {
  entry: SessionAuditEntry;
  nameById: Record<string, string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasChildren = (entry.children?.length ?? 0) > 0;

  if (OWNERSHIP_CHANGE_TYPES.has(entry.changeType)) {
    return <OwnershipDetails entry={entry} nameById={nameById} />;
  }

  if (entry.changeType === 'PriceOverride' && entry.priceBaseAmount !== undefined) {
    return (
      <div className="space-y-1 text-xs text-muted-foreground">
        {entry.priceVariantName ? (
          <p className="font-medium text-foreground">{entry.priceVariantName}</p>
        ) : null}
        <p>
          {fmtPrice(entry.priceBaseAmount)} → {fmtPrice(entry.priceOverriddenAmount)}
        </p>
        {entry.priceReason ? <p>Reason: {entry.priceReason}</p> : null}
        {entry.priceRequesterName ? <p>Requested by: {entry.priceRequesterName}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-xs text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {entry.children!.length} change{entry.children!.length !== 1 ? 's' : ''}
        </button>
      ) : null}
      {hasChildren && expanded ? (
        <div className="space-y-0.5 pl-1">
          {entry.children!.map((child, ci) => (
            <FieldChangeRow key={child.id ?? ci} entry={child} />
          ))}
        </div>
      ) : null}
      {!hasChildren && (entry.oldValue || entry.newValue) ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.oldValue ? (
            <span className="line-through text-red-700">
              {formatFieldValue(entry.fieldName, entry.oldValue)}
            </span>
          ) : null}
          {entry.oldValue && entry.newValue ? <span aria-hidden>→</span> : null}
          {entry.newValue ? (
            <span className="font-medium text-emerald-800">
              {formatFieldValue(entry.fieldName, entry.newValue)}
            </span>
          ) : null}
        </div>
      ) : null}
      {!OWNERSHIP_CHANGE_TYPES.has(entry.changeType) &&
      entry.changeType !== 'PriceOverride' &&
      entry.reason ? (
        <p>Reason: {entry.reason}</p>
      ) : null}
    </div>
  );
}

export interface SessionHistoryBodyProps {
  entries: SessionAuditEntry[];
  isLoading: boolean;
  counselorNameById?: Record<string, string>;
}

/** Existing history loading, empty, desktop table, and stacked records. Not a dialog. */
export function SessionHistoryBody({
  entries,
  isLoading,
  counselorNameById = {},
}: SessionHistoryBodyProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-muted border-b-primary" />
          <p className="text-sm">Loading history…</p>
        </div>
      ) : null}

      {!isLoading && entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
          <p className="text-sm font-medium text-foreground">No history yet</p>
          <p className="mt-1 text-xs text-center">Changes to this session will appear here</p>
        </div>
      ) : null}

      {!isLoading && entries.length > 0 ? (
        <div data-testid="session-history-table">
          <div data-testid="session-history-desktop" className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Event
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">
                    Date &amp; Time
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Actor
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Change / Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const cfg = ACTION_CONFIG[entry.changeType] ?? {
                    label: entry.changeType,
                    tone: 'text-foreground',
                  };
                  const rowId = entry.id ?? String(idx);
                  return (
                    <tr key={rowId} className="border-b border-border/70 align-top last:border-0">
                      <td className={cn('py-2.5 pr-3 font-semibold', cfg.tone)}>{cfg.label}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">
                        {formatDate(entry.changedAt)}
                      </td>
                      <td className="py-2.5 pr-3 text-foreground">{entry.changedBy || '—'}</td>
                      <td className="py-2.5">
                        <ChangeDetails
                          entry={entry}
                          nameById={counselorNameById}
                          expanded={expandedIds.has(rowId)}
                          onToggle={() => toggleExpand(rowId)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul data-testid="session-history-stacked" className="md:hidden space-y-3">
            {entries.map((entry, idx) => {
              const cfg = ACTION_CONFIG[entry.changeType] ?? {
                label: entry.changeType,
                tone: 'text-foreground',
              };
              const rowId = entry.id ?? String(idx);
              return (
                <li key={rowId} className="rounded-md border border-border bg-muted/20 px-3 py-2.5">
                  <p className={cn('text-sm font-semibold', cfg.tone)}>{cfg.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(entry.changedAt)}</p>
                  <dl className="mt-2 space-y-1.5 text-xs">
                    <div>
                      <dt className="text-muted-foreground">
                        {entry.changeType === 'OwnershipRequeued' ? 'Requeued by' : 'Actor'}
                      </dt>
                      <dd className="font-medium text-foreground">{entry.changedBy || '—'}</dd>
                    </div>
                    {entry.changeType === 'OwnershipRequeued' ? (
                      <>
                        {entry.reason ? (
                          <div>
                            <dt className="text-muted-foreground">Reason</dt>
                            <dd className="font-medium text-foreground">{entry.reason}</dd>
                          </div>
                        ) : null}
                        <div>
                          <dt className="text-muted-foreground">From</dt>
                          <dd className="font-medium text-foreground">
                            {formatOwnershipParty(entry.oldValue, counselorNameById)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">To</dt>
                          <dd className="font-medium text-foreground">
                            {formatOwnershipParty(entry.newValue, counselorNameById)}
                          </dd>
                        </div>
                      </>
                    ) : OWNERSHIP_CHANGE_TYPES.has(entry.changeType) ? (
                      <>
                        <div>
                          <dt className="text-muted-foreground">From</dt>
                          <dd className="font-medium text-foreground">
                            {formatOwnershipParty(entry.oldValue, counselorNameById)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">To</dt>
                          <dd className="font-medium text-foreground">
                            {formatOwnershipParty(entry.newValue, counselorNameById)}
                          </dd>
                        </div>
                        {entry.changeType === 'OwnershipClaimed' && entry.reason ? (
                          <div>
                            <dt className="text-muted-foreground">Intent</dt>
                            <dd className="font-medium text-foreground">{entry.reason}</dd>
                          </div>
                        ) : null}
                        {entry.changeType === 'OwnershipReassigned' ? (
                          <>
                            <div>
                              <dt className="text-muted-foreground">Intent</dt>
                              <dd className="font-medium text-foreground">General Reassign</dd>
                            </div>
                            {entry.reason ? (
                              <div>
                                <dt className="text-muted-foreground">Reason</dt>
                                <dd className="font-medium text-foreground">{entry.reason}</dd>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        <div>
                          <dt className="text-muted-foreground">Source</dt>
                          <dd className="font-medium text-foreground">
                            {entry.changeType === 'OwnershipClaimed'
                              ? 'Lifecycle Claim'
                              : entry.changeType === 'OwnershipReassigned'
                                ? 'Reassign'
                                : entry.reason || '—'}
                          </dd>
                        </div>
                      </>
                    ) : (
                      <div>
                        <dt className="text-muted-foreground">Change</dt>
                        <dd>
                          <ChangeDetails
                            entry={entry}
                            nameById={counselorNameById}
                            expanded={expandedIds.has(rowId)}
                            onToggle={() => toggleExpand(rowId)}
                          />
                        </dd>
                      </div>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </>
  );
}

export function SessionHistoryModal({
  isOpen,
  onClose,
  entries,
  isLoading,
  anchorRef,
  counselorNameById = {},
}: SessionHistoryModalProps) {
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    } else {
      setPanelPos(null);
    }
  }, [isOpen, anchorRef]);

  if (!isOpen) return null;

  return (
    <div className="counsellor-scrollbar fixed inset-0 z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Session History"
        data-testid="session-history-panel"
        className="absolute z-10 flex max-h-[min(70vh,36rem)] w-[min(36rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg"
        style={
          panelPos
            ? { top: panelPos.top, right: panelPos.right }
            : { top: '5rem', right: '1rem' }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Session History</h2>
            <p className="text-xs text-muted-foreground">Operational audit trail</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close session history"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <SessionHistoryBody
            entries={entries}
            isLoading={isLoading}
            counselorNameById={counselorNameById}
          />
        </div>

        <div className="flex justify-end border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
