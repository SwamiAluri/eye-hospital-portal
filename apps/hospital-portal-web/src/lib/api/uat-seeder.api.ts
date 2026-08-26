import axios from 'axios';
import { attachAuthRequestInterceptor, attachAuthResponseInterceptor } from '../auth-interceptors';
import { formatApiError } from './ip-management.api';

const IP_MANAGEMENT_API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_IP_MANAGEMENT_API_URL) ||
  'http://localhost:5074/api';

const client = axios.create({ baseURL: IP_MANAGEMENT_API_URL });
attachAuthRequestInterceptor(client);
attachAuthResponseInterceptor(client);

export interface UatRowStatus {
  code: string;
  scenario: string;
  journeyId?: string;
  clinicalState?: string;
  error?: string;
}

export interface UatDashboardDto {
  enabled: boolean;
  total: number;
  clinical: Record<string, number>;
  billing: Record<string, number>;
  coverage: Record<string, number>;
  occupiedBeds: number;
  availableBeds: number;
  rows: UatRowStatus[];
  failureFlags: Record<string, boolean>;
}

export interface UatSeedResult {
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
  rows: UatRowStatus[];
}

function qs(branchId: string) {
  return { params: { branchId } };
}

export const uatSeederApi = {
  async status(branchId: string): Promise<UatDashboardDto> {
    const { data } = await client.get<UatDashboardDto>('/dev/uat/status', qs(branchId));
    return data;
  },
  async seed(branchId: string): Promise<UatSeedResult> {
    const { data } = await client.post<UatSeedResult>(`/dev/uat/seed?branchId=${branchId}`, {});
    return data;
  },
  async reset(branchId: string): Promise<UatSeedResult> {
    const { data } = await client.post<UatSeedResult>(`/dev/uat/reset?branchId=${branchId}`, {});
    return data;
  },
  async reseed(branchId: string): Promise<UatSeedResult> {
    const { data } = await client.post<UatSeedResult>(`/dev/uat/reseed?branchId=${branchId}`, {});
    return data;
  },
  async simulate(branchId: string, action: string, body: { journeyId: string; amount?: number; paymentMode?: string; reason?: string; assignedBedId?: string }) {
    const { data } = await client.post(`/dev/uat/simulate/${action}?branchId=${branchId}`, body);
    return data;
  },
  async setFailures(flags: Record<string, boolean>) {
    const { data } = await client.post('/dev/uat/failures', flags);
    return data;
  },
  formatError(e: unknown) {
    return formatApiError(e, 'UAT seeder request failed');
  },
};
