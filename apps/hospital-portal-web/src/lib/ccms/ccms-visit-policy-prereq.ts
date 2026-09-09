import type { PreAuthorization } from '@/lib/api/ccms/ccms-authorizations.api';
import type {
  VisitPolicy,
  CreateVisitPolicyRequest,
  UpdateVisitPolicyRequest,
  AccommodationClass,
} from '@/lib/api/ccms/visit-policies.api';
import type { CounsellorDraftSnapshot } from '@/lib/api/ccms/parse-counsellor-draft';
import type { CoveragePanelForm } from '@/lib/counsellors-desk/coverage-form-mappers';
import type {
  RelationshipToInsured,
  RoomClassEntitlement,
} from '@/lib/api/ccms/ccms-coverage-cases.api';
import { isCcmsUuid } from '@/lib/ccms/ccms-ids';
import { relationshipApiValue } from '@/lib/ccms/relationship-api-map';

/** Backend requires a row in ccms_visit_insurance_policies with is_primary = true. */
export function hasDbPrimaryVisitPolicy(policies: VisitPolicy[]): boolean {
  return policies.some(p => p.isPrimary && p.policyNumber?.trim());
}

/**
 * Show "Import from counsellor session" only as empty-list recovery:
 * draft has a policy number and the visit has no policy rows yet.
 * If any visit policy exists, use Add / Set primary instead.
 */
export function shouldOfferImportPolicyFromCounsellorDraft(input: {
  hasCaseId: boolean;
  readOnly: boolean;
  draftPolicyNumber?: string | null;
  policies: VisitPolicy[];
}): boolean {
  if (!input.hasCaseId || input.readOnly) return false;
  if (!input.draftPolicyNumber?.trim()) return false;
  if (hasDbPrimaryVisitPolicy(input.policies)) return false;
  const withNumber = input.policies.filter((p) => p.policyNumber?.trim());
  return withNumber.length === 0;
}

export const PRIMARY_VISIT_POLICY_HINT =
  'Add a visit policy on Overview → Intake → Visit Policies and mark it Primary before generating pre-auth.';

function mapDraftRoomClass(raw?: string | null): AccommodationClass | undefined {
  if (!raw) return undefined;
  const n = raw.toLowerCase().replace(/[\s_]+/g, '-');
  if (n.includes('icu') || n.includes('hdu')) return 'icu';
  if (n.includes('semi')) return 'semi-private';
  if (n === 'private' || n.includes('private')) return 'private';
  if (n.includes('general')) return 'general';
  return undefined;
}

function mapVisitPolicyRoomClass(raw?: string | null): RoomClassEntitlement | undefined {
  if (!raw) return undefined;
  const n = raw.toLowerCase().replace(/[\s_]+/g, '-');
  if (n.includes('icu') || n.includes('hdu')) return 'ICU';
  if (n.includes('semi')) return 'Semi-Private';
  if (n.includes('private')) return 'Private';
  if (n.includes('general')) return 'General';
  return undefined;
}

function mapVisitPolicyRelationship(
  raw?: string | null,
): RelationshipToInsured | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  const map: Record<string, RelationshipToInsured> = {
    self: 'Self',
    spouse: 'Spouse',
    child: 'Child',
    parent: 'Parent',
    other: 'Other',
  };
  return map[key];
}

/** Prefer primary visit policy; else first with a policy number. */
export function resolvePreferredVisitPolicy(
  policies: VisitPolicy[],
): VisitPolicy | null {
  const withNumber = policies.filter((p) => p.policyNumber?.trim());
  if (withNumber.length === 0) return null;
  return withNumber.find((p) => p.isPrimary) ?? withNumber[0] ?? null;
}

/**
 * Map a visit policy row into coverage form fields (projection for Policy tab).
 * Does not clear unrelated form fields.
 */
export function coverageFormPatchFromVisitPolicy(
  policy: VisitPolicy,
): Partial<CoveragePanelForm> {
  const patch: Partial<CoveragePanelForm> = {
    policyNumber: policy.policyNumber?.trim() || undefined,
  };
  if (policy.membershipNumber?.trim()) {
    patch.membershipNumber = policy.membershipNumber.trim();
  }
  if (policy.insuredName?.trim()) {
    patch.insuredName = policy.insuredName.trim();
  }
  const relationship = mapVisitPolicyRelationship(policy.relationshipToInsured);
  if (relationship) patch.relationshipToInsured = relationship;
  const room = mapVisitPolicyRoomClass(policy.accommodationClass);
  if (room) patch.roomClassEntitlement = room;
  if (isCcmsUuid(policy.insuranceProviderId)) {
    patch.insuranceProviderId = policy.insuranceProviderId;
  }
  if (policy.insuranceProviderName?.trim()) {
    patch.insurerName = policy.insuranceProviderName.trim();
  }
  if (typeof policy.serviceTaxApplicable === 'boolean') {
    patch.serviceTaxApplicable = policy.serviceTaxApplicable;
  }
  return patch;
}

