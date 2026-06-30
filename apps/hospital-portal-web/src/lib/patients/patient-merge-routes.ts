export function patientMergeUrl(options?: {
  primaryId?: string;
  duplicateId?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.primaryId) params.set('primaryId', options.primaryId);
  if (options?.duplicateId) params.set('duplicateId', options.duplicateId);
  const qs = params.toString();
  return `/dashboard/patients/merge${qs ? `?${qs}` : ''}`;
}
