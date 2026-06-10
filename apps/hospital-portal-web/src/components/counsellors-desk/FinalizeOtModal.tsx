'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  LockKeyhole,
  AlertTriangle,
  User,
  Calendar,
  Clock,
  Stethoscope,
  DollarSign,
  ClipboardCheck,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import type {
  OtScheduleDetail,
  UpdateOtDetailsPayload,
  FinalizeSurgeryRecord,
  FinalizeStatus,
} from '@/types/counsellors-desk';
import { useAnesthesiaTypeMaster } from '@/hooks/use-anesthesia-type-master';
import { CounsellorOutpatientChecklist } from '@/components/counsellors-desk/CounsellorOutpatientChecklist';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';

const STATUS_COLORS: Record<FinalizeStatus, string> = {
  NotConfirmed: 'bg-orange-100 text-orange-700 border border-orange-200',
  Confirmed:    'bg-blue-100 text-blue-700 border border-blue-200',
  Finalised:    'bg-indigo-100 text-indigo-700 border border-indigo-200',
  OTPrepared:   'bg-purple-100 text-purple-700 border border-purple-200',
  Cancelled:    'bg-red-100 text-red-700 border border-red-200',
  SurgeryDone:  'bg-green-100 text-green-700 border border-green-200',
};

const LOCKED_STATUSES: FinalizeStatus[] = ['OTPrepared', 'SurgeryDone'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(dob?: string): number | undefined {
  if (!dob) return undefined;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(t?: string) {
  if (!t) return '—';
  // "HH:MM:SS" → "HH:MM"
  return t.substring(0, 5);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-gray-500">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-500 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <p className="text-sm text-gray-900 py-1.5 border-b border-gray-100">
        {value ?? '—'}
      </p>
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
        className={[
          'w-full text-sm rounded-lg border px-3 py-2 outline-none transition-colors',
          readOnly ? 'bg-gray-50 text-gray-500 cursor-default' : 'bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
          error ? 'border-red-400' : 'border-gray-300',
        ].join(' ')}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function TimeInput({
  label,
  value,
  onChange,
  required,
  error,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={[
          'w-full text-sm rounded-lg border px-3 py-2 outline-none transition-colors',
          readOnly ? 'bg-gray-50 text-gray-500 cursor-default' : 'bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
          error ? 'border-red-400' : 'border-gray-300',
        ].join(' ')}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
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
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className={[
            'w-full text-sm rounded-lg border px-3 py-2 pr-8 outline-none appearance-none transition-colors',
            readOnly ? 'bg-gray-50 text-gray-500 cursor-default' : 'bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
            error ? 'border-red-400' : 'border-gray-300',
          ].join(' ')}
        >
          <option value="">{placeholder ?? 'Select…'}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function TextareaInput({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        rows={3}
        className={[
          'w-full text-sm rounded-lg border px-3 py-2 outline-none resize-none transition-colors',
          readOnly ? 'bg-gray-50 text-gray-500 cursor-default' : 'bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
          'border-gray-300',
        ].join(' ')}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const { canEditCounsellorOutpatient } = useIpChecklistPermissions();
  const { options: anesthesiaMasterOptions } = useAnesthesiaTypeMaster();
  const anesthesiaSelectOptions = anesthesiaMasterOptions.map((o) => ({
    id: o.label,
    name: o.label,
  }));

  const [detail, setDetail] = useState<OtScheduleDetail | null>(null);
  const [form, setForm] = useState<UpdateOtDetailsPayload>(EMPTY_FORM);
  const [surgeons, setSurgeons] = useState<{ id: string; name: string }[]>([]);
  const [theaters, setTheaters] = useState<{ id: string; name: string }[]>([]);
  const [anesthetists, setAnesthetists] = useState<{ id: string; name: string }[]>([]);
  const [anesthetistMode, setAnesthetistMode] = useState<'list' | 'external'>('external');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActioning, setIsActioning] = useState(false);  const [scheduleDate, setScheduleDate] = useState<string>('');  const [errors, setErrors] = useState<Record<string, string>>({});

  const isLocked = detail ? LOCKED_STATUSES.includes(detail.status) : false;
  const isEdited  = detail
    ? (
        LOCKED_STATUSES.includes(detail.status) === false &&
        (detail.status === 'Confirmed' || detail.status === 'Finalised')
      )
    : false;

  // ── Load data when modal opens ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !scheduleId) return;

    let cancelled = false;
    setIsLoading(true);
    setDetail(null);
    setErrors({});
    setScheduleDate('');
    setAnesthetistMode('external');

    Promise.all([
      counsellorsDeskApi.getOtScheduleDetail(scheduleId),
      counsellorsDeskApi.getSurgeons(),
      counsellorsDeskApi.getOtTheaters(),
      counsellorsDeskApi.getAnesthetists(),
    ])
      .then(([det, surg, theat, anests]) => {
        if (cancelled) return;
        setDetail(det);
        setSurgeons(surg);
        setTheaters(theat);
        setAnesthetists(anests);
        // Set anesthetist mode: list if name matches a known anesthetist, else external
        if (det.anesthetistName && anests.some((a: { id: string; name: string }) => a.name === det.anesthetistName)) {
          setAnesthetistMode('list');
        } else {
          setAnesthetistMode(det.anesthetistName ? 'external' : 'external');
        }
        setScheduleDate(det.scheduleDate ?? '');
        // Resolve doctorId: use explicit id first, fall back to matching name in loaded surgeon list
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
          anesthetistName: det.anesthetistName ?? '',
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
  }, [isOpen, scheduleId]);

  // ── Keyboard close ──────────────────────────────────────────────────────────
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  // ── Form helpers ────────────────────────────────────────────────────────────
  const set = <K extends keyof UpdateOtDetailsPayload>(key: K, value: UpdateOtDetailsPayload[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.reportingTime) e.reportingTime = 'Reporting time is required to confirm';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  // Build a save payload that converts "HH:MM" times back to ISO DateTime strings
  // (the backend UpdateOtDetailsRequest expects DateTime? / TimeSpan?)
  const buildSavePayload = () => {
    const date = scheduleDate || detail?.scheduleDate; // "YYYY-MM-DD"
    // Strip empty-string Guid fields — backend expects Guid? (null), not ""
    const nullifyEmpty = (v: string | undefined) => (v && v.trim() !== '' ? v : undefined);
    // TimeSpan needs "HH:MM:SS" format
    const toTimeSpan = (t: string | undefined) =>
      t && /^\d{1,2}:\d{2}$/.test(t) ? `${t}:00` : t || undefined;
    return {
      ...form,
      doctorId:      nullifyEmpty(form.doctorId),
      theatreId:     nullifyEmpty(form.theatreId),
      startTime:     form.startTime && date ? `${date}T${form.startTime}:00` : undefined,
      endTime:       form.endTime   && date ? `${date}T${form.endTime}:00`   : undefined,
      reportingTime: toTimeSpan(form.reportingTime),
      // Don't send empty strings for optional text fields either
      anesthetistName: nullifyEmpty(form.anesthetistName),
      iolPower:        nullifyEmpty(form.iolPower),
      cancelReason:    nullifyEmpty(form.cancelReason),
    };
  };

  const handleSave = async () => {
    if (!scheduleId || isLocked) return;
    setIsSaving(true);
    try {
      const updated = await counsellorsDeskApi.updateOtDetails(scheduleId, buildSavePayload());
      setDetail((d) => d ? { ...d, ...updated } : d);
      onStatusChange(updated);
      toast.success('Details saved');
    } catch {
      toast.error('Failed to save details');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Status actions ──────────────────────────────────────────────────────────
  const runAction = async (action: 'confirm' | 'finalise' | 'cancel' | 'reopen', cancelReason?: string) => {
    if (!scheduleId) return;
    setIsActioning(true);
    try {
      let updated: FinalizeSurgeryRecord;
      switch (action) {
        case 'confirm': {
          if (!validate()) return;
          // save details first (with ISO DateTime), then confirm
          await counsellorsDeskApi.updateOtDetails(scheduleId, buildSavePayload());
          updated = await counsellorsDeskApi.confirmOtSchedule(scheduleId);
          break;
        }
        case 'finalise':
          updated = await counsellorsDeskApi.finaliseOtSchedule(scheduleId);
          break;
        case 'cancel':
          updated = await counsellorsDeskApi.cancelOtSchedule(scheduleId);
          break;
        case 'reopen':
          updated = await counsellorsDeskApi.reopenOtCase(scheduleId);
          break;
      }
      setDetail((d) => d ? { ...d, ...updated } : d);
      onStatusChange(updated);
      toast.success(`Status updated to ${updated.status}`);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      toast.error(msg ?? 'Action failed');
    } finally {
      setIsActioning(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const status = detail?.status ?? 'NotConfirmed';
  const isCataractSurgery = detail?.surgeryName?.toLowerCase().includes('cataract')
    || detail?.surgeryName?.toLowerCase().includes('phaco');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div className={`flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200 bg-gradient-to-r ${status === 'NotConfirmed' ? 'from-amber-50 to-orange-50' : 'from-blue-50 to-indigo-50'}`}>
          {isLoading ? (
            <div className="space-y-2 animate-pulse flex-1">
              <div className="h-4 bg-gray-200 rounded w-48" />
              <div className="h-3 bg-gray-200 rounded w-32" />
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-gray-900 truncate">{detail?.patientName ?? '—'}</h2>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[status as FinalizeStatus] ?? ''}`}>
                  {status}
                </span>
                {status === 'NotConfirmed' && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">Action Required</span>
                )}
                {isLocked && <LockKeyhole className="w-4 h-4 text-gray-400 flex-shrink-0" aria-label="Locked" />}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                <span>UHID: <strong className="text-gray-700">{detail?.uhid ?? '—'}</strong></span>
                {detail?.age != null && <span>{detail.age} yrs</span>}
                {detail?.gender && <span>{detail.gender}</span>}
                {detail?.visitDate && <span>Visit: {fmtDate(detail.visitDate)}</span>}
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Edit warning banner */}
        {!isLoading && isEdited && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Editing a <strong className="mx-0.5">{status}</strong> record will revert it to <strong className="mx-0.5">Not Confirmed</strong>.
          </div>
        )}

        {/* ─── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl" />
              ))}
            </div>
          ) : (
            <>              {/* ── Patient Details ─────────────────────────────────────────────── */}
              <section className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-3">
                <SectionHeader icon={<User className="w-4 h-4" />} title="Patient Details" />
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  <ReadonlyField label="Date of Birth"  value={detail?.dob ? fmtDate(detail.dob) : undefined} />
                  <ReadonlyField label="Blood Group"    value={detail?.bloodGroup} />
                  <ReadonlyField label="Gender"         value={detail?.gender} />
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <ReadonlyField label="Contact Number" value={detail?.contactNumber} />
                  <ReadonlyField label="Address"        value={detail?.address} />
                </div>
                {(detail?.emergencyContactName || detail?.emergencyContactPhone) && (
                  <div className="grid grid-cols-3 gap-x-6 gap-y-3 pt-2 border-t border-blue-100">
                    <ReadonlyField label="Emergency Contact" value={detail?.emergencyContactName} />
                    <ReadonlyField label="Emergency Phone"   value={detail?.emergencyContactPhone} />
                    <ReadonlyField label="Relationship"      value={detail?.emergencyContactRelationship} />
                  </div>
                )}
              </section>
              {/* ── Section 1: Surgery Details ────────────────────────────── */}
              <section className="rounded-xl border border-gray-200 p-4 space-y-3">
                <SectionHeader icon={<Stethoscope className="w-4 h-4" />} title="Surgery Details" />
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <ReadonlyField label="Surgery / Procedure" value={detail?.surgeryName} />
                  <div>
                    <FieldLabel>Eye</FieldLabel>
                    <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200">
                      {detail?.eyes ?? '—'}
                    </span>
                  </div>
                  <TextInput
                    label="Package Name"
                    value={form.packageName ?? ''}
                    onChange={(v) => set('packageName', v)}
                    placeholder={!detail?.packageName ? 'No package selected' : 'e.g. Phaco Standard'}
                    readOnly={isLocked || !detail?.packageName}
                  />
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
                    readOnly={isLocked}
                  />
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
                    readOnly={isLocked}
                  />
                  {detail?.diagnosis && (
                    <ReadonlyField label="Diagnosis" value={detail.diagnosis} />
                  )}
                </div>
              </section>

              {/* ── Section 2: Schedule ───────────────────────────────────── */}
              <section className="rounded-xl border border-gray-200 p-4 space-y-3">
                <SectionHeader icon={<Calendar className="w-4 h-4" />} title="Schedule" />
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  {isLocked
                    ? <ReadonlyField label="Surgery Date" value={fmtDate(scheduleDate || detail?.scheduleDate)} />
                    : (
                      <div>
                        <FieldLabel>Surgery Date</FieldLabel>
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 outline-none transition-colors bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )
                  }
                  <TimeInput
                    label="Start Time"
                    value={form.startTime ?? ''}
                    onChange={(v) => set('startTime', v)}
                    readOnly={isLocked}
                  />
                  <TimeInput
                    label="End Time"
                    value={form.endTime ?? ''}
                    onChange={(v) => set('endTime', v)}
                    readOnly={isLocked}
                  />
                  <TimeInput
                    label="Reporting Time"
                    value={form.reportingTime ?? ''}
                    onChange={(v) => set('reportingTime', v)}
                    required
                    error={errors.reportingTime}
                    readOnly={isLocked}
                  />
                </div>
              </section>

              {/* ── Section 3: Anesthesia ─────────────────────────────────── */}
              <section className="rounded-xl border border-gray-200 p-4 space-y-3">
                <SectionHeader icon={<Clock className="w-4 h-4" />} title="Anesthesia" />
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <SelectInput
                    label="Anesthesia Type"
                    value={form.anesthesiaType ?? ''}
                    onChange={(v) => set('anesthesiaType', v)}
                    options={anesthesiaSelectOptions}
                    readOnly={isLocked}
                  />
                  {/* Anesthetist — dropdown with External option for manual entry */}
                  <div>
                    <FieldLabel>Anesthetist Name</FieldLabel>
                    <div className="space-y-2">
                      <div className="relative">
                        <select
                          value={anesthetistMode === 'list' ? (form.anesthetistName ?? '') : '__external__'}
                          onChange={(e) => {
                            if (e.target.value === '__external__') {
                              setAnesthetistMode('external');
                              set('anesthetistName', '');
                            } else {
                              setAnesthetistMode('list');
                              set('anesthetistName', e.target.value);
                            }
                          }}
                          disabled={isLocked}
                          className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 pr-8 outline-none appearance-none bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-default"
                        >
                          <option value="">Select anesthetist…</option>
                          {anesthetists.map((a) => (
                            <option key={a.id} value={a.name}>{a.name}</option>
                          ))}
                          <option value="__external__">✎ External (manual entry)</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                      {anesthetistMode === 'external' && !isLocked && (
                        <input
                          type="text"
                          value={form.anesthetistName ?? ''}
                          onChange={(e) => set('anesthetistName', e.target.value)}
                          placeholder="Enter anesthetist name…"
                          className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 outline-none bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      )}
                      {anesthetistMode === 'external' && isLocked && form.anesthetistName && (
                        <p className="text-sm text-gray-900 py-1">{form.anesthetistName}</p>
                      )}
                    </div>
                  </div>
                  {isCataractSurgery && (
                    <TextInput
                      label="IOL Power"
                      value={form.iolPower ?? ''}
                      onChange={(v) => set('iolPower', v)}
                      placeholder="e.g. +21.5 D"
                      readOnly={isLocked}
                    />
                  )}
                </div>
              </section>

              {/* ── Section 4: Financial Snapshot ────────────────────────── */}
              <section className="rounded-xl border border-gray-200 p-4 space-y-3">
                <SectionHeader icon={<DollarSign className="w-4 h-4" />} title="Financial Snapshot" />
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  <ReadonlyField label="Payment Mode" value={detail?.paymentMode} />
                  <ReadonlyField label="Patient Type"  value={detail?.patientType} />
                  <div>
                    <FieldLabel>Package Rate (₹)</FieldLabel>
                    {(status === 'NotConfirmed' || status === 'Cancelled') ? (
                      <p className="text-sm font-bold text-gray-900 py-1.5 border-b border-gray-100">
                        {form.packageRate != null && form.packageRate !== 0
                          ? `₹${Number(form.packageRate).toLocaleString('en-IN')}`
                          : '—'}
                      </p>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        value={form.packageRate != null && form.packageRate !== 0 ? form.packageRate : ''}
                        onChange={(e) => set('packageRate', e.target.value ? parseFloat(e.target.value) : undefined)}
                        readOnly={isLocked}
                        placeholder="0.00"
                        className={[
                          'w-full text-sm rounded-lg border border-gray-300 px-3 py-2 outline-none transition-colors',
                          isLocked ? 'bg-gray-50 text-gray-500 cursor-default' : 'bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                        ].join(' ')}
                      />
                    )}
                  </div>
                </div>
              </section>

              {/* ── Section 5: Outpatient Safety Checklist (Form 1) ─────────── */}
              <section className="rounded-xl border border-gray-200 p-4">
                <SectionHeader icon={<ClipboardCheck className="w-4 h-4" />} title="Outpatient Safety Checklist" />
                {detail?.counsellingSessionId ? (
                  <CounsellorOutpatientChecklist
                    counselingSessionId={detail.counsellingSessionId}
                    readOnly={isLocked || !canEditCounsellorOutpatient}
                    showRollup
                    integrationContext={{
                      patientId: undefined,
                      paymentType: detail.paymentMode,
                      packageRate: form.packageRate ?? detail.packageRate,
                    }}
                  />
                ) : (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    No counselling session linked — outpatient checklist unavailable for this OT schedule.
                  </p>
                )}
              </section>

              {/* ── Remarks ───────────────────────────────────────────────── */}
              <section className="rounded-xl border border-gray-200 p-4">
                <SectionHeader icon={<User className="w-4 h-4" />} title="Notes" />
                <div className="space-y-3">
                  <TextareaInput
                    label="Remarks"
                    value={form.remarks ?? ''}
                    onChange={(v) => set('remarks', v)}
                    placeholder="Any special pre-op notes…"
                    readOnly={isLocked}
                  />
                  {status === 'Cancelled' && (
                    <TextareaInput
                      label="Cancellation Reason"
                      value={form.cancelReason ?? ''}
                      onChange={(v) => set('cancelReason', v)}
                      readOnly
                    />
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        {/* ─── Footer ──────────────────────────────────────────────────────── */}
        {!isLoading && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              {/* NotConfirmed */}
              {status === 'NotConfirmed' && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isActioning}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => runAction('confirm')}
                    disabled={isSaving || isActioning}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isActioning ? 'Processing…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => runAction('cancel')}
                    disabled={isSaving || isActioning}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel Surgery
                  </button>
                </>
              )}

              {/* Confirmed */}
              {status === 'Confirmed' && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isActioning}
                    className="px-4 py-2 text-sm font-medium text-yellow-800 bg-yellow-50 border border-yellow-300 rounded-lg hover:bg-yellow-100 disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? 'Saving…' : 'Save (will revert)'}
                  </button>
                  <button
                    onClick={() => runAction('finalise')}
                    disabled={isSaving || isActioning}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {isActioning ? 'Processing…' : 'Finalise'}
                  </button>
                  <button
                    onClick={() => runAction('cancel')}
                    disabled={isSaving || isActioning}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel Surgery
                  </button>
                </>
              )}

              {/* Finalised */}
              {status === 'Finalised' && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isActioning}
                    className="px-4 py-2 text-sm font-medium text-yellow-800 bg-yellow-50 border border-yellow-300 rounded-lg hover:bg-yellow-100 disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? 'Saving…' : 'Save (will revert)'}
                  </button>
                  <button
                    onClick={() => runAction('cancel')}
                    disabled={isSaving || isActioning}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel Surgery
                  </button>
                </>
              )}

              {/* OTPrepared — read-only */}
              {status === 'OTPrepared' && (
                <button
                  onClick={() => runAction('reopen')}
                  disabled={isActioning}
                  className="px-4 py-2 text-sm font-medium text-amber-800 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  {isActioning ? 'Processing…' : 'Reopen Case'}
                </button>
              )}

              {/* Cancelled — read-only */}
              {status === 'Cancelled' && (
                <button
                  onClick={() => runAction('reopen')}
                  disabled={isActioning}
                  className="px-4 py-2 text-sm font-medium text-amber-800 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  {isActioning ? 'Processing…' : 'Reopen Case'}
                </button>
              )}

              {/* SurgeryDone — view only, no actions */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
