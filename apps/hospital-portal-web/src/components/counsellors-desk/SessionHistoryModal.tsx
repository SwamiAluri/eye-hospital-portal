'use client';

import { useState, useLayoutEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { SessionAuditEntry } from '@/types/counsellors-desk';

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: SessionAuditEntry[];
  isLoading: boolean;
  anchorRef?: React.RefObject<HTMLButtonElement>;
}

const ACTION_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  StartCounselling:   { icon: '🟢', label: 'Session Started',       color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  SaveCounselling:    { icon: '💾', label: 'Session Saved',          color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  Decision:           { icon: '✅', label: 'Decision Recorded',      color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
  Schedule:           { icon: '📅', label: 'Surgery Scheduled',      color: 'text-green-700',   bg: 'bg-green-50 border-green-200' },
  PriceOverride:      { icon: '💰', label: 'Price Override',         color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  ReEvaluate:         { icon: '🔄', label: 'Session Re-opened',      color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200' },
  AddOnSurgery:       { icon: '➕', label: 'Add-On Surgery',         color: 'text-pink-700',    bg: 'bg-pink-50 border-pink-200' },
  UpdatePackage:      { icon: '📦', label: 'Package Updated',        color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200' },
  PatientTypeChanged: { icon: '👤', label: 'Payment Type Changed',   color: 'text-teal-700',    bg: 'bg-teal-50 border-teal-200' },
  StatusChanged:      { icon: '🔀', label: 'Status Changed',         color: 'text-sky-700',     bg: 'bg-sky-50 border-sky-200' },
  FieldChanged:       { icon: '✏️', label: 'Field Changed',          color: 'text-gray-700',    bg: 'bg-gray-50 border-gray-200' },
};

const FIELD_LABELS: Record<string, string> = {
  paymentType:          'Payment Type',
  insuranceCompany:     'Insurance Company',
  freeSurgeryReason:    'Free Surgery Reason',
  packageName:          'Package Name',
  packageRate:          'Package Rate (₹)',
  decision:             'Decision',
  wantsCounselling:     'Wants Counselling',
  scheduledDate:        'Scheduled Date',
  scheduledTime:        'Scheduled Time',
  surgeryEye:           'Surgery Eye',
  surgeonName:          'Surgeon Name',
  counsellorNotes:      'Counsellor Notes',
  investigations:       'Investigations',
  stage:                'Stage',
  selectedSurgeryId:    'Surgery / Procedure',
  selectedEye:          'Eye',
  schedule:             'Tentative Surgery Date',
  followUpDate:         'Follow-up Date',
  followUpReason:       'Follow-up Reason',
  patientRemarks:       'Patient Remarks',
  doctorNotes:          'Doctor Notes',
  wantToSeeDoctor:      'Wants to See Doctor',
  interestedToUpgrade:  'Interested to Upgrade',
  notRequiredPreAuth:   'No Pre-Auth Required',
  estimateMode:         'Estimate Mode',
  packageTemplateId:  'Package Template',
  discountType:         'Discount Type',
  discountValue:        'Discount Value',
  discountReason:       'Discount Reason',
  discountAmount:       'Discount Applied (₹)',
  finalPayableAmount:   'Final Payable (₹)',
};

/** Human-readable display for raw field values stored in the audit trail. */
const VALUE_LABELS: Record<string, string> = {
  DateForSurgery:   'Date for Surgery',
  Interested:       'Interested',
  NotInterested:    'Not Interested',
  NeedsTime:        'Needs Time',
  true:             'Yes',
  false:            'No',
  RE:               'Right Eye (RE)',
  LE:               'Left Eye (LE)',
  BE:               'Both Eyes (BE)',
  Cash:             'Cash',
  Insurance:        'Insurance',
  CoPay:            'Co-Pay',
  custom:           'Custom estimate',
  package:          'Package estimate',
  percent:          'Percentage (%)',
  flat:             'Flat amount (₹)',
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Renders a stored audit value in human-readable form.
 *  Pass fieldName when available so surgery/procedure IDs produce a clear label.
 */
function formatFieldValue(fieldName: string | undefined, val: string | null): string {
  if (!val) return '—';
  if (VALUE_LABELS[val]) return VALUE_LABELS[val];

  // Extract trailing eye code (-RE / -LE / -BE) if present
  const eyeMatch = val.match(/[_-](RE|LE|BE)$/i);
  const eyeSuffix = eyeMatch ? ` (${eyeMatch[1].toUpperCase()})` : '';

  if (UUID_RE.test(val)) {
    // Composite surgery-variant key — show field-specific label
    if (fieldName === 'selectedSurgeryId' || fieldName === 'selectedEye') {
      return `Procedure selection${eyeSuffix}`;
    }
    if (fieldName === 'packageName' || fieldName === 'packageRate') {
      return `Package ID${eyeSuffix}`;
    }
    // Generic UUID-containing value — short-hash + eye
    const uuidMatch = val.match(UUID_RE);
    const shortHash = uuidMatch ? uuidMatch[0].slice(0, 8) + '…' : val.slice(0, 10) + '…';
    return `[${shortHash}]${eyeSuffix}`;
  }

  return val;
}

/** Backward-compat wrapper (no fieldName context). */
function formatValue(val: string | null): string {
  return formatFieldValue(undefined, val);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return (
      d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' +
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
    <div className="flex items-center gap-2 text-xs text-gray-600 py-0.5 pl-2 border-l-2 border-blue-200">
      <span className="font-medium text-gray-700 shrink-0">{label}:</span>
      {entry.oldValue && (
        <span className="px-1 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded line-through">
          {formatFieldValue(entry.fieldName, entry.oldValue)}
        </span>
      )}
      {entry.oldValue && entry.newValue && <span className="text-gray-400">→</span>}
      {entry.newValue && (
        <span className="px-1 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded font-medium">
          {formatFieldValue(entry.fieldName, entry.newValue)}
        </span>
      )}
    </div>
  );
}

export function SessionHistoryModal({ isOpen, onClose, entries, isLoading, anchorRef }: SessionHistoryModalProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);

  // Recompute position each time the panel opens
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

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Determine arrow horizontal offset from the right edge of the panel
  const arrowRightOffset = anchorRef?.current
    ? Math.max(12, (anchorRef.current.getBoundingClientRect().width / 2) - 6)
    : 20;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Panel — click inside does not close */}
      <div
        className="absolute z-10 w-80 max-h-[70vh] rounded-xl overflow-hidden bg-white shadow-2xl border border-gray-200 flex flex-col"
        style={panelPos
          ? { top: panelPos.top, right: panelPos.right }
          : { top: '5rem', right: '1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow caret pointing up at the button */}
        <span
          className="absolute -top-2 border-8 border-transparent border-b-white drop-shadow-sm"
          style={{ right: arrowRightOffset }}
        />
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Session History</h2>
            <p className="text-xs text-gray-500 mt-0.5">Full audit trail of all changes</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
              <p className="text-sm">Loading history…</p>
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <span className="text-4xl mb-3">📋</span>
              <p className="text-sm font-medium">No history yet</p>
              <p className="text-xs mt-1 text-center">Changes to this session will appear here</p>
            </div>
          )}

          {!isLoading && entries.length > 0 && (
            <ol className="relative border-l-2 border-gray-100 ml-3 space-y-4">
              {entries.map((entry, idx) => {
                const cfg = ACTION_CONFIG[entry.changeType] ?? {
                  icon: '📝', label: entry.changeType, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200',
                };
                const hasChildren = (entry.children?.length ?? 0) > 0;
                const isExpanded  = expandedIds.has(entry.id ?? idx.toString());

                return (
                  <li key={entry.id ?? idx} className="ml-5">
                    <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-white border-2 border-gray-200 rounded-full text-xs">
                      {cfg.icon}
                    </span>

                    <div className={`p-3 rounded-xl border ${cfg.bg}`}>
                      {/* Header row */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                          {hasChildren && (
                            <button
                              onClick={() => toggleExpand(entry.id ?? idx.toString())}
                              className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded border ${cfg.color} hover:opacity-80 transition-opacity shrink-0`}
                            >
                              {isExpanded
                                ? <ChevronDown className="w-3 h-3" />
                                : <ChevronRight className="w-3 h-3" />}
                              {entry.children!.length} change{entry.children!.length !== 1 ? 's' : ''}
                            </button>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                          {formatDate(entry.changedAt)}
                        </span>
                      </div>

                      {/* PriceOverride enriched display */}
                      {entry.changeType === 'PriceOverride' && entry.priceBaseAmount !== undefined && (
                        <div className="mt-1.5 text-xs text-gray-600 space-y-1">
                          {entry.priceVariantName && (
                            <p className="font-medium text-gray-700">{entry.priceVariantName}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded line-through">
                              {fmtPrice(entry.priceBaseAmount)}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded font-medium">
                              {fmtPrice(entry.priceOverriddenAmount)}
                            </span>
                          </div>
                          {entry.priceReason && (
                            <p className="italic text-gray-500">Reason: {entry.priceReason}</p>
                          )}
                          {entry.priceRequesterName && (
                            <p className="text-gray-400">Requested by: {entry.priceRequesterName}</p>
                          )}
                        </div>
                      )}

                      {/* Generic old→new for non-PriceOverride entries */}
                      {entry.changeType !== 'PriceOverride' && !hasChildren && (entry.oldValue || entry.newValue) && (
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-600 flex-wrap">
                          {entry.oldValue && (
                            <span className="px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded line-through">
                              {formatFieldValue(entry.fieldName, entry.oldValue)}
                            </span>
                          )}
                          {entry.oldValue && entry.newValue && <span className="text-gray-400">→</span>}
                          {entry.newValue && (
                            <span className="px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded font-medium">
                              {formatFieldValue(entry.fieldName, entry.newValue)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reason (non-price-override) */}
                      {entry.changeType !== 'PriceOverride' && entry.reason && (
                        <p className="mt-1.5 text-xs text-gray-500 italic">Reason: {entry.reason}</p>
                      )}

                      {/* FieldChanged children — collapsed by default */}
                      {hasChildren && isExpanded && (
                        <div className="mt-2 space-y-1">
                          {entry.children!.map((child, ci) => (
                            <FieldChangeRow key={child.id ?? ci} entry={child} />
                          ))}
                        </div>
                      )}

                      {/* By (always show) */}
                      {entry.changedBy && (
                        <p className="mt-1.5 text-xs text-gray-400">by {entry.changedBy}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
