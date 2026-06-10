'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Tent, X, Building2, AlertTriangle,
  Lock, Activity, ClipboardList, FileText, Stethoscope, CirclePlus,
  SquareCheck, Square, Pencil, LogOut, Pill,
} from 'lucide-react';
import { PacAssessmentForm } from '@/components/ip-management/PacAssessmentForm';
import { AnaesthesiaMonitoringPanel } from '@/components/ip-management/AnaesthesiaMonitoringPanel';
import JourneyModal from '@/components/ip-management/JourneyModal';
import {
  ipManagementApi,
  fetchWardData,
  PatientJourneyRowDto,
  WardDto,
  WardBedDto,
  VitalSignDto,
  NurseRecordDto,
  AddVitalSignRequest,
  AddNurseRecordRequest,
  UpdateVitalSignRequest,
  UpdateNurseRecordRequest,
  OphthMedicationDto,
  IpIoTypeDto,
  SaveDischargeSummaryRequest,
  ChecklistItemDto,
  ChecklistResponseDto,
} from '@/lib/api/ip-management.api';
import { useAuthStore } from '@/lib/auth-store';
import { StatusBadge } from '@/components/counsellors-desk/StatusBadge';
import { getSurgeons, Surgeon, getNurses, Nurse } from '@/lib/api/widgets.api';
import { PreOpChecklistModal } from '@/components/ip-management/PreOpChecklistModal';
import { PreOpMedicationLog } from '@/components/ip-management/PreOpMedicationLog';
import { WardPostOpChecklist } from '@/components/ip-management/WardPostOpChecklist';
import { WardExpectedP0Banner } from '@/components/ip-management/WardExpectedP0Banner';
import { WardExpectedP0Chip } from '@/components/ip-management/WardExpectedP0Chip';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { transitionClinicalWithGates } from '@/lib/ip-checklist/transition-gates';

// ─── Types ────────────────────────────────────────────────────────────────────

type ClinicalTab = 'All' | 'Expected' | 'Admitted' | 'ReadyForSurgery' | 'InOT' | 'SurgeryCompleted' | 'PostOp' | 'ReadyForDischarge' | 'Discharged';
type ModalType = 'preop' | 'admit' | 'wardUpdation' | 'caseSheet' | 'emergencyFc' | 'sendToOT' | 'postOpWard' | 'discharge' | 'journey';
type WardUpdationTab = 'General' | 'Remark' | 'Vitals' | 'Nurse Records' | 'Medication Log' | 'PAC';

const PAC_EDITABLE_STATES = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);

const STATUS_TABS: { key: ClinicalTab; label: string; color: string; activeClass: string }[] = [
  { key: 'All',               label: 'All',               color: 'bg-slate-500',   activeClass: 'bg-slate-600 border-slate-600 text-white' },
  { key: 'Expected',          label: 'Expected',          color: 'bg-sky-500',     activeClass: 'bg-sky-500 border-sky-500 text-white' },
  { key: 'Admitted',          label: 'Admitted',          color: 'bg-cyan-500',    activeClass: 'bg-cyan-500 border-cyan-500 text-white' },
  { key: 'ReadyForSurgery',   label: 'Ready for Surgery', color: 'bg-teal-500',    activeClass: 'bg-teal-500 border-teal-500 text-white' },
  { key: 'InOT',              label: 'In OT',             color: 'bg-amber-500',   activeClass: 'bg-amber-500 border-amber-500 text-white' },
  { key: 'SurgeryCompleted',  label: 'Surgery Done',      color: 'bg-lime-600',    activeClass: 'bg-lime-600 border-lime-600 text-white' },
  { key: 'PostOp',            label: 'Post-Op',           color: 'bg-violet-500',  activeClass: 'bg-violet-500 border-violet-500 text-white' },
  { key: 'ReadyForDischarge', label: 'Ready for D/C',     color: 'bg-emerald-500', activeClass: 'bg-emerald-500 border-emerald-500 text-white' },
  { key: 'Discharged',        label: 'Discharged',        color: 'bg-gray-400',    activeClass: 'bg-gray-500 border-gray-500 text-white' },
];

