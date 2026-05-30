'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { ScheduleData } from '@/types/counsellors-desk';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';

interface ScheduleSurgeryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ScheduleData) => void;
  existingSchedule?: ScheduleData | null;
}

type DropdownOption = { id: string; name: string };
type PreviewRow = { date: string; ot: string; start: string; end: string; status: string };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                 'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function ScheduleSurgeryModal({ isOpen, onClose, onSubmit, existingSchedule }: ScheduleSurgeryModalProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(
    existingSchedule?.selectedDate ?? ''
  );
  const [form, setForm] = useState({
    operationTheatre: existingSchedule?.operationTheatre ?? '',
    doctor: existingSchedule?.doctor ?? '',
    surgeryStartTime: existingSchedule?.surgeryStartTime ?? '',
    avoidTimeFrom: existingSchedule?.avoidTimeFrom ?? '',
    avoidTimeTo: existingSchedule?.avoidTimeTo ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Real data for dropdowns
  const [surgeons,       setSurgeons]       = useState<DropdownOption[]>([]);
  const [theatres,       setTheatres]       = useState<DropdownOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Real schedule data for preview table
  const [previewRows,    setPreviewRows]    = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load surgeons + theatres once when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLoadingOptions(true);
    Promise.all([
      counsellorsDeskApi.getSurgeons(),
      counsellorsDeskApi.getOtTheaters(),
    ])
      .then(([s, t]) => { setSurgeons(s); setTheatres(t); })
      .catch(console.error)
      .finally(() => setLoadingOptions(false));
  }, [isOpen]);

  // Load real booked schedule for chosen date
  useEffect(() => {
    if (!selectedDate) { setPreviewRows([]); return; }
    setLoadingPreview(true);
    counsellorsDeskApi
      .getFinalizeList({ date: selectedDate })
      .then(records =>
        setPreviewRows(
          records.map(r => ({
            date:   new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    }),
            ot:     r.theaterName || '—',
            start:  r.startTime   || '—',
            end:    r.endTime     || '—',
            status: r.status,
          }))
        )
      )
      .catch(() => setPreviewRows([]))
      .finally(() => setLoadingPreview(false));
  }, [selectedDate]);

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen && existingSchedule) {
      setSelectedDate(existingSchedule.selectedDate);
      setForm({
        operationTheatre: existingSchedule.operationTheatre,
        doctor: existingSchedule.doctor,
        surgeryStartTime: existingSchedule.surgeryStartTime,
        avoidTimeFrom: existingSchedule.avoidTimeFrom,
        avoidTimeTo: existingSchedule.avoidTimeTo,
      });
    }
    if (!isOpen) {
      setErrors({});
    }
  }, [isOpen, existingSchedule]);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!selectedDate) e.date = 'Please select a date';
    if (!form.operationTheatre) e.operationTheatre = 'Operation Theatre is required';
    if (!form.doctor) e.doctor = 'Doctor is required';
    if (!form.surgeryStartTime) e.surgeryStartTime = 'Start time is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({ selectedDate, ...form });
    onClose();
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const formatDateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isPast = (day: number) => new Date(formatDateStr(day)) < new Date(new Date().toDateString());

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600">
          <h2 className="text-lg font-semibold text-white">
            {existingSchedule ? 'Update Schedule' : 'Schedule Surgery'}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Main content: 2 columns */}
          <div className="grid grid-cols-2 gap-6 p-6">
            {/* Left: Calendar */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Select Date *</p>
              {errors.date && <p className="text-xs text-red-500 mb-2">{errors.date}</p>}
              <div className="border rounded-xl overflow-hidden select-none">
                {/* Month nav */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                  <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-200 transition-colors">
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                  </button>
                  <span className="text-sm font-semibold text-gray-800">
                    {MONTHS[viewMonth]} {viewYear}
                  </span>
                  <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-200 transition-colors">
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
                {/* Day headers */}
                <div className="grid grid-cols-7 bg-gray-50">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
                  ))}
                </div>
                {/* Days */}
                <div className="grid grid-cols-7 p-2 gap-1">
                  {calendarCells.map((day, i) => {
                    if (!day) return <div key={i} />;
                    const dateStr = formatDateStr(day);
                    const isSelected = selectedDate === dateStr;
                    const past = isPast(day);
                    return (
                      <button
                        key={dateStr}
                        disabled={past}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`
                          w-full aspect-square rounded-lg text-xs font-medium transition-colors
                          ${past ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}
                          ${isSelected ? 'bg-blue-600 text-white' : past ? '' : 'hover:bg-blue-50 text-gray-700'}
                        `}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedDate && (
                <p className="mt-2 text-xs text-blue-600 font-medium">
                  Selected: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>

            {/* Right: Form fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Operation Theatre <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.operationTheatre}
                  onChange={(e) => setForm(f => ({ ...f, operationTheatre: e.target.value }))}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.operationTheatre ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select OT</option>
                  {loadingOptions
                    ? <option disabled>Loading…</option>
                    : theatres.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)
                  }
                </select>
                {errors.operationTheatre && <p className="text-xs text-red-500 mt-1">{errors.operationTheatre}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Doctor <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.doctor}
                  onChange={(e) => setForm(f => ({ ...f, doctor: e.target.value }))}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.doctor ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select Doctor</option>
                  {loadingOptions
                    ? <option disabled>Loading…</option>
                    : surgeons.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)
                  }
                </select>
                {errors.doctor && <p className="text-xs text-red-500 mt-1">{errors.doctor}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Surgery Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={form.surgeryStartTime}
                  onChange={(e) => setForm(f => ({ ...f, surgeryStartTime: e.target.value }))}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.surgeryStartTime ? 'border-red-400' : 'border-gray-300'}`}
                />
                {errors.surgeryStartTime && <p className="text-xs text-red-500 mt-1">{errors.surgeryStartTime}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Avoid Time From</label>
                  <input
                    type="time"
                    value={form.avoidTimeFrom}
                    onChange={(e) => setForm(f => ({ ...f, avoidTimeFrom: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Avoid Time To</label>
                  <input
                    type="time"
                    value={form.avoidTimeTo}
                    onChange={(e) => setForm(f => ({ ...f, avoidTimeTo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview table — real booked OT slots for the selected date */}
          <div className="px-6 pb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {selectedDate ? 'Booked OT Slots for Selected Date' : 'Existing Schedule Preview'}
            </p>
            <div className="border rounded-xl overflow-hidden">
              {loadingPreview ? (
                <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading schedule…
                </div>
              ) : previewRows.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-xs">
                  {selectedDate ? 'No surgeries booked for this date.' : 'Select a date to see booked slots.'}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-medium">
                    <tr>
                      {['Scheduled Date', 'OT', 'Start Time', 'End Time', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">{row.date}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{row.ot}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{row.start}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{row.end}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.status === 'Confirmed'    ? 'bg-blue-100 text-blue-700'    :
                            row.status === 'Finalised'   ? 'bg-indigo-100 text-indigo-700':
                            row.status === 'OTPrepared'  ? 'bg-emerald-100 text-emerald-700':
                            row.status === 'SurgeryDone' ? 'bg-green-100 text-green-700'  :
                            row.status === 'Cancelled'   ? 'bg-red-100 text-red-700'      :
                            'bg-amber-100 text-amber-700'
                          }`}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {existingSchedule ? 'Update Schedule' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
