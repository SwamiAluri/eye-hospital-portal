import type { AxiosError } from 'axios';

export type MasterApiErrorState = {
  status?: number;
  message: string;
  permissionDenied: boolean;
};

/** Map master-values API failures to user-visible empty states. */
export function parseMasterApiError(err: unknown): MasterApiErrorState {
  const axiosErr = err as AxiosError<{ message?: string }>;
  const status = axiosErr.response?.status;
  const serverMessage = axiosErr.response?.data?.message;

  if (status === 403) {
    return {
      status: 403,
      permissionDenied: true,
      message:
        'You need the master_data.view permission to manage Master Data. Ask an administrator to assign it to your role.',
    };
  }

  if (status === 401) {
    return {
      status: 401,
      permissionDenied: false,
      message: 'Your session expired. Sign in again to access Master Data.',
    };
  }

  if (status === 400 && serverMessage) {
    return { status: 400, permissionDenied: false, message: serverMessage };
  }

  return {
    status,
    permissionDenied: false,
    message:
      serverMessage ??
      'Could not load Master Data. Check that migrations 51–65 are applied and the API is reachable.',
  };
}
