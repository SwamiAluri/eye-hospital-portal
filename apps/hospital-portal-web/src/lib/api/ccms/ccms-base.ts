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

  attachAuthRequestInterceptor(ccmsAxios);
  attachAuthResponseInterceptor(ccmsAxios);

  return ccmsAxios;
};

export const getCcmsApi = (): AxiosInstance => ccmsAxios ?? initCcmsApi();
