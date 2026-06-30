'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, GitMerge } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PatientSearchAutosuggest } from '@/components/patients/lookup/PatientSearchAutosuggest';
import { useBranchContext } from '@/hooks/use-branch-context';
import { usePermissions } from '@/hooks/usePermissions';
import { getApi } from '@/lib/api';
import { mergePatients } from '@/lib/api/patient-merge.api';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { patientProfileUrl } from '@/lib/patients/patient-routes';
import type { UnifiedPatientSearchHit } from '@/lib/patients/unified-patient-search';

function toHit(row: {
  id: string;
  firstName: string;
  lastName: string;
  medicalRecordNumber?: string;
  mrn?: string;
}): UnifiedPatientSearchHit {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    mrn: row.medicalRecordNumber ?? row.mrn ?? '',
    phone: null,
    dateOfBirth: null,
    gender: null,
  };
}

export default function PatientMergePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { branchId } = useBranchContext();
  const { hasPermission } = usePermissions();
  const canMerge = hasPermission('patient.update');

  const [primary, setPrimary] = useState<UnifiedPatientSearchHit | null>(null);
  const [duplicate, setDuplicate] = useState<UnifiedPatientSearchHit | null>(null);
  const [primaryQuery, setPrimaryQuery] = useState('');
  const [duplicateQuery, setDuplicateQuery] = useState('');
  const [merging, setMerging] = useState(false);
  const [prefillDone, setPrefillDone] = useState(false);

  useEffect(() => {
    if (prefillDone) return;
    const primaryId = searchParams.get('primaryId');
    const duplicateId = searchParams.get('duplicateId');
    if (!primaryId && !duplicateId) {
      setPrefillDone(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const api = getApi();
        if (primaryId) {
          const { data } = await api.get(`/patients/${primaryId}`);
          if (!cancelled && data) {
            const hit = toHit(data);
            setPrimary(hit);
            setPrimaryQuery(`${hit.firstName} ${hit.lastName}`);
          }
        }
        if (duplicateId) {
          const { data } = await api.get(`/patients/${duplicateId}`);
          if (!cancelled && data) {
            const hit = toHit(data);
            setDuplicate(hit);
            setDuplicateQuery(`${hit.firstName} ${hit.lastName}`);
          }
        }
      } catch {
        toast.error('Could not load patients from link');
      } finally {
        if (!cancelled) setPrefillDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, prefillDone]);

  const ready =
    primary &&
    duplicate &&
    primary.id !== duplicate.id &&
    !merging &&
    canMerge;

  const handleMerge = async () => {
    if (!ready) return;
    const confirmed = window.confirm(
      `Merge ${duplicate.firstName} ${duplicate.lastName} (${duplicate.mrn}) into ${primary.firstName} ${primary.lastName} (${primary.mrn})? This cannot be undone.`,
    );
    if (!confirmed) return;

    setMerging(true);
    try {
      await mergePatients(primary.id, duplicate.id);
      toast.success('Patients merged');
      router.push(patientProfileUrl(primary.id));
    } catch {
      toast.error('Merge failed — check permissions and patient IDs');
    } finally {
      setMerging(false);
    }
  };

  if (!canMerge) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-600">
          You need <span className="font-mono">patient.update</span> permission to merge records.
        </p>
        <Link href="/dashboard/patients" className="text-sm text-emerald-700 hover:underline mt-4 inline-block">
          Back to Patient Hub
        </Link>
      </div>
    );
  }

  return (
    <div
      className="max-w-2xl mx-auto px-4 py-8"
      data-testid={patientLookupTestIds.mergePage}
    >
      <Link
        href="/dashboard/patients"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-emerald-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Patient Hub
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <GitMerge className="w-8 h-8 text-emerald-600" />
        <h1 className="text-2xl font-semibold text-gray-900">Merge patients</h1>
      </div>
      <p className="text-sm text-gray-600 mb-8">
        Combine duplicate records into one primary profile. Visits, appointments,
        prescriptions, and imaging orders move to the primary patient.
      </p>

      <div className="space-y-6">
        <section className="rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Primary record (keep)</h2>
          <PatientSearchAutosuggest
            branchId={branchId}
            value={primaryQuery}
            onChange={setPrimaryQuery}
            onSelectPatient={(p) => {
              setPrimary(p);
              setPrimaryQuery(`${p.firstName} ${p.lastName}`);
            }}
            className="max-w-none"
          />
          {primary && (
            <p className="text-sm text-gray-700 font-mono">
              {primary.firstName} {primary.lastName} · MRN {primary.mrn}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Duplicate (remove)</h2>
          <PatientSearchAutosuggest
            branchId={branchId}
            value={duplicateQuery}
            onChange={setDuplicateQuery}
            onSelectPatient={(p) => {
              setDuplicate(p);
              setDuplicateQuery(`${p.firstName} ${p.lastName}`);
            }}
            className="max-w-none"
          />
          {duplicate && (
            <p className="text-sm text-gray-700 font-mono">
              {duplicate.firstName} {duplicate.lastName} · MRN {duplicate.mrn}
            </p>
          )}
        </section>

        {primary && duplicate && primary.id === duplicate.id && (
          <p className="text-sm text-red-600">Primary and duplicate must be different patients.</p>
        )}

        <button
          type="button"
          disabled={!ready}
          onClick={() => void handleMerge()}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          data-testid={patientLookupTestIds.mergeSubmit}
        >
          <GitMerge className="w-4 h-4" />
          {merging ? 'Merging…' : 'Merge into primary'}
        </button>
      </div>
    </div>
  );
}
