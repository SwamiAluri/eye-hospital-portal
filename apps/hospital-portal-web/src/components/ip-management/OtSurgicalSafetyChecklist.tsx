'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  SurgicalSafetyChecklistDto,
  SaveBeforeAnaesthesiaRequest,
  SaveWhoTimeoutRequest,
  SaveAfterSurgeryRequest,
} from '@/lib/api/ip-management.api';
import { useOtSafetyHints } from '@/hooks/use-ot-safety-hints';

export interface OtSurgicalSafetyChecklistProps {
  journeyId: string;
  patientId?: string;
  patientName?: string;
  eyeOperated?: string | null;
  financialState?: string;
  balanceDue?: number;
  emergencyFcApplied?: boolean;
  readOnly?: boolean;
  surgeons?: { id: string; name: string }[];
  nurses?: { id: string; name: string }[];
  onGatesChange?: (gates: SurgicalSafetyChecklistDto['gates'] | null) => void;
}

type Section = 'before' | 'who' | 'after';

function inferEyeFlags(eyeOperated: string | null | undefined): { re: boolean; le: boolean } {
  const e = (eyeOperated ?? '').toUpperCase();
  if (e.includes('RE') || e.includes('OD') || e.includes('RIGHT')) return { re: true, le: false };
  if (e.includes('LE') || e.includes('OS') || e.includes('LEFT')) return { re: false, le: true };
  return { re: false, le: false };
}