/**
 * Whether the Policy tab should adopt visit-policy SoT into the form.
 * Avoids overwriting a counsellor-typed number that is not yet on the visit list.
 */
export function shouldHydrateCoverageFormFromVisitPolicies(
  form: Pick<CoveragePanelForm, 'policyNumber'>,
  policies: VisitPolicy[],
): boolean {
  const preferred = resolvePreferredVisitPolicy(policies);
  if (!preferred) return false;
  const current = form.policyNumber?.trim().toLowerCase() ?? '';
  if (!current) return true;
  const known = policies.some(
    (p) => p.policyNumber?.trim().toLowerCase() === current,
  );
  // Already matches a visit policy — hydrate when preferred (primary) differs.
  if (known) {
    return preferred.policyNumber.trim().toLowerCase() !== current;
  }
  // Typed number not on list yet — do not clobber.
  return false;
}

export function buildCoverageFormHydrationFromPolicies(
  form: Pick<CoveragePanelForm, 'policyNumber'>,
  policies: VisitPolicy[],
): Partial<CoveragePanelForm> | null {
  if (!shouldHydrateCoverageFormFromVisitPolicies(form, policies)) return null;
  const preferred = resolvePreferredVisitPolicy(policies);
  if (!preferred) return null;
  return coverageFormPatchFromVisitPolicy(preferred);
}

/**
 * Apply visit-policy SoT onto a coverage form after draft/case rebuild.
 * Safe to call after every `draftFromCase` / empty form set.
 */
export function applyVisitPolicyHydrationToForm(
  form: CoveragePanelForm,
  policies: VisitPolicy[],
): CoveragePanelForm {
  const patch = buildCoverageFormHydrationFromPolicies(form, policies);
  if (!patch) return form;
  return {
    ...form,
    ...patch,
  };
}

export type VisitPolicySyncPlan =
  | { action: 'skip' }
  | { action: 'create'; payload: CreateVisitPolicyRequest }
  | {
      action: 'update';
      policyId: string;
      payload: UpdateVisitPolicyRequest;
      setPrimary?: boolean;
    };

function buildUpdatePayloadFromForm(form: CoveragePanelForm): UpdateVisitPolicyRequest {
  const relationship = form.relationshipToInsured
    ? relationshipApiValue(form.relationshipToInsured)
    : undefined;

  return {
    policyNumber: form.policyNumber?.trim() || undefined,
    membershipNumber: form.membershipNumber?.trim() || undefined,
    insuredName: form.insuredName?.trim() || undefined,
    insuranceProviderId: isCcmsUuid(form.insuranceProviderId)
      ? form.insuranceProviderId
      : undefined,
    relationshipToInsured: relationship,
    accommodationClass: mapDraftRoomClass(form.roomClassEntitlement),
    serviceTaxApplicable: Boolean(form.serviceTaxApplicable),
  };
}

/**
 * Decide create vs update for coverage form → visit policy sync.
 * Create only when the visit has no policies yet; otherwise update primary/selected.
 */
export function resolveVisitPolicySyncPlan(
  caseId: string,
  form: CoveragePanelForm,
  policies: VisitPolicy[],
  opts?: { markPrimary?: boolean; sessionId?: string; selectedPolicyId?: string },
): VisitPolicySyncPlan {
  if (!canSyncVisitPolicyFromCoverageForm(form)) return { action: 'skip' };

  const createPayload = buildVisitPolicyFromCoverageForm(caseId, form, {
    markPrimary: opts?.markPrimary ?? true,
    sessionId: opts?.sessionId,
  });
  if (!createPayload) return { action: 'skip' };

  const withNumber = policies.filter((p) => p.policyNumber?.trim());
  if (withNumber.length === 0) {
    return { action: 'create', payload: createPayload };
  }

  const normalized = form.policyNumber!.trim().toLowerCase();
  const selected =
    (opts?.selectedPolicyId
      ? withNumber.find((p) => p.id === opts.selectedPolicyId)
      : undefined) ??
    withNumber.find((p) => p.policyNumber.trim().toLowerCase() === normalized) ??
    resolvePreferredVisitPolicy(withNumber);

  if (!selected) {
    return { action: 'create', payload: createPayload };
  }

  return {
    action: 'update',
    policyId: selected.id,
    payload: buildUpdatePayloadFromForm(form),
    setPrimary: !selected.isPrimary,
  };
}

