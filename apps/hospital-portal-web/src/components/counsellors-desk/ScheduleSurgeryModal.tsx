'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { startOfDay } from 'date-fns';
import { Loader2 } from 'lucide-react';
import type { ScheduleData } from '@/types/counsellors-desk';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  classifyScheduleLookupError,
  type ScheduleLookupOption,
} from '@/lib/counsellors-desk/schedule-surgery-lookups';
import {
  formatCounsellingDateDisplay,
  formatCounsellingDateLabel,
  toCounsellingDateOnly,
} from '@/lib/counsellors-desk/session-utils';
import {
  CounsellingBadge,
  CounsellingButton,
  CounsellingDialog,
  CounsellingDialogContent,
  CounsellingDialogFooter,
  CounsellingDialogHeader,
  CounsellingDialogTitle,
  CounsellingInput,
  CounsellingLabel,
  CounsellingSelect,
  CounsellingSelectContent,
  CounsellingSelectItem,
  CounsellingSelectTrigger,
  CounsellingSelectValue,
  SessionDatePicker,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

interface ScheduleSurgeryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ScheduleData) => void;
  existingSchedule?: ScheduleData | null;
}

type PreviewRow = { date: string; ot: string; start: string; end: string; status: string };

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'Confirmed':
      return 'border-counselling-primary/30 bg-counselling-accent text-counselling-primary';
    case 'Finalised':
      return 'border-teal-200 bg-teal-50 text-teal-800';
    case 'OTPrepared':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'SurgeryDone':
      return 'border-green-200 bg-green-50 text-green-700';
    case 'Cancelled':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-800';
  }
}

