// CCMS – Coverage & Claims Management System – Axios instance
import axios, { AxiosInstance } from 'axios';
import { attachAuthRequestInterceptor, attachAuthResponseInterceptor } from '../../auth-interceptors';

const CCMS_BASE_URL =
  process.env.NEXT_PUBLIC_CCMS_API_URL ?? 'http://localhost:7075/api';

let ccmsAxios: AxiosInstance;

export const initCcmsApi = (): AxiosInstance => {
  ccmsAxios = axios.create({
    baseURL: CCMS_BASE_URL,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
  });

  // FormData uploads must NOT inherit application/json — that routes CCMS document
  // uploads to the JSON metadata handler and creates empty blob rows.
  ccmsAxios.interceptors.request.use((config) => {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      const headers = config.headers;
      if (headers && typeof (headers as { delete?: (k: string) => void }).delete === 'function') {
        (headers as { delete: (k: string) => void }).delete('Content-Type');
      } else if (headers) {
        delete (headers as Record<string, unknown>)['Content-Type'];
      }
    }
    return config;
  });

  attachAuthRequestInterceptor(ccmsAxios);
  attachAuthResponseInterceptor(ccmsAxios);

  return ccmsAxios;
};

export const getCcmsApi = (): AxiosInstance => ccmsAxios ?? initCcmsApi();
