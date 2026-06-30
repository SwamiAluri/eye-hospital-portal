import type { PreAuthorization } from '@/lib/api/ccms/ccms-authorizations.api';
import type { VisitPolicy, CreateVisitPolicyRequest, AccommodationClass } from '@/lib/api/ccms/visit-policies.api';
import type { CounsellorDraftSnapshot } from '@/lib/api/ccms/parse-counsellor-draft';
import type { CoveragePanelForm } from '@/lib/counsellors-desk/coverage-form-mappers';
import { isCcmsUuid } from '@/lib/ccms/ccms-ids';
import { relationshipApiValue } from '@/lib/ccms/relationship-api-map';

/** Backend requires a row in ccms_visit_insurance_policies with is_primary = true. */
export function hasDbPrimaryVisitPolicy(policies: VisitPolicy[]): boolean {
  return policies.some(p => p.isPrimary && p.policyNumber?.trim());
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

  // POST body missing id — pick newest pending from GET
  const pending = list.filter(isPendingPreAuth);
  if (pending.length === 1) return pending[0];
  if (pending.length > 1 && createdId) {
    return pending.find(a => a.id?.toLowerCase() === createdId.toLowerCase()) ?? pending[0];
  }
  if (pending.length > 0) return pending[0];

  // Fresh generate with amounts but no id yet — trust POST when nothing submitted
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
