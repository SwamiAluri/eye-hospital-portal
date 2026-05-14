// CCMS – Coverage & Claims Management System – Axios instance
import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '../../auth-store';

const CCMS_BASE_URL =
  process.env.NEXT_PUBLIC_CCMS_API_URL ?? 'http://localhost:7075/api';

let ccmsAxios: AxiosInstance;

export const initCcmsApi = (): AxiosInstance => {
  ccmsAxios = axios.create({
    baseURL: CCMS_BASE_URL,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
  });

  ccmsAxios.interceptors.request.use((config) => {
    const { tenantId, token } = useAuthStore.getState();
    if (tenantId) (config.headers as Record<string, string>)['X-Tenant-ID'] = tenantId;
    if (token)    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    return config;
  });

  ccmsAxios.interceptors.response.use(
    (r) => r,
    (err) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[CCMS]', err.config?.url, err.response?.status, err.response?.data);
      }
      return Promise.reject(err);
    },
  );

  return ccmsAxios;
};

export const getCcmsApi = (): AxiosInstance => ccmsAxios ?? initCcmsApi();
