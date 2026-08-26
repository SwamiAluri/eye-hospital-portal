'use client';

import { useEffect, useState } from 'react';
import { Building2, Ban } from 'lucide-react';
import {
  ipManagementApi,
  PatientJourneyRowDto,
  WardDto,
  WardBedDto,
  type PreauthStatusDto,
} from '@/lib/api/ip-management.api';
import { getSurgeons, Surgeon, getNurses, Nurse } from '@/lib/api/widgets.api';
import { useMasterValues } from '@/hooks/use-master-values';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { canCancelAdmission } from '@/lib/ip-management/ward-journey-helpers';
import { usePermissions } from '@/hooks/use-permissions';
import { resolveIpRoleActions } from '@/lib/ip-management/ip-role-actions';
import { WristbandPrintControl } from '@/components/ip-management/WristbandPrintControl';

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
  onCancelled?: (updated: PatientJourneyRowDto) => void;
}

/**
 * Inline admission form rendered below Pre-OT Prep (Phase 15). Replaces the
 * standalone AdmitModal: same payload + warn-only gate semantics, but no
 * duplicate patient header, P0 banner, gate-warning list, or confirm() —
 * those signals already live on the workspace top bar.
 */
export function AdmitPanel({ journey, wards, onAdmitted, onCancelled }: AdmitPanelProps) {
  const [admissionType, setAdmissionType] = useState<AdmissionType>('IPD');
  const [primarySurgeonId, setPrimarySurgeonId] = useState('');
  const [wardId, setWardId] = useState('');
  const [roomBed, setRoomBed] = useState('');
  const [assignedBedId, setAssignedBedId] = useState('');
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
  const [coverage, setCoverage] = useState<PreauthStatusDto | null>(null);

  const { options: relationshipOptions } = useMasterValues('patient.relationship');

  useEffect(() => {
    getSurgeons().then(setSurgeons).catch(() => {});
    getNurses().then(setNurses).catch(() => {});
    ipManagementApi.getPreauthStatus(journey.id).then(setCoverage).catch(() => {});
  }, [journey.id]);

  useEffect(() => {
    if (!wardId) { setAdmitBeds([]); setRoomBed(''); setAssignedBedId(''); return; }
    ipManagementApi.getBedAvailability(wardId).then(setAdmitBeds).catch(() => {});
    setRoomBed('');
    setAssignedBedId('');
  }, [wardId]);

  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const coverageBlocked = Boolean(coverage && !coverage.allowed && !journey.isEmergencyFc);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await ipManagementApi.admitPatient(journey.id, {
        wardId: wardId || undefined,
        admissionType: admissionType || undefined,
        bedNumber: roomBed || undefined,
        assignedBedId: assignedBedId || undefined,
        admittedAt: admittedAt ? new Date(admittedAt).toISOString() : undefined,
        attendantName: attendantName || undefined,
        attendantPhone: attendantPhone || undefined,
        attendantRelationship: attendantRel || undefined,
        primarySurgeonId: primarySurgeonId || undefined,
        primaryNurseId: primaryNurseId || undefined,
        // Financial bypass / clinical override now live on the Coverage & Payment step.
        // Gates are warn-only and already surfaced on the workspace top bar.
        acknowledgeWarnings: true,
        expectedUpdatedAt: journey.updatedAt,
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

  async function handleCancelAdmission() {
    if (!cancelReason.trim()) {
      setError('Cancel reason is required.');
      return;
    }
    setCancelling(true);
    setError('');
    try {
      const result = await ipManagementApi.cancelAdmission(
        journey.id, cancelReason.trim(), journey.updatedAt);
      if (result) {
        const updated = {
          ...journey,
          clinicalState: result.clinicalState,
          wardName: result.wardName,
          bedNumber: result.bedNumber,
          updatedAt: result.updatedAt,
        };
        (onCancelled ?? onAdmitted)(updated);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not cancel admission.');
    } finally {
      setCancelling(false);
    }
  }

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  // After admission: show admission & bed summary (S-05 step 1 for Admitted patients).
  if (journey.clinicalState !== 'Expected') {
    return (
      <AdmissionBedSummary journey={journey} onCancelled={onCancelled} onAdmitted={onAdmitted} />
    );
  }

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
      {coverage && (!coverage.allowed || coverage.decision === 'BLOCK' || coverage.blockReason) && (
        <p
          data-testid={WARD_PREOP_TEST_IDS.admitCcmsBlock}
          className={`text-xs border px-3 py-2 rounded-lg ${
            coverage.allowed
              ? 'text-amber-900 bg-amber-50 border-amber-200'
              : 'text-red-800 bg-red-50 border-red-200'
          }`}
        >
          {coverage.decision ? `CCMS ${coverage.decision}. ` : ''}
          {coverage.blockReason || coverage.warningMessage || 'Coverage authorization blocks admission.'}
        </p>
      )}

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
            <select
              value={assignedBedId || roomBed}
              onChange={e => {
                const v = e.target.value;
                const match = admitBeds.find(b => b.bedId === v);
                if (match) {
                  setAssignedBedId(match.bedId);
                  setRoomBed(match.roomNo);
                } else {
                  setAssignedBedId('');
                  setRoomBed(v);
                }
              }}
              className={inputCls}
            >
              <option value="">— Select room/bed —</option>
              {admitBeds.map(b => (
                <option key={b.bedId} value={b.bedId}>
                  {b.description}{b.isAvailable ? '' : ' (occupied)'}
                </option>
              ))}
            </select>
          ) : (
            <input type="text" value={roomBed} onChange={e => { setAssignedBedId(''); setRoomBed(e.target.value); }} placeholder="e.g. Room 4 – Bed B" className={inputCls} />
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

      <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
        {canCancelAdmission(journey) && (
          <div className="flex-1 space-y-2">
            {!confirmCancel ? (
              <button
                type="button"
                onClick={() => { setConfirmCancel(true); setError(''); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50"
              >
                <Ban className="h-4 w-4" /> Cancel admission
              </button>
            ) : (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-2">
                <p className="text-xs text-rose-800">
                  This releases any reserved bed and ends the journey. It cannot be undone from IP Management.
                </p>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  rows={2}
                  placeholder="Reason (required)"
                  className="w-full border border-rose-200 rounded-lg px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setConfirmCancel(false); setCancelReason(''); }}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleCancelAdmission}
                    className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded-lg disabled:opacity-60"
                  >
                    {cancelling ? 'Cancelling…' : 'Confirm cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || coverageBlocked}
            data-testid={WARD_PREOP_TEST_IDS.admitSubmit}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-60"
          >
            {saving ? 'Admitting…' : 'Admit Patient'}
          </button>
        </div>
      </div>
    </form>
  );
}

function fmtWhen(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Post-admit view of S-05 step 1 — admission facts + bed assignment history. */
function AdmissionBedSummary({
  journey,
  onCancelled,
  onAdmitted,
}: {
  journey: PatientJourneyRowDto;
  onCancelled?: (updated: PatientJourneyRowDto) => void;
  onAdmitted: (updated: PatientJourneyRowDto) => void;
}) {
  const canPrintSafetyToken = resolveIpRoleActions(usePermissions()).canPrintSafetyToken;
  const [history, setHistory] = useState<
    Array<{ assignmentType: string; bedNumber?: string | null; startedAt: string; endedAt?: string | null; reason?: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void ipManagementApi.listBedAssignments(journey.id).then(rows => {
      if (!cancelled) {
        setHistory(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [journey.id]);

  async function handleCancelAdmission() {
    if (!cancelReason.trim()) {
      setError('Cancel reason is required.');
      return;
    }
    setCancelling(true);
    setError('');
    try {
      const result = await ipManagementApi.cancelAdmission(
        journey.id,
        cancelReason.trim(),
        journey.updatedAt,
      );
      if (result) {
        (onCancelled ?? onAdmitted)({
          ...journey,
          clinicalState: result.clinicalState,
          wardName: result.wardName,
          bedNumber: result.bedNumber,
          updatedAt: result.updatedAt,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not cancel admission.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      data-testid={WARD_PREOP_TEST_IDS.admitModal}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900">Admission &amp; bed</h3>
        </div>
        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
          Admitted
        </span>
      </div>

      {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Admission type</p>
          <p className="font-medium text-gray-900 mt-0.5">{journey.admissionType ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Admitted at</p>
          <p className="font-medium text-gray-900 mt-0.5">{fmtWhen(journey.admittedAt)}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Ward · bed</p>
          <p className="font-medium text-gray-900 mt-0.5">
            {[journey.wardName, journey.bedNumber].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Clinical state</p>
          <p className="font-medium text-gray-900 mt-0.5">{journey.clinicalState}</p>
        </div>
      </div>

      <WristbandPrintControl
        journey={journey}
        canPrint={canPrintSafetyToken}
        variant="admit"
      />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Bed history</p>
        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-gray-500">No bed assignment rows yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">Bed</th>
                  <th className="text-left px-3 py-2">Reason</th>
                  <th className="text-left px-3 py-2">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((row, i) => (
                  <tr key={`${row.startedAt}-${i}`}>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtWhen(row.startedAt)}</td>
                    <td className="px-3 py-2">{row.bedNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{row.reason || row.assignmentType || '—'}</td>
                    <td className="px-3 py-2">
                      {row.endedAt ? (
                        <span className="text-xs text-gray-500">Closed</span>
                      ) : (
                        <span className="text-xs text-emerald-700 font-medium">Current</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">
          Bed state is owned by Auth. Transfer from the ward board; this step does not write occupancy directly.
        </p>
      </div>

      {canCancelAdmission(journey) && (
        <div className="border-t border-gray-100 pt-3">
          {!confirmCancel ? (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="inline-flex items-center gap-1.5 text-xs text-rose-700 hover:underline"
            >
              <Ban className="h-3.5 w-3.5" /> Cancel admission
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <label className="block text-xs">
                <span className="font-medium text-rose-900">Reason</span>
                <input
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="mt-1 w-full border border-rose-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                />
              </label>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setConfirmCancel(false)} className="px-3 py-1.5 text-xs border rounded-lg">
                  Back
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => void handleCancelAdmission()}
                  className="px-3 py-1.5 text-xs bg-rose-600 text-white rounded-lg disabled:opacity-60"
                >
                  {cancelling ? 'Cancelling…' : 'Confirm cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