function CheckRow({
  label,
  checked,
  disabled,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className={`flex items-start gap-2.5 py-1.5 cursor-pointer ${disabled ? 'opacity-60 cursor-default' : ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={[
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
          checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white hover:border-blue-400',
        ].join(' ')}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <span className="text-sm text-gray-800">
        {label}
        {hint && <span className="block text-[10px] text-gray-400 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export function OtSurgicalSafetyChecklist({
  journeyId,
  patientId,
  patientName,
  eyeOperated,
  financialState,
  balanceDue,
  emergencyFcApplied,
  readOnly = false,
  surgeons = [],
  nurses = [],
  onGatesChange,
}: OtSurgicalSafetyChecklistProps) {
  const [data, setData] = useState<SurgicalSafetyChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { hints: integrationHints } = useOtSafetyHints({
    journeyId,
    patientId,
    patientName,
    eyeOperated: eyeOperated ?? undefined,
    financialState: financialState ?? data?.gates?.financialState,
    balanceDue: balanceDue ?? data?.gates?.balanceDue,
    emergencyFcApplied: emergencyFcApplied ?? data?.gates?.emergencyFcApplied,
  });
  const [open, setOpen] = useState<Record<Section, boolean>>({
    before: true,
    who: false,
    after: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const result = await ipManagementApi.getSurgicalSafetyChecklist(journeyId);
    setData(result);
    if (result?.gates) onGatesChange?.(result.gates);
    setLoading(false);
  }, [journeyId, onGatesChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveBefore(patch: Partial<SaveBeforeAnaesthesiaRequest>) {
    if (!data || readOnly) return;
    setSaving(true);
    const b = data.beforeAnaesthesia;
    const req: SaveBeforeAnaesthesiaRequest = {
      identityConfirmed: patch.identityConfirmed ?? b.identityConfirmed,
      eyeRe: patch.eyeRe ?? b.eyeRe,
      eyeLe: patch.eyeLe ?? b.eyeLe,
      topicalAntibioticsUsed: patch.topicalAntibioticsUsed ?? b.topicalAntibioticsUsed,
      surgeryType: patch.surgeryType ?? b.surgeryType ?? undefined,
      billingVerifiedOverride: patch.billingVerifiedOverride ?? b.billingVerifiedOverride,
      ascanVerified: patch.ascanVerified ?? b.ascanVerified,
      allergyKnown: patch.allergyKnown ?? b.allergyKnown,
      allergyDetails: patch.allergyDetails !== undefined ? patch.allergyDetails : b.allergyDetails ?? undefined,
      consentFormChecked: patch.consentFormChecked ?? b.consentFormChecked,
      fitnessConfirmed: patch.fitnessConfirmed ?? b.fitnessConfirmed,
    };
    const updated = await ipManagementApi.saveBeforeAnaesthesia(journeyId, req);
    if (updated) {
      setData(updated);
      onGatesChange?.(updated.gates);
    } else toast.error('Failed to save Before Anaesthesia checklist');
    setSaving(false);
  }

  async function saveWho(patch: Partial<SaveWhoTimeoutRequest>) {
    if (!data || readOnly) return;
    setSaving(true);
    const w = data.whoTimeout;
    const req: SaveWhoTimeoutRequest = {
      patientIdentity: patch.patientIdentity ?? w.patientIdentity,
      correctEye: patch.correctEye ?? w.correctEye,
      correctProcedure: patch.correctProcedure ?? w.correctProcedure,
      consentConfirmed: patch.consentConfirmed ?? w.consentConfirmed,
      surgeonUserId: patch.surgeonUserId !== undefined ? patch.surgeonUserId : w.surgeonUserId ?? undefined,
      nurseUserId: patch.nurseUserId !== undefined ? patch.nurseUserId : w.nurseUserId ?? undefined,
    };
    const updated = await ipManagementApi.saveWhoTimeout(journeyId, req);
    if (updated) {
      setData(updated);
      onGatesChange?.(updated.gates);
    } else toast.error('Failed to save WHO timeout');
    setSaving(false);
  }

  async function saveAfter(patch: Partial<SaveAfterSurgeryRequest>) {
    if (!data || readOnly) return;
    setSaving(true);
    const a = data.afterSurgery;
    const req: SaveAfterSurgeryRequest = {
      procedureNameRecorded: patch.procedureNameRecorded ?? a.procedureNameRecorded,
      postopMedicationInstructed: patch.postopMedicationInstructed ?? a.postopMedicationInstructed,
      postopPositionInstructed: patch.postopPositionInstructed ?? a.postopPositionInstructed,
    };
    const updated = await ipManagementApi.saveAfterSurgery(journeyId, req);
    if (updated) {
      setData(updated);
      onGatesChange?.(updated.gates);
    } else toast.error('Failed to save After Surgery checklist');
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading surgical safety checklist…
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-gray-500 py-4">
        Surgical safety checklist unavailable. Run migration 137.
      </p>
    );
  }

  const { gates, beforeAnaesthesia: b, whoTimeout: w, afterSurgery: a } = data;
  const suggestedEye = inferEyeFlags(eyeOperated ?? data.eyeOperated);

  function SectionHeader({
    id,
    title,
    done,
    total,
  }: {
    id: Section;
    title: string;
    done: boolean;
    total?: string;
  }) {
    return (
      <button
        type="button"
        onClick={() => setOpen(o => ({ ...o, [id]: !o[id] }))}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200"
      >
        <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          {done ? (
            <ShieldCheck className="h-4 w-4 text-green-600" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          )}
          {title}
          {total && <span className="text-xs font-normal text-gray-500">{total}</span>}
        </span>
        {open[id] ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Surgical Safety (Form 1 OT)</h3>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
      </div>

      <div
        className={[
          'rounded-lg border px-3 py-2 text-xs',
          gates.billingGateSatisfied
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800',
        ].join(' ')}
      >
        <p className="font-semibold">Billing gate {gates.billingGateSatisfied ? '— cleared' : '— blocked'}</p>
        <p className="mt-0.5">
          {gates.financialState}
          {gates.balanceDue != null && gates.balanceDue > 0 ? ` · Outstanding ₹${gates.balanceDue.toLocaleString('en-IN')}` : ''}
          {gates.emergencyFcApplied ? ' · Emergency FC applied' : ''}
          {gates.billingVerifiedAuto ? ' · Auto-verified from billing' : ''}
        </p>
        {!gates.billingGateSatisfied && (
          <p className="mt-1 text-[10px]">Accept Patient is blocked until billing is cleared or Emergency FC is applied.</p>
        )}
      </div>

      {integrationHints.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {integrationHints.map(h => (
            <span
              key={h.field}
              className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-700"
              title={h.label}
            >
              {h.label}
            </span>
          ))}
        </div>
      )}

      <SectionHeader
        id="before"
        title="Before Anaesthesia"
        done={gates.beforeAnaesthesiaComplete}
      />
      {open.before && (
        <div className="pl-1 space-y-1 border-l-2 border-blue-100 ml-2 pl-3">
          <CheckRow label="Patient identity confirmed (name & address)" checked={b.identityConfirmed} disabled={readOnly} onChange={v => saveBefore({ identityConfirmed: v })} />
          <div className="flex gap-4 py-1">
            <CheckRow label="Eye RE" checked={b.eyeRe} disabled={readOnly} onChange={v => saveBefore({ eyeRe: v })} hint={suggestedEye.re ? 'Suggested from journey' : undefined} />
            <CheckRow label="Eye LE" checked={b.eyeLe} disabled={readOnly} onChange={v => saveBefore({ eyeLe: v })} hint={suggestedEye.le ? 'Suggested from journey' : undefined} />
          </div>
          <CheckRow label="Topical antibiotics used" checked={b.topicalAntibioticsUsed} disabled={readOnly} onChange={v => saveBefore({ topicalAntibioticsUsed: v })} />
          <div className="py-1">
            <label className="text-xs text-gray-600 block mb-1">Surgery type</label>
            <select
              disabled={readOnly}
              value={b.surgeryType ?? ''}
              onChange={e => saveBefore({ surgeryType: e.target.value || undefined })}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 w-full max-w-xs"
            >
              <option value="">— Select —</option>
              <option value="Cataract">Cataract</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <CheckRow
            label="Billing details verified (manual override)"
            checked={b.billingVerifiedOverride}
            disabled={readOnly || gates.billingVerifiedAuto}
            onChange={v => saveBefore({ billingVerifiedOverride: v })}
            hint={gates.billingVerifiedAuto ? 'Auto-verified from IP Management' : undefined}
          />
          <CheckRow label="A-scan verified" checked={b.ascanVerified} disabled={readOnly} onChange={v => saveBefore({ ascanVerified: v })} />
          <CheckRow label="Known allergy checked" checked={b.allergyKnown} disabled={readOnly} onChange={v => saveBefore({ allergyKnown: v })} />
          {b.allergyKnown && (
            <input
              type="text"
              disabled={readOnly}
              value={b.allergyDetails ?? ''}
              onChange={e => setData(d => d ? { ...d, beforeAnaesthesia: { ...d.beforeAnaesthesia, allergyDetails: e.target.value } } : d)}
              onBlur={e => saveBefore({ allergyDetails: e.target.value })}
              placeholder="Allergy details…"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mb-1"
            />
          )}
          <CheckRow label="Consent form checked" checked={b.consentFormChecked} disabled={readOnly} onChange={v => saveBefore({ consentFormChecked: v })} />
          <CheckRow label="Fitness confirmed" checked={b.fitnessConfirmed} disabled={readOnly} onChange={v => saveBefore({ fitnessConfirmed: v })} />
        </div>
      )}

      <SectionHeader id="who" title="WHO — Before Incision" done={gates.whoTimeoutComplete} />
      {open.who && (
        <div className="pl-1 space-y-1 border-l-2 border-violet-100 ml-2 pl-3">
          <CheckRow label="Correct patient identity" checked={w.patientIdentity} disabled={readOnly} onChange={v => saveWho({ patientIdentity: v })} />
          <CheckRow label="Correct eye" checked={w.correctEye} disabled={readOnly} onChange={v => saveWho({ correctEye: v })} />
          <CheckRow label="Correct procedure" checked={w.correctProcedure} disabled={readOnly} onChange={v => saveWho({ correctProcedure: v })} />
          <CheckRow label="Consent confirmed" checked={w.consentConfirmed} disabled={readOnly} onChange={v => saveWho({ consentConfirmed: v })} />
          <div className="grid grid-cols-2 gap-2 py-2">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Confirming surgeon</label>
              <select
                disabled={readOnly}
                value={w.surgeonUserId ?? ''}
                onChange={e => saveWho({ surgeonUserId: e.target.value || undefined })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
              >
                <option value="">— Select surgeon —</option>
                {surgeons.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Confirming OT nurse</label>
              <select
                disabled={readOnly}
                value={w.nurseUserId ?? ''}
                onChange={e => saveWho({ nurseUserId: e.target.value || undefined })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
              >
                <option value="">— Select nurse —</option>
                {nurses.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[10px] text-gray-400">Dual sign-off required before Start Surgery (soft warning if incomplete).</p>
        </div>
      )}

      <SectionHeader id="after" title="After Surgery" done={gates.afterSurgeryComplete} />
      {open.after && (
        <div className="pl-1 space-y-1 border-l-2 border-green-100 ml-2 pl-3">
          <CheckRow label="Procedure name recorded" checked={a.procedureNameRecorded} disabled={readOnly} onChange={v => saveAfter({ procedureNameRecorded: v })} />
          <CheckRow label="Post-op medication instructed" checked={a.postopMedicationInstructed} disabled={readOnly} onChange={v => saveAfter({ postopMedicationInstructed: v })} />
          <CheckRow label="Post-op position instructed" checked={a.postopPositionInstructed} disabled={readOnly} onChange={v => saveAfter({ postopPositionInstructed: v })} />
        </div>
      )}
    </div>
  );
}
