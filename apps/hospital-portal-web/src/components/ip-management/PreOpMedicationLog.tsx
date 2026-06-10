'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, Pill } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  MedicationLogDto,
  OphthMedicationDto,
} from '@/lib/api/ip-management.api';

export interface PreOpMedicationLogProps {
  journeyId: string;
  readOnly?: boolean;
  masterMedications?: OphthMedicationDto[];
}

function fmtTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalInput(dt: string | null | undefined): string {
  if (!dt) return '';
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PreOpMedicationLog({
  journeyId,
  readOnly = false,
  masterMedications = [],
}: PreOpMedicationLogProps) {
  const [log, setLog] = useState<MedicationLogDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDoseId, setSavingDoseId] = useState<string | null>(null);
  const [addingDrug, setAddingDrug] = useState(false);
  const [medSearch, setMedSearch] = useState('');
  const [selectedMedId, setSelectedMedId] = useState<string>('');
  const [freeTextMed, setFreeTextMed] = useState('');
  const [metaSaving, setMetaSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getMedicationLog(journeyId);
    setLog(data);
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredMeds = useMemo(() => {
    const q = medSearch.trim().toLowerCase();
    if (!q) return masterMedications.slice(0, 20);
    return masterMedications
      .filter(m => m.genericName.toLowerCase().includes(q))
      .slice(0, 20);
  }, [masterMedications, medSearch]);

  const showXylocaine = (log?.anaesthesiaType ?? '').toLowerCase() === 'local';

  async function saveMeta(patch: {
    anaesthesiaType?: string;
    xylocaineSensitivityResult?: string;
    surgeryNotes?: string;
  }) {
    if (readOnly) return;
    setMetaSaving(true);
    const updated = await ipManagementApi.updateMedicationLogMeta(journeyId, patch);
    if (updated) setLog(updated);
    else toast.error('Failed to save medication log details');
    setMetaSaving(false);
  }

  async function handleAddDrug() {
    const master = masterMedications.find(m => m.id === selectedMedId);
    const name = (freeTextMed.trim() || master?.genericName || '').trim();
    if (!name) {
      toast.error('Select or enter a medication name');
      return;
    }
    setAddingDrug(true);
    const updated = await ipManagementApi.addMedicationDrug(journeyId, {
      medicineName: name,
      medicationId: master?.id,
      doseCount: 6,
    });
    if (updated) {
      setLog(updated);
      setMedSearch('');
      setSelectedMedId('');
      setFreeTextMed('');
    } else {
      toast.error('Failed to add medication');
    }
    setAddingDrug(false);
  }

  async function handleRemoveDrug(medicineName: string) {
    if (readOnly) return;
    const updated = await ipManagementApi.removeMedicationDrug(journeyId, medicineName);
    if (updated) setLog(updated);
    else toast.error('Failed to remove medication');
  }

  async function handleDoseChange(
    doseId: string,
    administeredAt: string,
    currentlySet: boolean,
  ) {
    if (readOnly) return;
    setSavingDoseId(doseId);
    const updated = await ipManagementApi.saveMedicationDose(journeyId, doseId, {
      administeredAt: administeredAt ? new Date(administeredAt).toISOString() : undefined,
      clearAdministration: !administeredAt && currentlySet,
    });
    if (updated) setLog(updated);
    else toast.error('Failed to save dose');
    setSavingDoseId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading medication log…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
        <span className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
          <Pill className="h-4 w-4" />
          Pre-Op Medication Log (Form 4)
        </span>
        <span className="text-xs text-amber-700">Informational — does not block send to OT</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label className="text-gray-500 block mb-1">Anaesthesia type</label>
          <select
            disabled={readOnly || metaSaving}
            value={log?.anaesthesiaType ?? ''}
            onChange={e => saveMeta({ anaesthesiaType: e.target.value || undefined })}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
          >
            <option value="">— Select —</option>
            <option value="Topical">Topical</option>
            <option value="Local">Local</option>
            <option value="General">General</option>
          </select>
        </div>
        <div>
          <label className="text-gray-500 block mb-1">Sent to OT</label>
          <p className="text-sm font-medium text-gray-800 py-1.5">{fmtTime(log?.sentToOtAt)}</p>
        </div>
      </div>

      {showXylocaine && (
        <div>
          <label className="text-gray-500 text-xs block mb-1">
            Xylocaine sensitivity test <span className="text-gray-400">(optional)</span>
          </label>
          <select
            disabled={readOnly || metaSaving}
            value={log?.xylocaineSensitivityResult ?? ''}
            onChange={e => saveMeta({ xylocaineSensitivityResult: e.target.value || undefined })}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
          >
            <option value="">— Not done —</option>
            <option value="+ve">+ve</option>
            <option value="-ve">−ve</option>
            <option value="NA">N/A</option>
          </select>
        </div>
      )}

      {!readOnly && (
        <div className="rounded-lg border border-dashed border-gray-300 p-3 space-y-2">
          <p className="text-xs font-medium text-gray-600">Add medication</p>
          <input
            type="text"
            placeholder="Search catalog or type name…"
            value={freeTextMed || medSearch}
            onChange={e => {
              setMedSearch(e.target.value);
              setFreeTextMed(e.target.value);
              setSelectedMedId('');
            }}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
          />
          {filteredMeds.length > 0 && medSearch && !selectedMedId && (
            <ul className="max-h-32 overflow-y-auto border border-gray-100 rounded-lg divide-y">
              {filteredMeds.map(m => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50"
                    onClick={() => {
                      setSelectedMedId(m.id);
                      setFreeTextMed(m.genericName);
                      setMedSearch(m.genericName);
                    }}
                  >
                    {m.genericName}
                    {m.route ? <span className="text-gray-400 ml-1">({m.route})</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={addingDrug}
            onClick={handleAddDrug}
            className="inline-flex items-center gap-1 text-sm text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
          >
            {addingDrug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add drug (6 dose slots)
          </button>
        </div>
      )}

      {(log?.drugs ?? []).length === 0 ? (
        <p className="text-sm text-gray-500 py-2">No medications logged yet.</p>
      ) : (
        <div className="space-y-4">
          {log!.drugs.map(drug => (
            <div key={drug.medicineName} className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800">{drug.medicineName}</span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDrug(drug.medicineName)}
                    className="text-red-500 hover:text-red-700 p-1"
                    aria-label={`Remove ${drug.medicineName}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-100">
                      <th className="text-left px-3 py-1.5 font-medium w-16">Dose</th>
                      <th className="text-left px-3 py-1.5 font-medium">Time administered</th>
                      <th className="text-left px-3 py-1.5 font-medium w-20">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drug.doses.map(dose => {
                      const done = !!dose.administeredAt;
                      const saving = savingDoseId === dose.id;
                      return (
                        <tr key={dose.id} className={done ? 'bg-green-50/50' : ''}>
                          <td className="px-3 py-1.5 font-medium text-gray-700">#{dose.doseNumber}</td>
                          <td className="px-3 py-1.5">
                            <input
                              type="datetime-local"
                              disabled={readOnly || saving}
                              value={toLocalInput(dose.administeredAt)}
                              onChange={e => handleDoseChange(dose.id, e.target.value, done)}
                              className="text-xs border border-gray-200 rounded px-1.5 py-1 w-full max-w-[180px]"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            {saving ? (
                              <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                            ) : done ? (
                              <span className="text-green-700 font-medium">Given</span>
                            ) : (
                              <span className="text-gray-400">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="text-gray-500 text-xs block mb-1">Surgery notes</label>
        <textarea
          disabled={readOnly || metaSaving}
          rows={2}
          value={log?.surgeryNotes ?? ''}
          onChange={e => setLog(prev => prev ? { ...prev, surgeryNotes: e.target.value } : prev)}
          onBlur={e => saveMeta({ surgeryNotes: e.target.value })}
          placeholder="Free-text notes for this section…"
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 resize-none"
        />
      </div>
    </div>
  );
}
