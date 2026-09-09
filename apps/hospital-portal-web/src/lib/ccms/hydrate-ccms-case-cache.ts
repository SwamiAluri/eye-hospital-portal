import type { QueryClient } from '@tanstack/react-query';
import { ccmsKeys } from '@/lib/ccms/ccms-query-keys';
import type { CoverageCaseWorkspace } from '@/lib/api/ccms/ccms-workspace.api';
import { mapCaseDocumentsFromApi } from '@/lib/api/ccms/ccms-documents.api';
import { mapPreAuthorizationFromApi } from '@/lib/api/ccms/ccms-authorizations.api';
import { mapApprovalEventFromApi } from '@/lib/api/ccms/ccms-approvals.api';
import {
  mapWorkflowActionsFromEvents,
  mapWorkflowHistoryFromApi,
} from '@/lib/api/ccms/ccms-workflow.api';

/** Writes workspace section payloads into individual React Query caches. */
export function hydrateCaseQueryCache(
  queryClient: QueryClient,
  caseId: string,
  workspace: CoverageCaseWorkspace,
): void {
  if (workspace.case) {
    queryClient.setQueryData(ccmsKeys.caseDetail(caseId), workspace.case);
  }

  if (workspace.policies != null) {
    queryClient.setQueryData(ccmsKeys.policies(caseId), workspace.policies);
  }

  if (workspace.preAuths != null) {
    const mapped = workspace.preAuths.map(r => mapPreAuthorizationFromApi(r));
    queryClient.setQueryData(ccmsKeys.preAuths(caseId), mapped);
  }

  if (workspace.billing !== undefined) {
    queryClient.setQueryData(ccmsKeys.billing(caseId), workspace.billing ?? null);
  }

  if (workspace.claims != null) {
    queryClient.setQueryData(ccmsKeys.claims(caseId), workspace.claims);
  }

  if (workspace.settlements != null) {
    queryClient.setQueryData(ccmsKeys.settlements(caseId), workspace.settlements);
  }

  if (workspace.communications != null) {
    queryClient.setQueryData(ccmsKeys.communications(caseId), workspace.communications);
  }

  if (workspace.documents != null) {
    queryClient.setQueryData(
      ccmsKeys.documents(caseId),
      mapCaseDocumentsFromApi(workspace.documents),
    );
  }

  if (workspace.approvalEvents != null) {
    const mapped = workspace.approvalEvents.map(r => mapApprovalEventFromApi(r));
    queryClient.setQueryData(ccmsKeys.events(caseId), mapped);
  }

  if (workspace.workflowHistory != null) {
    const mapped = workspace.workflowHistory.map(r => mapWorkflowHistoryFromApi(r));
    queryClient.setQueryData(ccmsKeys.workflowHistory(caseId), mapped);
  }

  if (workspace.workflowActions != null) {
    queryClient.setQueryData(
      ccmsKeys.workflowActions(caseId),
      mapWorkflowActionsFromEvents(workspace.workflowActions),
    );
  }

  if (workspace.eligibilityChecks != null) {
    queryClient.setQueryData(ccmsKeys.eligibilityChecks(caseId), workspace.eligibilityChecks);
  }

  if (workspace.policyCapture !== undefined) {
    queryClient.setQueryData(ccmsKeys.policyCapture(caseId), workspace.policyCapture ?? null);
  }
}