export function ScheduleSurgeryModal({
  isOpen,
  onClose,
  onSubmit,
  existingSchedule,
}: ScheduleSurgeryModalProps) {
  const minSurgeryDate = useMemo(() => startOfDay(new Date()), []);

  const [selectedDate, setSelectedDate] = useState(
    () => toCounsellingDateOnly(existingSchedule?.selectedDate),
  );
  const [form, setForm] = useState({
    operationTheatre: existingSchedule?.operationTheatre ?? '',
    doctor: existingSchedule?.doctor ?? '',
    surgeryStartTime: existingSchedule?.surgeryStartTime ?? '',
    avoidTimeFrom: existingSchedule?.avoidTimeFrom ?? '',
    avoidTimeTo: existingSchedule?.avoidTimeTo ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [surgeons, setSurgeons] = useState<ScheduleLookupOption[]>([]);
  const [theatres, setTheatres] = useState<ScheduleLookupOption[]>([]);
  const [surgeonError, setSurgeonError] = useState<string | null>(null);
  const [theaterError, setTheaterError] = useState<string | null>(null);
  const [loadingTheaters, setLoadingTheaters] = useState(false);
  const [loadingSurgeons, setLoadingSurgeons] = useState(false);
  const [theaterRetryKey, setTheaterRetryKey] = useState(0);
  const [surgeonRetryKey, setSurgeonRetryKey] = useState(0);

  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Theatres — independent of date and of surgeons. Must NOT mark session dirty.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingTheaters(true);
    setTheaterError(null);
    void counsellorsDeskApi
      .getOtTheaters()
      .then((rows) => {
        if (cancelled) return;
        setTheatres(
          rows.filter((t) => Boolean(t.id?.trim() && t.name?.trim())),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTheatres([]);
        setTheaterError(classifyScheduleLookupError(err, 'theatres'));
      })
      .finally(() => {
        if (!cancelled) setLoadingTheaters(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, theaterRetryKey]);

  // Surgeons — independent of theaters. Must NOT mark session dirty.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingSurgeons(true);
    setSurgeonError(null);
    void counsellorsDeskApi
      .getSurgeons()
      .then((rows) => {
        if (cancelled) return;
        setSurgeons(
          rows.filter((s) => Boolean(s.id?.trim() && s.name?.trim())),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSurgeons([]);
        setSurgeonError(classifyScheduleLookupError(err, 'doctors'));
      })
      .finally(() => {
        if (!cancelled) setLoadingSurgeons(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, surgeonRetryKey]);

  const loadingOptions = loadingTheaters || loadingSurgeons;

  useEffect(() => {
    if (!selectedDate) {
      setPreviewRows([]);
      return;
    }
    const dateOnly = toCounsellingDateOnly(selectedDate);
    if (!dateOnly) {
      setPreviewRows([]);
      return;
    }
    setLoadingPreview(true);
    counsellorsDeskApi
      .getFinalizeList({ date: dateOnly })
      .then((records) =>
        setPreviewRows(
          records.map((r) => ({
            date: formatCounsellingDateDisplay(dateOnly) ?? dateOnly,
            ot: r.theaterName || '—',
            start: r.startTime || '—',
            end: r.endTime || '—',
            status: r.status,
          })),
        ),
      )
      .catch(() => setPreviewRows([]))
      .finally(() => setLoadingPreview(false));
  }, [selectedDate]);

  useEffect(() => {
    if (!isOpen) {
      setErrors({});
      return;
    }
    if (existingSchedule) {
      setSelectedDate(toCounsellingDateOnly(existingSchedule.selectedDate));
      setForm({
        operationTheatre: existingSchedule.operationTheatre,
        doctor: existingSchedule.doctor,
        surgeryStartTime: existingSchedule.surgeryStartTime,
        avoidTimeFrom: existingSchedule.avoidTimeFrom,
        avoidTimeTo: existingSchedule.avoidTimeTo,
      });
    }
  }, [isOpen, existingSchedule]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!toCounsellingDateOnly(selectedDate)) next.date = 'Please select a date';
    if (!form.operationTheatre) next.operationTheatre = 'Operation Theatre is required';
    if (!form.doctor) next.doctor = 'Doctor is required';
    if (!form.surgeryStartTime) next.surgeryStartTime = 'Start time is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({ selectedDate: toCounsellingDateOnly(selectedDate), ...form });
    onClose();
  };

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  const selectedDateLabel = formatCounsellingDateLabel(selectedDate);

  return (
    <CounsellingDialog open={isOpen} onOpenChange={handleOpenChange}>
      <CounsellingDialogContent
        data-testid={counsellingTestIds.scheduleSurgeryModal}
        className="counselling-session flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0"
      >
        <CounsellingDialogHeader className="border-b border-counselling-border bg-counselling-accent/40 px-5 py-4 text-left">
          <CounsellingDialogTitle className="text-base font-semibold text-counselling-foreground">
            {existingSchedule ? counsellingCopy.updateSchedule : counsellingCopy.scheduleSurgery}
          </CounsellingDialogTitle>
        </CounsellingDialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {theaterError ? (
            <div
              data-testid={counsellingTestIds.scheduleSurgeryLookupError}
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              <span>{theaterError}</span>
              <CounsellingButton
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={loadingTheaters}
                onClick={() => setTheaterRetryKey((k) => k + 1)}
                data-testid={counsellingTestIds.scheduleSurgeryLookupRetry}
              >
                Retry theatres
              </CounsellingButton>
            </div>
          ) : null}
          {surgeonError ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span>{surgeonError}</span>
              <CounsellingButton
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={loadingSurgeons}
                onClick={() => setSurgeonRetryKey((k) => k + 1)}
              >
                Retry doctors
              </CounsellingButton>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <CounsellingLabel className="text-xs font-medium">
                {counsellingCopy.selectDate} <span className="text-red-500">*</span>
              </CounsellingLabel>
              {errors.date ? <p className="text-xs text-red-600">{errors.date}</p> : null}
              <SessionDatePicker
                variant="scheduling"
                value={selectedDate}
                minDate={minSurgeryDate}
                placeholder={counsellingCopy.pickSurgeryDate}
                data-testid={counsellingTestIds.scheduleSurgeryDate}
                onChange={setSelectedDate}
              />
              {selectedDateLabel ? (
                <p className="text-xs font-medium text-counselling-primary">{selectedDateLabel}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <CounsellingLabel className="text-xs font-medium">
                  {counsellingCopy.operationTheatre} <span className="text-red-500">*</span>
                </CounsellingLabel>
                <CounsellingSelect
                  value={form.operationTheatre || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, operationTheatre: v }))}
                  disabled={loadingTheaters || !!theaterError || theatres.length === 0}
                >
                  <CounsellingSelectTrigger
                    className={cn(
                      counsellingSessionTokens.catalogInput,
                      'w-full',
                      errors.operationTheatre && 'border-red-400',
                    )}
                    data-testid={counsellingTestIds.scheduleSurgeryOt}
                  >
                    <CounsellingSelectValue
                      placeholder={
                        loadingTheaters
                          ? 'Loading operation theatres…'
                          : theaterError
                            ? 'Theatres unavailable'
                            : theatres.length === 0
                              ? 'No operation theatres available for this branch.'
                              : 'Select OT'
                      }
                    />
                  </CounsellingSelectTrigger>
                  <CounsellingSelectContent>
                    {theatres.map((t) => (
                      <CounsellingSelectItem key={t.id} value={t.name}>
                        {t.name}
                      </CounsellingSelectItem>
                    ))}
                  </CounsellingSelectContent>
                </CounsellingSelect>
                {errors.operationTheatre ? (
                  <p className="text-xs text-red-600">{errors.operationTheatre}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <CounsellingLabel className="text-xs font-medium">
                  {counsellingCopy.doctor} <span className="text-red-500">*</span>
                </CounsellingLabel>
                <CounsellingSelect
                  value={form.doctor || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, doctor: v }))}
                  disabled={loadingSurgeons || !!surgeonError || surgeons.length === 0}
                >
                  <CounsellingSelectTrigger
                    className={cn(
                      counsellingSessionTokens.catalogInput,
                      'w-full',
                      errors.doctor && 'border-red-400',
                    )}
                    data-testid={counsellingTestIds.scheduleSurgeryDoctor}
                  >
                    <CounsellingSelectValue
                      placeholder={
                        loadingSurgeons
                          ? 'Loading doctors…'
                          : surgeonError
                            ? 'Doctors unavailable'
                            : surgeons.length === 0
                              ? 'No doctors available'
                              : 'Select Doctor'
                      }
                    />
                  </CounsellingSelectTrigger>
                  <CounsellingSelectContent>
                    {surgeons.map((s) => (
                      <CounsellingSelectItem key={s.id} value={s.name}>
                        {s.name}
                      </CounsellingSelectItem>
                    ))}
                  </CounsellingSelectContent>
                </CounsellingSelect>
                {errors.doctor ? <p className="text-xs text-red-600">{errors.doctor}</p> : null}
              </div>

              <div className="space-y-1.5">
                <CounsellingLabel className="text-xs font-medium">
                  {counsellingCopy.surgeryStartTime} <span className="text-red-500">*</span>
                </CounsellingLabel>
                <CounsellingInput
                  type="time"
                  value={form.surgeryStartTime}
                  onChange={(e) => setForm((f) => ({ ...f, surgeryStartTime: e.target.value }))}
                  className={cn(
                    counsellingSessionTokens.catalogInput,
                    errors.surgeryStartTime && 'border-red-400',
                  )}
                />
                {errors.surgeryStartTime ? (
                  <p className="text-xs text-red-600">{errors.surgeryStartTime}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <CounsellingLabel className="text-xs font-medium">{counsellingCopy.avoidTimeFrom}</CounsellingLabel>
                  <CounsellingInput
                    type="time"
                    value={form.avoidTimeFrom}
                    onChange={(e) => setForm((f) => ({ ...f, avoidTimeFrom: e.target.value }))}
                    className={counsellingSessionTokens.catalogInput}
                  />
                </div>
                <div className="space-y-1.5">
                  <CounsellingLabel className="text-xs font-medium">{counsellingCopy.avoidTimeTo}</CounsellingLabel>
                  <CounsellingInput
                    type="time"
                    value={form.avoidTimeTo}
                    onChange={(e) => setForm((f) => ({ ...f, avoidTimeTo: e.target.value }))}
                    className={counsellingSessionTokens.catalogInput}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
              {selectedDate ? counsellingCopy.bookedOtSlots : counsellingCopy.existingSchedulePreview}
            </p>
            <div className="overflow-hidden rounded-xl border border-counselling-border">
              {loadingPreview ? (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-counselling-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading schedule…
                </div>
              ) : previewRows.length === 0 ? (
                <div className="py-6 text-center text-xs text-counselling-muted-foreground">
                  {selectedDate
                    ? 'No surgeries booked for this date.'
                    : 'Select a date to see booked slots.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-counselling-muted text-counselling-muted-foreground">
                      <tr>
                        {['Scheduled Date', 'OT', 'Start Time', 'End Time', 'Status'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-counselling-border/70">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-counselling-muted/50">
                          <td className="whitespace-nowrap px-3 py-2">{row.date}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.ot}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.start}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.end}</td>
                          <td className="px-3 py-2">
                            <CounsellingBadge
                              variant="outline"
                              className={cn('text-[10px] font-medium', statusBadgeClass(row.status))}
                            >
                              {row.status}
                            </CounsellingBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <CounsellingDialogFooter className="border-t border-counselling-border bg-counselling-muted/40 px-5 py-3">
          <CounsellingButton type="button" variant="outline" onClick={onClose}>
            Cancel
          </CounsellingButton>
          <CounsellingButton type="button" onClick={handleSubmit} className="bg-counselling-primary hover:bg-counselling-primary/90">
            {existingSchedule ? counsellingCopy.updateSchedule : counsellingCopy.submitSchedule}
          </CounsellingButton>
        </CounsellingDialogFooter>
      </CounsellingDialogContent>
    </CounsellingDialog>
  );
}
