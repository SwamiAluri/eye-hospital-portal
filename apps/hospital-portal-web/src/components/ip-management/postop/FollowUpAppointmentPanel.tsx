'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { appointmentsApi, type Appointment } from '@/lib/api/appointments-enhanced.api';
import { ipManagementApi } from '@/lib/api/ip-management.api';
import { getSurgeons, type Surgeon } from '@/lib/api/widgets.api';
import { IpOverlayDialog } from '@/components/ip-management/IpOverlayDialog';
import { WARD_DISCHARGE_TEST_IDS } from '@/lib/ip-management/ward-discharge-test-ids';
import {
  defaultFollowUpLocalInput,
  followUpBookErrorMessage,
  formatFollowUpWhen,
  isActiveClinicAppointment,
  isoToDatetimeLocal,
} from '@/lib/ip-management/follow-up-appointment';

export interface FollowUpAppointmentPanelProps {
  journeyId: string;
  patientId?: string | null;
  patientName?: string | null;
  followupDate: string;
  followupDoctorId: string;
  followupAppointmentId: string | null;
  canBook: boolean;
  canLink: boolean;
  readOnly?: boolean;
  testIds?: boolean;
  onFollowupDateChange?: (value: string) => void;
  onLinked: (next: {
    followupAppointmentId: string;
    followupDate: string;
    followupDoctorId: string;
  }) => void;
}

