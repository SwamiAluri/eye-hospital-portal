'use client';

import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  createPolicy,
  updatePolicy,
  type VisitPolicy,
  type CreateVisitPolicyRequest,
} from '@/lib/api/ccms/visit-policies.api';
import { MasterValuesSelect } from '@/components/master-data/MasterValuesSelect';
import { relationshipApiValue, relationshipMasterCode } from '@/lib/ccms/relationship-api-map';
import { coverageTestIds } from '@/lib/counsellors-desk/coverage-test-ids';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import {
  CounsellingButton,
  CounsellingDialog,
  CounsellingDialogContent,
  CounsellingDialogFooter,
  CounsellingDialogHeader,
  CounsellingDialogTitle,
  CounsellingInput,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

interface Props {
  caseId: string;
  existing?: VisitPolicy | null;
  existingPolicies?: VisitPolicy[];
  /** True when adding a policy beyond the auto-created primary. */
  isAdditionalPolicy?: boolean;
  /** Prefer case/form insurer UUID when creating a new visit policy. */
  defaultInsuranceProviderId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const selectClassName = cn(
  'flex h-10 w-full rounded-lg border border-counselling-border bg-counselling-card px-3 py-2 text-sm text-counselling-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/25 focus-visible:border-counselling-primary/60',
);

export function VisitPolicyForm({
  caseId,
  existing,
  existingPolicies = [],
  isAdditionalPolicy = false,
  defaultInsuranceProviderId,
  onClose,
  onSaved,
}: Props) {
  const [busy, setBusy] = useState(false);

  const [policyNumber, setPolicyNumber] = useState(existing?.policyNumber ?? '');
  const [cardNumber, setCardNumber] = useState(existing?.cardNumber ?? '');
  const [membershipNumber, setMembershipNumber] = useState(existing?.membershipNumber ?? '');
  const [insuredName, setInsuredName] = useState(existing?.insuredName ?? '');
  const [relationship, setRelationship] = useState(
    relationshipMasterCode(existing?.relationshipToInsured ?? 'self'),
  );
  const [companyName, setCompanyName] = useState(existing?.companyName ?? '');
  const [contactNumber, setContactNumber] = useState(existing?.contactNumber ?? '');
  const [accommodationClass, setAccommodationClass] = useState(existing?.accommodationClass ?? '');
  const [tpaCoordinatorName, setTpaCoordinatorName] = useState(existing?.tpaCoordinatorName ?? '');
  const [serviceTaxApplicable, setServiceTaxApplicable] = useState(
    existing?.serviceTaxApplicable ?? false,
  );
  // First policy on an empty visit defaults to primary; additional policies stay opt-in.
  const [isPrimary, setIsPrimary] = useState(() => {
    if (existing) return Boolean(existing.isPrimary);
    if (isAdditionalPolicy || existingPolicies.length > 0) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyNumber.trim()) {
      toast.error('Policy number is required');
      return;
    }

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
      const isFirstOnVisit = !existing && existingPolicies.length === 0;
      const payload: CreateVisitPolicyRequest = {
        coverageCaseId: caseId,
        policyNumber: policyNumber.trim(),
        cardNumber: cardNumber || undefined,
        membershipNumber: membershipNumber || undefined,
        insuredName: insuredName || undefined,
        relationshipToInsured: relationshipApiValue(relationship),
        companyName: companyName || undefined,
        contactNumber: contactNumber || undefined,
        accommodationClass: (accommodationClass || undefined) as CreateVisitPolicyRequest['accommodationClass'],
        tpaCoordinatorName: tpaCoordinatorName || undefined,
        serviceTaxApplicable,
        isPrimary: isFirstOnVisit ? true : isPrimary,
        insuranceProviderId: defaultInsuranceProviderId || undefined,
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

  const primaryLabel =
    isAdditionalPolicy && !existing
      ? counsellingCopy.confirmPrimaryVisitPolicy
      : 'Set as Primary Policy';

  const title = existing ? 'Edit Policy' : 'Add Insurance Policy';

  return (
    <CounsellingDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <CounsellingDialogContent
        size="lg"
        className="counselling-session flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0"
        data-testid="visit-policy-form-dialog"
      >
        <CounsellingDialogHeader className="border-b border-counselling-border px-5 py-4 text-left">
          <CounsellingDialogTitle className="flex items-center gap-2 text-sm font-semibold text-counselling-foreground">
            <Shield className="h-4 w-4 text-counselling-primary" aria-hidden />
            {title}
          </CounsellingDialogTitle>
        </CounsellingDialogHeader>

        <form
          id="policy-form"
          onSubmit={handleSubmit}
          className="counselling-hidden-scroll flex-1 space-y-5 overflow-y-auto px-5 py-4"
        >
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-counselling-muted-foreground">
              Policy Details
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CounsellingInput
                label="Policy Number"
                required
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                data-testid={coverageTestIds.visitPolicyNumber}
                placeholder="INS-2024-001"
              />
              <CounsellingInput
                label="Card Number"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="Optional"
              />
              <CounsellingInput
                label="Membership Number"
                value={membershipNumber}
                onChange={(e) => setMembershipNumber(e.target.value)}
                placeholder="Optional"
              />
              <CounsellingInput
                label="Contact Number"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+91 9XXXXXXXXX"
              />
              <CounsellingInput
                label="Insured Name"
                value={insuredName}
                onChange={(e) => setInsuredName(e.target.value)}
                placeholder="Name on policy"
              />
              <div className="w-full space-y-1">
                <label className="block text-xs font-medium text-counselling-muted-foreground">
                  Relationship
                </label>
                <MasterValuesSelect
                  entityType="patient.relationship"
                  value={relationship}
                  onChange={setRelationship}
                  className={selectClassName}
                  placeholder="Select relationship"
                />
              </div>
              <CounsellingInput
                label="Company / Employer"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter company or employer name"
                data-testid="visit-policy-company-employer"
              />
              <div className="w-full space-y-1">
                <label className="block text-xs font-medium text-counselling-muted-foreground">
                  Room Class
                </label>
                <MasterValuesSelect
                  entityType="insurance.accommodation_class"
                  value={accommodationClass}
                  onChange={setAccommodationClass}
                  className={selectClassName}
                  placeholder="Select room class"
                />
              </div>
              <div className="sm:col-span-2">
                <CounsellingInput
                  label="TPA Coordinator Name"
                  value={tpaCoordinatorName}
                  onChange={(e) => setTpaCoordinatorName(e.target.value)}
                  placeholder="TPA coordinator"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-counselling-muted-foreground">
              Additional Details
            </h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-counselling-foreground">
                <input
                  type="checkbox"
                  checked={serviceTaxApplicable}
                  onChange={(e) => setServiceTaxApplicable(e.target.checked)}
                  className="rounded border-counselling-border text-counselling-primary focus:ring-counselling-primary/30"
                />
                Service Tax Applicable
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-counselling-foreground">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="rounded border-counselling-border text-counselling-primary focus:ring-counselling-primary/30"
                />
                {primaryLabel}
              </label>
            </div>
          </section>
        </form>

        <CounsellingDialogFooter className="gap-2 border-t border-counselling-border px-5 py-4 sm:justify-end">
          <CounsellingButton type="button" variant="outline" onClick={onClose}>
            Cancel
          </CounsellingButton>
          <CounsellingButton
            type="submit"
            form="policy-form"
            disabled={busy}
            data-testid={coverageTestIds.visitPolicySave}
          >
            {busy ? 'Saving…' : existing ? 'Save Changes' : 'Add Policy'}
          </CounsellingButton>
        </CounsellingDialogFooter>
      </CounsellingDialogContent>
    </CounsellingDialog>
  );
}
