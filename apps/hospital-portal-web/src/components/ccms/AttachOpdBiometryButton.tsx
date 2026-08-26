'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import biometryApi from '@/lib/api/biometry.api';
import { attachBiometryRecord } from '@/lib/api/ccms/ccms-documents.api';
import { latestBiometryPerEye } from '@/lib/ccms/attach-opd-biometry';

interface Props {
  caseId: string;
  patientId?: string | null;
  readOnly?: boolean;
  onAttached: () => void;
}

export function AttachOpdBiometryButton({ caseId, patientId, readOnly, onAttached }: Props) {
  const [busy, setBusy] = useState(false);
  if (readOnly || !patientId) return null;

  async function handleClick() {
    setBusy(true);
    try {
      const rows = await biometryApi.getByPatient(patientId!);
      const list = Array.isArray(rows) ? rows : [];
      const latest = latestBiometryPerEye(list);
      if (latest.length === 0) {
        toast.error('No OPD biometry on file for this patient.');
        return;
      }
      for (const row of latest) {
        await attachBiometryRecord(caseId, {
          biometryRecordId: row.id,
          eye: row.eye,
          examinationDate: row.examinationDate,
          calculatedIol: row.calculatedIOL ?? row.calculatedIol,
          device: row.device,
        });
      }
      toast.success(
        latest.length === 1
          ? 'OPD biometry attached to this case.'
          : `${latest.length} OPD biometry records attached.`,
      );
      onAttached();
    } catch {
      toast.error('Could not attach OPD biometry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      data-testid="ccms-attach-opd-biometry"
      disabled={busy}
      onClick={handleClick}
      className="mb-3 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
    >
      {busy ? 'Attaching…' : 'Attach OPD biometry'}
    </button>
  );
}
