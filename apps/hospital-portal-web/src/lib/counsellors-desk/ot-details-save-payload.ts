import type { FinalizeSurgeryRecord, UpdateOtDetailsPayload } from '@/types/counsellors-desk';

const nullifyEmpty = (v: string | undefined) => (v && v.trim() !== '' ? v : undefined);

const toTimeSpan = (t: string | undefined) =>
  t && /^\d{1,2}:\d{2}$/.test(t) ? `${t}:00` : t || undefined;

/**
 * Build PUT /ot-schedule/{id}/details body from controlled modal form state.
 * Empty anaesthesia/remarks strings are omitted so partial updates do not wipe DB values.
 */
export function buildOtDetailsSavePayload(
  form: UpdateOtDetailsPayload,
  scheduleDate?: string | null,
): UpdateOtDetailsPayload {
  const date = scheduleDate || undefined;
  return {
    ...form,
    doctorId: nullifyEmpty(form.doctorId),
    theatreId: nullifyEmpty(form.theatreId),
    startTime: form.startTime && date ? `${date}T${form.startTime}:00` : undefined,
    endTime: form.endTime && date ? `${date}T${form.endTime}:00` : undefined,
    reportingTime: toTimeSpan(form.reportingTime),
    anesthesiaType: nullifyEmpty(form.anesthesiaType),
    anesthetistName: nullifyEmpty(form.anesthetistName),
    iolPower: nullifyEmpty(form.iolPower),
    remarks: nullifyEmpty(form.remarks),
    cancelReason: nullifyEmpty(form.cancelReason),
  };
}

/**
 * Merge save payload anaesthesia fields onto the UpdateDetails API response.
 * Defends list-cache rehydration when the response historically omitted these fields.
 */
export function mergeOtDetailsSaveIntoRecord(
  updated: FinalizeSurgeryRecord,
  payload: UpdateOtDetailsPayload,
): FinalizeSurgeryRecord {
  return {
    ...updated,
    anesthesiaType: payload.anesthesiaType ?? updated.anesthesiaType,
    anesthetistName: payload.anesthetistName ?? updated.anesthetistName,
    remarks: payload.remarks ?? updated.remarks,
    iolPower: payload.iolPower ?? updated.iolPower,
  };
}
