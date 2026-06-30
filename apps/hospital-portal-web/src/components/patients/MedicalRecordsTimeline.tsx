'use client';

import { TimelineTab } from '@/components/patients/tabs/TimelineTab';

interface MedicalRecordsTimelineProps {
  patientId: string;
}

/** Unified clinical timeline from visits, labs, prescriptions, and more. */
export function MedicalRecordsTimeline({ patientId }: MedicalRecordsTimelineProps) {
  return <TimelineTab patientId={patientId} />;
}