export function FollowUpAppointmentPanel({
  journeyId,
  patientId,
  patientName,
  followupDate,
  followupDoctorId,
  followupAppointmentId,
  canBook,
  canLink,
  readOnly,
  testIds,
  onFollowupDateChange,
  onLinked,
}: FollowUpAppointmentPanelProps) {
  const booked = Boolean(followupAppointmentId);
  const [bookOpen, setBookOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
  const [doctorId, setDoctorId] = useState(followupDoctorId);
  const [whenLocal, setWhenLocal] = useState(defaultFollowUpLocalInput);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    getSurgeons()
      .then(setSurgeons)
      .catch(() => setSurgeons([]));
  }, []);

  useEffect(() => {
    if (followupDoctorId) setDoctorId(followupDoctorId);
  }, [followupDoctorId]);

  const doctorLabel =
    surgeons.find(s => s.id === followupDoctorId)?.name
    || followupDoctorId
    || 'clinic';

  async function persistLink(appointmentId: string, isoDate: string, linkedDoctorId: string) {
    const existing = await ipManagementApi.getPostOpInstructions(journeyId);
    const saved = await ipManagementApi.savePostOpInstructions(journeyId, {
      medications: existing?.medications ?? undefined,
      activityRestrictions: existing?.activityRestrictions ?? undefined,
      dietaryInstructions: existing?.dietaryInstructions ?? undefined,
      eyeCareInstructions: existing?.eyeCareInstructions ?? undefined,
      warningSigns: existing?.warningSigns ?? undefined,
      followupAppointmentId: appointmentId,
      followupDate: isoDate,
      followupDoctorId: linkedDoctorId || undefined,
    });
    if (!saved?.followupAppointmentId) {
      throw new Error('Could not link the appointment.');
    }
    onLinked({
      followupAppointmentId: saved.followupAppointmentId,
      followupDate: isoToDatetimeLocal(saved.followupDate),
      followupDoctorId: saved.followupDoctorId ?? linkedDoctorId,
    });
  }

  async function handleBook() {
    if (!patientId || !doctorId || !whenLocal) return;
    setBooking(true);
    setBookError('');
    try {
      const iso = new Date(whenLocal).toISOString();
      const created = await appointmentsApi.createFollowUp({
        patientId,
        doctorId,
        appointmentDate: iso,
        notes: `IP discharge follow-up${patientName ? ` · ${patientName}` : ''}`,
      });
      await persistLink(created.data.id, created.data.appointmentDate || iso, created.data.doctorId || doctorId);
      setBookOpen(false);
      toast.success('Follow-up booked');
    } catch (e: unknown) {
      setBookError(followUpBookErrorMessage(e));
    } finally {
      setBooking(false);
    }
  }

  async function openLink() {
    if (!patientId) return;
    setLinkOpen(true);
    setLoadingList(true);
    try {
      const fromDate = new Date();
      fromDate.setHours(0, 0, 0, 0);
      const res = await appointmentsApi.getByPatient(patientId, 50);
      const rows = (res.data ?? []).filter(
        a => isActiveClinicAppointment(a.status) && new Date(a.appointmentDate).getTime() >= fromDate.getTime(),
      );
      setUpcoming(rows);
    } catch {
      setUpcoming([]);
      toast.error('Could not load appointments.');
    } finally {
      setLoadingList(false);
    }
  }

  async function handleLink(row: Appointment) {
    setLinkingId(row.id);
    try {
      await persistLink(row.id, row.appointmentDate, row.doctorId);
      setLinkOpen(false);
      toast.success('Follow-up linked');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not link that visit.');
    } finally {
      setLinkingId(null);
    }
  }

  const missingPatient = !patientId;

  return (
    <div className="space-y-3">
      {booked ? (
        <div
          data-testid={testIds ? WARD_DISCHARGE_TEST_IDS.followupBooked : undefined}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
        >
          <b>Follow-up booked.</b> {formatFollowUpWhen(followupDate)}
          {' · '}
          {doctorLabel}
          {' · '}
          30 minutes.
          <div className="text-[11px] text-emerald-800/80 mt-1">
            Appointment visible on the clinic board. Form date is taken from this visit.
          </div>
        </div>
      ) : (
        <div
          data-testid={testIds ? WARD_DISCHARGE_TEST_IDS.followupMissing : undefined}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
        >
          <b>No follow-up appointment is booked.</b> Entering a date here does not reserve a clinic slot.
          Book a visit or link one that already exists.
        </div>
      )}

      <label className="block text-xs">
        <span className="font-medium text-gray-700">
          {booked ? 'Date on the form (from booked visit)' : 'Date on the form (not a booking)'}
        </span>
        <input
          type="datetime-local"
          value={followupDate}
          readOnly={booked || readOnly}
          disabled={booked || readOnly}
          onChange={e => onFollowupDateChange?.(e.target.value)}
          className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-sm disabled:bg-gray-50"
        />
      </label>

      {!readOnly && !booked && (
        <div className="flex flex-wrap gap-2">
          {canBook && !missingPatient && (
            <button
              type="button"
              data-testid={testIds ? WARD_DISCHARGE_TEST_IDS.btnBookFollowUp : undefined}
              onClick={() => {
                setBookError('');
                setWhenLocal(followupDate || defaultFollowUpLocalInput());
                setDoctorId(followupDoctorId || doctorId);
                setBookOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Book follow-up
            </button>
          )}
          {canLink && !missingPatient && (
            <button
              type="button"
              data-testid={testIds ? WARD_DISCHARGE_TEST_IDS.btnLinkFollowUp : undefined}
              onClick={() => void openLink()}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Link existing appointment
            </button>
          )}
          {!canBook && (
            <p className="text-xs text-gray-600">
              You cannot book a clinic visit. Ask the coordinator to book
              {canLink ? ', or link a visit that already exists.' : '.'}
            </p>
          )}
          {missingPatient && (
            <p className="text-xs text-red-700">Patient record is missing — cannot book or link a visit.</p>
          )}
        </div>
      )}

      {bookOpen && (
        <IpOverlayDialog
          onClose={() => !booking && setBookOpen(false)}
          size="sm"
          title="Book follow-up"
        >
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-500">
              Creates a clinic appointment{patientName ? ` for ${patientName}` : ''}. Type: Follow-up · 30 minutes.
            </p>
            <label className="block text-xs">
              <span className="font-medium text-gray-700">Doctor</span>
              <select
                value={doctorId}
                onChange={e => setDoctorId(e.target.value)}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-sm"
              >
                <option value="">Select doctor</option>
                {surgeons.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="font-medium text-gray-700">Date and time</span>
              <input
                type="datetime-local"
                value={whenLocal}
                onChange={e => setWhenLocal(e.target.value)}
                className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-sm"
              />
            </label>
            <p className="text-xs text-gray-500">
              After save, this visit appears on the appointments board. The discharge form date is filled from that visit.
            </p>
            {bookError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                <b>{bookError}</b>
                {/not available/i.test(bookError) ? ' Choose another slot.' : ''}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={booking}
                onClick={() => setBookOpen(false)}
                className="px-3 py-1.5 text-xs border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={booking || !doctorId || !whenLocal}
                onClick={() => void handleBook()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              >
                {booking ? 'Booking…' : 'Book visit'}
              </button>
            </div>
          </div>
        </IpOverlayDialog>
      )}

      {linkOpen && (
        <IpOverlayDialog onClose={() => setLinkOpen(false)} size="md" title="Link existing appointment">
          <div className="p-4 space-y-3">
            {loadingList ? (
              <p className="text-sm text-gray-500">Loading upcoming visits…</p>
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming appointments for this patient.</p>
            ) : (
              <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                {upcoming.map(row => (
                  <li key={row.id}>
                    <button
                      type="button"
                      disabled={linkingId === row.id}
                      onClick={() => void handleLink(row)}
                      className="w-full text-left rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="font-medium">{formatFollowUpWhen(row.appointmentDate)}</span>
                      <span className="text-gray-500">
                        {' · '}
                        {row.doctorName || 'Doctor'}
                        {' · '}
                        {row.appointmentType}
                        {' · '}
                        {row.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={() => setLinkOpen(false)} className="px-3 py-1.5 text-xs border rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </IpOverlayDialog>
      )}
    </div>
  );
}
