'use client';

/**
 * Ward care tab panel (vitals, med log, nurse records, remark) embedded in WardPreOpWorkspaceModal.
 * Use `WardPreOpCareTabsPanel` — standalone modal wrappers were removed in Phase 4.
 */
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Search, X, Lock, Activity, ClipboardList, Stethoscope, CirclePlus, Pencil, Pill, AlertTriangle,
} from 'lucide-react';
import { PacAssessmentForm } from '@/components/ip-management/PacAssessmentForm';
import { PreOpMedicationLog } from '@/components/ip-management/PreOpMedicationLog';
import {
  ipManagementApi,
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
} from '@/lib/api/ip-management.api';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { transitionClinicalWithGates } from '@/lib/ip-checklist/transition-gates';

const PAC_EDITABLE_STATES = new Set(['Admitted', 'ReadyForSurgery']);

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

function Checkbox({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm select-none ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className={disabled ? 'text-gray-500' : 'text-gray-700'}>{label}</span>
    </label>
  );
}

export type WardUpdationTab = 'General' | 'Remark' | 'Vitals' | 'Nurse Records' | 'Medication Log' | 'PAC';

export type WardPreOpCareTab = 'vitals' | 'medLog' | 'nurseRecords' | 'remark';

export function mapCareTabToWardUpdation(tab: WardPreOpCareTab): WardUpdationTab {
  switch (tab) {
    case 'vitals': return 'Vitals';
    case 'medLog': return 'Medication Log';
    case 'nurseRecords': return 'Nurse Records';
    case 'remark': return 'Remark';
  }
}

/** @deprecated Use `WardPreOpCareTabsHandle` */
export type WardUpdationModalHandle = WardPreOpCareTabsHandle;

export interface WardPreOpCareTabsHandle {
  saveAndMarkReady: () => Promise<void>;
}

export interface WardUpdationModalInnerProps {
  journey: PatientJourneyRowDto;
  wards: WardDto[];
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
  readOnly?: boolean;
  embedded?: boolean;
  forcedTab?: WardUpdationTab;
  hideFooter?: boolean;
  hideHeader?: boolean;
  hideTabs?: boolean;
}

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

function WardUpdationModalInner({
  journey,
  wards,
  onClose,
  onSaved,
  readOnly,
  embedded = false,
  forcedTab,
  hideFooter = false,
  hideHeader = false,
  hideTabs = false,
  modalRef,
}: WardUpdationModalInnerProps & { modalRef?: React.Ref<WardPreOpCareTabsHandle> }) {
  const { canEditWardChecklist, canEditPac } = useIpChecklistPermissions();
  const [activeTab, setActiveTab] = useState<WardUpdationTab>(forcedTab ?? 'General');
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

  async function handleSaveAndMarkReady(e?: React.FormEvent) {
    e?.preventDefault();
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
      if (!embedded) onClose();
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

  useImperativeHandle(modalRef, () => ({
    saveAndMarkReady: () => handleSaveAndMarkReady(),
  }));

  useEffect(() => {
    if (forcedTab) handleTabChange(forcedTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedTab, journey.id]);

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
      <div className={embedded ? 'flex flex-col min-h-0' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm'}>
        <div className={embedded ? 'flex flex-col min-h-0' : 'bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col'}>

          {/* Header */}
          {!hideHeader && (
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
          )}

          {/* Tabs */}
            {!hideTabs && (
          <div className="flex px-6 pt-3 border-b border-gray-100 shrink-0 gap-1">
            {([
              { key: 'General'       as WardUpdationTab, label: 'General' },
              { key: 'Vitals'        as WardUpdationTab, label: 'Vitals',        icon: <Activity className="h-3.5 w-3.5" /> },
              { key: 'Medication Log' as WardUpdationTab, label: 'Medication Log', icon: <Pill className="h-3.5 w-3.5" /> },
              { key: 'Nurse Records' as WardUpdationTab, label: 'Nurse Records', icon: <ClipboardList className="h-3.5 w-3.5" /> },
              ...(!embedded ? [{ key: 'PAC' as WardUpdationTab, label: 'PAC', icon: <Stethoscope className="h-3.5 w-3.5" /> }] : []),
              { key: 'Remark'        as WardUpdationTab, label: 'Remark' },
            ]).map(({ key, label, icon }) => (
              <button key={key} onClick={() => handleTabChange(key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {icon}{label}
              </button>
            ))}
          </div>
          )}

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

            {/* ── Medication Log Tab ── */}
            {activeTab === 'Medication Log' && (
              <div className="p-5">
                <PreOpMedicationLog
                  journeyId={journey.id}
                  readOnly={RO}
                  masterMedications={masterMeds}
                />
              </div>
            )}

            {!embedded && activeTab === 'PAC' && (
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
          {!hideFooter && (
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
          )}

        </div>
      </div>
    </>
  );
}

export interface WardPreOpCareTabsPanelProps {
  journey: PatientJourneyRowDto;
  wards: WardDto[];
  activeTab: WardPreOpCareTab;
  readOnly?: boolean;
  onSaved?: (updated: PatientJourneyRowDto) => void;
}

/** Embedded care-tab body for WardPreOpWorkspaceModal (vitals, med log, nurse, remark). */
export const WardPreOpCareTabsPanel = forwardRef<WardPreOpCareTabsHandle, WardPreOpCareTabsPanelProps>(
  function WardPreOpCareTabsPanel({ journey, wards, activeTab, readOnly, onSaved }, ref) {
    return (
      <WardUpdationModalInner
        journey={journey}
        wards={wards}
        onClose={() => {}}
        onSaved={onSaved ?? (() => {})}
        readOnly={readOnly}
        embedded
        hideFooter
        hideHeader
        hideTabs
        forcedTab={mapCareTabToWardUpdation(activeTab)}
        modalRef={ref}
      />
    );
  },
);
WardPreOpCareTabsPanel.displayName = 'WardPreOpCareTabsPanel';