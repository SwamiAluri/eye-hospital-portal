'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Stethoscope, Search, X, ClipboardList, SquareCheck,
  FileText, Zap, Plus, Trash2, Pen, ChevronDown, ChevronUp,
  AlertTriangle, RotateCcw, CheckCircle2, Info, Play, StopCircle,
  UserX, Eye,
} from 'lucide-react';
import {
  ipManagementApi,
  PatientJourneyRowDto, PatientJourneyDetailDto,
  UpdateOtDetailsRequest, TransitionRequest,
  ChecklistItemDto, ChecklistResponseDto,
  SurgeryNoteTemplateDto, AddSurgeryNoteTemplateRequest,
  RecordIolReturnRequest,
  SaveIntraOpNoteRequest, IntraOpPresetDto,
  IolCatalogItemDto,
} from '@/lib/api/ip-management.api';
import { getSurgeons, Surgeon, getNurses, Nurse, getOtTheaters, OtTheater } from '@/lib/api/widgets.api';
import { useAuthStore } from '@/lib/auth-store';
import { StatusBadge } from '@/components/counsellors-desk/StatusBadge';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { buildOtPresetMap, useOtIntraOpPresets } from '@/hooks/use-ot-intraop-presets';
import { OtSurgicalSafetyChecklist } from '@/components/ip-management/OtSurgicalSafetyChecklist';
import { AnaesthesiaMonitoringPanel } from '@/components/ip-management/AnaesthesiaMonitoringPanel';
import { SurgicalSafetyGateDto } from '@/lib/api/ip-management.api';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import {
  acceptInOtWithGates,
  startSurgeryWithGates,
  transitionClinicalWithGates,
} from '@/lib/ip-checklist/transition-gates';
import { OT_TEST_IDS } from '@/lib/ip-management/ot-test-ids';
import { toast } from 'react-hot-toast';

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmt(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Compute all valid power options for a selected IOL catalog item
function computeIolPowerOptions(item: IolCatalogItemDto | undefined): string[] {
  if (!item || item.powerRangeMin == null || item.powerRangeMax == null || item.powerIncrement == null || item.powerIncrement <= 0) return [];
  const opts: string[] = [];
  let p = item.powerRangeMin;
  while (p <= item.powerRangeMax + 0.0001) {
    const sign = p > 0 ? '+' : '';
    opts.push(`${sign}${p.toFixed(2)} D`);
    p = Math.round((p + item.powerIncrement) * 100) / 100;
  }
  return opts;
}

// ─── OT Details Modal ─────────────────────────────────────────────────────────

interface OtDetailsModalProps {
  journey: PatientJourneyDetailDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyDetailDto) => void;
}

