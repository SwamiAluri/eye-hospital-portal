'use client';

import { useEffect } from 'react';
import { X, ArrowRight, RotateCcw, ClipboardList, Bed, Stethoscope, CalendarClock, Ban } from 'lucide-react';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { StatusBadge } from '@/components/counsellors-desk/StatusBadge';
import { WardReadinessMeter } from '@/components/ip-management/WardReadinessMeter';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

const PRE_OP_STATES = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);

export type WardDrawerSurface = 'postOpWard' | 'discharge' | 'journey';

export interface WardPatientDrawerProps {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onOpenWorkspace: (journey: PatientJourneyRowDto) => void;
  onOpenSurface: (journey: PatientJourneyRowDto, surface: WardDrawerSurface) => void;
  onRebook: (journey: PatientJourneyRowDto) => void;
}

function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface PrimaryAction {
  label: string;
  run: () => void;
  tone: 'primary' | 'rebook';
}

export function WardPatientDrawer({
  journey,
  onClose,
  onOpenWorkspace,
  onOpenSurface,
  onRebook,
}: WardPatientDrawerProps) {
  const panelRef = useFocusTrap(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const state = journey.clinicalState;
  const isCancelled = state === 'CancelledSurgery';
  const isPreOp = PRE_OP_STATES.has(state);

  const primary: PrimaryAction | null = isCancelled
    ? { label: 'Rebook patient', run: () => onRebook(journey), tone: 'rebook' }
    : isPreOp
      ? { label: 'Open Pre-Op Workspace', run: () => onOpenWorkspace(journey), tone: 'primary' }
      : state === 'PostOp'
        ? { label: 'Open Post-Op Care', run: () => onOpenSurface(journey, 'postOpWard'), tone: 'primary' }
        : state === 'ReadyForDischarge'
          ? { label: 'Discharge Patient', run: () => onOpenSurface(journey, 'discharge'), tone: 'primary' }
          : { label: 'View Journey Timeline', run: () => onOpenSurface(journey, 'journey'), tone: 'primary' };

  // The journey timeline is the universal secondary link, unless it's the primary.
  const showJourneyLink = primary?.label !== 'View Journey Timeline';

  const wardBed = [journey.wardName ?? null, journey.bedNumber ? `Bed ${journey.bedNumber}` : null]
    .filter(Boolean).join(' · ') || '—';
  const eyeProcedure = [journey.eyeOperated ?? null, journey.procedureName ?? null]
    .filter(Boolean).join(' · ') || '—';

  const details: { icon: typeof Bed; label: string; value: string }[] = [
    { icon: Bed, label: 'Ward / Bed', value: wardBed },
    { icon: Stethoscope, label: 'Eye / Procedure', value: eyeProcedure },
    { icon: ClipboardList, label: 'Admission', value: journey.admissionType ?? '—' },
  ];
  if (journey.surgeonName) {
    details.push({ icon: Stethoscope, label: 'Surgeon', value: journey.surgeonName });
  }
  if (journey.anaesthetistName) {
    details.push({ icon: Stethoscope, label: 'Anaesthetist', value: journey.anaesthetistName });
  }
  if (journey.operationTheatreName) {
    details.push({ icon: ClipboardList, label: 'OT Room', value: journey.operationTheatreName });
  }

  const dates: { label: string; value: string }[] = [
    { label: 'Admitted', value: fmtDate(journey.admittedAt) },
    { label: 'Surgery scheduled', value: fmtDateTime(journey.surgeryScheduledAt) },
  ];

  const showCancelAudit = isCancelled || !!journey.surgeryCancelledAt;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Patient details">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />

      <div
        ref={panelRef}
        data-testid={WARD_PREOP_TEST_IDS.patientDrawer}
        className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">{journey.patientName ?? '—'}</h2>
            <p className="text-xs font-mono text-blue-700 mt-0.5">{journey.uhid ?? '—'}</p>
          </div>
          <button
            data-testid={WARD_PREOP_TEST_IDS.drawerClose}
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -mr-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={journey.clinicalState} size="sm" />
            <StatusBadge status={journey.otState} size="sm" />
            {journey.isEmergencyFc && (
              <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                Emergency FC
              </span>
            )}
          </div>

          {isPreOp && (
            <div className="bg-gray-50 rounded-xl p-4">
              <WardReadinessMeter
                variant="detail"
                clinicalState={journey.clinicalState}
                completed={journey.readinessCompleted}
                total={journey.readinessTotal}
                unverifiedCriticalCount={journey.unverifiedCriticalCount}
                pacCompleted={journey.pacCompleted}
                p2NeedsAttention={journey.p2ClearanceNeedsAttention}
              />
            </div>
          )}

          <dl className="grid grid-cols-1 gap-3">
            {details.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-gray-400">{label}</dt>
                  <dd className="text-sm font-medium text-gray-800">{value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Key dates</span>
            </div>
            <dl className="space-y-2">
              {dates.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {showCancelAudit && (
            <div className="border-t border-gray-100 pt-4" data-testid={WARD_PREOP_TEST_IDS.drawerCancelAudit}>
              <div className="flex items-center gap-2 mb-2">
                <Ban className="h-4 w-4 text-rose-500" />
                <span className="text-xs font-semibold uppercase tracking-wide text-rose-600">Cancellation</span>
              </div>
              <dl className="space-y-2">
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-500">Cancelled</dt>
                  <dd className="text-sm font-medium text-gray-800">{fmtDateTime(journey.surgeryCancelledAt)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-500">From stage</dt>
                  <dd className="text-sm font-medium text-gray-800">{journey.cancelledFromState ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 mb-1">Reason</dt>
                  <dd className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {journey.surgeryCancelReason?.trim() || '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Footer deep-links */}
        <div className="border-t border-gray-100 px-5 py-4 space-y-2">
          {primary && (
            <button
              data-testid={primary.tone === 'rebook' ? WARD_PREOP_TEST_IDS.drawerRebook : WARD_PREOP_TEST_IDS.drawerPrimaryAction}
              onClick={primary.run}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                primary.tone === 'rebook'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {primary.tone === 'rebook' ? <RotateCcw className="h-4 w-4" /> : null}
              {primary.label}
              {primary.tone === 'primary' ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          )}
          {showJourneyLink && (
            <button
              data-testid={WARD_PREOP_TEST_IDS.drawerViewJourney}
              onClick={() => onOpenSurface(journey, 'journey')}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              View Journey Timeline
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
