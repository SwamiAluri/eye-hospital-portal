'use client';

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import {
  ipManagementApi,
  PatientJourneyRowDto,
  WardDto,
  WardBedDto,
} from '@/lib/api/ip-management.api';
import { getSurgeons, Surgeon, getNurses, Nurse } from '@/lib/api/widgets.api';
import { useMasterValues } from '@/hooks/use-master-values';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

/**
 * Admission type is a DB-constrained journey enum
 * (`patient_journey.admission_type CHECK ('DayCare','IPD','Emergency')`).
 * It is intentionally NOT sourced from the `ward.admission_type` master
 * (ELECTIVE/EMERGENCY/DAY_CARE/REFERRAL) — that is a different taxonomy whose
 * codes would violate the CHECK constraint and break admission.
 */
const ADMISSION_TYPES = ['DayCare', 'IPD', 'Emergency'] as const;
type AdmissionType = (typeof ADMISSION_TYPES)[number];

export interface AdmitPanelProps {
  journey: PatientJourneyRowDto;
  wards: WardDto[];
  /** Called after a successful admission with the patched journey row. */
  onAdmitted: (updated: PatientJourneyRowDto) => void;
}

/**
 * Inline admission form rendered below Pre-OT Prep (Phase 15). Replaces the
 * standalone AdmitModal: same payload + warn-only gate semantics, but no
 * duplicate patient header, P0 banner, gate-warning list, or confirm() —
 * those signals already live on the workspace top bar.
 */
export function AdmitPanel({ journey, wards, onAdmitted }: AdmitPanelProps) {
  const [admissionType, setAdmissionType] = useState<AdmissionType>('IPD');
  const [primarySurgeonId, setPrimarySurgeonId] = useState('');
  const [wardId, setWardId] = useState('');
  const [roomBed, setRoomBed] = useState('');
  const [admittedAt, setAdmittedAt] = useState(new Date().toISOString().slice(0, 16));
  const [primaryNurseId, setPrimaryNurseId] = useState('');
  const [attendantName, setAttendantName] = useState('');
  const [attendantPhone, setAttendantPhone] = useState('');
  const [attendantRel, setAttendantRel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [admitBeds, setAdmitBeds] = useState<WardBedDto[]>([]);

  const { options: relationshipOptions } = useMasterValues('patient.relationship');

  useEffect(() => {
    getSurgeons().then(setSurgeons).catch(() => {});
    getNurses().then(setNurses).catch(() => {});
  }, []);

  useEffect(() => {
    if (!wardId) { setAdmitBeds([]); setRoomBed(''); return; }
    ipManagementApi.getBedAvailability(wardId).then(setAdmitBeds).catch(() => {});
    setRoomBed('');
  }, [wardId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await ipManagementApi.admitPatient(journey.id, {
        wardId: wardId || undefined,
        admissionType: admissionType || undefined,
        bedNumber: roomBed || undefined,
        admittedAt: admittedAt ? new Date(admittedAt).toISOString() : undefined,
        attendantName: attendantName || undefined,
        attendantPhone: attendantPhone || undefined,
        attendantRelationship: attendantRel || undefined,
        primarySurgeonId: primarySurgeonId || undefined,
        primaryNurseId: primaryNurseId || undefined,
        // Financial bypass / clinical override now live on the Coverage & Payment step.
        // Gates are warn-only and already surfaced on the workspace top bar.
        acknowledgeWarnings: true,
      });
      if (result) {
        onAdmitted({
          ...journey,
          clinicalState: result.clinicalState,
          wardName: result.wardName,
          bedNumber: result.bedNumber,
          admittedAt: result.admittedAt,
        });
      } else {
        setError('Admission failed. Patient may not be in Expected state.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Admission failed.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <form
      onSubmit={handleSubmit}
      data-testid={WARD_PREOP_TEST_IDS.admitModal}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-4"
    >
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">Admit Patient</h3>
      </div>

      {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Admission Type — DB-constrained journey enum */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">
          Admission Type <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          {ADMISSION_TYPES.map(t => (
            <label
              key={t}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-all ${admissionType === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              <input
                type="radio"
                name="admissionType"
                value={t}
                checked={admissionType === t}
                onChange={() => setAdmissionType(t)}
                className="hidden"
              />
              {t}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Surgeon / Doctor</label>
          <select value={primarySurgeonId} onChange={e => setPrimarySurgeonId(e.target.value)} className={inputCls}>
            <option value="">— Select surgeon —</option>
            {surgeons.map(s => (
              <option key={s.id} value={s.id}>{s.name}{s.specialization ? ` (${s.specialization})` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Ward</label>
          <select value={wardId} onChange={e => setWardId(e.target.value)} className={inputCls}>
            <option value="">— No ward assignment yet —</option>
            {wards.map(w => (
              <option key={w.id} value={w.id}>{w.wardName} ({w.totalBeds} beds)</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Room / Bed Number</label>
          {admitBeds.length > 0 ? (
            <select value={roomBed} onChange={e => setRoomBed(e.target.value)} className={inputCls}>
              <option value="">— Select room/bed —</option>
              {admitBeds.map(b => (
                <option key={b.bedId} value={b.roomNo}>
                  {b.description}{b.isAvailable ? '' : ' (occupied)'}
                </option>
              ))}
            </select>
          ) : (
            <input type="text" value={roomBed} onChange={e => setRoomBed(e.target.value)} placeholder="e.g. Room 4 – Bed B" className={inputCls} />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Admission Date &amp; Time</label>
          <input type="datetime-local" value={admittedAt} onChange={e => setAdmittedAt(e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Assigned Nurse</label>
          <select value={primaryNurseId} onChange={e => setPrimaryNurseId(e.target.value)} className={inputCls}>
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
            <input type="text" value={attendantName} onChange={e => setAttendantName(e.target.value)} placeholder="Full name" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input type="tel" value={attendantPhone} onChange={e => setAttendantPhone(e.target.value)} placeholder="Mobile no." className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Relationship</label>
            <select value={attendantRel} onChange={e => setAttendantRel(e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              {relationshipOptions.map(r => (
                <option key={r.value} value={r.label}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          data-testid={WARD_PREOP_TEST_IDS.admitSubmit}
          className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-60"
        >
          {saving ? 'Admitting…' : 'Admit Patient'}
        </button>
      </div>
    </form>
  );
}
