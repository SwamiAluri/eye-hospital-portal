'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getApi } from '@/lib/api';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
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

  return (
    <Alert
      variant="warning"
      className="mb-4"
      data-testid={patientLookupTestIds.duplicateHintBanner}
    >
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <AlertTitle>Possible duplicate patient record</AlertTitle>
          <AlertDescription>
            {matches.length} similar record{matches.length === 1 ? '' : 's'} found — review
            before documenting or billing.
          </AlertDescription>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {visible.map((m) => (
          <li key={m.id} className="rounded-lg border border-amber-100 bg-white/70 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={patientProfileUrl(m.id)}
                className="font-medium text-emerald-800 hover:underline"
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
              <p className="mt-0.5 text-xs capitalize text-gray-600">
                {m.matchType.replace(/([A-Z])/g, ' $1').trim()}
              </p>
            )}
            {m.differenceReason && (
              <p className="mt-0.5 text-xs text-gray-500">{m.differenceReason}</p>
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
    </Alert>
  );
}
