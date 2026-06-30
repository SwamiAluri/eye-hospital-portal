'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { Loader2 } from 'lucide-react';
import type { ScheduleData } from '@/types/counsellors-desk';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
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

type DropdownOption = { id: string; name: string };
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

  const [selectedDate, setSelectedDate] = useState(existingSchedule?.selectedDate ?? '');
  const [form, setForm] = useState({
    operationTheatre: existingSchedule?.operationTheatre ?? '',
    doctor: existingSchedule?.doctor ?? '',
    surgeryStartTime: existingSchedule?.surgeryStartTime ?? '',
    avoidTimeFrom: existingSchedule?.avoidTimeFrom ?? '',
    avoidTimeTo: existingSchedule?.avoidTimeTo ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [surgeons, setSurgeons] = useState<DropdownOption[]>([]);
  const [theatres, setTheatres] = useState<DropdownOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingOptions(true);
    Promise.all([counsellorsDeskApi.getSurgeons(), counsellorsDeskApi.getOtTheaters()])
      .then(([s, t]) => {
        setSurgeons(s);
        setTheatres(t);
      })
      .catch(console.error)
      .finally(() => setLoadingOptions(false));
  }, [isOpen]);

  useEffect(() => {
    if (!selectedDate) {
      setPreviewRows([]);
      return;
    }
    setLoadingPreview(true);
    counsellorsDeskApi
      .getFinalizeList({ date: selectedDate })
      .then((records) =>
        setPreviewRows(
          records.map((r) => ({
            date: new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }),
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
      setSelectedDate(existingSchedule.selectedDate);
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
    if (!selectedDate) next.date = 'Please select a date';
    if (!form.operationTheatre) next.operationTheatre = 'Operation Theatre is required';
    if (!form.doctor) next.doctor = 'Doctor is required';
    if (!form.surgeryStartTime) next.surgeryStartTime = 'Start time is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({ selectedDate, ...form });
    onClose();
  };

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  const selectedDateLabel = selectedDate
    ? format(new Date(`${selectedDate}T00:00:00`), 'EEEE, d MMMM yyyy')
    : null;

  return (
    <CounsellingDialog open={isOpen} onOpenChange={handleOpenChange}>
      <CounsellingDialogContent className="counselling-session flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <CounsellingDialogHeader className="border-b border-counselling-border bg-counselling-accent/40 px-5 py-4 text-left">
          <CounsellingDialogTitle className="text-base font-semibold text-counselling-foreground">
            {existingSchedule ? counsellingCopy.updateSchedule : counsellingCopy.scheduleSurgery}
          </CounsellingDialogTitle>
        </CounsellingDialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
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
                  disabled={loadingOptions}
                >
                  <CounsellingSelectTrigger
                    className={cn(
                      counsellingSessionTokens.catalogInput,
                      'w-full',
                      errors.operationTheatre && 'border-red-400',
                    )}
                  >
                    <CounsellingSelectValue placeholder="Select OT" />
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
                  disabled={loadingOptions}
                >
                  <CounsellingSelectTrigger
                    className={cn(
                      counsellingSessionTokens.catalogInput,
                      'w-full',
                      errors.doctor && 'border-red-400',
                    )}
                  >
                    <CounsellingSelectValue placeholder="Select Doctor" />
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
