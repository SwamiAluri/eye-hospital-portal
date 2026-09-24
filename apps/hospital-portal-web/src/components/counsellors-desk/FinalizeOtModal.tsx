'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  LockKeyhole,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { finalizeMutationErrorMessage } from '@/lib/counsellors-desk/finalize-mutation-error';
import type {
  OtScheduleDetail,
  UpdateOtDetailsPayload,
  FinalizeSurgeryRecord,
  FinalizeStatus,
} from '@/types/counsellors-desk';
import { useAnesthesiaTypeMaster } from '@/hooks/use-anesthesia-type-master';
import { CounsellorOutpatientChecklist } from '@/components/counsellors-desk/CounsellorOutpatientChecklist';
import { AnesthetistSelect } from '@/components/counsellors-desk/AnesthetistSelect';
import { SearchableMasterSelect } from '@/components/counsellors-desk/SearchableMasterSelect';
import { useHasPermission } from '@/hooks/use-permissions';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import {
  FINALIZE_OT_MUTATE_PERMISSION,
  resolveFinalizeChecklistReadOnly,
  resolveFinalizeOtFormLocked,
} from '@/lib/counsellors-desk/finalize-ot-authorization';
import { biometryMissingEyePhrase } from '@/lib/ip-management/iol-diopter';
import {
  hasUnresolvedAnesthetistNameConflict,
  resolveAnesthetistUiMode,
  type AnesthetistOption,
  type AnesthetistUiMode,
} from '@/lib/counsellors-desk/anesthetist-name-match';
import { formatCounsellingTimeDisplay } from '@/lib/counsellors-desk/counselling-time';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { CounsellingDatePicker } from '@/components/counsellors-desk/session/primitives/CounsellingDatePicker';
import { CounsellingTimePicker } from '@/components/counsellors-desk/session/primitives/CounsellingTimePicker';
import {
  CounsellingSelect,
  CounsellingSelectContent,
  CounsellingSelectItem,
  CounsellingSelectTrigger,
  CounsellingSelectValue,
} from '@/components/counsellors-desk/session/primitives';
import { CounsellingSessionWidget } from '@/components/counsellors-desk/session/CounsellingSessionWidget';
import { CounsellingStatusMessage } from '@/components/counsellors-desk/session/primitives/CounsellingStatusMessage';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { shouldShowCancellationReason, resolveFinalizeOtModalFooterActions } from '@/components/counsellors-desk/finalize-ot-modal-presentation';
import {
  buildOtDetailsSavePayload,
  mergeOtDetailsSaveIntoRecord,
} from '@/lib/counsellors-desk/ot-details-save-payload';
import {
  isCancelReasonPresent,
  isReportingTimeValid,
} from '@/lib/counsellors-desk/finalize-surgery-package1';
import {
  CounsellingAlertDialog,
  CounsellingAlertDialogAction,
  CounsellingAlertDialogCancel,
  CounsellingAlertDialogContent,
  CounsellingAlertDialogDescription,
  CounsellingAlertDialogFooter,
  CounsellingAlertDialogHeader,
  CounsellingAlertDialogTitle,
  CounsellingLabel,
  CounsellingTextarea,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<FinalizeStatus, string> = {
  NotConfirmed: 'bg-amber-100 text-amber-900',
  Confirmed:    'bg-sky-100 text-sky-900',
  Finalised:    'bg-teal-100 text-teal-900',
  OTPrepared:   'bg-emerald-100 text-emerald-900',
  Cancelled:    'bg-red-100 text-red-900',
  SurgeryDone:  'bg-emerald-100 text-emerald-800',
};

const denseBtn = 'min-h-8 !min-h-8 h-8 text-xs';
const fieldFocus =
  'w-full text-sm rounded-lg border border-counselling-border bg-counselling-card px-3 py-2 outline-none transition-colors hover:border-counselling-primary/40 focus:border-counselling-primary/60 focus:ring-2 focus:ring-counselling-primary/25';
const fieldReadonly = 'bg-counselling-muted/40 text-counselling-muted-foreground cursor-default';
const fieldGrid = 'grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2';

const STATUS_LABELS: Record<FinalizeStatus, string> = {
  NotConfirmed: 'Not Confirmed',
  Confirmed: 'Confirmed',
  Finalised: 'Finalised',
  OTPrepared: 'OT Prepared',
  Cancelled: 'Cancelled',
  SurgeryDone: 'Surgery Done',
};

function formatGenderDisplay(gender?: string | null): string {
  if (!gender?.trim()) return '';
  const g = gender.trim();
  if (/^(m|male)$/i.test(g)) return 'Male';
  if (/^(f|female)$/i.test(g)) return 'Female';
  if (/^(o|other)$/i.test(g)) return 'Other';
  return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
}

const LOCKED_STATUSES: FinalizeStatus[] = ['OTPrepared', 'SurgeryDone'];

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(t?: string) {
  if (!t) return '—';
  const hhMm = t.substring(0, 5);
  return formatCounsellingTimeDisplay(hhMm) || hhMm;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-[12.5px] font-medium leading-[18px] text-counselling-muted-foreground">
      {children}{required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value?: string | number | null }) {
  const display =
    value == null || value === ''
      ? '—'
      : typeof value === 'number'
        ? String(value)
        : String(value);
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] font-medium leading-[18px] text-counselling-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium leading-5 text-counselling-foreground">{display}</p>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={cn(
          fieldFocus,
          readOnly && fieldReadonly,
          error ? 'border-red-400' : undefined,
        )}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
  required,
  error,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  testId?: string;
}) {
  const errorId = error ? `${testId ?? 'time'}-error` : undefined;
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <CounsellingTimePicker
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        data-testid={testId}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  error,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <CounsellingSelect
        value={value || undefined}
        onValueChange={onChange}
        disabled={readOnly}
      >
        <CounsellingSelectTrigger
          className={cn(
            'h-10 w-full border-counselling-border bg-counselling-card text-sm',
            'hover:border-counselling-primary/40 focus:ring-counselling-primary/25',
            error ? 'border-red-400' : undefined,
            readOnly && fieldReadonly,
          )}
          data-testid={`finalize-ot-select-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <CounsellingSelectValue placeholder={placeholder ?? 'Select…'} />
        </CounsellingSelectTrigger>
        <CounsellingSelectContent className="z-[90]">
          {options.map((o) => (
            <CounsellingSelectItem key={o.id} value={o.id}>
              {o.name}
            </CounsellingSelectItem>
          ))}
        </CounsellingSelectContent>
      </CounsellingSelect>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function TextareaInput({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        rows={rows}
        className={cn(fieldFocus, 'resize-none', readOnly && fieldReadonly)}
      />
    </div>
  );
}

export interface FinalizeOtModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: string | null;
  onStatusChange: (updated: FinalizeSurgeryRecord) => void;
}

const EMPTY_FORM: UpdateOtDetailsPayload = {
  doctorId: '',
  doctorName: '',
  theatreId: '',
  theatreName: '',
  startTime: '',
  endTime: '',
  reportingTime: '',
  anesthesiaType: '',
  anesthetistName: '',
  iolPower: '',
  remarks: '',
  cancelReason: '',
  packageName: '',
  packageRate: undefined,
};

export function FinalizeOtModal({ isOpen, onClose, scheduleId, onStatusChange }: FinalizeOtModalProps) {
  const canMutateOt = useHasPermission(FINALIZE_OT_MUTATE_PERMISSION);
  const { canEditCounsellorOutpatient } = useIpChecklistPermissions();
  const {
    options: anesthesiaMasterOptions,
    loading: anesthesiaLoading,
    error: anesthesiaError,
    refetch: refetchAnesthesia,
  } = useAnesthesiaTypeMaster();
  const anesthesiaSelectOptions = anesthesiaMasterOptions.map((o) => ({
    id: o.label,
    name: o.label,
  }));

  const [detail, setDetail] = useState<OtScheduleDetail | null>(null);
  const [form, setForm] = useState<UpdateOtDetailsPayload>(EMPTY_FORM);
  const [surgeons, setSurgeons] = useState<{ id: string; name: string }[]>([]);
  const [theaters, setTheaters] = useState<{ id: string; name: string }[]>([]);
  const [anesthetists, setAnesthetists] = useState<AnesthetistOption[]>([]);
  const [anesthetistMode, setAnesthetistMode] = useState<AnesthetistUiMode>('list');
  const [selectedAnesthetistId, setSelectedAnesthetistId] = useState<string | null>(null);
  const [anesthetistsLoading, setAnesthetistsLoading] = useState(false);
  const [anesthetistsError, setAnesthetistsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReasonDraft, setCancelReasonDraft] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);

  const isLocked = detail ? LOCKED_STATUSES.includes(detail.status) : false;
  const cannotFinalize = !canMutateOt;
  const formLocked = resolveFinalizeOtFormLocked({
    isStatusLocked: isLocked,
    canMutateOt,
  });
  const checklistReadOnly = resolveFinalizeChecklistReadOnly({
    isStatusLocked: isLocked,
    canEditChecklist: canEditCounsellorOutpatient,
  });
  const isEdited  = detail
    ? (
        LOCKED_STATUSES.includes(detail.status) === false &&
        (detail.status === 'Confirmed' || detail.status === 'Finalised')
      )
    : false;

  const loadAnesthetists = useCallback(async (): Promise<AnesthetistOption[]> => {
    setAnesthetistsLoading(true);
    setAnesthetistsError(null);
    try {
      const list = await counsellorsDeskApi.getAnesthetists();
      setAnesthetists(list);
      return list;
    } catch {
      setAnesthetists([]);
      setAnesthetistsError('Unable to load anaesthetists.');
      return [];
    } finally {
      setAnesthetistsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !scheduleId) return;

    let cancelled = false;
    setIsLoading(true);
    setDetail(null);
    setErrors({});
    setScheduleDate('');
    setAnesthetistMode('list');
    setSelectedAnesthetistId(null);

    Promise.all([
      counsellorsDeskApi.getOtScheduleDetail(scheduleId),
      counsellorsDeskApi.getSurgeons(),
      counsellorsDeskApi.getOtTheaters(),
      loadAnesthetists(),
    ])
      .then(([det, surg, theat, anests]) => {
        if (cancelled) return;
        setDetail(det);
        setSurgeons(surg);
        setTheaters(theat);
        const resolved = resolveAnesthetistUiMode(det.anesthetistName, anests);
        setAnesthetistMode(resolved.mode);
        setSelectedAnesthetistId(resolved.selectedId);
        let anesthetistName = det.anesthetistName ?? '';
        if (resolved.mode === 'list' && resolved.selectedId) {
          const match = anests.find((a) => a.id === resolved.selectedId);
          if (match) anesthetistName = match.name;
        }
        setScheduleDate(det.scheduleDate ?? '');
        const resolvedDoctorId = det.doctorId ?? surg.find((s: { id: string; name: string }) => s.name === det.surgeon)?.id ?? '';
        setForm({
          doctorId:        resolvedDoctorId,
          doctorName:      det.surgeon     ?? '',
          theatreId:       det.theatreId   ?? '',
          theatreName:     det.theaterName ?? '',
          startTime:       det.startTime   ?? '',
          endTime:         det.endTime     ?? '',
          reportingTime:   det.reportingTime  ?? '',
          anesthesiaType:  det.anesthesiaType  ?? '',
          anesthetistName,
          iolPower:        det.iolPower    ?? '',
          remarks:         det.remarks     ?? '',
          cancelReason:    det.cancelReason ?? '',
          packageName:     det.packageName ?? '',
          packageRate:     det.packageRate ?? undefined,
        });
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load schedule detail'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [isOpen, scheduleId, loadAnesthetists]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Capture phase: popover still open — let Radix dismiss it; do not close modal.
      if (document.querySelector('[data-radix-popper-content-wrapper]')) return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const set = <K extends keyof UpdateOtDetailsPayload>(key: K, value: UpdateOtDetailsPayload[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const anesthetistConflict = hasUnresolvedAnesthetistNameConflict(
    anesthetistMode,
    form.anesthetistName,
    anesthetists,
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.reportingTime?.trim()) {
      e.reportingTime = 'Reporting time is required to confirm';
    } else if (!isReportingTimeValid(form.reportingTime)) {
      e.reportingTime = 'Enter a valid reporting time (HH:MM)';
    }
    if (anesthetistConflict) {
      e.anesthetistName = 'Select the existing anaesthetist or enter a different name';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const assertAnesthetistOkForSave = () => {
    if (!anesthetistConflict) return true;
    setErrors((prev) => ({
      ...prev,
      anesthetistName: 'Select the existing anaesthetist or enter a different name',
    }));
    toast.error('Resolve the anaesthetist name before saving');
    return false;
  };

  const buildSavePayload = () =>
    buildOtDetailsSavePayload(form, scheduleDate || detail?.scheduleDate);

  const handleSave = async () => {
    if (!scheduleId || isLocked || cannotFinalize) return;
    if (!assertAnesthetistOkForSave()) return;
    setIsSaving(true);
    try {
      const payload = buildSavePayload();
      const updated = mergeOtDetailsSaveIntoRecord(
        await counsellorsDeskApi.updateOtDetails(scheduleId, payload),
        payload,
      );
      setDetail((d) => d ? { ...d, ...updated } : d);
      onStatusChange(updated);
      toast.success('Details saved');
    } catch (err: unknown) {
      toast.error(finalizeMutationErrorMessage(err, 'Failed to save details'));
    } finally {
      setIsSaving(false);
    }
  };

  const runAction = async (action: 'confirm' | 'finalise' | 'cancel' | 'reopen', cancelReason?: string) => {
    if (!scheduleId || cannotFinalize) return;
    setIsActioning(true);
    try {
      let updated: FinalizeSurgeryRecord;
      switch (action) {
        case 'confirm': {
          if (!validate()) return;
          const payload = buildSavePayload();
          await counsellorsDeskApi.updateOtDetails(scheduleId, payload);
          updated = mergeOtDetailsSaveIntoRecord(
            await counsellorsDeskApi.confirmOtSchedule(scheduleId),
            payload,
          );
          break;
        }
        case 'finalise':
          updated = await counsellorsDeskApi.finaliseOtSchedule(scheduleId);
          break;
        case 'cancel': {
          if (!isCancelReasonPresent(cancelReason)) {
            toast.error('Cancellation reason is required');
            return;
          }
          updated = await counsellorsDeskApi.cancelOtSchedule(scheduleId, {
            cancelReason: cancelReason!.trim(),
          });
          break;
        }
        case 'reopen':
          updated = await counsellorsDeskApi.reopenOtCase(scheduleId);
          break;
      }
      setDetail((d) => d ? { ...d, ...updated } : d);
      onStatusChange(updated);
      toast.success(`Status updated to ${updated.status}`);
    } catch (err: unknown) {
      toast.error(finalizeMutationErrorMessage(err, 'Action failed'));
    } finally {
      setIsActioning(false);
    }
  };

  const openCancelDialog = () => {
    if (cannotFinalize || isActioning || isSaving) return;
    setCancelReasonDraft('');
    setCancelReasonError(null);
    setCancelDialogOpen(true);
  };

  const confirmCancelSurgery = async () => {
    if (!isCancelReasonPresent(cancelReasonDraft)) {
      setCancelReasonError('Cancellation reason is required');
      return;
    }
    setCancelReasonError(null);
    setCancelDialogOpen(false);
    await runAction('cancel', cancelReasonDraft.trim());
  };

  const status = detail?.status ?? 'NotConfirmed';
  const isCataractSurgery = detail?.surgeryName?.toLowerCase().includes('cataract')
    || detail?.surgeryName?.toLowerCase().includes('phaco');
  const showCancelReason = shouldShowCancellationReason(status);
  const footerActions = resolveFinalizeOtModalFooterActions(status);
  const showSave = footerActions.includes('save') || footerActions.includes('save_will_revert');
  const saveWillRevert = footerActions.includes('save_will_revert');
  const showConfirm = footerActions.includes('confirm');
  const showCancelSurgery = footerActions.includes('cancel_surgery');
  const showReopen = footerActions.includes('reopen');

  return (
    <div className="counselling-session fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className={cn(
          counsellingSessionTokens.sessionWidget,
          /* Viewport-safe width: approved max 960px, never exceed viewport */
          'relative z-10 flex max-h-[85vh] w-[min(960px,calc(100vw-2rem))] flex-col overflow-hidden bg-gray-100 shadow-xl',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="finalize-ot-modal-title"
        data-testid="finalize-ot-modal"
      >
        {/* Sticky identity header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-counselling-border/60 bg-counselling-card px-4 py-3 sm:px-5 sm:py-3.5">
          {isLoading ? (
            <div className="flex-1 animate-pulse space-y-2">
              <div className="h-4 w-48 rounded bg-counselling-muted" />
              <div className="h-3 w-32 rounded bg-counselling-muted" />
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="finalize-ot-modal-title"
                  className={cn(counsellingSessionTokens.patientName, 'truncate')}
                >
                  {detail?.patientName ?? '—'}
                </h2>
                <span
                  className={cn(
                    counsellingSessionTokens.statusPill,
                    STATUS_COLORS[status as FinalizeStatus] ?? '',
                  )}
                >
                  {STATUS_LABELS[status as FinalizeStatus] ?? status}
                </span>
                {status === 'NotConfirmed' && (
                  <span className={cn(counsellingSessionTokens.statusPill, counsellingSessionTokens.statusPillRequired)}>
                    Action Required
                  </span>
                )}
                {isLocked && (
                  <LockKeyhole className="h-4 w-4 shrink-0 text-counselling-muted-foreground" aria-label="Locked" />
                )}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-counselling-muted-foreground">
                <span className="font-semibold tabular-nums text-counselling-foreground">
                  {detail?.uhid ?? '—'}
                </span>
                {detail?.age != null && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{detail.age} yrs</span>
                  </>
                )}
                {detail?.gender && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{formatGenderDisplay(detail.gender)}</span>
                  </>
                )}
                {detail?.visitDate && (
                  <>
                    <span aria-hidden>·</span>
                    <span>Visit {fmtDate(detail.visitDate)}</span>
                  </>
                )}
              </p>
            </div>
          )}
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            className="!min-h-8 h-8 w-8 shrink-0 px-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </CounsellingButton>
        </div>

        {!isLoading && isEdited && (
          <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:px-5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Editing a <strong className="mx-0.5">{status}</strong> record will revert it to{' '}
            <strong className="mx-0.5">Not Confirmed</strong>.
          </div>
        )}
        {!isLoading && cannotFinalize && (
          <div className="flex shrink-0 items-center gap-2 border-b border-counselling-border/60 bg-counselling-muted/30 px-4 py-2 text-xs text-counselling-foreground sm:px-5">
            <LockKeyhole className="h-4 w-4 shrink-0" />
            <span>
              <b>You cannot finalize surgery.</b> Ask a counsellor with finalize rights.
            </span>
          </div>
        )}

        {/* Single scroll body — widgets float on muted canvas */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-3.5">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-counselling-muted/60" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <CounsellingSessionWidget title="Surgery & Schedule" data-testid="finalize-ot-surgery-schedule">
                <div className={fieldGrid}>
                  <ReadonlyField label="Surgery / Procedure" value={detail?.surgeryName} />
                  <ReadonlyField label="Eye" value={detail?.eyes} />
                  {formLocked || !detail?.packageName ? (
                    <ReadonlyField
                      label="Package"
                      value={form.packageName || detail?.packageName || undefined}
                    />
                  ) : (
                    <TextInput
                      label="Package"
                      value={form.packageName ?? ''}
                      onChange={(v) => set('packageName', v)}
                      placeholder={!detail?.packageName ? 'No package selected' : 'e.g. Phaco Standard'}
                    />
                  )}
                  {formLocked ? (
                    <ReadonlyField label="Surgeon" value={form.doctorName || detail?.surgeon} />
                  ) : (
                    <SelectInput
                      label="Surgeon"
                      value={form.doctorId ?? ''}
                      onChange={(v) => {
                        const s = surgeons.find((x) => x.id === v);
                        set('doctorId', v);
                        set('doctorName', s?.name ?? '');
                      }}
                      options={surgeons}
                      placeholder={detail?.surgeon ?? 'Select surgeon'}
                    />
                  )}
                  {formLocked ? (
                    <ReadonlyField label="Theatre" value={form.theatreName || detail?.theaterName} />
                  ) : (
                    <SelectInput
                      label="Theatre"
                      value={form.theatreId ?? ''}
                      onChange={(v) => {
                        const t = theaters.find((x) => x.id === v);
                        set('theatreId', v);
                        set('theatreName', t?.name ?? '');
                      }}
                      options={theaters}
                      placeholder={detail?.theaterName ?? 'Select theatre'}
                    />
                  )}
                  {formLocked
                    ? <ReadonlyField label="Surgery Date" value={fmtDate(scheduleDate || detail?.scheduleDate)} />
                    : (
                      <div>
                        <FieldLabel>Surgery Date</FieldLabel>
                        <CounsellingDatePicker
                          value={scheduleDate}
                          onChange={setScheduleDate}
                          variant="scheduling"
                          placeholder="Select surgery date"
                          data-testid="finalize-ot-surgery-date"
                        />
                      </div>
                    )}
                  {formLocked ? (
                    <ReadonlyField label="Start Time" value={fmtTime(form.startTime)} />
                  ) : (
                    <TimeField
                      label="Start Time"
                      value={form.startTime ?? ''}
                      onChange={(v) => set('startTime', v)}
                      testId="finalize-ot-start-time"
                    />
                  )}
                  {formLocked ? (
                    <ReadonlyField label="End Time" value={fmtTime(form.endTime)} />
                  ) : (
                    <TimeField
                      label="End Time"
                      value={form.endTime ?? ''}
                      onChange={(v) => set('endTime', v)}
                      testId="finalize-ot-end-time"
                    />
                  )}
                  {formLocked ? (
                    <ReadonlyField label="Reporting Time" value={fmtTime(form.reportingTime)} />
                  ) : (
                    <TimeField
                      label="Reporting Time"
                      value={form.reportingTime ?? ''}
                      onChange={(v) => set('reportingTime', v)}
                      required
                      error={errors.reportingTime}
                      testId="finalize-ot-reporting-time"
                    />
                  )}
                  {detail?.diagnosis && (
                    <ReadonlyField label="Diagnosis" value={detail.diagnosis} />
                  )}
                </div>
              </CounsellingSessionWidget>

              <CounsellingSessionWidget title="Anaesthesia & Team" data-testid="finalize-ot-anaesthesia-team">
                <div className={fieldGrid}>
                  {formLocked ? (
                    <ReadonlyField label="Anaesthesia Type" value={form.anesthesiaType} />
                  ) : (
                    <SearchableMasterSelect
                      label="Anaesthesia Type"
                      value={form.anesthesiaType ?? ''}
                      onChange={(v) => set('anesthesiaType', v)}
                      options={anesthesiaSelectOptions}
                      placeholder="Select anaesthesia type"
                      loading={anesthesiaLoading}
                      error={anesthesiaError ? 'Unable to load anaesthesia types.' : null}
                      onRetry={() => void refetchAnesthesia()}
                      emptyMessage="No anaesthesia types found."
                      data-testid="finalize-ot-anesthesia-type"
                    />
                  )}
                  {formLocked ? (
                    <ReadonlyField label="Anaesthetist Name" value={form.anesthetistName} />
                  ) : (
                    <div>
                      <AnesthetistSelect
                        staff={anesthetists}
                        mode={anesthetistMode}
                        selectedStaffId={selectedAnesthetistId}
                        anesthetistName={form.anesthetistName ?? ''}
                        loading={anesthetistsLoading}
                        error={anesthetistsError}
                        onRetry={() => void loadAnesthetists()}
                        onSelectStaff={(a) => {
                          setAnesthetistMode('list');
                          setSelectedAnesthetistId(a.id);
                          set('anesthetistName', a.name);
                          setErrors((e) => {
                            const n = { ...e };
                            delete n.anesthetistName;
                            return n;
                          });
                        }}
                        onSelectOther={() => {
                          setAnesthetistMode('other');
                          setSelectedAnesthetistId(null);
                          set('anesthetistName', '');
                        }}
                        onManualNameChange={(name) => {
                          set('anesthetistName', name);
                        }}
                      />
                      {errors.anesthetistName && (
                        <p className="mt-1 text-xs text-red-500" role="alert">{errors.anesthetistName}</p>
                      )}
                    </div>
                  )}
                  {isCataractSurgery && (
                    <>
                      {formLocked ? (
                        <ReadonlyField label="IOL Power" value={form.iolPower} />
                      ) : (
                        <TextInput
                          label="IOL Power"
                          value={form.iolPower ?? ''}
                          onChange={(v) => set('iolPower', v)}
                          placeholder="e.g. +21.5 D"
                        />
                      )}
                      {detail?.biometryMissingForEye && (
                        <div className="col-span-full">
                          <CounsellingStatusMessage
                            tone="warning"
                            title={`No biometry on file for the ${biometryMissingEyePhrase(detail.eyes)}.`}
                            description="Package can still be selected. Planned IOL power remains empty. OT will warn, not block, if a lens is scanned later."
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CounsellingSessionWidget>

              <CounsellingSessionWidget title="Financial" data-testid="finalize-ot-financial">
                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <ReadonlyField label="Payment Mode" value={detail?.paymentMode} />
                  <ReadonlyField label="Patient Type" value={detail?.patientType} />
                  {(status === 'NotConfirmed' || status === 'Cancelled' || formLocked) ? (
                    <ReadonlyField
                      label="Package Rate"
                      value={
                        form.packageRate != null && form.packageRate !== 0
                          ? `₹${Number(form.packageRate).toLocaleString('en-IN')}`
                          : undefined
                      }
                    />
                  ) : (
                    <div>
                      <FieldLabel>Package Rate (₹)</FieldLabel>
                      <input
                        type="number"
                        min={0}
                        value={form.packageRate != null && form.packageRate !== 0 ? form.packageRate : ''}
                        onChange={(e) => set('packageRate', e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="0.00"
                        className={fieldFocus}
                      />
                    </div>
                  )}
                </div>
              </CounsellingSessionWidget>

              <CounsellingSessionWidget title="Outpatient Safety" data-testid="finalize-ot-outpatient-safety">
                {detail?.counsellingSessionId ? (
                  <CounsellorOutpatientChecklist
                    counselingSessionId={detail.counsellingSessionId}
                    readOnly={checklistReadOnly}
                    showRollup
                    rollupVariant="readback"
                    flatList
                    checklistTitle="Safety Checklist"
                    integrationContext={{
                      patientId: undefined,
                      paymentType: detail.paymentMode,
                      packageRate: form.packageRate ?? detail.packageRate,
                    }}
                  />
                ) : (
                  <CounsellingStatusMessage
                    tone="warning"
                    title="No counselling session linked"
                    description="Outpatient checklist unavailable for this OT schedule."
                  />
                )}
              </CounsellingSessionWidget>

              {/* Slim Notes — not a primary widget */}
              <div
                className="space-y-2.5 px-1 pt-0.5"
                data-testid="finalize-ot-notes"
                data-notes-weight="slim"
              >
                {showCancelReason ? (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                    Notes
                  </p>
                ) : null}
                {formLocked ? (
                  <ReadonlyField label="Remarks" value={form.remarks} />
                ) : (
                  <TextareaInput
                    label="Remarks"
                    value={form.remarks ?? ''}
                    onChange={(v) => set('remarks', v)}
                    placeholder="Any special pre-op notes…"
                    rows={2}
                  />
                )}
                {showCancelReason && (
                  <ReadonlyField label="Cancellation Reason" value={form.cancelReason} />
                )}
              </div>
            </div>
          )}
        </div>

        {!isLoading && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-counselling-border/60 bg-counselling-card px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
            <CounsellingButton
              type="button"
              variant="outline"
              size="sm"
              className={denseBtn}
              onClick={onClose}
            >
              Close
            </CounsellingButton>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {showSave && (
                <CounsellingButton
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    denseBtn,
                    saveWillRevert && 'border-amber-300 text-amber-900 hover:bg-amber-50',
                  )}
                  onClick={handleSave}
                  disabled={isSaving || isActioning || cannotFinalize}
                >
                  {isSaving ? 'Saving…' : saveWillRevert ? 'Save (will revert)' : 'Save'}
                </CounsellingButton>
              )}
              {showConfirm && (
                <CounsellingButton
                  type="button"
                  size="sm"
                  className={cn(denseBtn, 'bg-counselling-primary text-white hover:bg-counselling-primary/90')}
                  onClick={() => runAction('confirm')}
                  disabled={isSaving || isActioning || cannotFinalize}
                >
                  {isActioning ? 'Processing…' : 'Confirm'}
                </CounsellingButton>
              )}
              {showReopen && (
                <CounsellingButton
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(denseBtn, 'border-amber-300 text-amber-900 hover:bg-amber-50')}
                  onClick={() => runAction('reopen')}
                  disabled={isActioning || cannotFinalize}
                >
                  {isActioning ? 'Processing…' : 'Reopen Case'}
                </CounsellingButton>
              )}
              {showCancelSurgery && (
                <CounsellingButton
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(denseBtn, 'border-red-300 text-red-700 hover:bg-red-50')}
                  onClick={openCancelDialog}
                  disabled={isSaving || isActioning || cannotFinalize}
                >
                  Cancel Surgery
                </CounsellingButton>
              )}
            </div>
          </div>
        )}
      </div>

      <CounsellingAlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <CounsellingAlertDialogContent data-testid="finalize-cancel-confirm-dialog">
          <CounsellingAlertDialogHeader>
            <CounsellingAlertDialogTitle>Cancel surgery?</CounsellingAlertDialogTitle>
            <CounsellingAlertDialogDescription>
              This cancels the surgery schedule. A reason is required.
            </CounsellingAlertDialogDescription>
          </CounsellingAlertDialogHeader>
          <div className="space-y-2">
            <CounsellingLabel htmlFor="finalize-cancel-reason">Cancellation reason</CounsellingLabel>
            <CounsellingTextarea
              id="finalize-cancel-reason"
              value={cancelReasonDraft}
              onChange={(e) => {
                setCancelReasonDraft(e.target.value);
                if (cancelReasonError) setCancelReasonError(null);
              }}
              rows={3}
              aria-invalid={!!cancelReasonError}
              aria-describedby={cancelReasonError ? 'finalize-cancel-reason-error' : undefined}
              data-testid="finalize-cancel-reason-input"
            />
            {cancelReasonError ? (
              <p id="finalize-cancel-reason-error" className="text-sm text-red-600" role="alert">
                {cancelReasonError}
              </p>
            ) : null}
          </div>
          <CounsellingAlertDialogFooter>
            <CounsellingAlertDialogCancel type="button" disabled={isActioning}>
              Keep surgery
            </CounsellingAlertDialogCancel>
            <CounsellingAlertDialogAction
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                void confirmCancelSurgery();
              }}
              disabled={isActioning}
              data-testid="finalize-cancel-confirm-submit"
            >
              Cancel surgery
            </CounsellingAlertDialogAction>
          </CounsellingAlertDialogFooter>
        </CounsellingAlertDialogContent>
      </CounsellingAlertDialog>
    </div>
  );
}
