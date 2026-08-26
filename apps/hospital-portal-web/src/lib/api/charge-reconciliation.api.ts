import { getApi } from '../api';

export interface ReconciliationBucket {
  number: number;
  code: string;
  title: string;
  count: number;
  value: number;
}

export interface ReconciliationRow {
  journeyId?: string | null;
  billId?: string | null;
  billNumber?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  itemId?: string | null;
  itemName: string;
  serialNumber?: string | null;
  sourceType?: string | null;
  sourceRefId?: string | null;
  amount: number;
  reason: string;
  occurredAt: string;
}

export interface ChargeReconciliationReport {
  fromUtc: string;
  toUtc: string;
  generatedAt: string;
  buckets: ReconciliationBucket[];
  implantedNotCharged: ReconciliationRow[];
  chargedNotImplanted: ReconciliationRow[];
  stockOutNoUsage: ReconciliationRow[];
  packageConsumableOverlap: ReconciliationRow[];
  unmappedItems: ReconciliationRow[];
}

export interface ChargeCompleteness {
  patientJourneyId?: string | null;
  billId?: string | null;
  implantsRecorded: number;
  implantsCharged: number;
  implantsMissingCharge: number;
  consumablesPending: number;
  exceptionsOpen?: number;
  warnings: string[];
}

export interface WastageGroup {
  key: string;
  count: number;
  cost: number;
}

export interface WastageLine {
  occurredAt: string;
  journeyId?: string | null;
  patientId?: string | null;
  surgeonUserId?: string | null;
  surgeonName?: string | null;
  itemId?: string | null;
  itemName: string;
  serialNumber?: string | null;
  usageStatus: string;
  reason: string;
  cost: number;
  hasLedgerMatch: boolean;
}

export interface WastageReport {
  fromUtc: string;
  toUtc: string;
  usageTotalCost: number;
  ledgerTotalCost: number;
  delta: number;
  lines: WastageLine[];
  byReason: WastageGroup[];
  bySurgeon: WastageGroup[];
  byItem: WastageGroup[];
  byMonth: WastageGroup[];
}

export const chargeReconciliationApi = {
  getReport: async (fromUtc?: string, toUtc?: string): Promise<ChargeReconciliationReport> => {
    const response = await getApi().get('/chargereconciliation', { params: { fromUtc, toUtc } });
    return response.data;
  },
  run: async (fromUtc?: string, toUtc?: string): Promise<ChargeReconciliationReport> => {
    const response = await getApi().post('/chargereconciliation/run', null, { params: { fromUtc, toUtc } });
    return response.data;
  },
  getWastage: async (fromUtc?: string, toUtc?: string): Promise<WastageReport> => {
    const response = await getApi().get('/chargereconciliation/wastage', { params: { fromUtc, toUtc } });
    return response.data;
  },
  getCompleteness: async (billId?: string, patientJourneyId?: string): Promise<ChargeCompleteness> => {
    const response = await getApi().get('/chargereconciliation/completeness', {
      params: { billId, patientJourneyId },
    });
    return response.data;
  },
};

export default chargeReconciliationApi;
