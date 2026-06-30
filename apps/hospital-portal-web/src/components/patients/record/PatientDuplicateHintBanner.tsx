'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GitMerge, Users } from 'lucide-react';
import { getApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { patientMergeUrl } from '@/lib/patients/patient-merge-routes';
import { patientProfileUrl } from '@/lib/patients/patient-routes';

type DuplicateMatch = {
  id: string;
  firstName: string;
  lastName: string;
  medicalRecordNumber?: string;
  matchConfidence?: number;
  matchType?: string;
  differenceReason?: string;
};

export function PatientDuplicateHintBanner({
  patientId,
  firstName,
  lastName,
  dateOfBirth,
  phone,
  email,
}: {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const { hasPermission } = usePermissions();
  const canMerge = hasPermission('patient.update');
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getApi().post<{
          isDuplicate?: boolean;
          matches?: DuplicateMatch[];
        }>('/patients/check-duplicates', {
          firstName,
          lastName,
          dateOfBirth: dateOfBirth?.split('T')[0] ?? null,
          contactNumber: phone ?? null,
          email: email ?? null,
          excludePatientId: patientId,
        });
        if (cancelled) return;
        const rows = (data?.matches ?? []).filter((m) => m.id !== patientId);
        if (data?.isDuplicate && rows.length > 0) {
          setMatches(rows);
        }
      } catch {
        // Non-blocking hint
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, firstName, lastName, dateOfBirth, phone, email]);

  if (matches.length === 0) return null;

  const visible = expanded ? matches : matches.slice(0, 3);
  const topMatch = matches[0];

  return (
    <div
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      data-testid={patientLookupTestIds.duplicateHintBanner}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Users className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">Possible duplicate patient record</p>
            <p className="text-amber-800 text-xs mt-0.5">
              {matches.length} similar record{matches.length === 1 ? '' : 's'} found — review
              before documenting or billing.
            </p>
          </div>
        </div>
        {canMerge && topMatch && (
          <Link
            href={patientMergeUrl({ primaryId: patientId, duplicateId: topMatch.id })}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-950 border border-emerald-200 bg-white px-2.5 py-1.5 rounded-lg"
            data-testid={patientLookupTestIds.mergeLink}
          >
            <GitMerge className="w-3.5 h-3.5" />
            Merge records
          </Link>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {visible.map((m) => (
          <li
            key={m.id}
            className="rounded-lg border border-amber-100 bg-white/70 px-3 py-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={patientProfileUrl(m.id)}
                className="text-emerald-800 hover:underline font-medium"
              >
                {m.firstName} {m.lastName}
                {m.medicalRecordNumber ? ` · ${m.medicalRecordNumber}` : ''}
              </Link>
              {m.matchConfidence != null && (
                <span className="text-xs text-amber-800">
                  {Math.round(Number(m.matchConfidence) * 100)}% match
                </span>
              )}
            </div>
            {m.matchType && (
              <p className="text-xs text-gray-600 mt-0.5 capitalize">
                {m.matchType.replace(/([A-Z])/g, ' $1').trim()}
              </p>
            )}
            {m.differenceReason && (
              <p className="text-xs text-gray-500 mt-0.5">{m.differenceReason}</p>
            )}
            {canMerge && (
              <Link
                href={patientMergeUrl({ primaryId: patientId, duplicateId: m.id })}
                className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline mt-1"
              >
                <GitMerge className="w-3 h-3" />
                Merge into this profile
              </Link>
            )}
          </li>
        ))}
      </ul>

      {matches.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-amber-900 hover:underline"
        >
          {expanded ? 'Show fewer' : `Review all ${matches.length} matches`}
        </button>
      )}

      {!canMerge && (
        <p className="mt-2 text-xs text-amber-800">
          Contact an administrator with patient merge permission to combine records.
        </p>
      )}
    </div>
  );
}
