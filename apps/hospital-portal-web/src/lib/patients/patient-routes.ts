export function patientProfileUrl(patientId: string): string {
  return `/dashboard/patients/${patientId}`;
}

export function patientEncounterUrl(patientId: string, visitId: string): string {
  return `/dashboard/patients/${patientId}/encounter/${visitId}`;
}

export function patientHubUrl(): string {
  return '/dashboard/patients';
}

export function patientPrintSummaryUrl(patientId: string): string {
  return `/dashboard/patients/${patientId}/summary/print`;
}

/** Patient Hub filtered by care program (specialty clinic track). */
export function patientHubProgramUrl(programCode: string): string {
  const params = new URLSearchParams();
  params.set('programCodes', programCode);
  return `/dashboard/patients?${params.toString()}`;
}
