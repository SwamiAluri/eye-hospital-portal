'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  createPolicy, updatePolicy,
  type VisitPolicy, type CreateVisitPolicyRequest,
} from '@/lib/api/ccms/visit-policies.api';
import { useTpaProviderMaster } from '@/hooks/use-insurance-masters';
import { MasterValuesSelect } from '@/components/master-data/MasterValuesSelect';
import { relationshipApiValue, relationshipMasterCode } from '@/lib/ccms/relationship-api-map';
import { coverageTestIds } from '@/lib/counsellors-desk/coverage-test-ids';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';

interface Props {
  caseId: string;
  existing?: VisitPolicy | null;
  existingPolicies?: VisitPolicy[];
  /** True when adding a policy beyond the auto-created primary. */
  isAdditionalPolicy?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function Field({
  label, children, required,
}: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function VisitPolicyForm({
  caseId, existing, existingPolicies = [], isAdditionalPolicy = false, onClose, onSaved,
}: Props) {
  const [mounted, setMounted] = useState(false);
  React.useEffect(() => setMounted(true), []);
  const [busy, setBusy] = useState(false);

  const [policyNumber,          setPolicyNumber]          = useState(existing?.policyNumber ?? '');
  const [cardNumber,            setCardNumber]            = useState(existing?.cardNumber ?? '');
  const [membershipNumber,      setMembershipNumber]      = useState(existing?.membershipNumber ?? '');
  const [insuredName,           setInsuredName]           = useState(existing?.insuredName ?? '');
  const [relationship,          setRelationship]          = useState(
    relationshipMasterCode(existing?.relationshipToInsured ?? 'self'),
  );
  const [companyName,           setCompanyName]           = useState(existing?.companyName ?? '');
  const [contactNumber,         setContactNumber]         = useState(existing?.contactNumber ?? '');
  const [accommodationClass,    setAccommodationClass]    = useState(existing?.accommodationClass ?? '');
  const [tpaCoordinatorName,    setTpaCoordinatorName]    = useState(existing?.tpaCoordinatorName ?? '');
  const [serviceTaxApplicable,  setServiceTaxApplicable]  = useState(existing?.serviceTaxApplicable ?? false);
  const [isPrimary,             setIsPrimary]             = useState(existing?.isPrimary ?? false);

  const { options: tpaOptions } = useTpaProviderMaster();
  const tpaNames = useMemo(() => tpaOptions.map((o) => o.label), [tpaOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyNumber.trim()) { toast.error('Policy number is required'); return; }

    const normalized = policyNumber.trim().toLowerCase();
    const duplicate = existingPolicies.find(
      (p) => p.id !== existing?.id && p.policyNumber?.trim().toLowerCase() === normalized,
    );
    if (duplicate) {
      toast.error(
        `Policy already on this visit — ${policyNumber.trim()} exists. Edit the existing policy instead.`,
      );
      return;
    }

    setBusy(true);
    try {
      const payload: CreateVisitPolicyRequest = {
        coverageCaseId:       caseId,
        policyNumber:         policyNumber.trim(),
        cardNumber:           cardNumber || undefined,
        membershipNumber:     membershipNumber || undefined,
        insuredName:          insuredName || undefined,
        relationshipToInsured: relationshipApiValue(relationship),
        companyName:          companyName || undefined,
        contactNumber:        contactNumber || undefined,
        accommodationClass:   (accommodationClass || undefined) as any,
        tpaCoordinatorName:   tpaCoordinatorName || undefined,
        serviceTaxApplicable,
        isPrimary,
      };

      if (existing) {
        await updatePolicy(caseId, existing.id, payload);
        toast.success('Policy updated');
      } else {
        await createPolicy(caseId, payload);
        toast.success('Policy added');
      }
      onSaved();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: string } })?.response?.status;
      const message = (err as { response?: { data?: string } })?.response?.data;
      if (status === 409 && message) {
        toast.error(message);
      } else {
        toast.error('Failed to save policy');
      }
    } finally {
      setBusy(false);
    }
  };

  const inp = 'w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30 placeholder:text-gray-300';
  const sel = inp + ' bg-white';

  const primaryLabel = isAdditionalPolicy && !existing
    ? counsellingCopy.confirmPrimaryVisitPolicy
    : 'Set as Primary Policy';

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-900">
              {existing ? 'Edit Policy' : 'Add Insurance Policy'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form id="policy-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Policy Number" required>
              <input
                value={policyNumber}
                onChange={e => setPolicyNumber(e.target.value)}
                data-testid={coverageTestIds.visitPolicyNumber}
                className={inp}
                placeholder="INS-2024-001"
              />
            </Field>
            <Field label="Card Number">
              <input value={cardNumber} onChange={e => setCardNumber(e.target.value)}
                className={inp} placeholder="Optional" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Membership Number">
              <input value={membershipNumber} onChange={e => setMembershipNumber(e.target.value)}
                className={inp} placeholder="Optional" />
            </Field>
            <Field label="Contact Number">
              <input value={contactNumber} onChange={e => setContactNumber(e.target.value)}
                className={inp} placeholder="+91 9XXXXXXXXX" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Insured Name">
              <input value={insuredName} onChange={e => setInsuredName(e.target.value)}
                className={inp} placeholder="Name on policy" />
            </Field>
            <Field label="Relationship">
              <MasterValuesSelect
                entityType="patient.relationship"
                value={relationship}
                onChange={setRelationship}
                className={sel}
                placeholder="— Select —"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Company / Employer">
              <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                list="visit-policy-tpa-suggestions"
                className={inp} placeholder="Employer or TPA name" />
              {tpaNames.length > 0 && (
                <datalist id="visit-policy-tpa-suggestions">
                  {tpaNames.map((n) => <option key={n} value={n} />)}
                </datalist>
              )}
            </Field>
            <Field label="Room Class">
              <MasterValuesSelect
                entityType="insurance.accommodation_class"
                value={accommodationClass}
                onChange={setAccommodationClass}
                className={sel}
                placeholder="— Select —"
              />
            </Field>
          </div>

          <Field label="TPA Coordinator Name">
            <input value={tpaCoordinatorName} onChange={e => setTpaCoordinatorName(e.target.value)}
              className={inp} placeholder="TPA coordinator" />
          </Field>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={serviceTaxApplicable}
                onChange={e => setServiceTaxApplicable(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              Service Tax Applicable
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={isPrimary}
                onChange={e => setIsPrimary(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              {primaryLabel}
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            form="policy-form"
            disabled={busy}
            data-testid={coverageTestIds.visitPolicySave}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {busy ? 'Saving…' : existing ? 'Save Changes' : 'Add Policy'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
