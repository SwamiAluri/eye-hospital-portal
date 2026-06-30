'use client';

import { EyeHistoryTab } from '@/components/patients/tabs/EyeHistoryTab';

interface Props {
  patientId: string;
}

/** Ophthalmic history — delegates to record tab implementation (real examination API). */
export function EyeHistoryPanel({ patientId }: Props) {
  return <EyeHistoryTab patientId={patientId} />;
}

export default EyeHistoryPanel;