/** Build a create-policy payload from counsellor draft (Overview import). */
export function buildVisitPolicyFromDraft(
  caseId: string,
  draft: CounsellorDraftSnapshot,
  opts?: { markPrimary?: boolean; sessionId?: string },
): CreateVisitPolicyRequest | null {
  const policyNumber = draft.policyNumber?.trim();
  if (!policyNumber) return null;

  return {
    coverageCaseId: caseId,
    sessionId: opts?.sessionId,
    policyNumber,
    membershipNumber: draft.membershipNumber?.trim() || undefined,
    insuredName: draft.insuredName?.trim() || undefined,
    relationshipToInsured: (draft.relationshipToInsured as CreateVisitPolicyRequest['relationshipToInsured']) ?? 'self',
    accommodationClass: mapDraftRoomClass(draft.roomClassEntitlement),
    isPrimary: opts?.markPrimary ?? true,
    serviceTaxApplicable: Boolean((draft as { serviceTaxApplicable?: boolean }).serviceTaxApplicable),
  };
}

/** Policy wizard step / Submit CTA — backend SoT for submit-to-claims. */
export function isCoveragePolicyStepComplete(policies: VisitPolicy[]): boolean {
  return hasDbPrimaryVisitPolicy(policies);
}

/** Whether Submit to Claims may be enabled (same rule as policy step completion). */
export function canEnableSubmitToClaims(policies: VisitPolicy[]): boolean {
  return isCoveragePolicyStepComplete(policies);
}

/** Whether coverage draft save should attempt primary visit-policy sync. */
export function canSyncVisitPolicyFromCoverageForm(
  form: Pick<CoveragePanelForm, 'policyNumber' | 'insurerName' | 'insuranceProviderId'>,
): boolean {
  if (!form.policyNumber?.trim()) return false;
  return !!(form.insurerName?.trim() || form.insuranceProviderId);
}

/** Build a create-policy payload from the coverage panel form (counsellor workflow). */
export function buildVisitPolicyFromCoverageForm(
  caseId: string,
  form: CoveragePanelForm,
  opts?: { markPrimary?: boolean; sessionId?: string },
): CreateVisitPolicyRequest | null {
  const policyNumber = form.policyNumber?.trim();
  if (!policyNumber) return null;

  const relationship = form.relationshipToInsured
    ? relationshipApiValue(form.relationshipToInsured)
    : 'self';

  return {
    coverageCaseId: caseId,
    sessionId: opts?.sessionId,
    policyNumber,
    membershipNumber: form.membershipNumber?.trim() || undefined,
    insuredName: form.insuredName?.trim() || undefined,
    insuranceProviderId: isCcmsUuid(form.insuranceProviderId)
      ? form.insuranceProviderId
      : undefined,
    relationshipToInsured: relationship,
    accommodationClass: mapDraftRoomClass(form.roomClassEntitlement),
    isPrimary: opts?.markPrimary ?? true,
    serviceTaxApplicable: Boolean(form.serviceTaxApplicable),
  };
}

export function isPendingPreAuth(auth: PreAuthorization): boolean {
  if (auth.status === 'PENDING') return true;
  const ps = (auth.processStatus ?? '').toLowerCase();
  return ps === 'pending' || ps === '';
}

/** Match generated auth after POST — tolerate GET lag, id casing, and processStatus casing. */
export function resolveVerifiedPreAuth(
  list: PreAuthorization[],
  created: PreAuthorization,
): PreAuthorization | null {
  const createdId = created?.id?.trim();
  if (createdId) {
    const byId = list.find(a => a.id?.toLowerCase() === createdId.toLowerCase());
    if (byId) return byId;
    if (list.length === 0 || isPendingPreAuth(created)) return created;
  }

  const pending = list.filter(isPendingPreAuth);
  if (pending.length === 1) return pending[0];
  if (pending.length > 1 && createdId) {
    return pending.find(a => a.id?.toLowerCase() === createdId.toLowerCase()) ?? pending[0];
  }
  if (pending.length > 0) return pending[0];

  if (
    !created.submittedAt
    && !created.receivedAt
    && isPendingPreAuth(created)
    && (created.requestedAmount > 0 || created.estimatedTotalCost > 0)
  ) {
    return created;
  }

  return null;
}
