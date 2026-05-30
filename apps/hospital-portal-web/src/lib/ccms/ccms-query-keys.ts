/** React Query key factory for CCMS case data. */
export const ccmsKeys = {
  all: ['ccms'] as const,
  payers: () => [...ccmsKeys.all, 'master', 'payers'] as const,
  tpas: () => [...ccmsKeys.all, 'master', 'tpas'] as const,
  patient: (patientId: string) => [...ccmsKeys.all, 'patient', patientId] as const,
  caseRoot: (caseId: string) => [...ccmsKeys.all, 'case', caseId] as const,
  caseDetail: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'detail'] as const,
  workspace: (caseId: string, sections: string) =>
    [...ccmsKeys.caseRoot(caseId), 'workspace', sections] as const,
  policies: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'policies'] as const,
  preAuths: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'preAuths'] as const,
  workflowHistory: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'workflowHistory'] as const,
  workflowActions: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'workflowActions'] as const,
  events: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'events'] as const,
  billing: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'billing'] as const,
  claims: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'claims'] as const,
  settlements: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'settlements'] as const,
  communications: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'communications'] as const,
  documents: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'documents'] as const,
  eligibilityChecks: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'eligibilityChecks'] as const,
  policyCapture: (caseId: string) => [...ccmsKeys.caseRoot(caseId), 'policyCapture'] as const,
  surgeons: () => [...ccmsKeys.all, 'master', 'surgeons'] as const,
};
