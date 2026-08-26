// CCMS – Dashboard & Analytics API client
import { getCcmsApi } from './ccms-base';

export interface OperationalSummary {
  totalActiveCases: number;
  pendingPreAuths: number;
  pendingClaims: number;
  pendingSettlements: number;
  totalApprovedAmountMtd: number;
  totalSettledAmountMtd: number;
  avgPreAuthTurnaroundHours: number;
  rejectionRatePct: number;
}

export interface PendingPreAuthItem {
  caseId: string;
  caseNumber: string;
  patientId: string;
  patientName?: string;
  payerName: string;
  requestedAmount: number;
  currentState: string;
  ageInHours: number;
  urgencyLevel: string;
}

export interface CashFlowDataPoint {
  period: string;
  claimed: number;
  settled: number;
  pending: number;
}

export interface StateDistributionItem {
  state: string;
  count: number;
  percentage: number;
}

export async function getOperationalSummary(): Promise<OperationalSummary> {
  const { data } = await getCcmsApi().get('/ccms/dashboard/summary');
  return data;
}

export async function getPendingPreAuths(): Promise<PendingPreAuthItem[]> {
  const { data } = await getCcmsApi().get('/ccms/dashboard/pending-preauths');
  return Array.isArray(data) ? data : [];
}

export async function getCashFlowReport(params?: {
  fromDate?: string;
  toDate?: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
}): Promise<CashFlowDataPoint[]> {
  const { data } = await getCcmsApi().get('/ccms/dashboard/cash-flow', { params });
  return Array.isArray(data) ? data : [];
}

export async function getStateDistribution(): Promise<StateDistributionItem[]> {
  const { data } = await getCcmsApi().get('/ccms/dashboard/state-distribution');
  return Array.isArray(data) ? data : [];
}

export interface JourneyKpiSnapshot {
  coverageCases: number;
  emergencyFcCount: number;
  approvedCount: number;
  partialApprovalCount: number;
  rejectedCount: number;
  claimSubmittedCount: number;
  claimQueryOpenCount: number;
  settledCount: number;
  avgPreauthTurnaroundHours: number | null;
  avgDischargeToSettlementHours: number | null;
}

export async function getJourneyKpis(): Promise<JourneyKpiSnapshot> {
  const { data } = await getCcmsApi().get('/ccms/analytics/journey-kpis');
  return data;
}
