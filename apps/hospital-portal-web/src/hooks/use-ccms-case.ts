'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ccmsKeys } from '@/lib/ccms/ccms-query-keys';
import { buildWorkspaceSections, type CaseDataLoadFlags } from '@/lib/ccms/ccms-tab-loading';
import { hydrateCaseQueryCache } from '@/lib/ccms/hydrate-ccms-case-cache';
import {
  getCoverageCaseWorkspace,
  type CoverageCaseWorkspace,
} from '@/lib/api/ccms/ccms-workspace.api';
import { getCoverageCaseById, type CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';
import {
  getAvailableActions,
  getWorkflowHistory,
  type WorkflowAction,
  type WorkflowHistoryEntry,
} from '@/lib/api/ccms/ccms-workflow.api';
import { getPreAuthByCaseId, type PreAuthorization } from '@/lib/api/ccms/ccms-authorizations.api';
import { getEventStream, type ApprovalEvent } from '@/lib/api/ccms/ccms-approvals.api';
import { getBillingFull, type BillingWithAllocations } from '@/lib/api/ccms/ccms-billing.api';
import { getClaimByCaseId, type ClaimPacket } from '@/lib/api/ccms/ccms-claims.api';
import { getSettlementsByCaseId, type Settlement } from '@/lib/api/ccms/ccms-settlements.api';
import { getPoliciesByCase, type VisitPolicy } from '@/lib/api/ccms/visit-policies.api';
import {
  listCommunications,
  type CcmsCommunicationLog,
} from '@/lib/api/ccms/ccms-communications.api';
import { listCaseDocuments, type CaseDocument } from '@/lib/api/ccms/ccms-documents.api';
import {
  getEligibilityChecks,
  getLatestPolicyCapture,
  type EligibilityCheck,
  type PolicyCapture,
} from '@/lib/api/ccms/ccms-eligibility.api';
import {
  listInsurancePayers,
  listTpaOrganizations,
  type InsurancePayer,
  type TpaOrganization,
} from '@/lib/api/ccms/ccms-master-data.api';
import { patientApi, type Patient } from '@/lib/api/patients.api';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';

export { ccmsKeys } from '@/lib/ccms/ccms-query-keys';

// ── Query keys ────────────────────────────────────────────────────────────────

const CCMS_STALE = 2 * 60 * 1000;
const MASTER_STALE = 30 * 60 * 1000;

async function fetchPatient(patientId: string): Promise<Patient | null> {
  try {
    const res = await patientApi.getById(patientId);
    return (res as { data?: Patient })?.data ?? (res as Patient);
  } catch {
    return null;
  }
}

// ── Master data ───────────────────────────────────────────────────────────────

export function useCcmsMasterData(enabled = true) {
  const payersQuery = useQuery({
    queryKey: ccmsKeys.payers(),
    queryFn: () => listInsurancePayers().catch(() => [] as InsurancePayer[]),
    staleTime: MASTER_STALE,
    enabled,
  });
  const tpasQuery = useQuery({
    queryKey: ccmsKeys.tpas(),
    queryFn: () => listTpaOrganizations().catch(() => [] as TpaOrganization[]),
    staleTime: MASTER_STALE,
    enabled,
  });
  return {
    payers: payersQuery.data ?? [],
    tpas: tpasQuery.data ?? [],
    isLoading: payersQuery.isLoading || tpasQuery.isLoading,
  };
}

export function useCcmsSurgeons(enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.surgeons(),
    queryFn: () => counsellorsDeskApi.getSurgeons().catch(() => [] as { id: string; name: string }[]),
    staleTime: MASTER_STALE,
    enabled,
  });
}

// ── Patient ───────────────────────────────────────────────────────────────────

export function useCcmsPatient(patientId?: string | null) {
  const query = useQuery({
    queryKey: ccmsKeys.patient(patientId ?? ''),
    queryFn: () => fetchPatient(patientId!),
    enabled: !!patientId,
    staleTime: CCMS_STALE,
  });
  const patient = query.data ?? null;
  const mrn = patient?.medicalRecordNumber ?? patient?.patientCode ?? null;
  return { patient, mrn, loading: query.isLoading };
}

// ── Case sections ─────────────────────────────────────────────────────────────

