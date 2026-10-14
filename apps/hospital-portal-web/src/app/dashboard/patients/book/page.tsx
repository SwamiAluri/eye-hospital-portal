'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import UnifiedAppointmentBooking from '@/components/appointments/UnifiedAppointmentBooking';

export default function PatientsBookingPage() {
  const router = useRouter();
  const createdPatientId = useSearchParams().get('createdPatientId');

  return (
    <UnifiedAppointmentBooking
      onClose={() => router.back()}
      onSuccess={() => router.push('/dashboard/patients')}
      resumePatientId={createdPatientId}
    />
  );
}
