/** Authoritative LabReport API status vocabulary (D-LAB-11). */
export const LAB_REPORT_STATUSES = [
  'ordered',
  'sample_collected',
  'in_progress',
  'completed',
  'cancelled',
  'on_hold',
] as const;

export type LabReportStatus = (typeof LAB_REPORT_STATUSES)[number];

/** Concise UI labels — API values remain the filter/persist keys. */
export const LAB_REPORT_STATUS_LABELS: Record<LabReportStatus, string> = {
  ordered: 'Ordered',
  sample_collected: 'Sample collected',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  on_hold: 'On hold',
};

/** Entity-comment priority vocabulary on LabReport.Priority. */
export const LAB_REPORT_PRIORITIES = ['routine', 'urgent', 'stat'] as const;

export const LAB_REPORT_PRIORITY_LABELS: Record<(typeof LAB_REPORT_PRIORITIES)[number], string> = {
  routine: 'Routine',
  urgent: 'Urgent',
  stat: 'STAT',
};

/** Entity-comment category vocabulary on LabReport.TestCategory. */
export const LAB_REPORT_CATEGORIES = [
  'hematology',
  'biochemistry',
  'microbiology',
  'pathology',
  'ophthalmology',
] as const;

/** Entity-comment specimen vocabulary on LabReport.SpecimenType. */
export const LAB_REPORT_SPECIMEN_TYPES = ['blood', 'urine', 'tissue', 'swab'] as const;

export const LAB_STATUS_CHIP_CLASS: Record<string, string> = {
  ordered: 'bg-blue-100 text-blue-800',
  sample_collected: 'bg-amber-100 text-amber-900',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  on_hold: 'bg-slate-100 text-slate-700',
};

export const LAB_PRIORITY_CHIP_CLASS: Record<string, string> = {
  routine: 'bg-slate-100 text-slate-700',
  urgent: 'bg-orange-100 text-orange-800',
  stat: 'bg-red-100 text-red-800',
};

export function labStatusLabel(status: string): string {
  return LAB_REPORT_STATUS_LABELS[status as LabReportStatus] ?? status;
}
