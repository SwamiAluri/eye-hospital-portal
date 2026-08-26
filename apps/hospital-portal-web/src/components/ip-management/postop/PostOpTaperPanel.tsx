'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  type PostOpTaperDto,
  type PostOpTaperStepDto,
  type SavePostOpTaperStepRequest,
} from '@/lib/api/ip-management.api';
import { IpOverlayDialog } from '@/components/ip-management/IpOverlayDialog';
import { useAuthStore } from '@/lib/auth-store';
import { resolveIpRoleActions } from '@/lib/ip-management/ip-role-actions';
import { normalizeOperativeEye } from '@/lib/ip-management/preop-laterality';
import { WARD_POSTOP_TEST_IDS } from '@/lib/ip-management/ward-postop-test-ids';

const DRUGS = ['Prednisolone 1%', 'Moxifloxacin 0.5%', 'Nepafenac 0.1%', 'Homide 2%'];
const FREQS = ['6 times a day', '4 times a day', '2 times a day', 'once a day', 'every 2 hours'];

const EYE_WORD: Record<string, string> = { OD: 'RIGHT', OS: 'LEFT', OU: 'BOTH' };

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function nextStepNo(steps: PostOpTaperStepDto[], drug: string, eye: string): number {
  const max = steps
    .filter(s => s.drugName.toLowerCase() === drug.toLowerCase() && s.eye === eye)
    .reduce((n, s) => Math.max(n, s.stepNo), 0);
  return max + 1;
}

export function PostOpTaperPanel({
  journeyId,
  eyeOperated,
  readOnly,
  onChanged,
}: {
  journeyId: string;
  eyeOperated?: string | null;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const permissions = useAuthStore(s => s.permissions);
  const canWrite = resolveIpRoleActions(permissions).canManagePostOp;
  const defaultEye = normalizeOperativeEye(eyeOperated) ?? 'OD';
  const eyeWord = EYE_WORD[defaultEye] ?? defaultEye;

  const [data, setData] = useState<PostOpTaperDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [drug, setDrug] = useState('Prednisolone 1%');
  const [eye, setEye] = useState(defaultEye);
  const [frequency, setFrequency] = useState('6 times a day');
  const [days, setDays] = useState('7');

  const load = useCallback(async () => {
    setLoading(true);
    const next = await ipManagementApi.getPostOpTaper(journeyId);
    setData(next ?? { steps: [], history: [] });
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setEye(defaultEye);
  }, [defaultEye]);

  async function persist(steps: SavePostOpTaperStepRequest[]) {
    setSaving(true);
    try {
      const saved = await ipManagementApi.savePostOpTaper(journeyId, { steps });
      setData(saved);
      toast.success('Taper saved');
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save the taper plan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const n = Number(days);
    if (!drug.trim() || !frequency.trim() || !Number.isFinite(n) || n <= 0) {
      toast.error('Drug, how often, and days are required.');
      return;
    }
    const current = data?.steps ?? [];
    const payload: SavePostOpTaperStepRequest[] = [
      ...current.map(s => ({
        drugName: s.drugName,
        eye: s.eye,
        frequencyLabel: s.frequencyLabel,
        days: s.days,
        stepNo: s.stepNo,
        instructions: s.instructions ?? undefined,
      })),
      {
        drugName: drug.trim(),
        eye,
        frequencyLabel: frequency.trim(),
        days: n,
        stepNo: nextStepNo(current, drug.trim(), eye),
      },
    ];
    await persist(payload);
    setAddOpen(false);
  }

  const steps = data?.steps ?? [];
  const history = data?.history ?? [];

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading taper…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Eyedrop taper · {eyeWord}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Printed on the discharge sheet. Corrections: add a new step; do not silently edit history.
          </p>
        </div>
        {!readOnly && canWrite && (
          <button
            type="button"
            data-testid={WARD_POSTOP_TEST_IDS.btnAddTaper}
            onClick={() => setAddOpen(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Add step
          </button>
        )}
      </div>

      {!canWrite && !readOnly && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          You can read the plan. You cannot add steps.
        </div>
      )}

      {steps.length === 0 ? (
        <div
          data-testid={WARD_POSTOP_TEST_IDS.taperEmpty}
          className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-sm text-gray-500"
        >
          No taper recorded. Add at least the steroid plan before handover.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm" data-testid={WARD_POSTOP_TEST_IDS.taperTable}>
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Drug</th>
                <th className="px-3 py-2 text-left font-medium">Step</th>
                <th className="px-3 py-2 text-left font-medium">How often</th>
                <th className="px-3 py-2 text-left font-medium">Days</th>
                <th className="px-3 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2 text-left font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {steps.map(s => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">{s.drugName}</td>
                  <td className="px-3 py-2">{s.stepNo}</td>
                  <td className="px-3 py-2">{s.frequencyLabel}</td>
                  <td className="px-3 py-2">{s.days}</td>
                  <td className="px-3 py-2 text-gray-500">{formatWhen(s.createdAt)}</td>
                  <td className="px-3 py-2 text-gray-500">{s.createdByName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && (
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer">Previous saves ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map(s => (
              <li key={s.id}>
                {s.drugName} · step {s.stepNo} · {s.frequencyLabel} · {s.days}d
                {' · '}
                {formatWhen(s.createdAt)}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-gray-500">
        {steps.length} step{steps.length === 1 ? '' : 's'} on file
        {saving ? ' · Saving…' : ''}
      </p>

      {addOpen && (
        <IpOverlayDialog onClose={() => setAddOpen(false)} size="sm" title="Add taper step">
          <div className="p-4 space-y-3">
            <label className="block text-xs">
              <span className="font-medium text-gray-700">Drug</span>
              <input
                list="ip-taper-drugs"
                value={drug}
                onChange={e => setDrug(e.target.value)}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-sm"
              />
              <datalist id="ip-taper-drugs">
                {DRUGS.map(d => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </label>
            <fieldset className="text-xs">
              <legend className="font-medium text-gray-700">Eye</legend>
              <div className="mt-1 flex gap-3">
                {(['OD', 'OS', 'OU'] as const).map(code => (
                  <label key={code} className="flex items-center gap-1.5">
                    <input type="radio" checked={eye === code} onChange={() => setEye(code)} />
                    {EYE_WORD[code]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-xs">
              <span className="font-medium text-gray-700">How often</span>
              <input
                list="ip-taper-freq"
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-sm"
              />
              <datalist id="ip-taper-freq">
                {FREQS.map(f => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </label>
            <label className="block text-xs">
              <span className="font-medium text-gray-700">Days</span>
              <input
                type="number"
                min={1}
                value={days}
                onChange={e => setDays(e.target.value)}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setAddOpen(false)} className="px-3 py-1.5 text-xs border rounded-lg">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleAdd()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add step'}
              </button>
            </div>
          </div>
        </IpOverlayDialog>
      )}
    </div>
  );
}