const STAT_CARDS: { key: ClinicalTab; label: string; bg: string; icon: string }[] = [
  { key: 'Expected',          label: 'Expected',          bg: 'bg-sky-50 text-sky-700',        icon: '🕐' },
  { key: 'Admitted',          label: 'Admitted',          bg: 'bg-cyan-50 text-cyan-700',      icon: '🛏️' },
  { key: 'ReadyForSurgery',   label: 'Ready for Surgery', bg: 'bg-teal-50 text-teal-700',      icon: '✅' },
  { key: 'InOT',              label: 'In OT',             bg: 'bg-amber-50 text-amber-700',    icon: '🔪' },
  { key: 'SurgeryCompleted',  label: 'Surgery Done',      bg: 'bg-green-50 text-green-700',    icon: '🩺' },
  { key: 'PostOp',            label: 'Post-Op',           bg: 'bg-violet-50 text-violet-700',  icon: '💊' },
  { key: 'ReadyForDischarge', label: 'Ready for D/C',     bg: 'bg-emerald-50 text-emerald-700',icon: '🏠' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function Checkbox({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm select-none ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
      <span onClick={() => !disabled && onChange?.(!checked)}>
        {checked
          ? <SquareCheck className="h-4 w-4 text-blue-600" />
          : <Square className="h-4 w-4 text-gray-400" />}
      </span>
      <span className={disabled ? 'text-gray-500' : 'text-gray-700'}>{label}</span>
    </label>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 13 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: `${50 + (i * 7) % 35}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Full Admit Modal ─────────────────────────────────────────────────────────

function AdmitModal({ journey, wards, onClose, onSaved }: {
  journey: PatientJourneyRowDto;
  wards: WardDto[];
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
}) {
  const [admissionType, setAdmissionType] = useState<'DayCare' | 'IPD' | 'Emergency'>('IPD');
  const [primarySurgeonId, setPrimarySurgeonId] = useState('');
  const [wardId, setWardId] = useState('');
  const [roomBed, setRoomBed] = useState('');
  const [admittedAt, setAdmittedAt] = useState(new Date().toISOString().slice(0, 16));
  const [primaryNurseId, setPrimaryNurseId] = useState('');
  const [attendantName, setAttendantName] = useState('');
  const [attendantPhone, setAttendantPhone] = useState('');
  const [attendantRel, setAttendantRel] = useState('');
  const [overrideStateCheck, setOverrideStateCheck] = useState(false);
  const [bypassFinancialClearance, setBypassFinancialClearance] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [admitBeds, setAdmitBeds] = useState<WardBedDto[]>([]);

  useEffect(() => {
    getSurgeons().then(data => setSurgeons(data)).catch(() => {});
    getNurses().then(data => setNurses(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!wardId) { setAdmitBeds([]); setRoomBed(''); return; }
    ipManagementApi.getBedAvailability(wardId).then(setAdmitBeds).catch(() => {});
    setRoomBed('');
  }, [wardId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ((overrideStateCheck || bypassFinancialClearance) && !overrideReason.trim()) {
      setError('Override reason is required when bypassing checks.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        wardId: wardId || undefined,
        admissionType: admissionType || undefined,
        bedNumber: roomBed || undefined,
        admittedAt: admittedAt ? new Date(admittedAt).toISOString() : undefined,
        attendantName: attendantName || undefined,
        attendantPhone: attendantPhone || undefined,
        attendantRelationship: attendantRel || undefined,
        primarySurgeonId: primarySurgeonId || undefined,
        primaryNurseId: primaryNurseId || undefined,
        overrideStateCheck: overrideStateCheck || undefined,
        bypassFinancialClearance: bypassFinancialClearance || undefined,
        overrideReason: overrideReason || undefined,
      };
      let result = await ipManagementApi.admitPatient(journey.id, payload);
      const warnings = result?.transitionWarnings ?? [];
      if (result && warnings.length > 0) {
        const proceed = window.confirm(
          `Checklist warnings:\n\n${warnings.map(w => `• ${w.message}`).join('\n')}\n\nAdmit anyway?`,
        );
        if (!proceed) {
          setSaving(false);
          return;
        }
        result = await ipManagementApi.admitPatient(journey.id, { ...payload, acknowledgeWarnings: true });
      }
      if (result) {
        onSaved({ ...journey, clinicalState: result.clinicalState, wardName: result.wardName, bedNumber: result.bedNumber, admittedAt: result.admittedAt });
        onClose();
      } else {
        setError('Admission failed. Patient may not be in Expected state.');
      }
    } finally {
      setSaving(false);
    }
  }

  const showOverrideReason = overrideStateCheck || bypassFinancialClearance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Admit Patient</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Patient header with status badge */}
          <div className="bg-sky-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-200 flex items-center justify-center text-sky-700 font-bold text-sm shrink-0">
              {(journey.patientName ?? '?').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sky-900">{journey.patientName ?? '—'}</p>
              <p className="text-sky-700 text-xs mt-0.5">{journey.uhid} · {journey.procedureName ?? '—'}</p>
            </div>
            <StatusBadge status={journey.clinicalState} size="sm" />
          </div>

          <WardExpectedP0Banner
            journeyId={journey.id}
            counselingSessionId={journey.counselingSessionId}
            clinicalState={journey.clinicalState}
          />

          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Admission Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Admission Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {(['DayCare', 'IPD', 'Emergency'] as const).map(t => (
                <label key={t}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-all ${admissionType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  <input type="radio" name="admissionType" value={t} checked={admissionType === t} onChange={() => setAdmissionType(t)} className="hidden" />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Surgeon / Doctor</label>
              <select value={primarySurgeonId} onChange={e => setPrimarySurgeonId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Select surgeon —</option>
                {surgeons.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.specialization ? ` (${s.specialization})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ward</label>
              <select value={wardId} onChange={e => setWardId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— No ward assignment yet —</option>
                {wards.map(w => (
                  <option key={w.id} value={w.id}>{w.wardName} ({w.totalBeds} beds)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Room / Bed Number</label>
              {admitBeds.length > 0 ? (
                <select value={roomBed} onChange={e => setRoomBed(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Select room/bed —</option>
                  {admitBeds.map(b => (
                    <option key={b.bedId} value={b.roomNo}>
                      {b.description}{b.isAvailable ? '' : ' (occupied)'}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" value={roomBed} onChange={e => setRoomBed(e.target.value)} placeholder="e.g. Room 4 – Bed B"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Admission Date &amp; Time</label>
              <input type="datetime-local" value={admittedAt} onChange={e => setAdmittedAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Assigned Nurse</label>
              <select value={primaryNurseId} onChange={e => setPrimaryNurseId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Select nurse —</option>
                {nurses.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Attendant / Guardian */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Attendant / Guardian</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input type="text" value={attendantName} onChange={e => setAttendantName(e.target.value)} placeholder="Full name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input type="tel" value={attendantPhone} onChange={e => setAttendantPhone(e.target.value)} placeholder="Mobile no."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Relationship</label>
                <select value={attendantRel} onChange={e => setAttendantRel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Select —</option>
                  {['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Sibling', 'Friend', 'Guardian', 'Other'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Emergency Override / Bypass Section */}
          <div className="border border-orange-200 bg-orange-50 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-orange-800 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Override / Bypass (Use with caution)
            </p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-orange-700 cursor-pointer">
                <input type="checkbox" checked={overrideStateCheck} onChange={e => setOverrideStateCheck(e.target.checked)}
                  className="rounded border-orange-300" />
                Override clinical state check
              </label>
              <label className="flex items-center gap-2 text-xs text-orange-700 cursor-pointer">
                <input type="checkbox" checked={bypassFinancialClearance} onChange={e => setBypassFinancialClearance(e.target.checked)}
                  className="rounded border-orange-300" />
                Bypass financial clearance
              </label>
            </div>
            {showOverrideReason && (
              <div>
                <label className="block text-xs font-medium text-orange-800 mb-1">
                  Override Reason <span className="text-red-500">*</span>
                </label>
                <textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                  rows={2}
                  placeholder="Explain the reason for override / bypass..."
                  className="w-full border border-orange-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white resize-none" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-60">
              {saving ? 'Admitting…' : 'Admit Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Room Status Query Popup ──────────────────────────────────────────────────

function RoomStatusQueryPopup({ wards, onSelect, onClose }: {
  wards: WardDto[];
  onSelect: (roomNo: string) => void;
  onClose: () => void;
}) {
  type BedWithWard = WardBedDto & { wardName: string };

  const [beds, setBeds] = useState<BedWithWard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | 'Available' | 'Vacant'>('All');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!wards.length) { setLoading(false); return; }
    setLoading(true);
    Promise.all(
      wards.map(w =>
        ipManagementApi.getBedAvailability(w.id).then(data =>
          data.map(b => ({ ...b, wardName: w.wardName }))
        )
      )
    ).then(results => {
      setBeds(results.flat());
      setLoading(false);
    });
  }, [wards]);

  const filtered = beds.filter(b => {
    if (filter === 'Available') return b.isAvailable;
    if (filter === 'Vacant')    return b.currentOccupancy === 0;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-semibold text-gray-800">Room Status Query</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>

        {/* Filter pills */}
        <div className="flex justify-center gap-3 px-5 py-3 border-b border-gray-100 shrink-0">
          {([
            { key: 'Vacant'    as const, label: 'Vacant Rooms',    active: 'bg-yellow-400 text-white',  inactive: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
            { key: 'Available' as const, label: 'Available Rooms', active: 'bg-green-600 text-white',   inactive: 'bg-green-100 text-green-700 hover:bg-green-200' },
            { key: 'All'       as const, label: 'All Rooms',       active: 'bg-blue-600 text-white',    inactive: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
          ]).map(({ key, label, active, inactive }) => (
            <button key={key} onClick={() => { setFilter(key); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === key ? active : inactive}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-y-auto overflow-x-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading rooms…</div>
          ) : paged.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No rooms match the selected filter.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  {['Description', 'Room Number', 'Capacity', 'Occupancy', 'Booking', 'Extension', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(bed => (
                  <tr key={`${bed.bedId}-${bed.roomNo}`} className="border-t border-gray-100 hover:bg-gray-50 min-w-[640px]">
                    <td className="px-4 py-2.5 font-medium text-gray-700 max-w-[160px] truncate">{bed.description}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-600">{bed.roomNo}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{bed.capacity}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{bed.currentOccupancy}</td>
                    <td className="px-4 py-2.5 text-center text-gray-400">0</td>
                    <td className="px-4 py-2.5 text-center text-gray-400">—</td>
                    <td className="px-4 py-2.5 text-right pr-5">
                      <button
                        onClick={() => { onSelect(bed.roomNo); onClose(); }}
                        title="Assign this room"
                        className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors text-sm font-bold leading-none ml-auto">
                        +
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 shrink-0">
            <span className="text-xs text-gray-500">Showing {from} to {to} of {filtered.length} entries</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 text-xs rounded-lg font-medium transition-colors ${currentPage === p ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ward Updation Modal (comprehensive, tabbed) ──────────────────────────────

function WardUpdationModal({ journey, wards, onClose, onSaved, readOnly }: {
  journey: PatientJourneyRowDto;
  wards: WardDto[];
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
  readOnly?: boolean;
}) {
  const { canEditWardChecklist, canEditPac } = useIpChecklistPermissions();
  const [activeTab, setActiveTab] = useState<WardUpdationTab>('General');
  const [wardId, setWardId] = useState(wards.find(w => w.wardName === journey.wardName)?.id ?? '');
  const [roomBed, setRoomBed] = useState(journey.bedNumber ?? '');
  const [showBedPopup, setShowBedPopup] = useState(false);
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pacCompleted, setPacCompleted] = useState<boolean | null>(null);
  const [pacWarningDismissed, setPacWarningDismissed] = useState(false);

  // ── Master Data ───────────────────────────────────────────────────────────
  const [masterMeds, setMasterMeds] = useState<OphthMedicationDto[]>([]);
  const [ioTypes, setIoTypes] = useState<IpIoTypeDto[]>([]);
  const [wardBeds, setWardBeds] = useState<WardBedDto[]>([]);
  const masterLoadedRef = useRef(false);

  // ── Vitals ────────────────────────────────────────────────────────────────
  const [vitals, setVitals] = useState<VitalSignDto[]>([]);
  const [vitalsLoading, setVitalsLoading] = useState(false);
  const [vitalsLoaded, setVitalsLoaded] = useState(false);
  const [vitalAddMode, setVitalAddMode] = useState(false);
  const [vitalForm, setVitalForm] = useState({
    bloodPressureSystolic: '', bloodPressureDiastolic: '',
    pulseRate: '', temperature: '', oxygenSaturation: '',
    respiratoryRate: '', weight: '', height: '', notes: '',
  });
  const [vitalSaving, setVitalSaving] = useState(false);
  const [editingVitalKey, setEditingVitalKey] = useState<string | null>(null);
  const [editVitalForm, setEditVitalForm] = useState<Partial<UpdateVitalSignRequest>>({});

  // ── Nurse Records ────────────────────────────────────────────────────────
  const [nurseRecords, setNurseRecords] = useState<NurseRecordDto[]>([]);
  const [nurseLoading, setNurseLoading] = useState(false);
  const [nurseLoaded, setNurseLoaded] = useState(false);
  const [nurseAddMode, setNurseAddMode] = useState(false);
  const [nurseForm, setNurseForm] = useState({
    shiftType: 'Morning', nursingNotes: '', medicationsGiven: '',
    intakeOutputNotes: '', painScore: '', alertnessLevel: 'Alert',
  });
  const [nurseSaving, setNurseSaving] = useState(false);
  const [editingNurseKey, setEditingNurseKey] = useState<string | null>(null);
  const [editNurseForm, setEditNurseForm] = useState<Partial<UpdateNurseRecordRequest>>({});
  // Medication multi-select
  const [medSearchQuery, setMedSearchQuery] = useState('');
  const [medDropOpen, setMedDropOpen] = useState(false);
  const [ioSearchQuery, setIoSearchQuery] = useState('');
  const [ioDropOpen, setIoDropOpen] = useState(false);
  const [selectedMedIds, setSelectedMedIds] = useState<string[]>([]);
  // I/O type chips
  const [selectedIoTypeIds, setSelectedIoTypeIds] = useState<string[]>([]);
  const [ioFreeText, setIoFreeText] = useState('');

  // ── Pending (local until "Save & Mark Ready for Surgery") ─────────────────
  const [pendingVitals,       setPendingVitals]       = useState<AddVitalSignRequest[]>([]);
  const [pendingNurseRecords, setPendingNurseRecords] = useState<AddNurseRecordRequest[]>([]);

  const RO = readOnly || journey.clinicalState === 'Discharged' || !canEditWardChecklist;
  const pacRO = RO || !canEditPac || !PAC_EDITABLE_STATES.has(journey.clinicalState);

  // Load master data once (meds, io-types)
  useEffect(() => {
    if (masterLoadedRef.current) return;
    masterLoadedRef.current = true;
    ipManagementApi.getMasterMedications().then(setMasterMeds).catch(() => {});
    ipManagementApi.getIoTypes().then(setIoTypes).catch(() => {});
  }, []);

  // Load beds when wardId changes
  useEffect(() => {
    if (!wardId) { setWardBeds([]); return; }
    ipManagementApi.getBedAvailability(wardId).then(setWardBeds).catch(() => {});
  }, [wardId]);

  useEffect(() => {
    ipManagementApi.getPacAssessment(journey.id).then(pac => {
      if (pac) setPacCompleted(pac.assessmentStatus === 'Completed');
    }).catch(() => {});
  }, [journey.id]);

  function handleTabChange(tab: WardUpdationTab) {
    setActiveTab(tab);
    if (tab === 'Vitals' && !vitalsLoaded) {
      setVitalsLoading(true);
      ipManagementApi.getVitals(journey.id).then(data => {
        setVitals(data);
        setVitalsLoaded(true);
        setVitalsLoading(false);
        if (data.length === 0 && !RO) setVitalAddMode(true);
      });
    }
    if (tab === 'Nurse Records' && !nurseLoaded) {
      setNurseLoading(true);
      ipManagementApi.getNurseRecords(journey.id).then(data => {
        setNurseRecords(data);
        setNurseLoaded(true);
        setNurseLoading(false);
        if (data.length === 0 && !RO) setNurseAddMode(true);
      });
    }
  }

  async function handleSaveAndMarkReady(e: React.FormEvent) {
    e.preventDefault();
    if (!pacWarningDismissed && pacCompleted === false) {
      const proceed = window.confirm(
        'PAC assessment is not completed. You can still mark ready for surgery, but ward item "PAC done & documented" may be incomplete.\n\nProceed anyway?',
      );
      if (!proceed) return;
      setPacWarningDismissed(true);
    }
    setSaving(true);
    setError('');
    try {
      if (wardId) {
        await ipManagementApi.updateWardAssignment(journey.id, { wardId, bedNumber: roomBed });
      }
      for (const v of pendingVitals) {
        await ipManagementApi.addVital(journey.id, v);
      }
      for (const n of pendingNurseRecords) {
        await ipManagementApi.addNurseRecord(journey.id, n);
      }
      const result = await transitionClinicalWithGates(journey.id, {
        newState: 'ReadyForSurgery',
        reason:   remark || undefined,
      });
      onSaved({ ...journey, clinicalState: result.clinicalState, wardName: result.wardName ?? journey.wardName, bedNumber: result.bedNumber ?? roomBed });
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
               ?? (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message
               ?? (e instanceof Error ? e.message : null)
               ?? 'Failed to save. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleAddVital(e: React.FormEvent) {
    e.preventDefault();
    const req: AddVitalSignRequest = {
      bloodPressureSystolic:  vitalForm.bloodPressureSystolic  ? Number(vitalForm.bloodPressureSystolic)  : undefined,
      bloodPressureDiastolic: vitalForm.bloodPressureDiastolic ? Number(vitalForm.bloodPressureDiastolic) : undefined,
      pulseRate:              vitalForm.pulseRate              ? Number(vitalForm.pulseRate)              : undefined,
      temperature:            vitalForm.temperature            ? Number(vitalForm.temperature)            : undefined,
      oxygenSaturation:       vitalForm.oxygenSaturation       ? Number(vitalForm.oxygenSaturation)       : undefined,
      respiratoryRate:        vitalForm.respiratoryRate        ? Number(vitalForm.respiratoryRate)        : undefined,
      weight:                 vitalForm.weight                 ? Number(vitalForm.weight)                 : undefined,
      height:                 vitalForm.height                 ? Number(vitalForm.height)                 : undefined,
      notes:                  vitalForm.notes || undefined,
    };
    setPendingVitals(prev => [req, ...prev]);
    setVitalAddMode(false);
    setVitalForm({ bloodPressureSystolic: '', bloodPressureDiastolic: '', pulseRate: '', temperature: '', oxygenSaturation: '', respiratoryRate: '', weight: '', height: '', notes: '' });
  }

  function handleAddNurse(e: React.FormEvent) {
    e.preventDefault();
    // Compose medicationsGiven from selected med names
    const medNames = selectedMedIds
      .map(id => masterMeds.find(m => m.id === id)?.genericName ?? '')
      .filter(Boolean)
      .join(', ');
    // Compose I/O from chips + free text
    const chipLabels = selectedIoTypeIds
      .map(id => ioTypes.find(t => t.id === id)?.label ?? '')
      .filter(Boolean)
      .join(', ');
    const ioNote = [chipLabels, ioFreeText.trim()].filter(Boolean).join('; ');

    const req: AddNurseRecordRequest = {
      shiftType:         nurseForm.shiftType || undefined,
      nursingNotes:      nurseForm.nursingNotes || undefined,
      medicationsGiven:  medNames || nurseForm.medicationsGiven || undefined,
      intakeOutputNotes: ioNote || undefined,
      painScore:         nurseForm.painScore ? Number(nurseForm.painScore) : undefined,
      alertnessLevel:    nurseForm.alertnessLevel || undefined,
    };
    setPendingNurseRecords(prev => [req, ...prev]);
    setNurseAddMode(false);
    setNurseForm({ shiftType: 'Morning', nursingNotes: '', medicationsGiven: '', intakeOutputNotes: '', painScore: '', alertnessLevel: 'Alert' });
    setSelectedMedIds([]);
    setSelectedIoTypeIds([]);
    setIoFreeText('');
    setMedSearchQuery('');
    setMedDropOpen(false);
    setIoSearchQuery('');
    setIoDropOpen(false);
  }

  async function handleSaveEditVital(key: string) {
    if (key.startsWith('pending-')) {
      const idx = parseInt(key.replace('pending-', ''), 10);
      setPendingVitals(prev => prev.map((v, i) => i === idx ? { ...v, ...editVitalForm } : v));
    } else {
      const updated = await ipManagementApi.updateVital(journey.id, key, editVitalForm);
      if (updated) setVitals(prev => prev.map(v => v.id === key ? updated : v));
    }
    setEditingVitalKey(null);
    setEditVitalForm({});
  }

  async function handleSaveEditNurse(key: string) {
    if (key.startsWith('pending-')) {
      const idx = parseInt(key.replace('pending-', ''), 10);
      setPendingNurseRecords(prev => prev.map((r, i) => i === idx ? { ...r, ...editNurseForm } : r));
    } else {
      const updated = await ipManagementApi.updateNurseRecord(journey.id, key, editNurseForm);
      if (updated) setNurseRecords(prev => prev.map(r => r.id === key ? updated : r));
    }
    setEditingNurseKey(null);
    setEditNurseForm({});
  }

  const stateColors: Record<string, string> = {
    Expected: 'bg-sky-100 text-sky-700',
    Admitted: 'bg-cyan-100 text-cyan-700',
    ReadyForSurgery: 'bg-teal-100 text-teal-700',
    InOT: 'bg-amber-100 text-amber-700',
    SurgeryCompleted: 'bg-green-100 text-green-700',
    PostOp: 'bg-violet-100 text-violet-700',
    ReadyForDischarge: 'bg-emerald-100 text-emerald-700',
    Discharged: 'bg-gray-100 text-gray-600',
  };
  const stateColor = stateColors[journey.clinicalState] ?? 'bg-gray-100 text-gray-600';

  return (
    <>
      {showBedPopup && (
        <RoomStatusQueryPopup
          wards={wards}
          onSelect={roomNo => setRoomBed(roomNo)}
          onClose={() => setShowBedPopup(false)}
        />
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                  {(journey.patientName ?? '?').charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 text-base">{journey.patientName ?? '—'}</p>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{journey.uhid ?? '—'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stateColor}`}>{journey.clinicalState}</span>
                    {RO && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Read Only
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 ml-2 shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Info bar */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-teal-500">Eye Operated</p>
                <p className="font-bold text-teal-900 text-sm mt-0.5">{journey.eyeOperated ?? '—'}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">Procedure</p>
                <p className="font-bold text-blue-900 text-sm mt-0.5">{journey.procedureName ?? '—'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Admitted</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{fmtDate(journey.admittedAt)}</p>
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Sched. Surgery</p>
                <p className="font-bold text-violet-900 text-sm mt-0.5">{fmtDate(journey.surgeryScheduledAt)}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex px-6 pt-3 border-b border-gray-100 shrink-0 gap-1">
            {([
              { key: 'General'       as WardUpdationTab, label: 'General' },
              { key: 'Vitals'        as WardUpdationTab, label: 'Vitals',        icon: <Activity className="h-3.5 w-3.5" /> },
              { key: 'Medication Log' as WardUpdationTab, label: 'Medication Log', icon: <Pill className="h-3.5 w-3.5" /> },
              { key: 'Nurse Records' as WardUpdationTab, label: 'Nurse Records', icon: <ClipboardList className="h-3.5 w-3.5" /> },
              { key: 'PAC'           as WardUpdationTab, label: 'PAC',           icon: <Stethoscope className="h-3.5 w-3.5" /> },
              { key: 'Remark'        as WardUpdationTab, label: 'Remark' },
            ]).map(({ key, label, icon }) => (
              <button key={key} onClick={() => handleTabChange(key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">

            {/* ── General Tab ── */}
            {activeTab === 'General' && (
              <div className="p-6 space-y-5">
                {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 border-b border-gray-100 pb-1">Admission</h3>
                  <Checkbox checked label="Admitted" disabled />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ward</label>
                      <select value={wardId} onChange={e => setWardId(e.target.value)} disabled={RO}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                        <option value="">— Select ward —</option>
                        {wards.map(w => <option key={w.id} value={w.id}>{w.wardName}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Room / Bed</label>
                      <div className="flex gap-1">
                        {wardBeds.length > 0 ? (
                          <select value={roomBed} onChange={e => setRoomBed(e.target.value)} disabled={RO}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
                            <option value="">— Select room/bed —</option>
                            {wardBeds.map(b => (
                              <option key={b.bedId} value={b.roomNo}>
                                {b.description}{b.isAvailable ? '' : ' (occupied)'}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input type="text" value={roomBed} onChange={e => setRoomBed(e.target.value)} disabled={RO}
                            placeholder="Room 4 – Bed B"
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
                        )}
                        {!RO && (
                          <button type="button" onClick={() => setShowBedPopup(true)}
                            title="Browse available rooms"
                            className="px-2 py-1.5 border border-gray-300 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
                            <Search className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Remark Tab ── */}
            {activeTab === 'Remark' && (
              <div className="p-6 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">Remarks / Notes</label>
                  <span className="text-xs text-gray-400">Saved when you click "Save &amp; Mark Ready for Surgery"</span>
                </div>
                <textarea value={remark} onChange={e => setRemark(e.target.value)} disabled={RO} rows={10}
                  placeholder="Any clinical or administrative notes about this patient's ward stay…"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50" />
                {remark.trim() && !RO && (
                  <p className="text-xs text-teal-600">Remark will be included on final save.</p>
                )}
              </div>
            )}

            {/* ── Vitals Tab ── */}
            {activeTab === 'Vitals' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-red-500" /> Vital Readings
                  </h3>
                  {!RO && !vitalAddMode && (
                    <button onClick={() => setVitalAddMode(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                      <CirclePlus className="h-3.5 w-3.5" /> Add Reading
                    </button>
                  )}
                </div>

                {vitalAddMode && (
                  <form onSubmit={handleAddVital} className="bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-3">
                    <h4 className="text-xs font-semibold text-blue-800">New Vital Reading</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { key: 'bloodPressureSystolic',  label: 'BP Systolic (mmHg)',  placeholder: '120' },
                        { key: 'bloodPressureDiastolic', label: 'BP Diastolic (mmHg)', placeholder: '80'  },
                        { key: 'pulseRate',              label: 'Pulse Rate (bpm)',     placeholder: '72'  },
                        { key: 'temperature',            label: 'Temperature (°F)',     placeholder: '98.6'},
                        { key: 'oxygenSaturation',       label: 'SpO₂ (%)',            placeholder: '98'  },
                        { key: 'respiratoryRate',        label: 'Resp. Rate (/min)',    placeholder: '16'  },
                        { key: 'weight',                 label: 'Weight (kg)',          placeholder: '65'  },
                        { key: 'height',                 label: 'Height (cm)',          placeholder: '165' },
                      ] as const).map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-blue-700 mb-1">{label}</label>
                          <input type="number" step="any"
                            value={vitalForm[key as keyof typeof vitalForm]}
                            onChange={e => setVitalForm(p => ({ ...p, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full border border-blue-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      ))}
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-blue-700 mb-1">Notes</label>
                        <input type="text" value={vitalForm.notes}
                          onChange={e => setVitalForm(p => ({ ...p, notes: e.target.value }))}
                          placeholder="Any additional observations…"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setVitalAddMode(false)}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button type="submit" disabled={vitalSaving}
                        className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-medium disabled:opacity-60">
                        {vitalSaving ? 'Recording…' : 'Record'}
                      </button>
                    </div>
                  </form>
                )}

                {editingVitalKey !== null && !RO && (
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-3">
                    <h4 className="text-xs font-semibold text-blue-800">Edit Vital Reading</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { key: 'bloodPressureSystolic',  label: 'BP Systolic (mmHg)',  placeholder: '120' },
                        { key: 'bloodPressureDiastolic', label: 'BP Diastolic (mmHg)', placeholder: '80'  },
                        { key: 'pulseRate',              label: 'Pulse Rate (bpm)',     placeholder: '72'  },
                        { key: 'temperature',            label: 'Temperature (°F)',     placeholder: '98.6'},
                        { key: 'oxygenSaturation',       label: 'SpO₂ (%)',            placeholder: '98'  },
                        { key: 'respiratoryRate',        label: 'Resp. Rate (/min)',    placeholder: '16'  },
                        { key: 'weight',                 label: 'Weight (kg)',          placeholder: '65'  },
                        { key: 'height',                 label: 'Height (cm)',          placeholder: '165' },
                      ] as const).map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-blue-700 mb-1">{label}</label>
                          <input type="number" step="any"
                            value={(editVitalForm as Record<string, unknown>)[key] as string ?? ''}
                            onChange={e => setEditVitalForm(p => ({ ...p, [key]: e.target.value ? Number(e.target.value) : undefined }))}
                            placeholder={placeholder}
                            className="w-full border border-blue-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      ))}
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-blue-700 mb-1">Notes</label>
                        <input type="text" value={editVitalForm.notes ?? ''}
                          onChange={e => setEditVitalForm(p => ({ ...p, notes: e.target.value }))}
                          placeholder="Any additional observations…"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => { setEditingVitalKey(null); setEditVitalForm({}); }}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button type="button" onClick={() => handleSaveEditVital(editingVitalKey!)}
                        className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}

                {vitalsLoading ? (
                  <div className="py-10 text-center text-gray-400 text-sm">Loading vitals…</div>
                ) : vitals.length === 0 && pendingVitals.length === 0 ? (
                  <div className="py-10 text-center text-gray-400">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No vital readings recorded yet</p>
                    {!RO && <p className="text-xs mt-1">Click "Add Reading" to record the first reading</p>}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {['Date', 'Time', 'BP (sys/dia)', 'Pulse', 'Temp °F', 'SpO₂ %', 'RR /min', 'Weight', 'Height', 'Notes', ''].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingVitals.map((v, i) => {
                          const key = `pending-${i}`;
                          const today = new Date().toISOString();
                          return (
                            <tr key={key} className={`border-b border-yellow-100 ${editingVitalKey === key ? 'bg-blue-50 outline outline-2 outline-blue-300' : 'bg-yellow-50'}`}>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(today)}</td>
                              <td className="px-3 py-2 text-gray-400">—</td>
                              <td className="px-3 py-2 font-medium text-gray-700">
                                {v.bloodPressureSystolic != null && v.bloodPressureDiastolic != null
                                  ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : '—'}
                              </td>
                              <td className="px-3 py-2">{v.pulseRate ?? '—'}</td>
                              <td className="px-3 py-2">{v.temperature ?? '—'}</td>
                              <td className="px-3 py-2">{v.oxygenSaturation ?? '—'}</td>
                              <td className="px-3 py-2">{v.respiratoryRate ?? '—'}</td>
                              <td className="px-3 py-2">{v.weight != null ? `${v.weight} kg` : '—'}</td>
                              <td className="px-3 py-2">{v.height != null ? `${v.height} cm` : '—'}</td>
                              <td className="px-3 py-2 text-gray-400 max-w-[120px] truncate">{v.notes || '—'}</td>
                              <td className="px-3 py-2">
                                {!RO && (
                                  <button onClick={() => { setEditingVitalKey(key); setEditVitalForm({ ...v }); }}
                                    className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="Edit">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {vitals.map(v => {
                          const key = v.id;
                          return (
                            <tr key={key} className={`border-b ${editingVitalKey === key ? 'bg-blue-50 outline outline-2 outline-blue-300' : 'border-gray-50 hover:bg-gray-50'}`}>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(v.recordedAt)}</td>
                              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtTime(v.recordedAt)}</td>
                              <td className="px-3 py-2 font-medium text-gray-700">
                                {v.bloodPressureSystolic != null && v.bloodPressureDiastolic != null
                                  ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : '—'}
                              </td>
                              <td className="px-3 py-2">{v.pulseRate ?? '—'}</td>
                              <td className="px-3 py-2">{v.temperature ?? '—'}</td>
                              <td className="px-3 py-2">{v.oxygenSaturation ?? '—'}</td>
                              <td className="px-3 py-2">{v.respiratoryRate ?? '—'}</td>
                              <td className="px-3 py-2">{v.weight != null ? `${v.weight} kg` : '—'}</td>
                              <td className="px-3 py-2">{v.height != null ? `${v.height} cm` : '—'}</td>
                              <td className="px-3 py-2 text-gray-400 max-w-[120px] truncate">{v.notes || '—'}</td>
                              <td className="px-3 py-2">
                                {!RO && (
                                  <button onClick={() => { setEditingVitalKey(key); setEditVitalForm({ temperature: v.temperature ?? undefined, bloodPressureSystolic: v.bloodPressureSystolic ?? undefined, bloodPressureDiastolic: v.bloodPressureDiastolic ?? undefined, pulseRate: v.pulseRate ?? undefined, respiratoryRate: v.respiratoryRate ?? undefined, oxygenSaturation: v.oxygenSaturation != null ? Number(v.oxygenSaturation) : undefined, weight: v.weight != null ? Number(v.weight) : undefined, height: v.height != null ? Number(v.height) : undefined, notes: v.notes ?? undefined }); }}
                                    className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors" title="Edit">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Nurse Records Tab ── */}
            {activeTab === 'Nurse Records' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-teal-600" /> Nurse Daily Records
                  </h3>
                  {!RO && !nurseAddMode && (
                    <button onClick={() => setNurseAddMode(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium">
                      <CirclePlus className="h-3.5 w-3.5" /> Add Entry
                    </button>
                  )}
                </div>

                {nurseAddMode && (
                  <form onSubmit={handleAddNurse} className="bg-teal-50 rounded-xl p-4 border border-teal-100 space-y-3">
                    <h4 className="text-xs font-semibold text-teal-800">New Nurse Record</h4>
                    {/* Shift pills */}
                    <div>
                      <label className="block text-xs font-medium text-teal-700 mb-1.5">Shift</label>
                      <div className="flex gap-2 flex-wrap">
                        {(['Morning', 'Afternoon', 'Evening', 'Night'] as const).map(s => (
                          <label key={s}
                            className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${nurseForm.shiftType === s ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                            <input type="radio" name="nurseShift" checked={nurseForm.shiftType === s}
                              onChange={() => setNurseForm(p => ({ ...p, shiftType: s }))} className="hidden" />
                            {s}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-teal-700 mb-1">Nursing Notes</label>
                        <textarea value={nurseForm.nursingNotes}
                          onChange={e => setNurseForm(p => ({ ...p, nursingNotes: e.target.value }))} rows={2}
                          placeholder="Patient condition, observations…"
                          className="w-full border border-teal-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
                      </div>

                      {/* Medications: searchable multi-select from masterMeds */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-teal-700 mb-1">Medications Given</label>
                        <input type="text"
                          value={medSearchQuery}
                          onChange={e => setMedSearchQuery(e.target.value)}
                          onFocus={() => setMedDropOpen(true)}
                          onBlur={() => setTimeout(() => setMedDropOpen(false), 150)}
                          placeholder="Click to browse or type to search medications…"
                          className="w-full border border-teal-300 rounded-t-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                        {(medDropOpen || !!medSearchQuery) && masterMeds.length > 0 && (
                          <div className="border border-teal-200 border-t-0 rounded-b-lg bg-white max-h-52 overflow-y-auto shadow-md">
                            {masterMeds
                              .filter(m => !medSearchQuery || m.genericName.toLowerCase().includes(medSearchQuery.toLowerCase()))
                              .slice(0, 25)
                              .map(m => {
                                const selected = selectedMedIds.includes(m.id);
                                return (
                                  <button key={m.id} type="button"
                                    onMouseDown={e => { e.preventDefault(); setSelectedMedIds(prev => selected ? prev.filter(id => id !== m.id) : [...prev, m.id]); }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${selected ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${selected ? 'bg-teal-500 border-teal-500' : 'border-gray-300 bg-white'}`}>
                                      {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                    </div>
                                    <span className={`flex-1 text-xs font-medium ${selected ? 'text-teal-700' : 'text-gray-700'}`}>{m.genericName}</span>
                                    {m.drugClass && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0 font-medium">{m.drugClass}</span>
                                    )}
                                  </button>
                                );
                              })}
                            {medSearchQuery && masterMeds.filter(m => m.genericName.toLowerCase().includes(medSearchQuery.toLowerCase())).length === 0 && (
                              <p className="px-3 py-2.5 text-xs text-gray-400 text-center">No medications match</p>
                            )}
                          </div>
                        )}
                        {selectedMedIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {selectedMedIds.map(id => {
                              const med = masterMeds.find(m => m.id === id);
                              return med ? (
                                <span key={id} className="flex items-center gap-1 bg-teal-100 text-teal-800 text-xs px-2 py-0.5 rounded-full">
                                  {med.genericName}
                                  <button type="button" onClick={() => setSelectedMedIds(p => p.filter(x => x !== id))}
                                    className="ml-0.5 text-teal-600 hover:text-teal-900">×</button>
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>

                      {/* I/O: searchable combobox + chips + free text */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-teal-700 mb-1">Intake / Output</label>
                        <input type="text"
                          value={ioSearchQuery}
                          onChange={e => setIoSearchQuery(e.target.value)}
                          onFocus={() => setIoDropOpen(true)}
                          onBlur={() => setTimeout(() => setIoDropOpen(false), 150)}
                          placeholder="Click to browse or type to search I/O types…"
                          className="w-full border border-teal-300 rounded-t-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                        {(ioDropOpen || !!ioSearchQuery) && ioTypes.length > 0 && (
                          <div className="border border-teal-200 border-t-0 rounded-b-lg bg-white max-h-52 overflow-y-auto shadow-md">
                            {(['Intake', 'Output'] as const).map(cat => {
                              const filtered = ioTypes.filter(t => t.category === cat && (!ioSearchQuery || t.label.toLowerCase().includes(ioSearchQuery.toLowerCase())));
                              if (filtered.length === 0) return null;
                              return (
                                <div key={cat}>
                                  <p className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${cat === 'Intake' ? 'text-teal-600 bg-teal-50 border-b border-teal-100' : 'text-orange-600 bg-orange-50 border-b border-orange-100'}`}>{cat}</p>
                                  {filtered.map(t => {
                                    const selected = selectedIoTypeIds.includes(t.id);
                                    return (
                                      <button key={t.id} type="button"
                                        onMouseDown={e => { e.preventDefault(); setSelectedIoTypeIds(prev => selected ? prev.filter(id => id !== t.id) : [...prev, t.id]); }}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${selected ? (cat === 'Intake' ? 'bg-teal-50' : 'bg-orange-50') : 'hover:bg-gray-50'}`}>
                                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${selected ? (cat === 'Intake' ? 'bg-teal-500 border-teal-500' : 'bg-orange-400 border-orange-400') : 'border-gray-300 bg-white'}`}>
                                          {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                        </div>
                                        <span className={`flex-1 text-xs font-medium ${selected ? (cat === 'Intake' ? 'text-teal-700' : 'text-orange-700') : 'text-gray-700'}`}>{t.label}</span>
                                        {t.unit && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0 font-medium">{t.unit}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })}
                            {ioSearchQuery && ioTypes.filter(t => t.label.toLowerCase().includes(ioSearchQuery.toLowerCase())).length === 0 && (
                              <p className="px-3 py-2.5 text-xs text-gray-400 text-center">No I/O types match</p>
                            )}
                          </div>
                        )}
                        {selectedIoTypeIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {selectedIoTypeIds.map(id => {
                              const t = ioTypes.find(x => x.id === id);
                              return t ? (
                                <span key={id} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${t.category === 'Intake' ? 'bg-teal-100 text-teal-800' : 'bg-orange-100 text-orange-800'}`}>
                                  {t.label}
                                  <button type="button" onClick={() => setSelectedIoTypeIds(p => p.filter(x => x !== id))}
                                    className="ml-0.5 hover:opacity-70">×</button>
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                        <textarea value={ioFreeText} onChange={e => setIoFreeText(e.target.value)}
                          rows={2} placeholder="Additional I/O notes (volumes, timings…)"
                          className="w-full border border-teal-300 rounded-lg px-3 py-2 mt-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-teal-700 mb-1">Pain Score (0–10)</label>
                        <input type="number" min={0} max={10} value={nurseForm.painScore}
                          onChange={e => setNurseForm(p => ({ ...p, painScore: e.target.value }))}
                          placeholder="0 = none, 10 = severe"
                          className="w-full border border-teal-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-teal-700 mb-1">Alertness Level</label>
                        <select value={nurseForm.alertnessLevel}
                          onChange={e => setNurseForm(p => ({ ...p, alertnessLevel: e.target.value }))}
                          className="w-full border border-teal-300 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                          {['Alert', 'Drowsy', 'Confused', 'Unresponsive'].map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setNurseAddMode(false)}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button type="submit" disabled={nurseSaving}
                        className="px-4 py-1.5 text-xs bg-teal-600 text-white rounded-lg font-medium disabled:opacity-60">
                        {nurseSaving ? 'Saving…' : 'Save Entry'}
                      </button>
                    </div>
                  </form>
                )}

                {nurseLoading ? (
                  <div className="py-10 text-center text-gray-400 text-sm">Loading records…</div>
                ) : nurseRecords.length === 0 && pendingNurseRecords.length === 0 ? (
                  <div className="py-10 text-center text-gray-400">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No nurse records yet</p>
                    {!RO && <p className="text-xs mt-1">Click "Add Entry" to log the first record</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingNurseRecords.map((r, i) => {
                      const key = `pending-${i}`;
                      const isEditing = editingNurseKey === key;
                      return isEditing ? (
                        <div key={key} className="bg-yellow-50 rounded-xl p-3.5 border border-yellow-200 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-teal-700 mb-0.5">Nursing Notes</label>
                              <textarea rows={2} value={editNurseForm.nursingNotes ?? ''}
                                onChange={e => setEditNurseForm(p => ({ ...p, nursingNotes: e.target.value }))}
                                className="w-full border border-yellow-300 rounded px-2 py-1 text-xs bg-white focus:outline-none resize-none" />
                            </div>
                            <div>
                              <label className="block text-xs text-teal-700 mb-0.5">Medications Given</label>
                              <textarea rows={2} value={editNurseForm.medicationsGiven ?? ''}
                                onChange={e => setEditNurseForm(p => ({ ...p, medicationsGiven: e.target.value }))}
                                className="w-full border border-yellow-300 rounded px-2 py-1 text-xs bg-white focus:outline-none resize-none" />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs text-teal-700 mb-0.5">I/O Notes</label>
                              <input type="text" value={editNurseForm.intakeOutputNotes ?? ''}
                                onChange={e => setEditNurseForm(p => ({ ...p, intakeOutputNotes: e.target.value }))}
                                className="w-full border border-yellow-300 rounded px-2 py-1 text-xs bg-white focus:outline-none" />
                            </div>
                            <div>
                              <label className="block text-xs text-teal-700 mb-0.5">Pain Score</label>
                              <input type="number" min={0} max={10} value={editNurseForm.painScore ?? ''}
                                onChange={e => setEditNurseForm(p => ({ ...p, painScore: e.target.value ? Number(e.target.value) : undefined }))}
                                className="w-full border border-yellow-300 rounded px-2 py-1 text-xs bg-white focus:outline-none" />
                            </div>
                            <div>
                              <label className="block text-xs text-teal-700 mb-0.5">Alertness</label>
                              <select value={editNurseForm.alertnessLevel ?? ''}
                                onChange={e => setEditNurseForm(p => ({ ...p, alertnessLevel: e.target.value }))}
                                className="w-full border border-yellow-300 rounded px-2 py-1 text-xs bg-white focus:outline-none">
                                {['Alert','Drowsy','Confused','Unresponsive'].map(a => <option key={a} value={a}>{a}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditingNurseKey(null); setEditNurseForm({}); }}
                              className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button onClick={() => handleSaveEditNurse(key)}
                              className="px-3 py-1 text-xs bg-yellow-500 text-white rounded font-medium hover:bg-yellow-600">Save</button>
                          </div>
                        </div>
                      ) : (
                        <div key={key} className="bg-yellow-50 rounded-xl p-3.5 border border-yellow-200 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {r.shiftType && <span className="text-xs font-semibold text-teal-700 bg-teal-100 px-2.5 py-0.5 rounded-full">{r.shiftType}</span>}
                            {r.alertnessLevel && <span className="text-xs font-medium text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">{r.alertnessLevel}</span>}
                            {r.painScore != null && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                r.painScore >= 7 ? 'bg-red-100 text-red-700' : r.painScore >= 4 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                              }`}>Pain: {r.painScore}/10</span>
                            )}
                            {!RO && (
                              <button onClick={() => { setEditingNurseKey(key); setEditNurseForm({ shiftType: r.shiftType, nursingNotes: r.nursingNotes, medicationsGiven: r.medicationsGiven, intakeOutputNotes: r.intakeOutputNotes, painScore: r.painScore ?? undefined, alertnessLevel: r.alertnessLevel }); }}
                                className="ml-auto p-1 text-gray-400 hover:text-teal-600 rounded" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="space-y-0.5 text-xs">
                            {r.nursingNotes      && <p className="text-gray-700"><span className="font-medium text-gray-500">Notes: </span>{r.nursingNotes}</p>}
                            {r.medicationsGiven  && <p className="text-gray-700"><span className="font-medium text-gray-500">Meds: </span>{r.medicationsGiven}</p>}
                            {r.intakeOutputNotes && <p className="text-gray-700"><span className="font-medium text-gray-500">I/O: </span>{r.intakeOutputNotes}</p>}
                          </div>
                        </div>
                      );
                    })}
                    {nurseRecords.map(r => {
                      const key = r.id;
                      const isEditing = editingNurseKey === key;
                      return isEditing ? (
                        <div key={key} className="bg-blue-50 rounded-xl p-3.5 border border-blue-200 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-teal-700 mb-0.5">Nursing Notes</label>
                              <textarea rows={2} value={editNurseForm.nursingNotes ?? ''}
                                onChange={e => setEditNurseForm(p => ({ ...p, nursingNotes: e.target.value }))}
                                className="w-full border border-blue-200 rounded px-2 py-1 text-xs bg-white focus:outline-none resize-none" />
                            </div>
                            <div>
                              <label className="block text-xs text-teal-700 mb-0.5">Medications Given</label>
                              <textarea rows={2} value={editNurseForm.medicationsGiven ?? ''}
                                onChange={e => setEditNurseForm(p => ({ ...p, medicationsGiven: e.target.value }))}
                                className="w-full border border-blue-200 rounded px-2 py-1 text-xs bg-white focus:outline-none resize-none" />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs text-teal-700 mb-0.5">I/O Notes</label>
                              <input type="text" value={editNurseForm.intakeOutputNotes ?? ''}
                                onChange={e => setEditNurseForm(p => ({ ...p, intakeOutputNotes: e.target.value }))}
                                className="w-full border border-blue-200 rounded px-2 py-1 text-xs bg-white focus:outline-none" />
                            </div>
                            <div>
                              <label className="block text-xs text-teal-700 mb-0.5">Pain Score</label>
                              <input type="number" min={0} max={10} value={editNurseForm.painScore ?? ''}
                                onChange={e => setEditNurseForm(p => ({ ...p, painScore: e.target.value ? Number(e.target.value) : undefined }))}
                                className="w-full border border-blue-200 rounded px-2 py-1 text-xs bg-white focus:outline-none" />
                            </div>
                            <div>
                              <label className="block text-xs text-teal-700 mb-0.5">Alertness</label>
                              <select value={editNurseForm.alertnessLevel ?? ''}
                                onChange={e => setEditNurseForm(p => ({ ...p, alertnessLevel: e.target.value }))}
                                className="w-full border border-blue-200 rounded px-2 py-1 text-xs bg-white focus:outline-none">
                                {['Alert','Drowsy','Confused','Unresponsive'].map(a => <option key={a} value={a}>{a}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditingNurseKey(null); setEditNurseForm({}); }}
                              className="px-2 py-1 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button onClick={() => handleSaveEditNurse(key)}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded font-medium hover:bg-blue-700">Save</button>
                          </div>
                        </div>
                      ) : (
                        <div key={r.id} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-teal-700 bg-teal-100 px-2.5 py-0.5 rounded-full">{r.shiftType ?? '—'}</span>
                            <span className="text-xs font-medium text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">{r.alertnessLevel ?? '—'}</span>
                            {r.painScore != null && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.painScore >= 7 ? 'bg-red-100 text-red-700' : r.painScore >= 4 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                Pain: {r.painScore}/10
                              </span>
                            )}
                            <span className="text-xs text-gray-400 ml-auto">{fmtDate(r.recordedAt)} {fmtTime(r.recordedAt)}</span>
                            {!RO && (
                              <button onClick={() => { setEditingNurseKey(key); setEditNurseForm({ shiftType: r.shiftType ?? undefined, nursingNotes: r.nursingNotes ?? undefined, medicationsGiven: r.medicationsGiven ?? undefined, intakeOutputNotes: r.intakeOutputNotes ?? undefined, painScore: r.painScore ?? undefined, alertnessLevel: r.alertnessLevel ?? undefined }); }}
                                className="p-1 text-gray-400 hover:text-teal-600 rounded" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="space-y-0.5 text-xs">
                            {r.nursingNotes      && <p className="text-gray-700"><span className="font-medium text-gray-500">Notes: </span>{r.nursingNotes}</p>}
                            {r.medicationsGiven  && <p className="text-gray-700"><span className="font-medium text-gray-500">Meds: </span>{r.medicationsGiven}</p>}
                            {r.intakeOutputNotes && <p className="text-gray-700"><span className="font-medium text-gray-500">I/O: </span>{r.intakeOutputNotes}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Medication Log Tab (Form 4 pre-op) ── */}
            {activeTab === 'Medication Log' && (
              <div className="p-5">
                <PreOpMedicationLog
                  journeyId={journey.id}
                  readOnly={RO}
                  masterMedications={masterMeds}
                />
              </div>
            )}

            {/* ── PAC Tab (Form 3) ── */}
            {activeTab === 'PAC' && (
              <div className="p-5">
                {pacCompleted === false && !RO && (
                  <div className="mb-4 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>PAC assessment is incomplete. You may still mark ready for surgery, but you will be prompted to confirm.</span>
                  </div>
                )}
                <PacAssessmentForm
                  journeyId={journey.id}
                  readOnly={pacRO}
                  onStatusChange={completed => setPacCompleted(completed)}
                />
              </div>
            )}

          </div>

          {/* Footer — always visible */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              {RO ? 'Close' : 'Cancel'}
            </button>
            {!RO && (
              <button onClick={handleSaveAndMarkReady} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-60">
                {saving ? 'Saving…' : '✅ Save & Mark Ready for Surgery'}
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Patient CaseSheet Modal (read-only) ──────────────────────────────────────

function PatientCaseSheetModal({ journey, onClose }: { journey: PatientJourneyRowDto; onClose: () => void }) {
  const statePills = [
    { label: 'Clinical', value: journey.clinicalState, color: 'bg-blue-100 text-blue-700' },
    { label: 'OT', value: journey.otState, color: 'bg-amber-100 text-amber-700' },
    { label: 'Financial', value: journey.financialState, color: 'bg-green-100 text-green-700' },
    { label: 'Post-Op', value: journey.postOpState ?? '—', color: 'bg-violet-100 text-violet-700' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">Patient Case Sheet</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Patient header */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl shrink-0">
              {(journey.patientName ?? '?').charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{journey.patientName ?? '—'}</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
                <span className="font-mono text-blue-700 font-medium">{journey.uhid ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Status chips */}
          <div className="flex flex-wrap gap-2">
            {statePills.map(s => (
              <span key={s.label} className={`text-xs px-3 py-1 rounded-full font-medium ${s.color}`}>
                {s.label}: {s.value}
              </span>
            ))}
          </div>

          {/* Clinical info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Eye &amp; Procedure</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Eye Operated</p>
                <p className="font-medium text-gray-800">{journey.eyeOperated ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Procedure</p>
                <p className="font-medium text-gray-800">{journey.procedureName ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Package Amount</p>
                <p className="font-bold text-gray-900">{fmtINR(journey.packageAmount)}</p>
              </div>
            </div>
          </div>

          {/* Timeline info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Timeline</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Admitted</p>
                <p className="font-medium text-gray-800">{fmtDate(journey.admittedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Scheduled Surgery</p>
                <p className="font-medium text-gray-800">{fmtDate(journey.surgeryScheduledAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Ward / Bed</p>
                <p className="font-medium text-gray-800">
                  {journey.wardName ?? '—'}{journey.bedNumber ? ` · ${journey.bedNumber}` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 pb-6">
          <button onClick={onClose} className="px-5 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Emergency FC Modal ───────────────────────────────────────────────────────

function EmergencyFcModal({ journey, onClose, onSaved }: {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError('Reason is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await ipManagementApi.applyEmergencyFc(journey.id, { reason: reason.trim() });
      if (result) {
        onSaved({ ...journey, financialState: result.financialState });
        onClose();
      } else {
        setError('Failed to apply Emergency FC. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Emergency Financial Category</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold text-orange-900">{journey.patientName}</p>
            <p className="text-orange-700 text-xs mt-0.5">Applying Emergency FC overrides the standard financial workflow.</p>
          </div>
          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} required rows={3}
              placeholder="Describe the emergency financial situation…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-60">
              {saving ? 'Applying…' : 'Apply Emergency FC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Send To OT Modal ─────────────────────────────────────────────────────────

function SendToOTModal({ journey, onClose, onSaved }: {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    setSaving(true);
    setError('');
    try {
      const result = await transitionClinicalWithGates(journey.id, { newState: 'SentToOT' });
      if (result) {
        onSaved({ ...journey, clinicalState: result.clinicalState });
        onClose();
      } else {
        setError('Could not send to OT. Patient may not be in ReadyForSurgery state.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900">Send to Operation Theatre</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Patient context */}
          <div className="bg-teal-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-200 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
              {(journey.patientName ?? '?').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-teal-900 text-sm">{journey.patientName ?? '—'}</p>
              <p className="text-teal-700 text-xs truncate">{journey.uhid} · {journey.procedureName ?? '—'}</p>
            </div>
          </div>

          {/* Context details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {journey.eyeOperated && (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">Eye</p>
                <p className="font-semibold text-gray-700 mt-0.5">{journey.eyeOperated}</p>
              </div>
            )}
            {journey.wardName && (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">Ward / Bed</p>
                <p className="font-semibold text-gray-700 mt-0.5">{journey.wardName}{journey.bedNumber ? ` · ${journey.bedNumber}` : ''}</p>
              </div>
            )}
            {journey.surgeryScheduledAt && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 col-span-2">
                <p className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">Surgery Scheduled</p>
                <p className="font-semibold text-gray-700 mt-0.5">
                  {new Date(journey.surgeryScheduledAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-600">
            This will notify the Operation Theatre team. OT details (anaesthetist, theatre room, surgical team) can be filled in from the <span className="font-medium text-teal-700">Operation Theatre</span> page.
          </p>

          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSend} disabled={saving}
              className="px-5 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-60 flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5" />
              {saving ? 'Sending…' : 'Send to OT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Post-Op Ward Modal ───────────────────────────────────────────────────────

function PostOpWardModal({ journey, onClose, onSaved }: {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
}) {
  const [activeTab, setActiveTab] = useState<'Overview' | 'Form4Checklist' | 'NurseChecklist' | 'SurgeonChecklist'>('Form4Checklist');
  const [nurseItems,  setNurseItems]  = useState<ChecklistItemDto[]>([]);
  const [surgeonItems,setSurgeonItems]= useState<ChecklistItemDto[]>([]);
  const [nurseChecks, setNurseChecks] = useState<Record<string, { done: boolean; notes: string }>>({});
  const [surgeonChecks,setSurgeonChecks]=useState<Record<string, { done: boolean; notes: string }>>({});
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistLoaded, setChecklistLoaded] = useState<'nurse'|'surgeon'|null>(null);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');

  async function loadChecklist(mode: 'nurse' | 'surgeon') {
    if (checklistLoaded === mode) return;
    setChecklistLoading(true);
    const data = mode === 'nurse'
      ? await ipManagementApi.getNurseChecklist(journey.id)
      : await ipManagementApi.getSurgeonChecklist(journey.id);
    const init: Record<string, { done: boolean; notes: string }> = {};
    data.items.forEach(item => {
      const resp = data.responses.find((r: ChecklistResponseDto) => r.itemId === item.id);
      init[item.id] = { done: resp?.isCompleted ?? false, notes: resp?.notes ?? '' };
    });
    if (mode === 'nurse') {
      setNurseItems(data.items);
      setNurseChecks(init);
    } else {
      setSurgeonItems(data.items);
      setSurgeonChecks(init);
    }
    setChecklistLoaded(mode);
    setChecklistLoading(false);
  }

  function handleTabChange(tab: 'Overview' | 'Form4Checklist' | 'NurseChecklist' | 'SurgeonChecklist') {
    setActiveTab(tab);
    if (tab === 'NurseChecklist') loadChecklist('nurse');
    if (tab === 'SurgeonChecklist') loadChecklist('surgeon');
  }

  async function handleSaveChecklist() {
    const mode = activeTab === 'NurseChecklist' ? 'nurse' : 'surgeon';
    const checks = mode === 'nurse' ? nurseChecks : surgeonChecks;
    const items  = mode === 'nurse' ? nurseItems  : surgeonItems;
    setSavingChecklist(true);
    try {
      const req = {
        responses: items.map(item => ({
          itemId: item.id,
          isCompleted: checks[item.id]?.done ?? false,
          notes: checks[item.id]?.notes || undefined,
        })),
      };
      if (mode === 'nurse') {
        await ipManagementApi.saveNurseChecklist(journey.id, req);
      } else {
        await ipManagementApi.saveSurgeonChecklist(journey.id, req);
      }
    } finally {
      setSavingChecklist(false);
    }
  }

  async function handleMarkReady() {
    setMarking(true);
    setError('');
    try {
      const result = await transitionClinicalWithGates(journey.id, { newState: 'ReadyForDischarge' });
      if (result) {
        onSaved({ ...journey, clinicalState: result.clinicalState });
        onClose();
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
               ?? (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message
               ?? (e instanceof Error ? e.message : null)
               ?? 'Failed to mark ready for discharge.';
      setError(msg);
    } finally {
      setMarking(false);
    }
  }

  const tabs = [
    { key: 'Overview'        as const, label: 'Overview'         },
    { key: 'Form4Checklist'  as const, label: 'Form 4 Checklist' },
    { key: 'NurseChecklist'  as const, label: 'Nurse Checklist'  },
    { key: 'SurgeonChecklist'as const, label: 'Surgeon Checklist'},
  ];

  const checks = activeTab === 'NurseChecklist' ? nurseChecks : surgeonChecks;
  const items  = activeTab === 'NurseChecklist' ? nurseItems  : surgeonItems;
  const setChecks = activeTab === 'NurseChecklist' ? setNurseChecks : setSurgeonChecks;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold shrink-0">
              {(journey.patientName ?? '?').charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-gray-900">{journey.patientName ?? '—'}</p>
                <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{journey.uhid ?? '—'}</span>
                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Post-Op</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{journey.procedureName ?? '—'} · {journey.eyeOperated ?? '—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-3 border-b border-gray-100 shrink-0 gap-1">
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => handleTabChange(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === key ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}

          {activeTab === 'Overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Ward / Bed', value: journey.wardName ? `${journey.wardName}${journey.bedNumber ? ` · ${journey.bedNumber}` : ''}` : '—' },
                  { label: 'Admitted', value: fmtDate(journey.admittedAt) },
                  { label: 'Surgery Date', value: fmtDate(journey.surgeryScheduledAt) },
                  { label: 'Admission Type', value: journey.admissionType ?? '—' },
                  { label: 'Financial State', value: journey.financialState },
                  { label: 'OT State', value: journey.otState },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                    <p className="font-semibold text-gray-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-violet-800">
                <p className="font-semibold mb-1">Post-Op Stage</p>
                <p className="text-xs">Patient is recovering post-surgery. Complete nurse and surgeon checklists, then mark ready for discharge.</p>
              </div>
            </div>
          )}

          {activeTab === 'Form4Checklist' && (
            <WardPostOpChecklist
              journeyId={journey.id}
              counselingSessionId={journey.counselingSessionId ?? undefined}
            />
          )}

          {/* Legacy nurse / surgeon checklists */}
          {(activeTab === 'NurseChecklist' || activeTab === 'SurgeonChecklist') && (
            <div className="space-y-3">
              {checklistLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
              ) : items.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <SquareCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No checklist items found</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500">{Object.values(checks).filter(v => v.done).length}/{items.length} completed</p>
                  </div>
                  {items.map(item => (
                    <label key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input type="checkbox" checked={checks[item.id]?.done ?? false}
                        onChange={e => setChecks((c: Record<string, { done: boolean; notes: string }>) => ({ ...c, [item.id]: { ...c[item.id], done: e.target.checked } }))}
                        className="mt-0.5 w-4 h-4 rounded accent-violet-600" />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${checks[item.id]?.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {item.itemLabel}
                          {item.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        {checks[item.id]?.done && (
                          <input type="text" placeholder="Notes (optional)"
                            value={checks[item.id]?.notes ?? ''}
                            onChange={e => setChecks((c: Record<string, { done: boolean; notes: string }>) => ({ ...c, [item.id]: { ...c[item.id], notes: e.target.value } }))}
                            onClick={e => e.stopPropagation()}
                            className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400" />
                        )}
                      </div>
                    </label>
                  ))}
                  <div className="flex justify-end pt-1">
                    <button onClick={handleSaveChecklist} disabled={savingChecklist}
                      className="px-4 py-2 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium disabled:opacity-60">
                      {savingChecklist ? 'Saving…' : 'Save Checklist'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Close
          </button>
          <button onClick={handleMarkReady} disabled={marking}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-60">
            <LogOut className="h-4 w-4" />
            {marking ? 'Marking…' : 'Mark Ready for Discharge'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Discharge Summary Modal (Ward-owned) ─────────────────────────────────────

function WardDischargeSummaryModal({ journey, onClose, onSaved }: {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
}) {
  const { canEditMonitoring } = useIpChecklistPermissions();
  const [form, setForm] = useState<SaveDischargeSummaryRequest>({
    conditionAtDischarge: '',
    diagnosisCodes: '',
    proceduresPerformed: '',
    hospitalCourse: '',
    dischargeInstructions: '',
    medicationsOnDischarge: '',
    followUpPlan: '',
    formatType: 'Standard',
  });
  const [isFinalized, setIsFinalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [error, setError] = useState('');
  const [anaesClearanceComplete, setAnaesClearanceComplete] = useState<boolean | null>(null);
  const [nurseSummaryIssued, setNurseSummaryIssued] = useState(false);
  const [overrideApplying, setOverrideApplying] = useState(false);

  useEffect(() => {
    (async () => {
      const [data, postOp] = await Promise.all([
        ipManagementApi.getDischargeSummary(journey.id),
        ipManagementApi.getWardPostOpChecklist(journey.id),
      ]);
      if (data) {
        setForm({
          conditionAtDischarge:  data.conditionAtDischarge ?? '',
          diagnosisCodes:        data.diagnosisCodes ?? '',
          proceduresPerformed:   data.proceduresPerformed ?? '',
          hospitalCourse:        data.hospitalCourse ?? '',
          dischargeInstructions: data.dischargeInstructions ?? '',
          medicationsOnDischarge:data.medicationsOnDischarge ?? '',
          followUpPlan:          data.followUpPlan ?? '',
          formatType:            data.formatType ?? 'Standard',
        });
        setIsFinalized(data.summaryStatus === 'Final');
      }
      const issued = postOp?.items.find(i => i.itemKey === 'discharge_summary_issued');
      setNurseSummaryIssued(!!issued?.isCompleted || !!issued?.isBypassed);
      setLoading(false);
    })();
  }, [journey.id]);

  const fields: Array<{ label: string; key: keyof SaveDischargeSummaryRequest; type?: string; rows?: number; options?: string[] }> = [
    { label: 'Diagnosis Codes',          key: 'diagnosisCodes',        rows: 2 },
    { label: 'Procedures Performed',     key: 'proceduresPerformed',   rows: 2 },
    { label: 'Hospital Course',          key: 'hospitalCourse',        rows: 3 },
    { label: 'Condition at Discharge',   key: 'conditionAtDischarge',  type: 'select',
      options: ['', 'Good', 'Stable', 'Fair', 'Guarded'] },
    { label: 'Discharge Instructions',   key: 'dischargeInstructions', rows: 3 },
    { label: 'Medications on Discharge', key: 'medicationsOnDischarge',rows: 3 },
    { label: 'Follow-up Plan',           key: 'followUpPlan',          rows: 2 },
  ];

  async function handleSave() {
    setSaving(true);
    try {
      await ipManagementApi.saveDischargeSummary(journey.id, form);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      const result = await ipManagementApi.finalizeDischargeSummary(journey.id);
      if (result) setIsFinalized(true);
    } finally {
      setFinalizing(false);
    }
  }

  async function handleDischargeOverride() {
    const reason = window.prompt('Reason for discharge override (checklist gates incomplete):');
    if (!reason?.trim()) return;
    setOverrideApplying(true);
    try {
      await ipManagementApi.applyDischargeOverride(journey.id, { reason: reason.trim() });
      setError('');
    } catch {
      setError('Failed to apply discharge override.');
    } finally {
      setOverrideApplying(false);
    }
  }

  async function handleDischarge() {
    if (!isFinalized) { setError('Please finalize the discharge summary first.'); return; }
    setDischarging(true);
    setError('');
    try {
      const result = await transitionClinicalWithGates(journey.id, { newState: 'Discharged' });
      if (result) {
        onSaved({ ...journey, clinicalState: result.clinicalState });
        onClose();
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
               ?? (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message
               ?? (e instanceof Error ? e.message : null)
               ?? 'Discharge failed.';
      setError(msg);
    } finally {
      setDischarging(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <LogOut className="h-4 w-4 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Discharge Summary</h2>
              <p className="text-xs text-gray-500">{journey.patientName ?? '—'} · {journey.uhid ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isFinalized && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Finalized</span>}
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`rounded-lg border px-3 py-2 ${isFinalized ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className="font-semibold text-gray-700">Clinical summary</p>
              <p className={`mt-0.5 ${isFinalized ? 'text-green-800' : 'text-gray-600'}`}>
                {isFinalized ? 'Final — locked' : 'Draft — not finalized'}
              </p>
            </div>
            <div className={`rounded-lg border px-3 py-2 ${nurseSummaryIssued ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className="font-semibold text-gray-700">Nurse checklist (P10)</p>
              <p className={`mt-0.5 ${nurseSummaryIssued ? 'text-green-800' : 'text-amber-800'}`}>
                {nurseSummaryIssued ? 'discharge_summary_issued ✓' : 'discharge_summary_issued pending'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : fields.map(({ label, key, type, rows, options }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              {type === 'select' ? (
                <select value={(form[key] as string) ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  disabled={isFinalized}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400">
                  {(options ?? []).map(opt => (
                    <option key={opt} value={opt}>{opt || '— select —'}</option>
                  ))}
                </select>
              ) : (
                <textarea value={(form[key] as string) ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  rows={rows ?? 2} disabled={isFinalized}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none disabled:bg-gray-50 disabled:text-gray-400" />
              )}
            </div>
          ))}

          <AnaesthesiaMonitoringPanel
            journeyId={journey.id}
            mode="discharge"
            readOnly={isFinalized || !canEditMonitoring}
            onClearanceChange={setAnaesClearanceComplete}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Close</button>
            <button onClick={handleDischargeOverride} disabled={overrideApplying}
              className="px-3 py-2 text-xs border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-50 disabled:opacity-50">
              {overrideApplying ? 'Applying…' : 'Discharge override'}
            </button>
          </div>
          {!isFinalized && (
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button onClick={handleFinalize} disabled={finalizing}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-60">
                {finalizing ? 'Finalizing…' : 'Finalize & Lock'}
              </button>
            </div>
          )}
          <button onClick={handleDischarge} disabled={discharging || !isFinalized}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed">
            <LogOut className="h-4 w-4" />
            {discharging ? 'Discharging…' : 'Discharge Patient'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Row Icon Action Bar ───────────────────────────────────────────────────────

function InlineRowActions({ journey, onAction }: {
  journey: PatientJourneyRowDto;
  onAction: (modal: ModalType) => void;
}) {
  const state = journey.clinicalState;

  const icon = (title: string, child: React.ReactNode, onClick: () => void, cls: string) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${cls}`}
    >{child}</button>
  );

  return (
    <div className="flex items-center gap-1 flex-nowrap">
      {state === 'ReadyForSurgery' && (
        icon('Send to OT', <span className="text-xs font-bold px-0.5">→OT</span>, () => onAction('sendToOT'), 'text-teal-600 hover:text-teal-800 hover:bg-teal-50 border border-teal-300')
      )}
      {icon('Case Sheet', <FileText className="h-3.5 w-3.5" />, () => onAction('caseSheet'), 'text-gray-400 hover:text-gray-700 hover:bg-gray-100')}
      {!journey.isLocked && state !== 'Discharged' && (
        icon('Emergency FC', <AlertTriangle className="h-3.5 w-3.5" />, () => onAction('emergencyFc'), 'text-orange-500 hover:text-orange-700 hover:bg-orange-50')
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WardManagementPage() {
  const { user, token } = useAuthStore();
  const branchId = user?.branchId;

  const [journeys, setJourneys] = useState<PatientJourneyRowDto[]>([]);
  const [wards, setWards] = useState<WardDto[]>([]);
  const [isLoading, setIsLoading] = useState(
    () => !!(useAuthStore.getState().token && useAuthStore.getState().user?.branchId)
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClinicalTab>('All');
  const [filters, setFilters] = useState({ surgeryDate: '', showDischarged: false });
  const [appliedFilters, setAppliedFilters] = useState({ surgeryDate: '', showDischarged: false });

  const [selectedJourney, setSelectedJourney] = useState<PatientJourneyRowDto | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [transitionLoading, setTransitionLoading] = useState<string | null>(null);

  async function loadData() {
    if (!branchId) {
      setIsLoading(false);
      setLoadError('Your account has no branch assigned. Please contact your administrator.');
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const { journeys: journeyData, wards: wardData } = await fetchWardData(branchId);
      setJourneys(journeyData);
      setWards(wardData);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setLoadError('Session expired. Please refresh the page or log in again.');
      } else if (status === 400) {
        setLoadError('Invalid request. Branch configuration may be missing.');
      } else {
        setLoadError('Could not load ward data. The service may be starting up — please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!token) return; loadData(); }, [token, branchId]);

  async function handleSearch() {
    setAppliedFilters(filters);
    setIsLoading(true);
    setLoadError(null);
    try {
      const { journeys: fresh } = await fetchWardData(branchId!);
      setJourneys(fresh);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setLoadError('Session expired. Please refresh the page or log in again.');
      } else {
        setLoadError('Could not load ward data. The service may be starting up — please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleRowUpdated(updated: PatientJourneyRowDto) {
    setJourneys(prev => prev.map(j => j.id === updated.id ? updated : j));
  }

  function openModal(journey: PatientJourneyRowDto, modal: ModalType) {
    setSelectedJourney(journey);
    setActiveModal(modal);
  }

  function closeModal() {
    setSelectedJourney(null);
    setActiveModal(null);
  }

  function handleRowClick(journey: PatientJourneyRowDto) {
    const state = journey.clinicalState;
    if (state === 'Expected') {
      openModal(journey, 'preop');
    } else if (state === 'Admitted') {
      openModal(journey, 'wardUpdation');
    } else if (state === 'ReadyForSurgery') {
      openModal(journey, 'sendToOT');
    } else if (state === 'PostOp') {
      openModal(journey, 'postOpWard');
    } else if (state === 'ReadyForDischarge') {
      openModal(journey, 'discharge');
    } else {
      // SentToOT, InOT, SurgeryCompleted, Discharged → journey timeline
      openModal(journey, 'journey');
    }
  }

  const displayJourneys = useMemo(() => {
    let list = Array.isArray(journeys) ? journeys : [];
    if (!appliedFilters.showDischarged) list = list.filter(j => j.clinicalState !== 'Discharged');
    if (activeTab !== 'All') list = list.filter(j => j.clinicalState === activeTab);
    if (appliedFilters.surgeryDate) list = list.filter(j => j.surgeryScheduledAt?.startsWith(appliedFilters.surgeryDate));
    return list;
  }, [journeys, activeTab, appliedFilters]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: journeys.length };
    STATUS_TABS.slice(1).forEach(({ key }) => {
      map[key] = journeys.filter(j => j.clinicalState === key).length;
    });
    return map;
  }, [journeys]);

  const statCounts = useMemo(() => {
    const map: Record<string, number> = {};
    STAT_CARDS.forEach(({ key }) => { map[key] = journeys.filter(j => j.clinicalState === key).length; });
    return map;
  }, [journeys]);

  return (
    <div className="space-y-4">
      {/* Modals */}
      {selectedJourney && activeModal === 'preop' && (
        <PreOpChecklistModal
          journey={selectedJourney}
          branchId={branchId}
          onClose={closeModal}
          onAdmitSuccess={u => { handleRowUpdated(u); closeModal(); }}
        />
      )}
      {selectedJourney && activeModal === 'admit' && (
        <AdmitModal journey={selectedJourney} wards={wards} onClose={closeModal}
          onSaved={u => { handleRowUpdated(u); closeModal(); }} />
      )}
      {selectedJourney && activeModal === 'wardUpdation' && (
        <WardUpdationModal journey={selectedJourney} wards={wards} onClose={closeModal}
          onSaved={u => { handleRowUpdated(u); closeModal(); }}
          readOnly={selectedJourney.clinicalState === 'Discharged'} />
      )}
      {selectedJourney && activeModal === 'caseSheet' && (
        <PatientCaseSheetModal journey={selectedJourney} onClose={closeModal} />
      )}
      {selectedJourney && activeModal === 'emergencyFc' && (
        <EmergencyFcModal journey={selectedJourney} onClose={closeModal}
          onSaved={u => { handleRowUpdated(u); closeModal(); }} />
      )}
      {selectedJourney && activeModal === 'sendToOT' && (
        <SendToOTModal journey={selectedJourney} onClose={closeModal}
          onSaved={u => { handleRowUpdated(u); closeModal(); }} />
      )}
      {selectedJourney && activeModal === 'postOpWard' && (
        <PostOpWardModal journey={selectedJourney} onClose={closeModal}
          onSaved={u => { handleRowUpdated(u); closeModal(); }} />
      )}
      {selectedJourney && activeModal === 'discharge' && (
        <WardDischargeSummaryModal journey={selectedJourney} onClose={closeModal}
          onSaved={u => { handleRowUpdated(u); closeModal(); }} />
      )}
      {selectedJourney && activeModal === 'journey' && (
        <JourneyModal
          journeyId={selectedJourney.id}
          clinicalState={selectedJourney.clinicalState}
          patientName={selectedJourney.patientName}
          onClose={closeModal}
          onStateChange={partial => {
            setJourneys(prev => prev.map(j =>
              j.id === selectedJourney.id ? { ...j, ...partial } : j
            ));
          }}
        />
      )}

      <div>
        {/* Ward Management title removed — stat cards serve as context */}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {STAT_CARDS.map(({ key, label, bg, icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`rounded-xl p-3 text-left border transition-all ${activeTab === key ? `${bg} border-current shadow-sm` : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
            <div className="text-xl mb-1">{icon}</div>
            <p className="text-2xl font-bold">{statCounts[key] ?? 0}</p>
            <p className="text-xs font-medium mt-0.5 text-gray-600 leading-tight">{label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Surgery Date</label>
            <input type="date" value={filters.surgeryDate} onChange={e => setFilters(f => ({ ...f, surgeryDate: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
            <div onClick={() => setFilters(f => ({ ...f, showDischarged: !f.showDischarged }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${filters.showDischarged ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${filters.showDischarged ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-gray-700 font-medium">Show Discharged</span>
          </label>
          <button onClick={handleSearch}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Search className="h-4 w-4" /> Search
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Status tabs */}
        <div className="flex items-center px-4 pt-4 pb-3 overflow-x-auto gap-1.5">
          {STATUS_TABS.map(({ key, label, color, activeClass }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                activeTab === key ? `${activeClass} shadow-sm` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeTab === key ? 'bg-white/80' : color}`} />
              {label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${activeTab === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {counts[key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-y border-gray-100">
                {['Status', '#', 'MR No', 'Patient Name', 'Age / Gender', 'Admission Type', 'Eye / Procedure', 'OT State', 'Ward / Bed', 'Admitted', 'Surgery Date', 'Surgery Time', ''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide whitespace-nowrap bg-gray-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                : loadError
                ? (
                  <tr>
                    <td colSpan={13} className="py-14 text-center">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                      <p className="text-sm font-medium text-gray-700 mb-1">Failed to load ward data</p>
                      <p className="text-xs text-gray-400 mb-4">{loadError}</p>
                      <button
                        onClick={() => loadData()}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                        Try Again
                      </button>
                    </td>
                  </tr>
                )
                : displayJourneys.length === 0
                ? (
                  <tr>
                    <td colSpan={13} className="py-14 text-center text-gray-400">
                      <Tent className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No patients found in this category</p>
                    </td>
                  </tr>
                )
                : displayJourneys.map((j, idx) => {
                  const patientAge = j.patientDob
                    ? Math.floor((Date.now() - new Date(j.patientDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                    : null;
                  const ageGender = [
                    patientAge !== null ? `${patientAge}y` : null,
                    j.patientGender ? j.patientGender[0].toUpperCase() : null,
                  ].filter(Boolean).join(' / ') || '—';
                  return (
                  <tr key={j.id} onClick={() => handleRowClick(j)}
                    className={`transition-colors cursor-pointer ${
                      j.clinicalState === 'SurgeryCompleted' ? 'bg-green-50 hover:bg-green-100' :
                      j.clinicalState === 'InOT'            ? 'bg-amber-50 hover:bg-amber-100' :
                                                              'hover:bg-blue-50'
                    } ${transitionLoading === j.id ? 'opacity-50 pointer-events-none' : ''}`}>
                    <td className="px-3 py-3">
                      <StatusBadge status={j.clinicalState} size="sm" />
                      <WardExpectedP0Chip
                        counselingSessionId={j.counselingSessionId}
                        clinicalState={j.clinicalState}
                      />
                      {j.clinicalState === 'ReadyForSurgery' && j.otReturnReason && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5 mt-1 whitespace-nowrap">
                          ⚠ Returned from OT
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{idx + 1}</td>
                    <td className="px-3 py-3 font-mono text-xs text-blue-700 font-medium">{j.uhid ?? '—'}</td>
                    <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">{j.patientName ?? '—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{ageGender}</td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{j.admissionType ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-700 text-xs whitespace-nowrap">
                      {j.eyeOperated ? <span className="font-medium">{j.eyeOperated}</span> : null}
                      {j.eyeOperated && j.procedureName ? <span className="text-gray-400"> · </span> : null}
                      {j.procedureName ?? (j.eyeOperated ? null : '—')}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={j.otState} size="sm" /></td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      <span className="font-medium">{j.wardName ?? '—'}</span>
                      {j.bedNumber && <span className="text-gray-400"> · {j.bedNumber}</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{fmt(j.admittedAt)}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(j.surgeryScheduledAt)}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtTime(j.surgeryScheduledAt)}</td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <InlineRowActions
                        journey={j}
                        onAction={modal => openModal(j, modal)}
                      />
                    </td>
                  </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>

        {!isLoading && displayJourneys.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing <span className="font-medium">{displayJourneys.length}</span> of <span className="font-medium">{journeys.length}</span> patients
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
