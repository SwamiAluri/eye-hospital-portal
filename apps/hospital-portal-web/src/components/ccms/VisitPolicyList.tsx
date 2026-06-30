'use client';

import React, { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, Star, Trash2, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getPoliciesBySession, deletePolicy, setPrimaryPolicy, createPolicy,
  type VisitPolicy,
} from '@/lib/api/ccms/visit-policies.api';
import { parseCounsellorDraft } from '@/lib/api/ccms/parse-counsellor-draft';
import { hasDbPrimaryVisitPolicy, buildVisitPolicyFromDraft } from '@/lib/ccms/ccms-visit-policy-prereq';
import { ccmsKeys, useCcmsCasePolicies } from '@/hooks/use-ccms-case';
import { VisitPolicyForm } from './VisitPolicyForm';
import { coverageTestIds } from '@/lib/counsellors-desk/coverage-test-ids';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';

interface Props {
  caseId?: string;
  sessionId?: string;
  readOnly?: boolean;
  counsellorDraftJson?: string;
  onChanged?: () => void;
}

export function VisitPolicyList({ caseId, sessionId, readOnly = false, counsellorDraftJson, onChanged }: Props) {
  const queryClient = useQueryClient();
  const casePoliciesQuery = useCcmsCasePolicies(caseId);
  const [sessionPolicies, setSessionPolicies] = useState<VisitPolicy[]>([]);
  const [sessionLoading, setSessionLoading] = useState(!!sessionId && !caseId);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<VisitPolicy | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const loadSessionPolicies = useCallback(async () => {
    if (!sessionId || caseId) return;
    setSessionLoading(true);
    setSessionError(null);
    try {
      setSessionPolicies(await getPoliciesBySession(sessionId));
    } catch (e: unknown) {
      setSessionError((e as Error)?.message ?? 'Failed to load policies');
    } finally {
      setSessionLoading(false);
    }
  }, [caseId, sessionId]);

  React.useEffect(() => { loadSessionPolicies(); }, [loadSessionPolicies]);

  const policies = caseId ? (casePoliciesQuery.data ?? []) : sessionPolicies;
  const loading = caseId ? casePoliciesQuery.isLoading : sessionLoading;
  const error = caseId ? (casePoliciesQuery.error ? (casePoliciesQuery.error as Error).message : null) : sessionError;

  const draft = parseCounsellorDraft(counsellorDraftJson);
  const canImportFromDraft = Boolean(
    caseId && !readOnly && draft?.policyNumber?.trim() && !hasDbPrimaryVisitPolicy(policies),
  );

  const reload = useCallback(async () => {
    if (caseId) {
      await queryClient.invalidateQueries({ queryKey: ccmsKeys.policies(caseId) });
    } else {
      await loadSessionPolicies();
    }
  }, [caseId, queryClient, loadSessionPolicies]);

  const handleDelete = async (policy: VisitPolicy) => {
    if (!caseId) return;
    if (!confirm(`Remove policy ${policy.policyNumber}?`)) return;
    try {
      await deletePolicy(caseId, policy.id);
      toast.success('Policy removed');
      await reload();
    } catch {
      toast.error('Failed to remove policy');
    }
  };

  const handleSetPrimary = async (policy: VisitPolicy) => {
    if (!caseId) return;
    try {
      await setPrimaryPolicy(caseId, policy.id);
      toast.success(`${policy.policyNumber} set as primary`);
      await reload();
      onChanged?.();
    } catch {
      toast.error('Failed to set primary');
    }
  };

  const handleImportFromDraft = async () => {
    if (!caseId || !draft) return;
    const payload = buildVisitPolicyFromDraft(caseId, draft, {
      markPrimary: true,
      sessionId,
    });
    if (!payload) {
      toast.error('No policy number in counsellor draft');
      return;
    }
    setImportBusy(true);
    try {
      await createPolicy(caseId, payload);
      toast.success('Visit policy imported from counsellor session (marked Primary)');
      await reload();
      onChanged?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to import policy';
      toast.error(msg);
    } finally {
      setImportBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
          <button onClick={() => reload()} className="ml-auto font-semibold hover:underline">Retry</button>
        </div>
      )}

      {policies.map(p => (
        <div key={p.id}
          className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${
            p.isPrimary ? 'bg-counselling-accent border-counselling-primary/30' : 'bg-counselling-card border-counselling-border'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0">
            <div className={`mt-0.5 p-1.5 rounded-lg ${p.isPrimary ? 'bg-counselling-accent' : 'bg-counselling-muted'}`}>
              <Shield className={`w-3.5 h-3.5 ${p.isPrimary ? 'text-counselling-primary' : 'text-counselling-muted-foreground'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-gray-900 truncate">{p.policyNumber}</span>
                {p.isPrimary && (
                  <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-counselling-primary text-white uppercase tracking-widest">
                    Primary
                  </span>
                )}
              </div>
              {p.insuredName && (
                <p className="text-xs text-gray-500 truncate">{p.insuredName}</p>
              )}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {p.cardNumber && <span className="text-[10px] text-gray-400">Card: {p.cardNumber}</span>}
                {p.accommodationClass && <span className="text-[10px] text-gray-400 capitalize">Room: {p.accommodationClass}</span>}
                {p.serviceTaxApplicable && <span className="text-[10px] text-amber-600">Service Tax</span>}
              </div>
            </div>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {!p.isPrimary && (
                <button onClick={() => handleSetPrimary(p)}
                  title="Set as Primary"
                  className="p-1.5 rounded-lg hover:bg-yellow-50 text-gray-300 hover:text-yellow-500 transition-colors">
                  <Star className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => { setEditing(p); setShowForm(true); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(p)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}

      {policies.length === 0 && (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 py-6 text-center space-y-2">
          <Shield className="w-7 h-7 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500">No visit policies saved in CCMS yet.</p>
          <p className="text-[11px] text-counselling-muted-foreground px-4">
            {counsellingCopy.firstPolicyOnSaveDraft}
          </p>
          {draft?.policyNumber && (
            <p className="text-[11px] text-amber-700 px-4">
              Counsellor draft has policy <span className="font-mono font-semibold">{draft.policyNumber}</span> — save the policy draft to create it.
            </p>
          )}
        </div>
      )}

      {canImportFromDraft && (
        <button
          type="button"
          onClick={handleImportFromDraft}
          disabled={importBusy}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 disabled:opacity-50 transition-colors"
        >
          {importBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
          Import policy from counsellor session
        </button>
      )}

      {!readOnly && caseId && policies.length > 0 && (
        <button
          type="button"
          data-testid={coverageTestIds.visitPolicyAdd}
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-counselling-primary border border-dashed border-counselling-primary/30 rounded-xl hover:bg-counselling-accent transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />{counsellingCopy.addAnotherPolicy}
        </button>
      )}

      {showForm && caseId && (
        <VisitPolicyForm
          caseId={caseId}
          existing={editing}
          existingPolicies={policies}
          isAdditionalPolicy={!editing && policies.length > 0}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); void reload(); onChanged?.(); }}
        />
      )}
    </div>
  );
}
