'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Plus } from 'lucide-react';
import { appointmentsApi } from '@/lib/api/appointments.api';
import { useHasPermission } from '@/hooks/use-permissions';

interface AppointmentRow {
  id: string;
  appointmentDate: string;
  appointmentType?: string;
  status: string;
  doctorName?: string;
  notes?: string;
}

export function PatientSchedulingTab({ patientId }: { patientId: string }) {
  const canViewAppointments = useHasPermission('appointment.view');
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(canViewAppointments);

  useEffect(() => {
    if (!canViewAppointments) {
      setLoading(false);
      setAppointments([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    appointmentsApi
      .getByPatient(patientId)
      .then((res) => {
        if (!cancelled) setAppointments(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setAppointments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, canViewAppointments]);

  if (!canViewAppointments) {
    return (
      <div className="py-8 text-sm text-gray-500 text-center">
        Appointment scheduling requires appointment access. Use Counsellor Waiting List → Schedule
        Counselling for counselling sessions.
      </div>
    );
  }

  if (loading) {
    return <div className="py-8 text-sm text-gray-500">Loading appointments…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600" />
          Appointments ({appointments.length})
        </h3>
        <Link
          href={`/dashboard/appointments/schedule?patientId=${patientId}`}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" />
          Book
        </Link>
      </div>

      {appointments.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No appointments scheduled.</p>
      ) : (
        <div className="space-y-2">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 flex justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(apt.appointmentDate).toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {[apt.appointmentType, apt.doctorName ? `Dr. ${apt.doctorName}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {apt.notes && <p className="text-xs text-gray-500 mt-1">{apt.notes}</p>}
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-700 h-fit">
                {apt.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