/** Multi-select chip component used for assistant surgeons and scrub nurses */
function ChipSelect({ label, options, selected, loading, onChange, readOnly }: {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  loading: boolean;
  onChange: (names: string[]) => void;
  readOnly?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (readOnly) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
        <div className="flex flex-wrap gap-1.5 min-h-[32px]">
          {selected.length === 0 ? (
            <span className="text-sm text-gray-400">—</span>
          ) : selected.map(name => (
            <span key={name} className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-xs font-medium">
              {name}
            </span>
          ))}
        </div>
      </div>
    );
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) && !selected.includes(o.name)
  );

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="border border-gray-300 rounded-lg bg-white min-h-[40px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        {/* Selected chips */}
        <div className="flex flex-wrap gap-1.5 p-2">
          {selected.map(name => (
            <span key={name} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
              {name}
              <button type="button" onClick={() => onChange(selected.filter(n => n !== name))} className="text-blue-500 hover:text-blue-800 leading-none">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {/* Search input */}
          <div ref={ref} className="relative flex-1 min-w-[120px]">
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={loading ? 'Loading…' : selected.length === 0 ? `Search ${label.toLowerCase()}…` : 'Add more…'}
              className="w-full outline-none text-xs py-0.5 bg-transparent placeholder-gray-400"
            />
            {open && (filtered.length > 0 || (!loading && search)) && (
              <div className="absolute left-0 top-full mt-1 z-40 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-40 overflow-y-auto">
                {filtered.length > 0 ? filtered.map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); onChange([...selected, o.name]); setSearch(''); setOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px] shrink-0">
                      {o.name.charAt(0)}
                    </div>
                    {o.name}
                  </button>
                )) : (
                  <p className="px-3 py-2 text-xs text-gray-400">No matches found</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Single-select searchable dropdown component */
function SearchableSelect({ label, options, searchValue, onSearchChange, onSelect, loading, placeholder, readOnly }: {
  label: string;
  options: { id: string; name: string; sub?: string }[];
  searchValue: string;
  onSearchChange: (val: string) => void;
  onSelect: (id: string, name: string) => void;
  loading?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (readOnly) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
        <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800">
          {searchValue || <span className="text-gray-400">—</span>}
        </div>
      </div>
    );
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div ref={ref} className="relative">
        <input
          type="text"
          value={searchValue}
          onChange={e => { onSearchChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={loading ? 'Loading…' : placeholder}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {open && filtered.length > 0 && (
          <div className="absolute left-0 top-full mt-1 z-50 w-full bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-48 overflow-y-auto">
            {filtered.map(o => (
              <button
                key={o.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); onSearchChange(o.name); onSelect(o.id, o.name); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 text-left"
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px] shrink-0">
                  {o.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{o.name}</p>
                  {o.sub && <p className="text-gray-400 text-[10px]">{o.sub}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OtDetailsModal({ journey, onClose, onSaved }: OtDetailsModalProps) {
  // Staff lists from API
  const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  // Multi-select state (internal arrays → joined on save)
  const [assistants, setAssistants] = useState<string[]>(
    journey.assistantName ? journey.assistantName.split(',').map(s => s.trim()).filter(Boolean) : []
  );
  const [scrubNurses, setScrubNurses] = useState<string[]>(
    (journey.scrubNurseNames ?? journey.scrubNurseName)
      ? ((journey.scrubNurseNames ?? journey.scrubNurseName)!).split(',').map(s => s.trim()).filter(Boolean)
      : []
  );

  // Main form state
  const [form, setForm] = useState<UpdateOtDetailsRequest>({
    anaesthetistName: journey.anaesthetistName ?? journey.anesthesiologistName ?? '',
    operationTheatreName: journey.operationTheatreName ?? journey.otRoomNumber ?? '',
    anaesthesiaType: journey.anaesthesiaType ?? '',
    iolPower: journey.iolPower ?? '',
    iolIssuedFromIp: journey.iolIssuedFromIp ?? false,
    iolBarcodeVerified: journey.iolBarcodeVerified ?? false,
    iolBarcode: journey.iolBarcode ?? '',
  });
  const [intraOpForm, setIntraOpForm] = useState({
    implantUsed: '',
    procedure:       { selected: [] as string[], notes: '' },
    findings:        { selected: [] as string[], notes: '' },
    complications:   { selected: [] as string[], notes: '' },
    anesthesiaNotes: { selected: [] as string[], notes: '' },
    bloodLossMl: '',
    ivFluidMl: '',
  });
  const { presets: masterPresets } = useOtIntraOpPresets(FALLBACK_PRESETS);
  const [presets, setPresets] = useState<Record<string, string[]>>(FALLBACK_PRESETS);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [anaesthetistSearch, setAnaesthetistSearch] = useState(journey.anaesthetistName ?? journey.anesthesiologistName ?? '');
  const [anaDropOpen, setAnaDropOpen] = useState(false);
  const anaRef = useRef<HTMLDivElement>(null);
  const [surgeonId, setSurgeonId] = useState<string>(journey.primarySurgeonId ?? '');
  const [surgeonSearch, setSurgeonSearch] = useState('');
  const [otTheaters, setOtTheaters] = useState<OtTheater[]>([]);
  const [iolCatalog, setIolCatalog] = useState<IolCatalogItemDto[]>([]);

  const [verifyingBarcode, setVerifyingBarcode] = useState(false);
  const [barcodeMsg, setBarcodeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Load staff lists + intra-op note
  useEffect(() => {
    Promise.all([
      getSurgeons().catch(() => [] as Surgeon[]),
      getNurses().catch(() => [] as Nurse[]),
      ipManagementApi.getIntraOpNote(journey.id).catch(() => null),
      getOtTheaters(journey.branchId).catch(() => [] as OtTheater[]),
      ipManagementApi.getIolCatalog().catch(() => [] as IolCatalogItemDto[]),
      ipManagementApi.getIntraOpPresets().catch(() => [] as IntraOpPresetDto[]),
    ]).then(([s, n, note, theaters, catalog, allPresets]) => {
      setSurgeons(s);
      setNurses(n);
      setOtTheaters(theaters);
      setIolCatalog(catalog);
      const pMap = buildOtPresetMap(FALLBACK_PRESETS, masterPresets, allPresets as IntraOpPresetDto[]);
      setPresets(pMap);
      setPresetsLoading(false);
      if (note) {
        setIntraOpForm({
          implantUsed: note.implantUsed ?? '',
          procedure:       deserializeMultiSelect(note.procedurePerformed, pMap['procedure'] ?? []),
          findings:        deserializeMultiSelect(note.findings,           pMap['findings'] ?? []),
          complications:   deserializeMultiSelect(note.complications,      pMap['complications'] ?? []),
          anesthesiaNotes: deserializeMultiSelect(note.anesthesiaNotes,    pMap['anesthesia_notes'] ?? []),
          bloodLossMl: note.bloodLossMl != null ? String(note.bloodLossMl) : '',
          ivFluidMl:   note.ivFluidMl   != null ? String(note.ivFluidMl)   : '',
        });
      }
      if (journey.primarySurgeonId) {
        const found = s.find(x => x.id === journey.primarySurgeonId);
        if (found) setSurgeonSearch(found.name);
      }
      setStaffLoading(false);
    });
  }, [journey.id, masterPresets]);

  // Close anaesthetist dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (anaRef.current && !anaRef.current.contains(e.target as Node)) setAnaDropOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredAnaesthetists = surgeons.filter(s =>
    s.name.toLowerCase().includes(anaesthetistSearch.toLowerCase())
  );

  async function handleVerifyBarcode() {
    const barcode = (form.iolBarcode ?? '').trim();
    if (!barcode) return;
    setVerifyingBarcode(true);
    setBarcodeMsg(null);
    try {
      const res = await ipManagementApi.verifyIolBarcode(journey.id, { barcode });
      if (res) {
        setForm(f => ({ ...f, iolBarcodeVerified: res.isValid }));
        setBarcodeMsg({ ok: res.isValid, text: res.isValid ? (res.catalogEntry ?? 'Barcode verified ✓') : (res.message ?? 'Barcode not found') });
      }
    } finally {
      setVerifyingBarcode(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await ipManagementApi.updateOtDetails(journey.id, {
        anaesthetistName: form.anaesthetistName || undefined,
        operationTheatreName: form.operationTheatreName || undefined,
        assistantName: assistants.length > 0 ? assistants.join(', ') : undefined,
        scrubNurseNames: scrubNurses.length > 0 ? scrubNurses.join(', ') : undefined,
        anaesthesiaType: form.anaesthesiaType || undefined,
        iolPower: form.iolPower || undefined,
        iolIssuedFromIp: form.iolIssuedFromIp,
        iolBarcodeVerified: form.iolBarcodeVerified,
        iolBarcode: form.iolBarcode || undefined,
        primarySurgeonId: surgeonId || undefined,
      });
      // Save IOL implant details to intra-op note if provided
      const intraOpPayload: SaveIntraOpNoteRequest = {
        implantUsed:        intraOpForm.implantUsed || undefined,
        procedurePerformed: serializeMultiSelect(intraOpForm.procedure),
        findings:           serializeMultiSelect(intraOpForm.findings),
        complications:      serializeMultiSelect(intraOpForm.complications),
        anesthesiaNotes:    serializeMultiSelect(intraOpForm.anesthesiaNotes),
        bloodLossMl:  intraOpForm.bloodLossMl ? Number(intraOpForm.bloodLossMl) : undefined,
        ivFluidMl:    intraOpForm.ivFluidMl   ? Number(intraOpForm.ivFluidMl)   : undefined,
      };
      if (Object.values(intraOpPayload).some(v => v !== undefined)) {
        await ipManagementApi.saveIntraOpNote(journey.id, intraOpPayload);
      }
      if (result) { onSaved(result); onClose(); }
    } finally {
      setSaving(false);
    }
  }

  // Context detail chips
  function ContextChip({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null;
    return (
      <div className="bg-gray-50 rounded-lg px-3 py-2">
        <p className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">{label}</p>
        <p className="font-semibold text-gray-700 text-xs mt-0.5">{value}</p>
      </div>
    );
  }

  const surgeryDateStr = journey.surgeryScheduledAt
    ? new Date(journey.surgeryScheduledAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">OT Details — {journey.patientName}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Context strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ContextChip label="MR No" value={journey.uhid} />
            <ContextChip label="Ward / Bed" value={journey.wardName ? `${journey.wardName}${journey.bedNumber ? ` · ${journey.bedNumber}` : ''}` : null} />
            <ContextChip label="Eye" value={journey.eyeOperated} />
            <ContextChip label="Procedure" value={journey.procedureName} />
            <ContextChip label="Admission" value={journey.admissionType} />
            <ContextChip label="Surgeon" value={journey.surgeonName} />
            {surgeryDateStr && (
              <div className="bg-teal-50 rounded-lg px-3 py-2 col-span-2">
                <p className="text-teal-400 font-medium uppercase tracking-wide text-[10px]">Surgery Scheduled</p>
                <p className="font-semibold text-teal-800 text-xs mt-0.5">{surgeryDateStr}</p>
              </div>
            )}
          </div>

          <form id="ot-details-form" onSubmit={handleSubmit} className="space-y-5">
            {/* ── Surgical Team ── */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Surgical Team</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Primary Surgeon — searchable single-select */}
                <SearchableSelect
                  label="Primary Surgeon"
                  options={surgeons.map(s => ({ id: s.id, name: s.name }))}
                  searchValue={surgeonSearch}
                  onSearchChange={setSurgeonSearch}
                  onSelect={(id, name) => { setSurgeonId(id); setSurgeonSearch(name); }}
                  loading={staffLoading}
                  placeholder="Search surgeon…"
                />
                {/* Anaesthetist — searchable single-select */}
                <div ref={anaRef} className="relative">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Anaesthetist</label>
                  <input
                    type="text"
                    value={anaesthetistSearch}
                    onChange={e => { setAnaesthetistSearch(e.target.value); setForm(f => ({ ...f, anaesthetistName: e.target.value })); setAnaDropOpen(true); }}
                    onFocus={() => setAnaDropOpen(true)}
                    placeholder={staffLoading ? 'Loading…' : 'Search anaesthetist…'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {anaDropOpen && filteredAnaesthetists.length > 0 && (
                    <div className="absolute left-0 top-full mt-1 z-40 w-full bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-40 overflow-y-auto">
                      {filteredAnaesthetists.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={e => { e.preventDefault(); setAnaesthetistSearch(s.name); setForm(f => ({ ...f, anaesthetistName: s.name })); setAnaDropOpen(false); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 text-left"
                        >
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px] shrink-0">
                            {s.name.charAt(0)}
                          </div>
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Operation Theatre — searchable dropdown */}
                <SearchableSelect
                  label="Operation Theatre"
                  options={otTheaters.map(t => ({ id: t.id, name: t.name }))}
                  searchValue={form.operationTheatreName ?? ''}
                  onSearchChange={v => setForm(f => ({ ...f, operationTheatreName: v }))}
                  onSelect={(_, name) => setForm(f => ({ ...f, operationTheatreName: name }))}
                  loading={staffLoading}
                  placeholder="Search or type OT room…"
                />

                {/* Assistant Surgeons — multi-select chips */}
                <div className="sm:col-span-2">
                  <ChipSelect
                    label="Assistant Surgeon(s)"
                    options={surgeons}
                    selected={assistants}
                    loading={staffLoading}
                    onChange={setAssistants}
                  />
                </div>

                {/* Scrub Nurses — multi-select chips */}
                <div className="sm:col-span-2">
                  <ChipSelect
                    label="Scrub Nurse(s)"
                    options={nurses}
                    selected={scrubNurses}
                    loading={staffLoading}
                    onChange={setScrubNurses}
                  />
                </div>
              </div>
            </div>

            {/* ── Anaesthesia ── */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Anaesthesia</p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Anaesthesia Type</label>
                <div className="flex flex-wrap gap-2">
                  {(['Local', 'General', 'Spinal', 'Topical', 'Retrobulbar', 'Peribulbar'] as const).map(t => (
                    <label key={t} className={`flex items-center px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      form.anaesthesiaType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}>
                      <input type="radio" name="anaesthesiaType" checked={form.anaesthesiaType === t}
                        onChange={() => setForm(f => ({ ...f, anaesthesiaType: t }))} className="hidden" />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* ── IOL / Implant ── */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">IOL / Implant Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SearchableSelect
                  label="Implant Used (IOL Model)"
                  options={iolCatalog.map(c => ({ id: c.id, name: c.modelName, sub: `${c.brand} · ${c.iolType}` }))}
                  searchValue={intraOpForm.implantUsed}
                  onSearchChange={v => setIntraOpForm(f => ({ ...f, implantUsed: v }))}
                  onSelect={(_, name) => setIntraOpForm(f => ({ ...f, implantUsed: name }))}
                  loading={staffLoading}
                  placeholder="Search IOL model…"
                />
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">IOL Power</label>
                  <input type="text" value={form.iolPower ?? ''}
                    onChange={e => setForm(f => ({ ...f, iolPower: e.target.value }))}
                    placeholder="e.g. +21.0D"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {/* IOL Barcode */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">IOL Barcode</label>
                  <div className="flex gap-2">
                    <input type="text" value={form.iolBarcode ?? ''}
                      onChange={e => setForm(f => ({ ...f, iolBarcode: e.target.value }))}
                      placeholder="Scan or type barcode…"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="button" onClick={handleVerifyBarcode}
                      disabled={verifyingBarcode || !form.iolBarcode}
                      className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 whitespace-nowrap">
                      {verifyingBarcode ? '…' : '✓ Verify'}
                    </button>
                  </div>
                  {barcodeMsg && (
                    <p className={`text-xs mt-1 font-medium ${barcodeMsg.ok ? 'text-green-700' : 'text-red-600'}`}>{barcodeMsg.text}</p>
                  )}
                  {form.iolBarcodeVerified && !barcodeMsg && (
                    <p className="text-xs mt-1 text-green-700 font-medium">Barcode verified ✓</p>
                  )}
                </div>
                {/* IOL Issued From IP Store */}
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="iolIssuedFromIp" checked={form.iolIssuedFromIp ?? false}
                    onChange={e => setForm(f => ({ ...f, iolIssuedFromIp: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <label htmlFor="iolIssuedFromIp" className="text-xs font-medium text-gray-700 cursor-pointer">
                    IOL Issued From IP Store
                  </label>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-white rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" form="ot-details-form" disabled={saving}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-60">
            {saving ? 'Saving…' : 'Save OT Details'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Return Patient Modal ──────────────────────────────────────────────────────

const RETURN_REASONS = [
  'High Blood Pressure',
  'Uncontrolled Blood Sugar',
  'Patient Not Fasting (NPO)',
  'Consent Not Signed',
  'Anaesthesia Contraindication',
  'Equipment / Instrument Issue',
  'Emergency Priority Case',
  'Patient Declined Surgery',
  'Abnormal Pre-op Labs',
  'Other',
];

function ReturnPatientModal({ journey, onClose, onSaved }: {
  journey: PatientJourneyRowDto | PatientJourneyDetailDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyDetailDto) => void;
}) {
  const roles = useAuthStore(s => s.roles);
  const allowedReturn = roles.length === 0 || roles.some(r =>
    ['OT Nurse', 'OTNurse', 'Anaesthetist', 'Anesthetist', 'Surgeon', 'Doctor', 'Admin'].includes(r));
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleReturn() {
    if (!selected) return;
    if (!allowedReturn) {
      setError('Only OT Nurse, Anaesthetist, or Surgeon may return a patient from OT.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const reason = notes.trim() ? `${selected} — ${notes.trim()}` : selected;
      const result = await transitionClinicalWithGates(journey.id, {
        newState: 'ReadyForSurgery',
        reason,
      });
      if (result) { onSaved(result); onClose(); }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
               ?? (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message
               ?? (e instanceof Error ? e.message : null)
               ?? 'Failed to return patient.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-rose-600" />
            <h2 className="text-base font-semibold text-gray-900">Return Patient to Ward</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Patient strip */}
          <div className="bg-rose-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-rose-200 flex items-center justify-center text-rose-700 font-bold text-sm shrink-0">
              {((journey as PatientJourneyRowDto).patientName ?? '?').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-rose-900 text-sm">{(journey as PatientJourneyRowDto).patientName ?? '—'}</p>
              <p className="text-rose-600 text-xs">{journey.uhid ?? '—'} · {(journey as PatientJourneyRowDto).procedureName ?? '—'}</p>
            </div>
          </div>

          {/* Reason chips */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Reason for Return <span className="text-red-500">*</span></p>
            <div className="grid grid-cols-2 gap-2">
              {RETURN_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelected(r === selected ? null : r)}
                  className={`px-3 py-2 text-xs rounded-lg text-left border transition-all ${
                    selected === r
                      ? 'bg-rose-600 text-white border-rose-600 font-semibold'
                      : 'border-gray-200 text-gray-700 hover:bg-rose-50 hover:border-rose-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Additional Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional details about the return reason…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
            />
          </div>

          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-white rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleReturn}
            disabled={!selected || saving}
            className="px-5 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            <UserX className="h-3.5 w-3.5" />
            {saving ? 'Returning…' : 'Return Patient'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Checklist Modal ──────────────────────────────────────────────────────────

interface ChecklistModalProps {
  journeyId: string;
  mode: 'nurse' | 'surgeon';
  onClose: () => void;
}

function ChecklistModal({ journeyId, mode, onClose }: ChecklistModalProps) {
  const [items, setItems] = useState<ChecklistItemDto[]>([]);
  const [responses, setResponses] = useState<ChecklistResponseDto[]>([]);
  const [checks, setChecks] = useState<Record<string, { done: boolean; notes: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const data = mode === 'nurse'
        ? await ipManagementApi.getNurseChecklist(journeyId)
        : await ipManagementApi.getSurgeonChecklist(journeyId);
      setItems(Array.isArray(data.items) ? data.items : []);
      setResponses(Array.isArray(data.responses) ? data.responses : []);
      const init: Record<string, { done: boolean; notes: string }> = {};
      data.items.forEach(item => {
        const resp = data.responses.find(r => r.checklistItemId === item.id);
        init[item.id] = { done: resp?.isCompleted ?? false, notes: resp?.notes ?? '' };
      });
      setChecks(init);
      setLoading(false);
    })();
  }, [journeyId, mode]);

  async function handleSave() {
    setSaving(true);
    try {
      const req = {
        responses: Object.entries(checks).map(([checklistItemId, v]) => ({
          checklistItemId,
          isCompleted: v.done,
          notes: v.notes || undefined,
        })),
      };
      const ok = mode === 'nurse'
        ? await ipManagementApi.saveNurseChecklist(journeyId, req)
        : await ipManagementApi.saveSurgeonChecklist(journeyId, req);
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'nurse' ? 'Nurse Post-Op Checklist' : 'Surgeon Post-Op Checklist';
  const completedCount = Object.values(checks).filter(v => v.done).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{completedCount}/{items.length} completed</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : items.map(item => (
            <label key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={checks[item.id]?.done ?? false}
                onChange={e => setChecks(c => ({ ...c, [item.id]: { ...c[item.id], done: e.target.checked } }))}
                className="mt-0.5 w-4 h-4 rounded accent-blue-600"
              />
              <div className="flex-1">
                <p className={`text-sm font-medium ${checks[item.id]?.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {item.itemLabel}
                  {item.isRequired && <span className="text-red-500 ml-1">*</span>}
                </p>
                {checks[item.id]?.done && (
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={checks[item.id]?.notes ?? ''}
                    onChange={e => setChecks(c => ({ ...c, [item.id]: { ...c[item.id], notes: e.target.value } }))}
                    onClick={e => e.stopPropagation()}
                    className="mt-1 w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                )}
              </div>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Checklist'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Post-Op Instructions Modal ───────────────────────────────────────────────

interface PostOpInstructionsModalProps {
  journeyId: string;
  onClose: () => void;
}

function PostOpInstructionsModal({ journeyId, onClose }: PostOpInstructionsModalProps) {
  const [form, setForm] = useState({
    medications: '',
    eyeCareInstructions: '',
    warningSigns: '',
    activityRestrictions: '',
    dietaryInstructions: '',
    followupDate: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const WARNING_SIGNS = [
    'Sudden vision loss',
    'Severe eye pain',
    'Excessive discharge',
    'Increasing redness',
    'Floaters or flashes of light',
  ];

  const MED_PRESETS = [
    'Moxifloxacin 0.5% — 4×/day × 2 wks',
    'Prednisolone Acetate 1% — 4×/day × 4 wks',
    'Ketorolac 0.4% — 4×/day × 2 wks',
    'Lubricating drops — 4×/day as needed',
  ];

  const EYECARE_PRESETS = [
    'Wear eye shield at night for 2 weeks',
    'Wear sunglasses outdoors',
    'Do not rub or press the eye',
    'Keep eye dry — no swimming for 4 weeks',
  ];

  const ACTIVITY_PRESETS = [
    'No heavy lifting (>2 kg) for 2 weeks',
    'No bending below waist for 1 week',
    'No strenuous exercise for 4 weeks',
    'Avoid dusty / smoky environments',
  ];

  function appendPreset(field: keyof typeof form, text: string) {
    setForm(f => ({ ...f, [field]: f[field] ? f[field] + '\n' + text : text }));
  }

  function toggleWarningSign(sign: string) {
    setForm(f => {
      const current = f.warningSigns ? f.warningSigns.split('\n').filter(Boolean) : [];
      const next = current.includes(sign)
        ? current.filter(s => s !== sign)
        : [...current, sign];
      return { ...f, warningSigns: next.join('\n') };
    });
  }

  useEffect(() => {
    (async () => {
      const data = await ipManagementApi.getPostOpInstructions(journeyId);
      if (data) {
        setForm({
          medications:           data.medications ?? '',
          eyeCareInstructions:   data.eyeCareInstructions ?? '',
          warningSigns:          data.warningSigns ?? '',
          activityRestrictions:  data.activityRestrictions ?? '',
          dietaryInstructions:   data.dietaryInstructions ?? '',
          followupDate:          data.followupDate ? data.followupDate.slice(0, 10) : '',
        });
      }
      setLoading(false);
    })();
  }, [journeyId]);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await ipManagementApi.savePostOpInstructions(journeyId, {
        medications:           form.medications || undefined,
        eyeCareInstructions:   form.eyeCareInstructions || undefined,
        warningSigns:          form.warningSigns || undefined,
        activityRestrictions:  form.activityRestrictions || undefined,
        dietaryInstructions:   form.dietaryInstructions || undefined,
        followupDate:          form.followupDate || undefined,
      });
      if (result) onClose();
    } finally {
      setSaving(false);
    }
  }

  const selectedWarnings = form.warningSigns ? form.warningSigns.split('\n').filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Post-Op Instructions</h2>
            <p className="text-xs text-gray-500 mt-0.5">Eye surgery discharge guidance</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Medications */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Medications</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {MED_PRESETS.map(p => (
                    <button key={p} type="button"
                      onClick={() => appendPreset('medications', p)}
                      className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">
                      + {p}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  placeholder="List medications and dosing instructions…"
                  value={form.medications}
                  onChange={e => setForm(f => ({ ...f, medications: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>

              {/* Eye Care Instructions */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Eye Care Instructions</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {EYECARE_PRESETS.map(p => (
                    <button key={p} type="button"
                      onClick={() => appendPreset('eyeCareInstructions', p)}
                      className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200">
                      + {p}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  placeholder="Eye shield, sunglasses, hygiene instructions…"
                  value={form.eyeCareInstructions}
                  onChange={e => setForm(f => ({ ...f, eyeCareInstructions: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                />
              </div>

              {/* Warning Signs */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Warning Signs — seek care immediately if:</label>
                <div className="space-y-1.5">
                  {WARNING_SIGNS.map(sign => (
                    <label key={sign} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedWarnings.includes(sign)}
                        onChange={() => toggleWarningSign(sign)}
                        className="w-4 h-4 rounded accent-red-500"
                      />
                      <span className={`text-sm ${selectedWarnings.includes(sign) ? 'text-red-700 font-medium' : 'text-gray-700'}`}>{sign}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Activity Restrictions */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Activity Restrictions</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {ACTIVITY_PRESETS.map(p => (
                    <button key={p} type="button"
                      onClick={() => appendPreset('activityRestrictions', p)}
                      className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200">
                      + {p}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  placeholder="Physical activity limits…"
                  value={form.activityRestrictions}
                  onChange={e => setForm(f => ({ ...f, activityRestrictions: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
              </div>

              {/* Dietary + Follow-up Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Dietary Instructions</label>
                  <textarea
                    rows={2}
                    placeholder="Optional dietary guidance…"
                    value={form.dietaryInstructions}
                    onChange={e => setForm(f => ({ ...f, dietaryInstructions: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Follow-up Date</label>
                  <input
                    type="date"
                    value={form.followupDate}
                    onChange={e => setForm(f => ({ ...f, followupDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Instructions'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Format Heads (Surgery Note Templates) Modal ──────────────────────────────

interface FormatHeadsModalProps {
  onClose: () => void;
}

function FormatHeadsModal({ onClose }: FormatHeadsModalProps) {
  const [templates, setTemplates] = useState<SurgeryNoteTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState<AddSurgeryNoteTemplateRequest>({ fieldLabel: '', fieldType: 'text', isRequired: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const tpl = await ipManagementApi.getSurgeryNoteTemplates();
      setTemplates(Array.isArray(tpl) ? tpl : []);
      setLoading(false);
    })();
  }, []);

  async function handleAdd() {
    if (!newField.fieldLabel.trim()) return;
    setSaving(true);
    try {
      const result = await ipManagementApi.addSurgeryNoteTemplate({ ...newField, fieldOrder: templates.length + 1 });
      if (result) {
        setTemplates(prev => [...prev, result]);
        setNewField({ fieldLabel: '', fieldType: 'text', isRequired: false });
        setShowAdd(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await ipManagementApi.deleteSurgeryNoteTemplate(id);
    if (ok) setTemplates(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Format Heads — Surgery Note Templates</h2>
            <p className="text-xs text-gray-500 mt-0.5">Custom fields used in intra-op notes</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-800">{t.fieldLabel}</span>
                    <span className="ml-2 text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">{t.fieldType}</span>
                    {t.isRequired && <span className="ml-1 text-xs text-red-500">required</span>}
                  </div>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {templates.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No template fields yet</p>}
            </div>
          )}

          {showAdd && (
            <div className="mt-3 border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-2">
              <input
                type="text"
                placeholder="Field label (e.g., Implant Used, Complications)"
                value={newField.fieldLabel}
                onChange={e => setNewField(f => ({ ...f, fieldLabel: e.target.value }))}
                className="w-full border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <select
                  value={newField.fieldType}
                  onChange={e => setNewField(f => ({ ...f, fieldType: e.target.value as AddSurgeryNoteTemplateRequest['fieldType'] }))}
                  className="border border-blue-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {['text', 'textarea', 'select', 'checkbox', 'number'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-blue-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newField.isRequired ?? false}
                    onChange={e => setNewField(f => ({ ...f, isRequired: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  Required
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100">Cancel</button>
                <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-medium disabled:opacity-60">
                  {saving ? '…' : 'Add Field'}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => setShowAdd(s => !s)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Field
          </button>
          <button onClick={onClose} className="px-5 py-2 text-sm bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium">Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── IOL Return Modal ────────────────────────────────────────────────────────

function IolReturnModal({ journeyId, onClose }: { journeyId: string; onClose: () => void }) {
  const [form, setForm] = useState<RecordIolReturnRequest>({ iolPower: '', iolBatch: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (f: keyof RecordIolReturnRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [f]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.iolPower?.trim() || !form.iolBatch?.trim() || !form.reason.trim()) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await ipManagementApi.recordIolReturn(journeyId, form);
      if (result) { onClose(); }
      else { setError('Failed to record IOL return.'); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Return IOL / Implant</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Lens Power <span className="text-red-500">*</span></label>
            <input type="text" value={form.iolPower ?? ''} onChange={set('iolPower')} required
              placeholder="e.g. +22.0 D AcrySof IQ SN60WF"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Batch / Lot Number <span className="text-red-500">*</span></label>
            <input type="text" value={form.iolBatch ?? ''} onChange={set('iolBatch')} required
              placeholder="Batch number…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Return Reason <span className="text-red-500">*</span></label>
            <textarea value={form.reason} onChange={set('reason')} required rows={3}
              placeholder="Reason for IOL return (e.g. wrong power, not implanted)…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-60">
              {saving ? 'Recording…' : 'Record Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Cancel Surgery Modal ─────────────────────────────────────────────────────

function CancelSurgeryModal({ journey, onClose, onSaved }: {
  journey: PatientJourneyDetailDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyDetailDto) => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError('Cancellation reason is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await ipManagementApi.transitionClinical(journey.id, {
        newState: 'SentToOT',
        reason: reason.trim(),
      });
      if (result) { onSaved(result); onClose(); }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
               ?? (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message
               ?? (e instanceof Error ? e.message : null)
               ?? 'Failed to cancel surgery.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="text-base font-semibold text-gray-900">Cancel Surgery</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
            <p className="font-semibold mb-1">Patient: {journey.patientName ?? '—'}</p>
            <p className="text-xs">This will return the patient to <span className="font-semibold">Sent to OT</span> status for rescheduling. This action requires a documented reason.</p>
          </div>
          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Cancellation Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              placeholder="Document the reason for surgery cancellation (e.g., patient unstable, equipment issue, consent withdrawn)…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Keep in OT</button>
            <button type="submit" disabled={saving || !reason.trim()}
              className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-60">
              {saving ? 'Cancelling…' : 'Cancel Surgery & Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Intra-Op Multi-Select Helpers ────────────────────────────────────────────

const MULTI_SEP = '||';
const CUSTOM_PREFIX = 'CUSTOM:';

interface MultiSelectValue { selected: string[]; notes: string }

function serializeMultiSelect(v: MultiSelectValue): string | undefined {
  const parts = [...v.selected];
  if (v.notes.trim()) parts.push(`${CUSTOM_PREFIX}${v.notes.trim()}`);
  return parts.length > 0 ? parts.join(MULTI_SEP) : undefined;
}

function deserializeMultiSelect(raw: string | null | undefined, presets: string[]): MultiSelectValue {
  if (!raw) return { selected: [], notes: '' };
  if (!raw.includes(MULTI_SEP) && !raw.startsWith(CUSTOM_PREFIX)) {
    // Backward-compat: old single-string value — put in notes if not a preset
    if (presets.includes(raw)) return { selected: [raw], notes: '' };
    return { selected: [], notes: raw };
  }
  const parts = raw.split(MULTI_SEP);
  const selected: string[] = [];
  let notes = '';
  for (const p of parts) {
    if (p.startsWith(CUSTOM_PREFIX)) notes = p.slice(CUSTOM_PREFIX.length);
    else selected.push(p);
  }
  return { selected, notes };
}

// ─── Fallback preset options (used when API is unavailable) ───────────────────
const FALLBACK_PRESETS: Record<string, string[]> = {
  procedure: [
    'Phacoemulsification',
    'Phaco + In-the-Bag IOL Implantation',
    'Phaco + Sulcus IOL Implantation',
    'Manual SICS (MSICS)',
    'MSICS + IOL Implantation',
    'ECCE (Extra-Capsular Cataract Extraction)',
    'FLACS (Femtosecond Laser-Assisted Cataract)',
    'Anterior Vitrectomy',
    'Capsulorrhexis (CCC)',
    'Trabeculectomy',
    'Combined Phaco + Trabeculectomy',
    'Pars Plana Vitrectomy (PPV)',
    'Scleral Buckle',
    'DSAEK / DMEK (Endothelial Keratoplasty)',
    'DALK (Deep Anterior Lamellar Keratoplasty)',
    'Penetrating Keratoplasty (PKP)',
    'Pterygium Excision + Conjunctival Autograft',
    'DCR (Dacryocystorhinostomy)',
    'Strabismus Correction / Muscle Surgery',
    'Intravitreal Injection',
    'YAG Laser Capsulotomy (Intra-Op)',
  ],
  findings: [
    'Normal Findings / Uneventful',
    'Good Red Reflex',
    'Dense Nuclear Cataract',
    'Posterior Polar Cataract',
    'Posterior Capsule Rent (PCR)',
    'Zonular Weakness / Zonulysis',
    'Small Pupil (< 4 mm)',
    'Vitreous Loss',
    'High Positive Vitreous Pressure',
    'Corneal Guttata',
    'Anterior Capsule Fibrosis / Phimosis',
    'Calcified Plaque on Lens',
    'Subluxated Lens',
    'Shallow Anterior Chamber',
    'Iris Prolapse',
    'Bleeding / Hyphema',
    'Iridodialysis',
    'Neovascularization of Iris (NVI)',
    'CME (Cystoid Macular Edema) Risk',
    'Rock-Hard Nucleus (Grade 4/5)',
  ],
  complications: [
    'No Complications (Uneventful)',
    'Posterior Capsule Rupture (PCR)',
    'Vitreous Loss',
    'Nucleus Drop / Dropped Nucleus',
    'Zonular Dehiscence',
    'Choroidal Hemorrhage',
    'Corneal Decompensation / Endothelial Damage',
    'Iris Trauma / Sphincterotomy',
    'IOL Dislocation / Decentration',
    'Anterior Capsule Tear',
    'Hyphema',
    'Wound Leak / Inadequate Sealing',
    'Subconjunctival Hemorrhage',
    'High Intraocular Pressure (IOP Spike)',
    'Anesthesia Complication',
    'Systemic Complication (BP / Cardiac)',
    'Prolonged Surgery Duration',
    'Corneal Abrasion',
    'Hypotony',
    'Conversion to ECCE',
  ],
  anesthesia_notes: [
    'Topical – Proparacaine 0.5%',
    'Topical – Oxybuprocaine 0.4%',
    'Intracameral Lignocaine 1%',
    'Sub-Tenon\'s Block',
    'Peribulbar Block',
    'Retrobulbar Block',
    'General Anaesthesia (GA)',
    'Spinal / Epidural Anaesthesia',
    'Sodium Hyaluronate 1% (Healon) Used',
    'Methylcellulose 2% Used',
    'Sodium Hyaluronate + Chondroitin Sulfate Used',
    'Triamcinolone Acetonide Used',
    'BSS Plus Used',
    'Adrenaline Added to BSS',
    'Trypan Blue Capsule Staining',
    'Capsule Tension Ring (CTR) Inserted',
    'Iris Hooks Used (Small Pupil)',
    'Malyugin Ring Used',
    'No Viscoelastic Required',
  ],
};

// ─── IntraOpMultiSelect Component ─────────────────────────────────────────────

interface IntraOpMultiSelectProps {
  label: string;
  presets: string[];
  value: MultiSelectValue;
  onChange: (v: MultiSelectValue) => void;
  notesPlaceholder?: string;
  readOnly?: boolean;
  loading?: boolean;
}

function IntraOpMultiSelect({ label, presets, value, onChange, notesPlaceholder, readOnly, loading }: IntraOpMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = presets.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  function toggle(opt: string) {
    if (readOnly) return;
    const already = value.selected.includes(opt);
    onChange({ ...value, selected: already ? value.selected.filter(s => s !== opt) : [...value.selected, opt] });
  }

  function removeChip(opt: string, e: MouseEvent) {
    e.stopPropagation();
    onChange({ ...value, selected: value.selected.filter(s => s !== opt) });
  }

  return (
    <div ref={containerRef}>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>

      {/* Trigger box — shows selected chips, click to open */}
      <div
        onClick={() => { if (!readOnly) setOpen(o => !o); }}
        className={`min-h-[38px] w-full border rounded-lg px-2.5 py-1.5 flex flex-wrap gap-1.5 items-center transition-colors ${
          readOnly ? 'bg-gray-50 cursor-default' : 'bg-white cursor-pointer'
        } ${
          open ? 'border-blue-500 ring-2 ring-blue-100' : readOnly ? 'border-gray-200' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        {loading ? (
          <span className="text-xs text-gray-400">Loading…</span>
        ) : value.selected.length === 0 ? (
          <span className="text-xs text-gray-400 select-none">{readOnly ? '—' : 'Click to select…'}</span>
        ) : (
          value.selected.map(opt => (
            <span key={opt} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
              <span className="max-w-[180px] truncate">{opt}</span>
              {!readOnly && (
                <button type="button" onClick={e => removeChip(opt, e)}
                  className="shrink-0 text-blue-400 hover:text-blue-700 leading-none">
                  ×
                </button>
              )}
            </span>
          ))
        )}
        {!readOnly && (
          <span className="ml-auto shrink-0 text-gray-400 text-xs select-none">{open ? '▲' : '▼'}</span>
        )}
      </div>

      {/* Dropdown panel */}
      {open && !readOnly && (
        <div className="relative z-50">
          <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-gray-100">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search options…"
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* List */}
            <ul className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-3 text-xs text-gray-400 text-center">No matching options</li>
              ) : filtered.map(opt => {
                const sel = value.selected.includes(opt);
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => toggle(opt)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors ${
                        sel ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                        sel ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {sel && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      {opt}
                    </button>
                  </li>
                );
              })}
            </ul>
            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                {value.selected.length > 0 ? `${value.selected.length} selected` : `${filtered.length} options`}
              </span>
              {value.selected.length > 0 && (
                <button type="button" onClick={() => onChange({ ...value, selected: [] })}
                  className="text-[10px] text-red-400 hover:text-red-600">Clear all</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Always-visible notes textarea */}
      <textarea
        rows={2}
        disabled={readOnly}
        value={value.notes}
        onChange={e => onChange({ ...value, notes: e.target.value })}
        placeholder={notesPlaceholder ?? 'Additional notes…'}
        className="mt-1.5 w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  );
}

// ─── Surgery Detail Modal (row-click for SentToOT / InOT) ──────────────────────

interface SurgeryDetailModalProps {
  journey: PatientJourneyDetailDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyDetailDto) => void;
  onOpenConfirm: (action: 'accept' | 'startSurgery' | 'endSurgery', message: string) => void;
  onOpenReturn: () => void;
}

function SurgeryDetailModal({ journey, onClose, onSaved, onOpenConfirm, onOpenReturn }: SurgeryDetailModalProps) {
  const { clinicalState, otState } = journey;
  const { canSignOtSafety, canEditMonitoring, canOverrideWhoTimeout } = useIpChecklistPermissions();
  const roles = useAuthStore(s => s.roles);
  const canReturnFromOt = roles.length === 0 || roles.some(r =>
    ['OT Nurse', 'OTNurse', 'Anaesthetist', 'Anesthetist', 'Surgeon', 'Doctor', 'Admin'].includes(r));
  const [safetyGates, setSafetyGates] = useState<SurgicalSafetyGateDto | null>(null);
  const [monitoringReadingsEmpty, setMonitoringReadingsEmpty] = useState(false);
  const [whoOverrideApplying, setWhoOverrideApplying] = useState(false);

  const isReadOnly = clinicalState === 'SurgeryCompleted' || clinicalState === 'PostOp';
  const safetyReadOnly = isReadOnly || !canSignOtSafety;
  const monitoringReadOnly = isReadOnly || !canEditMonitoring;

  const showAccept = clinicalState === 'SentToOT' && otState === 'SentToOT';
  const showStart  = clinicalState === 'SentToOT' && otState === 'Accepted' && journey.otDetailsSaved;
  const showEnd    = clinicalState === 'InOT';
  const showReturn = clinicalState === 'SentToOT' || clinicalState === 'InOT';

  // Staff lists
  const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  // Multi-select state
  const [assistants, setAssistants] = useState<string[]>(
    journey.assistantName ? journey.assistantName.split(',').map(s => s.trim()).filter(Boolean) : []
  );
  const [scrubNurses, setScrubNurses] = useState<string[]>(
    (journey.scrubNurseNames ?? journey.scrubNurseName)
      ? ((journey.scrubNurseNames ?? journey.scrubNurseName)!).split(',').map(s => s.trim()).filter(Boolean)
      : []
  );

  // Form state
  const [form, setForm] = useState<UpdateOtDetailsRequest>({
    anaesthetistName: journey.anaesthetistName ?? journey.anesthesiologistName ?? '',
    operationTheatreName: journey.operationTheatreName ?? journey.otRoomNumber ?? '',
    anaesthesiaType: journey.anaesthesiaType ?? '',
    iolPower: journey.iolPower ?? '',
    iolIssuedFromIp: journey.iolIssuedFromIp ?? false,
    iolBarcodeVerified: journey.iolBarcodeVerified ?? false,
    iolBarcode: journey.iolBarcode ?? '',
  });
  const [anaesthetistSearch, setAnaesthetistSearch] = useState(journey.anaesthetistName ?? journey.anesthesiologistName ?? '');
  const [anaDropOpen, setAnaDropOpen] = useState(false);
  const anaRef = useRef<HTMLDivElement>(null);
  const [surgeonId, setSurgeonId] = useState<string>(journey.primarySurgeonId ?? '');
  const [surgeonSearch, setSurgeonSearch] = useState('');
  const [otTheaters, setOtTheaters] = useState<OtTheater[]>([]);
  const [iolCatalog, setIolCatalog] = useState<IolCatalogItemDto[]>([]);
  const [intraOpForm, setIntraOpForm] = useState({
    implantUsed: '',
    procedure:       { selected: [] as string[], notes: '' },
    findings:        { selected: [] as string[], notes: '' },
    complications:   { selected: [] as string[], notes: '' },
    anesthesiaNotes: { selected: [] as string[], notes: '' },
    bloodLossMl: '',
    ivFluidMl: '',
  });
  const { presets: masterPresets } = useOtIntraOpPresets(FALLBACK_PRESETS);
  const [presets, setPresets] = useState<Record<string, string[]>>(FALLBACK_PRESETS);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [verifyingBarcode, setVerifyingBarcode] = useState(false);
  const [barcodeMsg, setBarcodeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getSurgeons().catch(() => [] as Surgeon[]),
      getNurses().catch(() => [] as Nurse[]),
      ipManagementApi.getIntraOpNote(journey.id).catch(() => null),
      getOtTheaters(journey.branchId).catch(() => [] as OtTheater[]),
      ipManagementApi.getIolCatalog().catch(() => [] as IolCatalogItemDto[]),
      ipManagementApi.getIntraOpPresets().catch(() => [] as IntraOpPresetDto[]),
    ]).then(([s, n, note, theaters, catalog, allPresets]) => {
      setSurgeons(s);
      setNurses(n);
      setOtTheaters(theaters);
      setIolCatalog(catalog);

      const pMap = buildOtPresetMap(FALLBACK_PRESETS, masterPresets, allPresets as IntraOpPresetDto[]);
      setPresets(pMap);
      setPresetsLoading(false);

      if (note) setIntraOpForm({
        implantUsed: note.implantUsed ?? '',
        procedure:       deserializeMultiSelect(note.procedurePerformed, pMap['procedure'] ?? []),
        findings:        deserializeMultiSelect(note.findings,           pMap['findings'] ?? []),
        complications:   deserializeMultiSelect(note.complications,      pMap['complications'] ?? []),
        anesthesiaNotes: deserializeMultiSelect(note.anesthesiaNotes,    pMap['anesthesia_notes'] ?? []),
        bloodLossMl: note.bloodLossMl != null ? String(note.bloodLossMl) : '',
        ivFluidMl:   note.ivFluidMl   != null ? String(note.ivFluidMl)   : '',
      });
      if (journey.primarySurgeonId) {
        const found = s.find(x => x.id === journey.primarySurgeonId);
        if (found) setSurgeonSearch(found.name);
      }
      setStaffLoading(false);
    });
  }, [journey.id, masterPresets]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (anaRef.current && !anaRef.current.contains(e.target as Node)) setAnaDropOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (clinicalState !== 'InOT') {
      setMonitoringReadingsEmpty(false);
      return;
    }
    ipManagementApi.getAnaesthesiaMonitoring(journey.id)
      .then(m => setMonitoringReadingsEmpty(!m?.readings?.length))
      .catch(() => setMonitoringReadingsEmpty(false));
  }, [journey.id, clinicalState]);

  const filteredAnaesthetists = surgeons.filter(s =>
    s.name.toLowerCase().includes(anaesthetistSearch.toLowerCase())
  );

  const selectedIolItem = useMemo(
    () => iolCatalog.find(c => c.modelName === intraOpForm.implantUsed),
    [iolCatalog, intraOpForm.implantUsed]
  );
  const iolPowerOptions = useMemo(() => computeIolPowerOptions(selectedIolItem), [selectedIolItem]);

  async function handleVerifyBarcode() {
    const barcode = (form.iolBarcode ?? '').trim();
    if (!barcode) return;
    setVerifyingBarcode(true);
    setBarcodeMsg(null);
    try {
      const res = await ipManagementApi.verifyIolBarcode(journey.id, { barcode });
      if (res) {
        setForm(f => ({ ...f, iolBarcodeVerified: res.isValid }));
        setBarcodeMsg({ ok: res.isValid, text: res.isValid ? (res.catalogEntry ?? 'Barcode verified ✓') : (res.message ?? 'Barcode not found') });
      }
    } finally {
      setVerifyingBarcode(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await ipManagementApi.updateOtDetails(journey.id, {
        anaesthetistName: form.anaesthetistName || undefined,
        operationTheatreName: form.operationTheatreName || undefined,
        assistantName: assistants.length > 0 ? assistants.join(', ') : undefined,
        scrubNurseNames: scrubNurses.length > 0 ? scrubNurses.join(', ') : undefined,
        anaesthesiaType: form.anaesthesiaType || undefined,
        iolPower: form.iolPower || undefined,
        iolIssuedFromIp: form.iolIssuedFromIp,
        iolBarcodeVerified: form.iolBarcodeVerified,
        iolBarcode: form.iolBarcode || undefined,
        primarySurgeonId: surgeonId || undefined,
      });
      const intraOpPayload: SaveIntraOpNoteRequest = {
        implantUsed:        intraOpForm.implantUsed || undefined,
        procedurePerformed: serializeMultiSelect(intraOpForm.procedure),
        findings:           serializeMultiSelect(intraOpForm.findings),
        complications:      serializeMultiSelect(intraOpForm.complications),
        anesthesiaNotes:    serializeMultiSelect(intraOpForm.anesthesiaNotes),
        bloodLossMl:  intraOpForm.bloodLossMl ? Number(intraOpForm.bloodLossMl) : undefined,
        ivFluidMl:    intraOpForm.ivFluidMl   ? Number(intraOpForm.ivFluidMl)   : undefined,
      };
      if (Object.values(intraOpPayload).some(v => v !== undefined)) {
        await ipManagementApi.saveIntraOpNote(journey.id, intraOpPayload);
      }
      if (result) { onSaved(result); onClose(); }
    } finally {
      setSaving(false);
    }
  }

  const surgeryDateStr = journey.surgeryScheduledAt
    ? new Date(journey.surgeryScheduledAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Surgery Details — {journey.patientName}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Read-only banner */}
          {isReadOnly && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-800">Surgery Completed — View Only</p>
            </div>
          )}

          {/* Patient info card */}
          <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-700 text-sm shrink-0">
              {(journey.patientName ?? '?').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-900 text-sm">{journey.patientName ?? '—'}</p>
              <p className="text-blue-600 text-xs">{journey.uhid ?? '—'} · {journey.procedureName ?? '—'} · {journey.eyeOperated ?? '—'}</p>
              {surgeryDateStr && <p className="text-blue-500 text-xs mt-0.5">Scheduled: {surgeryDateStr}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StatusBadge status={clinicalState} size="sm" />
              <StatusBadge status={otState} size="sm" />
            </div>
          </div>

          <OtSurgicalSafetyChecklist
            journeyId={journey.id}
            patientId={'patientId' in journey ? journey.patientId : undefined}
            patientName={journey.patientName ?? undefined}
            eyeOperated={journey.eyeOperated}
            financialState={journey.financialState}
            balanceDue={journey.balanceDue}
            emergencyFcApplied={journey.isEmergencyFc}
            readOnly={safetyReadOnly}
            surgeons={surgeons.map(s => ({ id: s.id, name: s.name }))}
            nurses={nurses.map(n => ({ id: n.id, name: n.name }))}
            onGatesChange={setSafetyGates}
          />

          {safetyGates && !safetyGates.whoTimeoutComplete && !journey.whoSupervisorOverrideApplied
            && canOverrideWhoTimeout && clinicalState === 'SentToOT' && otState === 'Accepted' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-center justify-between gap-2">
              <p className="text-xs text-amber-900">WHO timeout incomplete — supervisor may override to allow start surgery.</p>
              <button
                type="button"
                disabled={whoOverrideApplying}
                onClick={async () => {
                  const reason = window.prompt('Reason for WHO supervisor override:');
                  if (!reason?.trim()) return;
                  setWhoOverrideApplying(true);
                  try {
                    const updated = await ipManagementApi.applyWhoSupervisorOverride(journey.id, reason.trim());
                    if (updated) {
                      onSaved(updated);
                      toast.success('WHO supervisor override applied.');
                    } else {
                      toast.error('Failed to apply WHO override.');
                    }
                  } finally {
                    setWhoOverrideApplying(false);
                  }
                }}
                className="shrink-0 px-2.5 py-1 text-xs font-medium border border-amber-400 text-amber-900 rounded-lg hover:bg-amber-100 disabled:opacity-50"
              >
                {whoOverrideApplying ? 'Applying…' : 'Supervisor override'}
              </button>
            </div>
          )}

          {(clinicalState === 'SentToOT' || clinicalState === 'InOT' || clinicalState === 'SurgeryCompleted') && (
            <AnaesthesiaMonitoringPanel
              journeyId={journey.id}
              mode="ot"
              readOnly={monitoringReadOnly}
            />
          )}

          {/* OT form */}
          <form id="surgery-detail-form" onSubmit={handleSave} className="space-y-5">
            {/* Surgical Team */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Surgical Team</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Primary Surgeon — searchable single-select */}
                <SearchableSelect
                  label="Primary Surgeon"
                  options={surgeons.map(s => ({ id: s.id, name: s.name }))}
                  searchValue={surgeonSearch}
                  onSearchChange={setSurgeonSearch}
                  onSelect={(id, name) => { setSurgeonId(id); setSurgeonSearch(name); }}
                  loading={staffLoading}
                  placeholder="Search surgeon…"
                />
                {isReadOnly ? (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Anaesthetist</p>
                    <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800">
                      {anaesthetistSearch || form.anaesthetistName || <span className="text-gray-400">—</span>}
                    </div>
                  </div>
                ) : (
                  <div ref={anaRef} className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Anaesthetist</label>
                    <input
                      type="text"
                      value={anaesthetistSearch}
                      onChange={e => { setAnaesthetistSearch(e.target.value); setForm(f => ({ ...f, anaesthetistName: e.target.value })); setAnaDropOpen(true); }}
                      onFocus={() => setAnaDropOpen(true)}
                      placeholder={staffLoading ? 'Loading…' : 'Search anaesthetist…'}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {anaDropOpen && filteredAnaesthetists.length > 0 && (
                      <div className="absolute left-0 top-full mt-1 z-40 w-full bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-40 overflow-y-auto">
                        {filteredAnaesthetists.map(s => (
                          <button key={s.id} type="button"
                            onMouseDown={e => { e.preventDefault(); setAnaesthetistSearch(s.name); setForm(f => ({ ...f, anaesthetistName: s.name })); setAnaDropOpen(false); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 text-left">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-[10px] shrink-0">
                              {s.name.charAt(0)}
                            </div>
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <SearchableSelect
                  label="Operation Theatre"
                  options={otTheaters.map(t => ({ id: t.id, name: t.name }))}
                  searchValue={form.operationTheatreName ?? ''}
                  onSearchChange={v => setForm(f => ({ ...f, operationTheatreName: v }))}
                  onSelect={(_, name) => setForm(f => ({ ...f, operationTheatreName: name }))}
                  loading={staffLoading}
                  placeholder="Search or type OT room…"
                />
                <div className="sm:col-span-2">
                  <ChipSelect label="Assistant Surgeon(s)" options={surgeons} selected={assistants} loading={staffLoading} onChange={setAssistants} readOnly={isReadOnly} />
                </div>
                <div className="sm:col-span-2">
                  <ChipSelect label="Scrub Nurse(s)" options={nurses} selected={scrubNurses} loading={staffLoading} onChange={setScrubNurses} readOnly={isReadOnly} />
                </div>
              </div>
            </div>

            {/* Anaesthesia */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Anaesthesia</p>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Anaesthesia Type</p>
                {isReadOnly ? (
                  <span className="inline-block px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 text-xs font-medium">
                    {form.anaesthesiaType || '—'}
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(['Local', 'General', 'Spinal', 'Topical', 'Retrobulbar', 'Peribulbar'] as const).map(t => (
                      <label key={t} className={`flex items-center px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        form.anaesthesiaType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}>
                        <input type="radio" name="sdm-anaesthesiaType" checked={form.anaesthesiaType === t}
                          onChange={() => setForm(f => ({ ...f, anaesthesiaType: t }))} className="hidden" />
                        {t}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* IOL / Implant */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">IOL / Implant Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SearchableSelect
                  label="Implant Used (IOL Model)"
                  options={iolCatalog.map(c => ({ id: c.id, name: c.modelName, sub: `${c.brand} · ${c.iolType}` }))}
                  searchValue={intraOpForm.implantUsed}
                  onSearchChange={v => setIntraOpForm(f => ({ ...f, implantUsed: v }))}
                  onSelect={(_, name) => {
                    setIntraOpForm(f => ({ ...f, implantUsed: name }));
                    const newItem = iolCatalog.find(c => c.modelName === name);
                    const newOpts = computeIolPowerOptions(newItem);
                    if (newOpts.length > 0 && !newOpts.includes(form.iolPower ?? '')) {
                      setForm(f => ({ ...f, iolPower: '' }));
                    }
                  }}
                  loading={staffLoading}
                  placeholder="Search IOL model…"
                  readOnly={isReadOnly}
                />
                {isReadOnly ? (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">IOL Power</p>
                    <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800">{form.iolPower || '—'}</div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">IOL Power</label>
                    {iolPowerOptions.length > 0 ? (
                      <select
                        value={form.iolPower ?? ''}
                        onChange={e => setForm(f => ({ ...f, iolPower: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Select power…</option>
                        {iolPowerOptions.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    ) : (
                      <input type="text" value={form.iolPower ?? ''}
                        onChange={e => setForm(f => ({ ...f, iolPower: e.target.value }))}
                        placeholder="e.g. +21.0D"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    )}
                  </div>
                )}
                {isReadOnly ? (
                  <div className="pt-5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${form.iolIssuedFromIp ? 'text-blue-700' : 'text-gray-400'}`}>
                      <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${form.iolIssuedFromIp ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                        {form.iolIssuedFromIp && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      IOL Issued From IP Store
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="sdm-iolIssuedFromIp" checked={form.iolIssuedFromIp ?? false}
                      onChange={e => setForm(f => ({ ...f, iolIssuedFromIp: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <label htmlFor="sdm-iolIssuedFromIp" className="text-xs font-medium text-gray-700 cursor-pointer">
                      IOL Issued From IP Store
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Intra-Op Notes — shown for InOT, SurgeryCompleted, PostOp */}
            {(clinicalState === 'InOT' || clinicalState === 'SurgeryCompleted' || clinicalState === 'PostOp') && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Intra-Op Notes</p>
                <div className="space-y-4">
                  <IntraOpMultiSelect
                    label="Procedure / Technique"
                    presets={presets['procedure'] ?? []}
                    value={intraOpForm.procedure}
                    onChange={v => setIntraOpForm(f => ({ ...f, procedure: v }))}
                    notesPlaceholder="e.g. Phacoemulsification with IOL implantation…"
                    readOnly={isReadOnly}
                    loading={presetsLoading}
                  />
                  <IntraOpMultiSelect
                    label="Intra-Op Findings"
                    presets={presets['findings'] ?? []}
                    value={intraOpForm.findings}
                    onChange={v => setIntraOpForm(f => ({ ...f, findings: v }))}
                    notesPlaceholder="Additional findings during surgery…"
                    readOnly={isReadOnly}
                    loading={presetsLoading}
                  />
                  <IntraOpMultiSelect
                    label="Complications"
                    presets={presets['complications'] ?? []}
                    value={intraOpForm.complications}
                    onChange={v => setIntraOpForm(f => ({ ...f, complications: v }))}
                    notesPlaceholder="Any intra-operative complications…"
                    readOnly={isReadOnly}
                    loading={presetsLoading}
                  />
                  <IntraOpMultiSelect
                    label="Anaesthesia / Viscoelastic / OVD"
                    presets={presets['anesthesia_notes'] ?? []}
                    value={intraOpForm.anesthesiaNotes}
                    onChange={v => setIntraOpForm(f => ({ ...f, anesthesiaNotes: v }))}
                    notesPlaceholder="Viscoelastic used, anaesthesia details…"
                    readOnly={isReadOnly}
                    loading={presetsLoading}
                  />
                  {/* Blood Loss & IV Fluid */}
                  {isReadOnly ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">Blood Loss (mL)</p>
                        <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800">{intraOpForm.bloodLossMl || '—'}</div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1.5">IV Fluid (mL)</p>
                        <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800">{intraOpForm.ivFluidMl || '—'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Blood Loss (mL)</label>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {[0, 50, 100, 250].map(v => (
                            <button key={v} type="button"
                              onClick={() => setIntraOpForm(f => ({ ...f, bloodLossMl: String(v) }))}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                intraOpForm.bloodLossMl === String(v)
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                              }`}>
                              {v}
                            </button>
                          ))}
                        </div>
                        <input type="number" min={0}
                          value={intraOpForm.bloodLossMl}
                          onChange={e => setIntraOpForm(f => ({ ...f, bloodLossMl: e.target.value }))}
                          placeholder="Enter mL"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">IV Fluid (mL)</label>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {[100, 250, 500, 1000].map(v => (
                            <button key={v} type="button"
                              onClick={() => setIntraOpForm(f => ({ ...f, ivFluidMl: String(v) }))}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                intraOpForm.ivFluidMl === String(v)
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                              }`}>
                              {v}
                            </button>
                          ))}
                        </div>
                        <input type="number" min={0}
                          value={intraOpForm.ivFluidMl}
                          onChange={e => setIntraOpForm(f => ({ ...f, ivFluidMl: e.target.value }))}
                          placeholder="Enter mL"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100 bg-white rounded-b-2xl">
          <div className="flex items-center gap-2">
            {showAccept && (
              <button type="button"
                onClick={() => {
                  if (safetyGates && !safetyGates.billingGateSatisfied) {
                    toast.error('Billing clearance required before accepting patient in OT. Apply Emergency FC or confirm payment.');
                    return;
                  }
                  let msg = 'Accept this patient into the Operation Theatre?';
                  if (safetyGates && !safetyGates.beforeAnaesthesiaComplete) {
                    msg += '\n\nNote: Before Anaesthesia checklist is not yet complete.';
                  }
                  onOpenConfirm('accept', msg);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Accept Patient
              </button>
            )}
            {clinicalState === 'SentToOT' && otState === 'Accepted' && !isReadOnly && (
              <button type="button"
                onClick={() => {
                  let msg = 'Start surgery for this patient now?';
                  if (safetyGates && !safetyGates.whoTimeoutComplete) {
                    msg += '\n\nWarning: WHO timeout checklist is not complete.';
                  }
                  onOpenConfirm('startSurgery', msg);
                }}
                disabled={!journey.otDetailsSaved}
                title={!journey.otDetailsSaved ? 'Save surgeon, anaesthetist, OT room & anaesthesia type first' : undefined}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
                <Play className="h-3.5 w-3.5" />
                Start Surgery
              </button>
            )}
            {showEnd && (
              <div className="flex items-center gap-2">
                {monitoringReadingsEmpty && (
                  <span
                    className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-1"
                    title="Form 5 intra-op monitoring readings are empty (informational only)"
                  >
                    Monitoring empty
                  </span>
                )}
                <button type="button"
                  onClick={() => {
                    let msg = 'Mark this surgery as completed?';
                    if (safetyGates && !safetyGates.afterSurgeryComplete) {
                      msg += '\n\nWarning: After Surgery checklist is not complete.';
                    }
                    onOpenConfirm('endSurgery', msg);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg">
                  <StopCircle className="h-3.5 w-3.5" />
                  End Surgery
                </button>
              </div>
            )}
            {showReturn && canReturnFromOt && (
              <button type="button" onClick={onOpenReturn}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-rose-300 text-rose-600 hover:bg-rose-50 bg-white rounded-lg">
                <UserX className="h-3.5 w-3.5" />
                Return Patient
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button type="submit" form="surgery-detail-form" disabled={saving}
                className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-60">
                {saving ? 'Saving…' : 'Save OT Details'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Row Expanded Panel (Post-Op Actions) ─────────────────────────────────────

interface ExpandedPanelProps {
  journey: PatientJourneyDetailDto;
  onSaved: (updated: PatientJourneyDetailDto) => void;
  onViewDetails?: () => void;
}

function ExpandedPanel({ journey, onSaved, onViewDetails }: ExpandedPanelProps) {
  const [nurseChecklist, setNurseChecklist] = useState(false);
  const [surgeonChecklist, setSurgeonChecklist] = useState(false);
  const [postOpInstructions, setPostOpInstructions] = useState(false);
  const [iolReturnModal, setIolReturnModal] = useState(false);
  const [returnPatientOpen, setReturnPatientOpen] = useState(false);
  const [movingToPostOp, setMovingToPostOp] = useState(false);

  const isPostOp = journey.clinicalState === 'PostOp';
  const isInOT = journey.clinicalState === 'InOT';
  const isSurgeryCompleted = journey.clinicalState === 'SurgeryCompleted';

  async function handleMoveToPostOp() {
    setMovingToPostOp(true);
    try {
      const result = await transitionClinicalWithGates(journey.id, { newState: 'PostOp' });
      if (result) onSaved(result);
    } finally {
      setMovingToPostOp(false);
    }
  }

  return (
    <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50 to-white px-6 py-5">
      {/* Modals */}
      {nurseChecklist && <ChecklistModal journeyId={journey.id} mode="nurse" onClose={() => setNurseChecklist(false)} />}
      {surgeonChecklist && <ChecklistModal journeyId={journey.id} mode="surgeon" onClose={() => setSurgeonChecklist(false)} />}
      {postOpInstructions && <PostOpInstructionsModal journeyId={journey.id} onClose={() => setPostOpInstructions(false)} />}
      {iolReturnModal && <IolReturnModal journeyId={journey.id} onClose={() => setIolReturnModal(false)} />}
      {returnPatientOpen && (
        <ReturnPatientModal
          journey={journey}
          onClose={() => setReturnPatientOpen(false)}
          onSaved={updated => { onSaved(updated); setReturnPatientOpen(false); }}
        />
      )}

      {/* Surgery timeline summary bar */}
      <div className="flex items-center gap-6 mb-5 pb-4 border-b border-gray-100 text-xs text-gray-500">
        {journey.surgeryStartedAt && (
          <div className="flex items-center gap-1.5">
            <Play className="h-3 w-3 text-blue-400" />
            <span>Started: <span className="font-semibold text-gray-700">{fmt(journey.surgeryStartedAt)}</span></span>
          </div>
        )}
        {journey.surgeryEndedAt && (
          <div className="flex items-center gap-1.5">
            <StopCircle className="h-3 w-3 text-green-400" />
            <span>Ended: <span className="font-semibold text-gray-700">{fmt(journey.surgeryEndedAt)}</span></span>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-gray-400">Financial:</span>
          <StatusBadge status={journey.financialState} size="sm" />
        </div>
      </div>

      {/* ── In-OT actions ──────────────────────────────────────────────────── */}
      {isInOT && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">In-Theatre Actions</p>
          <div className="grid grid-cols-2 gap-3 max-w-xs">
            <button
              onClick={() => setIolReturnModal(true)}
              className="group flex flex-col items-start p-4 bg-white border border-gray-200 rounded-xl hover:border-orange-300 hover:shadow-md transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center mb-3 group-hover:bg-orange-200 transition-colors">
                <RotateCcw className="h-4 w-4 text-orange-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Return IOL</p>
              <p className="text-xs text-gray-400 mt-0.5">Log implant return</p>
            </button>
            <button
              onClick={() => setReturnPatientOpen(true)}
              className="group flex flex-col items-start p-4 bg-white border border-gray-200 rounded-xl hover:border-rose-300 hover:shadow-md transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center mb-3 group-hover:bg-rose-200 transition-colors">
                <UserX className="h-4 w-4 text-rose-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Return Patient</p>
              <p className="text-xs text-gray-400 mt-0.5">Cancel &amp; send back</p>
            </button>
          </div>
        </div>
      )}

      {/* ── Post-Op actions ────────────────────────────────────────────────── */}
      {isPostOp && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Post-Op Care</p>
            {onViewDetails && (
              <button
                onClick={onViewDetails}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
                View Surgery Details
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => setNurseChecklist(true)}
              className="group flex flex-col items-start p-4 bg-white border border-gray-200 rounded-xl hover:border-cyan-300 hover:shadow-md transition-all text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center mb-3 group-hover:bg-cyan-200 transition-colors">
                <SquareCheck className="h-4 w-4 text-cyan-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Nurse Checklist</p>
              <p className="text-xs text-gray-400 mt-0.5">7 recovery checks</p>
            </button>
            <button
              onClick={() => setSurgeonChecklist(true)}
              className="group flex flex-col items-start p-4 bg-white border border-gray-200 rounded-xl hover:border-teal-300 hover:shadow-md transition-all text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center mb-3 group-hover:bg-teal-200 transition-colors">
                <ClipboardList className="h-4 w-4 text-teal-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Surgeon Checklist</p>
              <p className="text-xs text-gray-400 mt-0.5">5 sign-off items</p>
            </button>
            <button
              onClick={() => setPostOpInstructions(true)}
              className="group flex flex-col items-start p-4 bg-white border border-gray-200 rounded-xl hover:border-violet-300 hover:shadow-md transition-all text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center mb-3 group-hover:bg-violet-200 transition-colors">
                <FileText className="h-4 w-4 text-violet-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Post-Op Instructions</p>
              <p className="text-xs text-gray-400 mt-0.5">Eye care &amp; medications</p>
            </button>
          </div>

          {/* Move to Post-Op Ward CTA — only while still SurgeryCompleted */}
          {isSurgeryCompleted && (
            <div className="mt-4 flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-violet-900">Patient ready for recovery ward?</p>
                <p className="text-xs text-violet-500 mt-0.5">Complete the checklists above, then transfer to Post-Op Ward</p>
              </div>
              <button
                onClick={handleMoveToPostOp}
                disabled={movingToPostOp}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap ml-6"
              >
                <Zap className="h-4 w-4" />
                {movingToPostOp ? 'Moving…' : 'Move to Post-Op Ward'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── OT Row ───────────────────────────────────────────────────────────────────

interface OtRowProps {
  journey: PatientJourneyRowDto;
  onExpand: () => void;
  expanded: boolean;
  detail: PatientJourneyDetailDto | null;
  onOtFormOpen: () => void;
  onDetailUpdated: (updated: PatientJourneyDetailDto) => void;
  onOpenConfirm: (action: 'accept' | 'startSurgery' | 'endSurgery', message: string) => void;
  onOpenReturn: () => void;
  onRowClick: () => void;
}

function OtRow({ journey, onExpand, expanded, detail, onOtFormOpen, onDetailUpdated, onOpenConfirm, onOpenReturn, onRowClick }: OtRowProps) {
  const { clinicalState, otState } = journey;

  const isDone = clinicalState === 'SurgeryCompleted';
  const isDetailClickable = clinicalState === 'SentToOT' || clinicalState === 'InOT' || isDone;

  const showAccept  = clinicalState === 'SentToOT' && otState === 'SentToOT';
  const showStart   = clinicalState === 'SentToOT' && otState === 'Accepted' && journey.otDetailsSaved;
  const showEnd     = clinicalState === 'InOT';
  const showReturn  = clinicalState === 'SentToOT' || clinicalState === 'InOT';

  const [movingToPostOp, setMovingToPostOp] = useState(false);

  async function handleMoveToPostOp() {
    setMovingToPostOp(true);
    try {
      const result = await transitionClinicalWithGates(journey.id, { newState: 'PostOp' });
      if (result) onDetailUpdated(result);
    } finally {
      setMovingToPostOp(false);
    }
  }

  return (
    <>
      <tr
        data-testid={OT_TEST_IDS.journeyRow(journey.id)}
        className={`transition-colors cursor-pointer ${
          clinicalState === 'InOT' ? 'bg-amber-50 hover:bg-amber-100' :
          clinicalState === 'SurgeryCompleted' ? 'bg-green-50 hover:bg-green-100' :
          'hover:bg-gray-50'
        } ${expanded ? 'bg-blue-50' : ''}`}
        onClick={isDetailClickable ? onRowClick : onExpand}
      >
        <td className="px-3 py-3"><StatusBadge status={clinicalState === 'SentToOT' && otState === 'Accepted' ? 'Accepted' : clinicalState} size="sm" /></td>
        <td className="px-3 py-3 font-mono text-xs text-blue-700 font-medium">{journey.uhid ?? '—'}</td>
        <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">{journey.patientName ?? '—'}</td>
        <td className="px-3 py-3 text-gray-600 text-xs">{journey.eyeOperated ?? '—'}</td>
        <td className="px-3 py-3 text-gray-700 text-xs whitespace-nowrap">{journey.procedureName ?? '—'}</td>
        <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{fmt(journey.surgeryScheduledAt)}</td>
        <td className="px-3 py-3 text-gray-600 text-xs"><StatusBadge status={otState} size="sm" /></td>
        <td className="px-3 py-3">
          <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
            {showAccept && (
              <button
                data-testid={OT_TEST_IDS.acceptBtn(journey.id)}
                onClick={() => onOpenConfirm('accept', 'Accept this patient into the Operation Theatre?')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Accept
              </button>
            )}
            {showStart && (
              <button
                data-testid={OT_TEST_IDS.startSurgeryBtn(journey.id)}
                onClick={() => onOpenConfirm('startSurgery', 'Start surgery for this patient now?')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Play className="h-3.5 w-3.5" />
                Start Surgery
              </button>
            )}
            {showEnd && (
              <button
                data-testid={OT_TEST_IDS.endSurgeryBtn(journey.id)}
                onClick={() => onOpenConfirm('endSurgery', 'Mark this surgery as completed?')}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <StopCircle className="h-3.5 w-3.5" />
                End Surgery
              </button>
            )}
            {showReturn && (
              <button
                onClick={onOpenReturn}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-rose-300 text-rose-600 hover:bg-rose-50 bg-white rounded-lg transition-colors"
              >
                <UserX className="h-3.5 w-3.5" />
                Return
              </button>
            )}
            {isDone ? (
              <button
                data-testid={OT_TEST_IDS.moveToPostOpBtn(journey.id)}
                onClick={handleMoveToPostOp}
                disabled={movingToPostOp}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                <Zap className="h-3.5 w-3.5" />
                {movingToPostOp ? 'Moving…' : 'Move to Post-Op Ward'}
              </button>
            ) : clinicalState === 'PostOp' ? (
              <>
                <button
                  onClick={onRowClick}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Details
                </button>
                <button onClick={onExpand} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onOtFormOpen()}
                  title="Edit OT Details"
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <Pen className="h-3.5 w-3.5" />
                </button>
                <button onClick={onExpand} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg">
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {expanded && detail && (
        <tr>
          <td colSpan={8} className="p-0">
            <ExpandedPanel journey={detail} onSaved={onDetailUpdated} onViewDetails={onRowClick} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── OT Skeleton ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: `${50 + (i * 9) % 35}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type OtFilter = 'All' | 'SentToOT' | 'OTAccepted' | 'InOT' | 'SurgeryCompleted' | 'PostOp';

const OT_STAT_CARDS: { key: OtFilter; label: string; bg: string; icon: string; color: string; activeClass: string }[] = [
  { key: 'SentToOT',          label: 'Awaiting Acceptance', bg: 'bg-sky-50 text-sky-700',       icon: '📋', color: 'bg-sky-500',     activeClass: 'bg-sky-500 border-sky-500 text-white' },
  { key: 'OTAccepted',        label: 'OT Accepted',         bg: 'bg-green-50 text-green-700',   icon: '✅', color: 'bg-green-500',   activeClass: 'bg-green-500 border-green-500 text-white' },
  { key: 'InOT',              label: 'In OT',               bg: 'bg-amber-50 text-amber-700',   icon: '🔪', color: 'bg-amber-500',   activeClass: 'bg-amber-500 border-amber-500 text-white' },
  { key: 'SurgeryCompleted',  label: 'Done',                bg: 'bg-green-50 text-green-700',   icon: '🩺', color: 'bg-lime-600',    activeClass: 'bg-lime-600 border-lime-600 text-white' },
  { key: 'PostOp',            label: 'Post-Op',             bg: 'bg-violet-50 text-violet-700', icon: '💊', color: 'bg-violet-500',  activeClass: 'bg-violet-500 border-violet-500 text-white' },
];

export default function OperationTheatrePage() {
  const { user } = useAuthStore();
  const branchId = user?.branchId;
  const [journeys, setJourneys] = useState<PatientJourneyRowDto[]>([]);
  const [details, setDetails] = useState<Record<string, PatientJourneyDetailDto>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<OtFilter>('All');
  const [searchName, setSearchName] = useState('');
  const [surgeryDate, setSurgeryDate] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [otFormId, setOtFormId] = useState<string | null>(null);
  const [detailModalId, setDetailModalId] = useState<string | null>(null);
  const [formatHeads, setFormatHeads] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ journeyId: string; action: 'accept' | 'startSurgery' | 'endSurgery'; message: string } | null>(null);
  const [returnJourney, setReturnJourney] = useState<PatientJourneyRowDto | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!branchId) return;
      setIsLoading(true);
      try {
        const jList = await ipManagementApi.listJourneys({ branchId });
        setJourneys(Array.isArray(jList) ? jList : []);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [branchId]);

  async function handleRowClick(id: string) {
    // Always re-fetch so modal sees fresh otDetailsSaved / patientName after any save
    const d = await ipManagementApi.getJourneyDetail(id);
    if (d) setDetails(prev => ({ ...prev, [id]: d }));
    setDetailModalId(id);
  }

  async function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!details[id]) {
      const detail = await ipManagementApi.getJourneyDetail(id);
      if (detail) setDetails(prev => ({ ...prev, [id]: detail }));
    }
  }

  function handleDetailUpdated(updated: PatientJourneyDetailDto) {
    setDetails(prev => ({ ...prev, [updated.id]: updated }));
    setJourneys(prev => prev.map(j => j.id === updated.id ? { ...j, clinicalState: updated.clinicalState, otState: updated.otState, financialState: updated.financialState } : j));
  }

  async function handleConfirmAction() {
    if (!confirmModal) return;
    setActionLoading(true);
    try {
      let result: PatientJourneyDetailDto | null = null;
      if (confirmModal.action === 'accept') {
        result = await acceptInOtWithGates(confirmModal.journeyId);
      } else if (confirmModal.action === 'startSurgery') {
        result = await startSurgeryWithGates(confirmModal.journeyId);
      } else if (confirmModal.action === 'endSurgery') {
        result = await transitionClinicalWithGates(confirmModal.journeyId, { newState: 'SurgeryCompleted' });
      }
      if (result) handleDetailUpdated(result);
      setConfirmModal(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (e instanceof Error ? e.message : 'Action failed.');
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  }

  const OT_CLINICAL_STATES = ['SentToOT', 'InOT', 'SurgeryCompleted', 'PostOp'];

  // Returns 'OTAccepted' when clinical=SentToOT but ot=Accepted (post-accept, pre-surgery)
  const effectiveOtFilter = (j: { clinicalState: string; otState: string }): OtFilter => {
    if (j.clinicalState === 'SentToOT' && j.otState === 'Accepted') return 'OTAccepted';
    return j.clinicalState as OtFilter;
  };

  const displayJourneys = useMemo(() => {
    let list = journeys.filter(j => (OT_CLINICAL_STATES as string[]).includes(j.clinicalState));
    if (activeFilter !== 'All') list = list.filter(j => effectiveOtFilter(j) === activeFilter);
    if (searchName.trim()) list = list.filter(j => (j.patientName ?? '').toLowerCase().includes(searchName.toLowerCase()));
    if (surgeryDate) list = list.filter(j => j.surgeryScheduledAt?.startsWith(surgeryDate));
    return list;
  }, [journeys, activeFilter, searchName, surgeryDate]);

  const counts = useMemo(() => {
    const base = journeys.filter(j => (OT_CLINICAL_STATES as string[]).includes(j.clinicalState));
    const map: Record<string, number> = { All: base.length };
    OT_STAT_CARDS.forEach(({ key }) => { map[key] = base.filter(j => effectiveOtFilter(j) === key).length; });
    return map;
  }, [journeys]);

  return (
    <div className="space-y-4" data-testid={OT_TEST_IDS.page}>
      {formatHeads && <FormatHeadsModal onClose={() => setFormatHeads(false)} />}
      <ConfirmationDialog
        isOpen={!!confirmModal}
        title="Update Surgery"
        message={confirmModal?.message ?? ''}
        variant="info"
        confirmText="Yes"
        cancelText="No"
        isLoading={actionLoading}
        dataTestId={OT_TEST_IDS.confirmDialog}
        confirmTestId={OT_TEST_IDS.confirmYes}
        onConfirm={handleConfirmAction}
        onClose={() => setConfirmModal(null)}
      />
      {returnJourney && (
        <ReturnPatientModal
          journey={returnJourney}
          onClose={() => setReturnJourney(null)}
          onSaved={updated => { handleDetailUpdated(updated); setReturnJourney(null); }}
        />
      )}
      {detailModalId && details[detailModalId] && (
        <SurgeryDetailModal
          journey={details[detailModalId]}
          onClose={() => setDetailModalId(null)}
          onSaved={updated => { handleDetailUpdated(updated); setDetailModalId(null); }}
          onOpenConfirm={(action, message) => {
            setDetailModalId(null);
            setConfirmModal({ journeyId: details[detailModalId!]!.id, action, message });
          }}
          onOpenReturn={() => {
            const j = journeys.find(x => x.id === detailModalId);
            if (j) { setDetailModalId(null); setReturnJourney(j); }
          }}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-blue-600" />
            Operation Theatre
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage surgical workflow from prep to discharge</p>
        </div>
        <button
          onClick={() => setFormatHeads(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-gray-700"
        >
          <Zap className="h-4 w-4 text-amber-500" />
          Format Heads
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {OT_STAT_CARDS.map(({ key, label, bg, icon }) => (
          <button
            key={key}
            data-testid={OT_TEST_IDS.statusTab(key)}
            onClick={() => setActiveFilter(activeFilter === key ? 'All' : key)}
            className={`rounded-xl p-4 text-left border transition-all ${activeFilter === key ? `${bg} border-current shadow-sm` : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}
          >
            <div className="text-2xl mb-1">{icon}</div>
            <p className="text-2xl font-bold">{counts[key] ?? 0}</p>
            <p className="text-xs font-medium mt-0.5 text-gray-600">{label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Patient Name</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name…"
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                className="pl-8 border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Surgery Date</label>
            <input
              type="date"
              value={surgeryDate}
              onChange={e => setSurgeryDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {(searchName || surgeryDate) && (
            <button onClick={() => { setSearchName(''); setSurgeryDate(''); }} className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveFilter('All')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                activeFilter === 'All' ? 'bg-slate-600 border-slate-600 text-white shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeFilter === 'All' ? 'bg-white/80' : 'bg-slate-500'}`} />
              All
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${activeFilter === 'All' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {counts.All ?? 0}
              </span>
            </button>
            {OT_STAT_CARDS.map(({ key, label, color, activeClass }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(activeFilter === key ? 'All' : key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  activeFilter === key ? `${activeClass} shadow-sm` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeFilter === key ? 'bg-white/80' : color}`} />
                {label}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${activeFilter === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {counts[key] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* OT Form for editing */}
        {otFormId && details[otFormId] && (
          <OtDetailsModal
            journey={details[otFormId]}
            onClose={() => setOtFormId(null)}
            onSaved={updated => {
              handleDetailUpdated(updated);
              setOtFormId(null);
            }}
          />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-100">
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">MR No</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Diagnosis</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Surgeon</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Surgery Date</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">OT State</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : displayJourneys.length === 0
                ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-gray-400">
                      <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No OT patients found</p>
                    </td>
                  </tr>
                )
                : displayJourneys.map(j => (
                  <OtRow
                    key={j.id}
                    journey={j}
                    expanded={expandedId === j.id}
                    detail={details[j.id] ?? null}
                    onExpand={() => handleExpand(j.id)}
                    onRowClick={() => handleRowClick(j.id)}
                    onOtFormOpen={async () => {
                      if (!details[j.id]) {
                        const d = await ipManagementApi.getJourneyDetail(j.id);
                        if (d) setDetails(prev => ({ ...prev, [j.id]: d }));
                      }
                      setOtFormId(j.id);
                    }}
                    onDetailUpdated={handleDetailUpdated}
                    onOpenConfirm={(action, message) => setConfirmModal({ journeyId: j.id, action, message })}
                    onOpenReturn={() => setReturnJourney(j)}
                  />
                ))
              }
            </tbody>
          </table>
        </div>

        {!isLoading && displayJourneys.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing <span className="font-medium">{displayJourneys.length}</span> patients
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
