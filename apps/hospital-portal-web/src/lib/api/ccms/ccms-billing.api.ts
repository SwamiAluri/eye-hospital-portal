// CCMS – Billing Integration API client
import { getCcmsApi } from './ccms-base';

export interface BillAllocationLine {
  lineItemId: string;
  description: string;
  totalAmount: number;
  coveredAmount: number;
  nonPayableAmount: number;
  patientPayable: number;
  reason?: string;
}

export interface BillAllocation {
  id: string;
  caseId: string;
  billId?: string;
  totalBillAmount: number;
  coveredAmount: number;
  nonPayableTotal: number;
  patientPayableTotal: number;
  lines: BillAllocationLine[];
  allocatedAt: string;
  allocatedBy?: string;
}

export interface AllocateBillRequest {
  billId?: string;
  totalBillAmount: number;
  lines: Omit<BillAllocationLine, 'lineItemId'>[];
  notes?: string;
}

export interface NonPayableItem {
  id: string;
  description: string;
  amount: number;
  reason: string;
}

export async function allocateBill(caseId: string, req: AllocateBillRequest): Promise<BillAllocation> {
  const { data } = await getCcmsApi().post(`/ccms/billing/cases/${caseId}/allocate`, req);
  return data;
}

export async function getAllocation(caseId: string): Promise<BillAllocation | null> {
  try {
    const { data } = await getCcmsApi().get(`/ccms/billing/cases/${caseId}/allocation`);
    return data;
  } catch {
    return null;
  }
}

export async function getNonPayables(caseId: string): Promise<NonPayableItem[]> {
  const { data } = await getCcmsApi().get(`/ccms/billing/cases/${caseId}/non-payables`);
  return Array.isArray(data) ? data : [];
}