export function useCcmsCaseDetail(caseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.caseDetail(caseId ?? ''),
    queryFn: () => getCoverageCaseById(caseId!),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCasePolicies(caseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.policies(caseId ?? ''),
    queryFn: () => getPoliciesByCase(caseId!),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCasePreAuths(caseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.preAuths(caseId ?? ''),
    queryFn: () => getPreAuthByCaseId(caseId!),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCaseWorkflowHistory(
  caseId?: string | null,
  workflowInstanceId?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ccmsKeys.workflowHistory(caseId ?? ''),
    queryFn: () => getWorkflowHistory('coverage-case', caseId!, workflowInstanceId ?? undefined),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCaseWorkflowActions(
  caseId?: string | null,
  workflowInstanceId?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ccmsKeys.workflowActions(caseId ?? ''),
    queryFn: () => getAvailableActions('coverage-case', caseId!, workflowInstanceId ?? undefined),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCaseEvents(caseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.events(caseId ?? ''),
    queryFn: () => getEventStream(caseId!),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCaseBilling(caseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.billing(caseId ?? ''),
    queryFn: () => getBillingFull(caseId!),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCaseClaims(caseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.claims(caseId ?? ''),
    queryFn: () => getClaimByCaseId(caseId!),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCaseSettlements(caseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.settlements(caseId ?? ''),
    queryFn: () => getSettlementsByCaseId(caseId!),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCaseCommunications(caseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.communications(caseId ?? ''),
    queryFn: () => listCommunications(caseId!),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCaseDocuments(caseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.documents(caseId ?? ''),
    queryFn: () => listCaseDocuments(caseId!),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCaseEligibilityChecks(caseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.eligibilityChecks(caseId ?? ''),
    queryFn: () => getEligibilityChecks(caseId!).catch(() => [] as EligibilityCheck[]),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

export function useCcmsCasePolicyCapture(caseId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ccmsKeys.policyCapture(caseId ?? ''),
    queryFn: () => getLatestPolicyCapture(caseId!).catch(() => null),
    enabled: !!caseId && enabled,
    staleTime: CCMS_STALE,
  });
}

/** Single BFF request that hydrates per-slice React Query caches for the case page. */
export function useHydrateCaseWorkspace(
  caseId?: string | null,
  loadFlags?: CaseDataLoadFlags,
) {
  const queryClient = useQueryClient();
  const sections = useMemo(
    () => (loadFlags ? buildWorkspaceSections(loadFlags) : 'policies,preauths'),
    [loadFlags],
  );

  return useQuery({
    queryKey: ccmsKeys.workspace(caseId ?? '', sections),
    queryFn: async (): Promise<CoverageCaseWorkspace> => {
      const workspace = await getCoverageCaseWorkspace(caseId!, sections);
      hydrateCaseQueryCache(queryClient, caseId!, workspace);
      return workspace;
    },
    enabled: !!caseId && !!loadFlags,
    staleTime: CCMS_STALE,
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

// ── Targeted invalidation ─────────────────────────────────────────────────────

export type CcmsInvalidateScope =
  | 'case'
  | 'policies'
  | 'preAuths'
  | 'billing'
  | 'claims'
  | 'settlements'
  | 'communications'
  | 'documents'
  | 'eligibility'
  | 'workflow'
  | 'events';

export interface CcmsInvalidateOptions {
  workflowInstanceId?: string | null;
}

const SCOPE_KEYS: Record<CcmsInvalidateScope, (caseId: string) => readonly unknown[]> = {
  case: ccmsKeys.caseDetail,
  policies: ccmsKeys.policies,
  preAuths: ccmsKeys.preAuths,
  billing: ccmsKeys.billing,
  claims: ccmsKeys.claims,
  settlements: ccmsKeys.settlements,
  communications: ccmsKeys.communications,
  documents: ccmsKeys.documents,
  eligibility: ccmsKeys.eligibilityChecks,
  workflow: ccmsKeys.workflowHistory,
  events: ccmsKeys.events,
};

export function useCcmsInvalidate() {
  const queryClient = useQueryClient();

  async function invalidateCase(
    caseId: string,
    scopes: CcmsInvalidateScope[],
    options?: CcmsInvalidateOptions,
  ) {
    const unique = [...new Set(scopes)];
    const workflowInstanceId = options?.workflowInstanceId ?? undefined;

    const fetchers: Partial<Record<CcmsInvalidateScope, () => Promise<unknown>>> = {
      case: () => getCoverageCaseById(caseId),
      policies: () => getPoliciesByCase(caseId),
      preAuths: () => getPreAuthByCaseId(caseId),
      billing: () => getBillingFull(caseId),
      claims: () => getClaimByCaseId(caseId),
      settlements: () => getSettlementsByCaseId(caseId),
      communications: () => listCommunications(caseId),
      documents: () => listCaseDocuments(caseId),
      eligibility: () => getEligibilityChecks(caseId).catch(() => [] as EligibilityCheck[]),
      events: () => getEventStream(caseId),
    };

    await Promise.all(
      unique.map(async scope => {
        if (scope === 'workflow') return;
        const key = SCOPE_KEYS[scope](caseId);
        const fetcher = fetchers[scope];
        if (fetcher) {
          await queryClient.fetchQuery({ queryKey: key, queryFn: fetcher });
        } else {
          await queryClient.invalidateQueries({ queryKey: key });
        }
      }),
    );

    if (unique.includes('workflow') && workflowInstanceId) {
      await queryClient.fetchQuery({
        queryKey: ccmsKeys.workflowHistory(caseId),
        queryFn: () => getWorkflowHistory('coverage-case', caseId, workflowInstanceId),
      });
      await queryClient.fetchQuery({
        queryKey: ccmsKeys.workflowActions(caseId),
        queryFn: () => getAvailableActions('coverage-case', caseId, workflowInstanceId),
      });
    } else if (unique.includes('workflow')) {
      await queryClient.invalidateQueries({ queryKey: ccmsKeys.workflowHistory(caseId) });
      await queryClient.invalidateQueries({ queryKey: ccmsKeys.workflowActions(caseId) });
    }

    if (unique.includes('eligibility')) {
      await queryClient.fetchQuery({
        queryKey: ccmsKeys.policyCapture(caseId),
        queryFn: () => getLatestPolicyCapture(caseId).catch(() => null),
      });
    }

    await queryClient.refetchQueries({
      queryKey: [...ccmsKeys.caseRoot(caseId), 'workspace'],
      type: 'active',
    });
  }

  async function invalidateAllCaseData(caseId: string) {
    await queryClient.invalidateQueries({ queryKey: ccmsKeys.caseRoot(caseId) });
    await queryClient.refetchQueries({
      queryKey: ccmsKeys.caseRoot(caseId),
      type: 'active',
    });
  }

  return { invalidateCase, invalidateAllCaseData };
}

// Re-export types used by consumers
export type {
  CoverageCase,
  PreAuthorization,
  WorkflowHistoryEntry,
  WorkflowAction,
  ApprovalEvent,
  BillingWithAllocations,
  ClaimPacket,
  Settlement,
  VisitPolicy,
  CcmsCommunicationLog,
  CaseDocument,
  EligibilityCheck,
  PolicyCapture,
  InsurancePayer,
  TpaOrganization,
};
