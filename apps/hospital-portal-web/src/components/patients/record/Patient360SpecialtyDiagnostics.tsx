'use client';

import { useEffect, useState } from 'react';
import { Patient360ListPagination } from '@/components/patients/record/Patient360ListPagination';
import {
  Patient360DetailSheet,
  Patient360RecordTable,
  Patient360Section,
  patient360Honesty,
} from '@/components/patients/record/Patient360RecordTable';
import {
  biometryEmptyMessage,
  biometryUnauthorizedMessage,
  biometryUnavailableMessage,
  loadPatient360Biometry,
  loadPatient360Oct,
  loadPatient360Retinopathy,
  octEmptyMessage,
  octUnauthorizedMessage,
  octUnavailableMessage,
  retinopathyEmptyMessage,
  retinopathyUnauthorizedMessage,
  retinopathyUnavailableMessage,
  type BiometryContextRow,
  type OctContextRow,
  type RetinopathyContextRow,
  type SpecialtyListResult,
} from '@/lib/patients/patient-360-specialty-diagnostics';

function specialtyHonesty<T>(
  result: SpecialtyListResult<T>,
  loading: boolean,
  copy: { empty: string; unauthorized: string; unavailable: string; loading: string },
) {
  if (loading) return copy.loading;
  return patient360Honesty(result, copy);
}

export function Patient360SpecialtyDiagnosticsView({
  biometry,
  retinopathy,
  oct,
  biometryLoading = false,
  retinopathyLoading = false,
  octLoading = false,
  onBiometryPage,
  onRetinopathyPage,
  onOctPage,
}: {
  biometry: SpecialtyListResult<BiometryContextRow>;
  retinopathy: SpecialtyListResult<RetinopathyContextRow>;
  oct: SpecialtyListResult<OctContextRow>;
  biometryLoading?: boolean;
  retinopathyLoading?: boolean;
  octLoading?: boolean;
  onBiometryPage?: (page: number) => void;
  onRetinopathyPage?: (page: number) => void;
  onOctPage?: (page: number) => void;
}) {
  return (
    <div className="space-y-4">
        <Patient360Section title="Biometry" heading="h4">
          <p className="sr-only">Source: Biometry</p>
          <Patient360RecordTable
            caption="Biometry"
            columns={[
              { header: 'Date' },
              { header: 'Eye' },
              { header: 'Device' },
              { header: 'Measures' },
              { header: 'Status' },
              { header: 'Action' },
            ]}
            emptyState={specialtyHonesty(biometry, biometryLoading, {
              empty: biometryEmptyMessage(),
              unauthorized: biometryUnauthorizedMessage(),
              unavailable: biometryUnavailableMessage(),
              loading: 'Loading biometry records.',
            })}
            rows={biometryLoading ? [] : biometry.rows.map((row) => ({
              id: row.id,
              cells: [
                row.when ?? '—',
                row.eye ?? '—',
                [row.device, row.deviceModel].filter(Boolean).join(' · ') || '—',
                row.measures.map((measure) => `${measure.label} ${measure.value}`).join(' · ') || '—',
                row.status ?? '—',
                <Patient360DetailSheet trigger="View details" title="Biometry">
                  {row.measures.map((measure) => (
                    <p key={measure.label}>
                      {measure.label}: {measure.value}
                    </p>
                  ))}
                </Patient360DetailSheet>,
              ],
            }))}
          />
          {!biometryLoading && biometry.state === 'ready' ? (
            <Patient360ListPagination
              label="Biometry"
              currentPage={biometry.pageNumber}
              pageSize={biometry.pageSize}
              totalCount={biometry.totalCount}
              onPageChange={(page) => onBiometryPage?.(page)}
            />
          ) : null}
        </Patient360Section>
        <Patient360Section title="Retinopathy screening" heading="h4">
          <p className="sr-only">Source: Retinopathy screening</p>
          <Patient360RecordTable
            caption="Retinopathy screening"
            columns={[
              { header: 'Date' },
              { header: 'Eye' },
              { header: 'DR grade' },
              { header: 'Findings' },
              { header: 'Status' },
              { header: 'Referral required' },
            ]}
            emptyState={specialtyHonesty(retinopathy, retinopathyLoading, {
              empty: retinopathyEmptyMessage(),
              unauthorized: retinopathyUnauthorizedMessage(),
              unavailable: retinopathyUnavailableMessage(),
              loading: 'Loading retinopathy screening records.',
            })}
            rows={retinopathyLoading ? [] : retinopathy.rows.map((row) => ({
              id: row.id,
              cells: [
                row.when ?? '—',
                row.eye ?? '—',
                row.drGrade ?? '—',
                row.findings.join(', ') || '—',
                row.status ?? '—',
                row.referralRequired ?? '—',
              ],
            }))}
          />
          {!retinopathyLoading && retinopathy.state === 'ready' ? (
            <Patient360ListPagination
              label="Retinopathy screening"
              currentPage={retinopathy.pageNumber}
              pageSize={retinopathy.pageSize}
              totalCount={retinopathy.totalCount}
              onPageChange={(page) => onRetinopathyPage?.(page)}
            />
          ) : null}
        </Patient360Section>
        <Patient360Section title="OCT" heading="h4">
          <p className="sr-only">Source: OCT</p>
          <Patient360RecordTable
            caption="OCT"
            columns={[
              { header: 'Date' },
              { header: 'Eye' },
              { header: 'Type' },
              { header: 'Pattern' },
              { header: 'Size' },
              { header: 'Device' },
              { header: 'Status' },
            ]}
            emptyState={specialtyHonesty(oct, octLoading, {
              empty: octEmptyMessage(),
              unauthorized: octUnauthorizedMessage(),
              unavailable: octUnavailableMessage(),
              loading: 'Loading OCT scans.',
            })}
            rows={octLoading ? [] : oct.rows.map((row) => ({
              id: row.id,
              cells: [
                row.when ?? '—',
                row.eye ?? '—',
                row.scanType ?? '—',
                row.scanPattern ?? '—',
                row.scanSize ?? '—',
                [row.device, row.deviceModel].filter(Boolean).join(' · ') || '—',
                row.status ?? '—',
              ],
            }))}
          />
          {!octLoading && oct.state === 'ready' ? (
            <Patient360ListPagination
              label="OCT"
              currentPage={oct.pageNumber}
              pageSize={oct.pageSize}
              totalCount={oct.totalCount}
              onPageChange={(page) => onOctPage?.(page)}
            />
          ) : null}
        </Patient360Section>
    </div>
  );
}

const idle = <T,>(): SpecialtyListResult<T> => ({
  state: 'ready',
  rows: [],
  totalCount: 0,
  pageNumber: 1,
  pageSize: 20,
});

export function Patient360SpecialtyDiagnostics({ patientId }: { patientId: string }) {
  const [biometryPage, setBiometryPage] = useState(1);
  const [retinopathyPage, setRetinopathyPage] = useState(1);
  const [octPage, setOctPage] = useState(1);
  const [biometry, setBiometry] = useState<SpecialtyListResult<BiometryContextRow>>(idle);
  const [retinopathy, setRetinopathy] = useState<SpecialtyListResult<RetinopathyContextRow>>(idle);
  const [oct, setOct] = useState<SpecialtyListResult<OctContextRow>>(idle);
  const [biometryLoading, setBiometryLoading] = useState(true);
  const [retinopathyLoading, setRetinopathyLoading] = useState(true);
  const [octLoading, setOctLoading] = useState(true);

  useEffect(() => {
    setBiometryPage(1);
    setRetinopathyPage(1);
    setOctPage(1);
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    setBiometryLoading(true);
    void loadPatient360Biometry(patientId, biometryPage).then((next) => {
      if (!cancelled) {
        setBiometry(next);
        setBiometryLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, biometryPage]);

  useEffect(() => {
    let cancelled = false;
    setRetinopathyLoading(true);
    void loadPatient360Retinopathy(patientId, retinopathyPage).then((next) => {
      if (!cancelled) {
        setRetinopathy(next);
        setRetinopathyLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, retinopathyPage]);

  useEffect(() => {
    let cancelled = false;
    setOctLoading(true);
    void loadPatient360Oct(patientId, octPage).then((next) => {
      if (!cancelled) {
        setOct(next);
        setOctLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, octPage]);

  return (
    <Patient360SpecialtyDiagnosticsView
      biometry={biometry}
      retinopathy={retinopathy}
      oct={oct}
      biometryLoading={biometryLoading}
      retinopathyLoading={retinopathyLoading}
      octLoading={octLoading}
      onBiometryPage={setBiometryPage}
      onRetinopathyPage={setRetinopathyPage}
      onOctPage={setOctPage}
    />
  );
}
