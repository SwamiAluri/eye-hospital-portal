'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  clinicalEmptyMessage,
  clinicalUnauthorizedMessage,
  clinicalUnavailableMessage,
  loadPatient360Clinical,
  loadPatient360CodedDiagnoses,
  loadPatient360Prescriptions,
  codedDiagnosisTypeLabel,
  type ClinicalListResult,
  type ClinicalSource,
  type CodedDiagnosisListResult,
  type NamedMeasure,
  type Patient360ClinicalBundle,
  type PrescriptionListResult,
} from '@/lib/patients/patient-360-clinical';
import {
  ipVitalsEmptyMessage,
  ipVitalsUnauthorizedMessage,
  ipVitalsUnavailableMessage,
  loadPatient360IpVitals,
  type IpVitalsListResult,
} from '@/lib/patients/patient-360-ip-vitals';
import {
  imagingFilesEmptyMessage,
  imagingFilesUnauthorizedMessage,
  imagingFilesUnavailableMessage,
  loadPatient360ImagingFiles,
  type ImagingFileListResult,
} from '@/lib/patients/patient-360-imaging-files';
import { Patient360ListPagination } from './Patient360ListPagination';
import { Patient360Subnav } from './Patient360Group';
import {
  Patient360DetailSheet,
  Patient360RecordTable,
  Patient360Section,
  patient360Honesty,
  truncatePatient360Text,
} from './Patient360RecordTable';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import type { PatientSummary } from '@/types/patient-lookup';
import { usePatientRecord } from './PatientRecordProvider';
import { Patient360SpecialtyDiagnostics } from './Patient360SpecialtyDiagnostics';

function measureValue(measures: NamedMeasure[], ...labels: string[]): string {
  const found = measures.find((row) => labels.includes(row.label));
  return found?.value ?? '—';
}

function clinicalHonesty(source: ClinicalSource, result: ClinicalListResult<unknown> | null | undefined, loading: string) {
  return patient360Honesty(result, {
    empty: clinicalEmptyMessage(source),
    unauthorized: clinicalUnauthorizedMessage(source),
    unavailable: clinicalUnavailableMessage(source),
    loading,
  });
}

function draftSummaryRows(summary: PatientSummary) {
  const vitals = summary.latestVitals;
  if (!vitals) return [];
  const recorded = vitals.recordedAt ?? null;
  const rows: { id: string; finding: string; od: string; os: string; recorded: string }[] = [];
  if (vitals.visualAcuityOd?.trim() || vitals.visualAcuityOs?.trim()) {
    rows.push({
      id: 'va',
      finding: 'Visual acuity',
      od: vitals.visualAcuityOd?.trim() || '—',
      os: vitals.visualAcuityOs?.trim() || '—',
      recorded: recorded ?? '—',
    });
  }
  if (vitals.iopOd != null || vitals.iopOs != null) {
    rows.push({
      id: 'iop',
      finding: 'IOP',
      od: vitals.iopOd != null ? String(vitals.iopOd) : '—',
      os: vitals.iopOs != null ? String(vitals.iopOs) : '—',
      recorded: recorded ?? '—',
    });
  }
  return rows;
}

export function Patient360ClinicalView({
  summary,
  bundle,
  ipVitals,
  onIpVitalsPageChange,
  imagingFiles,
  onImagingFilesPageChange,
  prescriptions,
  onPrescriptionsPageChange,
  codedDiagnoses,
  onCodedDiagnosesPageChange,
  specialty,
}: {
  summary: PatientSummary;
  bundle: Patient360ClinicalBundle;
  ipVitals: IpVitalsListResult | null;
  onIpVitalsPageChange?: (page: number) => void;
  imagingFiles: ImagingFileListResult | null;
  onImagingFilesPageChange?: (page: number) => void;
  prescriptions?: PrescriptionListResult | null;
  onPrescriptionsPageChange?: (page: number) => void;
  codedDiagnoses?: CodedDiagnosisListResult | null;
  onCodedDiagnosesPageChange?: (page: number) => void;
  specialty?: ReactNode;
}) {
  const draft = draftSummaryRows(summary);
  const registrationAllergy = summary.allergies?.trim() || null;
  const medicationHistory = prescriptions === undefined ? bundle.prescriptions : prescriptions;

  return (
    <>
      <Patient360Subnav
        items={[
          { id: 'p360-clinical-summary', label: 'Summary' },
          { id: 'p360-clinical-vitals', label: 'Vitals' },
          { id: 'p360-clinical-allergies', label: 'Allergies' },
          { id: 'p360-clinical-exams', label: 'Examinations' },
          { id: 'p360-clinical-rx', label: 'Medications' },
          { id: 'p360-clinical-dx', label: 'Diagnoses' },
          { id: 'p360-clinical-lab', label: 'Laboratory' },
          { id: 'p360-clinical-imaging', label: 'Imaging & scans' },
          { id: 'p360-clinical-optical', label: 'Optical' },
          { id: 'p360-clinical-notes', label: 'Notes' },
          { id: 'p360-clinical-specialty', label: 'Specialty diagnostics' },
        ]}
      />
      <div className="mt-4 space-y-4">
        <Patient360Section id="p360-clinical-summary" title="Summary">
          <Patient360RecordTable
            caption="Clinical summary"
            columns={[{ header: 'Finding' }, { header: 'Right eye' }, { header: 'Left eye' }, { header: 'Recorded' }]}
            rows={draft.map((row) => ({
              id: row.id,
              cells: [row.finding, row.od, row.os, row.recorded],
            }))}
            emptyState="No examination draft measures are on this summary."
          />
        </Patient360Section>

        <Patient360Section id="p360-clinical-vitals" title="Vitals">
          <h4 className="text-sm font-medium text-gray-900">OPD</h4>
          <Patient360RecordTable
            caption="OPD vitals"
            columns={[
              { header: 'Date' },
              { header: 'BP' },
              { header: 'Pulse' },
              { header: 'SpO2' },
              { header: 'Temperature' },
              { header: 'Weight' },
              { header: 'Source' },
            ]}
            emptyState={clinicalHonesty('vitals', bundle.vitals, 'Loading OPD vitals.')}
            rows={bundle.vitals.rows.map((row) => ({
              id: row.id,
              cells: [
                row.measuredAt ?? '—',
                measureValue(row.measures, 'Blood pressure'),
                <>
                  {measureValue(row.measures, 'Heart rate')}
                  {row.measures.some((measure) => measure.label === 'Heart rate') ? (
                    <span className="sr-only">Heart rate</span>
                  ) : null}
                </>,
                measureValue(row.measures, 'Oxygen saturation'),
                measureValue(row.measures, 'Temperature'),
                measureValue(row.measures, 'Weight'),
                row.source,
              ],
            }))}
          />

          <h4 className="text-sm font-medium text-gray-900">IP Vitals</h4>
          <Patient360RecordTable
            caption="IP vitals"
            columns={[
              { header: 'Date' },
              { header: 'BP' },
              { header: 'Pulse' },
              { header: 'SpO2' },
              { header: 'Temperature' },
              { header: 'Weight' },
              { header: 'Source' },
            ]}
            emptyState={patient360Honesty(ipVitals, {
              empty: ipVitalsEmptyMessage(),
              unauthorized: ipVitalsUnauthorizedMessage(),
              unavailable: ipVitalsUnavailableMessage(),
              loading: 'Loading IP vitals.',
            })}
            rows={ipVitals?.rows.map((row) => ({
              id: row.id,
              cells: [
                row.recordedAt ?? '—',
                measureValue(row.measures, 'Blood pressure'),
                <>
                  {measureValue(row.measures, 'Pulse rate', 'Heart rate')}
                  {row.measures.some((measure) => measure.label === 'Pulse rate') ? (
                    <span className="sr-only">Pulse rate</span>
                  ) : null}
                </>,
                measureValue(row.measures, 'Oxygen saturation'),
                measureValue(row.measures, 'Temperature'),
                measureValue(row.measures, 'Weight'),
                row.context,
              ],
            })) ?? []}
          />
          {ipVitals && onIpVitalsPageChange ? (
            <Patient360ListPagination
              label="IP vitals"
              currentPage={ipVitals.pageNumber}
              pageSize={ipVitals.pageSize}
              totalCount={ipVitals.totalCount}
              onPageChange={onIpVitalsPageChange}
            />
          ) : null}
        </Patient360Section>

        <Patient360Section id="p360-clinical-allergies" title="Allergies">
          <Patient360RecordTable
            caption="Allergies"
            columns={[{ header: 'Allergen' }, { header: 'Reaction' }, { header: 'Status' }, { header: 'Recorded' }]}
            emptyState={clinicalHonesty('allergies', bundle.allergies, 'Loading allergies.')}
            rows={bundle.allergies.rows.map((row) => ({
              id: row.id,
              cells: [row.name, row.reaction || '—', row.status ?? '—', row.recorded ?? '—'] as ReactNode[],
            }))}
          />
          {registrationAllergy ? (
            <p className="text-xs text-gray-600">
              Registration allergy text: {registrationAllergy}
            </p>
          ) : null}
        </Patient360Section>

        <Patient360Section id="p360-clinical-exams" title="Examinations">
          <Patient360RecordTable
            caption="Examinations"
            columns={[
              { header: 'Date' },
              { header: 'Examination' },
              { header: 'Eye' },
              { header: 'Key finding' },
              { header: 'Provider' },
              { header: 'Action', srOnly: true },
            ]}
            emptyState={clinicalHonesty('examinations', bundle.examinations, 'Loading examinations.')}
            rows={bundle.examinations.rows.map((row) => {
              const longDetail = Boolean(
                (row.finding && row.finding.length > 48) || row.title.length > 48,
              );
              return {
                id: row.id,
                cells: [
                  row.when ?? '—',
                  truncatePatient360Text(row.title),
                  row.eye ?? '—',
                  row.finding ? truncatePatient360Text(row.finding) : '—',
                  row.provider ?? '—',
                  longDetail || row.finding ? (
                    <Patient360DetailSheet trigger="View details" title="Examination">
                      <p>{row.title}</p>
                      {row.eye ? <p>{row.eye}</p> : null}
                      {row.finding ? <p>{row.finding}</p> : null}
                      {row.provider ? <p>{row.provider}</p> : null}
                      {row.when ? <p>{row.when}</p> : null}
                    </Patient360DetailSheet>
                  ) : (
                    '—'
                  ),
                ],
              };
            })}
          />
        </Patient360Section>

        <Patient360Section id="p360-clinical-rx" title="Medications">
          <Patient360RecordTable
            caption="Medications"
            columns={[
              { header: 'Medication' },
              { header: 'Dose' },
              { header: 'Frequency' },
              { header: 'Route' },
              { header: 'Duration' },
              { header: 'Status' },
            ]}
            emptyState={clinicalHonesty('prescriptions', medicationHistory, 'Loading prescriptions.')}
            rows={medicationHistory
              ? medicationHistory.rows.flatMap((row) =>
                  row.lines.map((line) => ({
                    id: line.id,
                    cells: [
                      [line.medicationName, line.genericName].filter(Boolean).join(' · '),
                      [line.dosage, line.form].filter(Boolean).join(' ') || '—',
                      line.frequency ?? '—',
                      line.route ?? '—',
                      [line.startDate ?? row.when, line.endDate, line.durationDays != null ? `${line.durationDays} days` : null]
                        .filter(Boolean)
                        .join(' · ') || '—',
                      row.status ?? '—',
                    ],
                  })),
                )
              : []}
          />
          {medicationHistory?.state === 'ready' ? (
            <Patient360ListPagination
              label="Prescriptions"
              currentPage={medicationHistory.pageNumber ?? 1}
              pageSize={medicationHistory.pageSize ?? 20}
              totalCount={medicationHistory.totalCount ?? medicationHistory.rows.length}
              onPageChange={onPrescriptionsPageChange ?? (() => undefined)}
            />
          ) : null}
        </Patient360Section>

        <Patient360Section id="p360-clinical-dx" title="Diagnoses">
          <Patient360RecordTable
            caption="Diagnoses"
            columns={[
              { header: 'Diagnosis' },
              { header: 'Code' },
              { header: 'Status' },
              { header: 'Recorded' },
              { header: 'Source' },
            ]}
            emptyState={clinicalHonesty('codedDiagnosis', codedDiagnoses, 'Loading coded diagnosis.')}
            rows={codedDiagnoses
              ? codedDiagnoses.rows.map((row) => ({
                  id: row.id,
                  cells: [
                    row.description,
                    row.code,
                    codedDiagnosisTypeLabel(row.diagnosisType) ?? '—',
                    row.diagnosedAt ?? '—',
                    [row.eyeSpecificity ? `Eye ${row.eyeSpecificity}` : null, row.codeLaterality ? `Code laterality ${row.codeLaterality}` : null]
                      .filter(Boolean)
                      .join(' · ') || '—',
                  ],
                }))
              : []}
          />
          {codedDiagnoses?.state === 'ready' ? (
            <Patient360ListPagination
              label="Coded diagnosis"
              currentPage={codedDiagnoses.pageNumber ?? 1}
              pageSize={codedDiagnoses.pageSize ?? 20}
              totalCount={codedDiagnoses.totalCount ?? codedDiagnoses.rows.length}
              onPageChange={onCodedDiagnosesPageChange ?? (() => undefined)}
            />
          ) : null}
        </Patient360Section>

        <Patient360Section id="p360-clinical-lab" title="Laboratory">
          <Patient360RecordTable
            caption="Laboratory"
            columns={[
              { header: 'Test' },
              { header: 'Result' },
              { header: 'Range' },
              { header: 'Status' },
              { header: 'Date' },
            ]}
            emptyState={clinicalHonesty('labs', bundle.labs, 'Loading laboratory reports.')}
            rows={bundle.labs.rows.map((row) => ({
              id: row.id,
              cells: [
                row.title,
                row.detail ?? '—',
                row.reference ?? '—',
                row.status ?? '—',
                row.when ?? '—',
              ],
            }))}
          />
        </Patient360Section>

        <Patient360Section id="p360-clinical-imaging" title="Imaging & scans">
          <Patient360RecordTable
            caption="Imaging orders"
            columns={[
              { header: 'Date' },
              { header: 'Study' },
              { header: 'Eye/Body' },
              { header: 'Status' },
              { header: 'Report' },
              { header: 'Action', srOnly: true },
            ]}
            emptyState={clinicalHonesty('imaging', bundle.imaging, 'Loading imaging orders.')}
            rows={bundle.imaging.rows.map((row) => ({
              id: row.id,
              cells: [
                row.when ?? '—',
                row.title,
                row.detail ?? '—',
                row.status ?? '—',
                '—',
                row.detail && row.detail.length > 48 ? (
                  <Patient360DetailSheet trigger="View details" title={row.title}>
                    <p>{row.detail}</p>
                  </Patient360DetailSheet>
                ) : (
                  '—'
                ),
              ],
            }))}
          />
          <h4 className="text-sm font-medium text-gray-900">Files</h4>
          <Patient360RecordTable
            caption="Imaging files"
            columns={[
              { header: 'Date' },
              { header: 'Study' },
              { header: 'Eye/Body' },
              { header: 'Status' },
              { header: 'Action' },
            ]}
            emptyState={patient360Honesty(imagingFiles, {
              empty: imagingFilesEmptyMessage(),
              unauthorized: imagingFilesUnauthorizedMessage(),
              unavailable: imagingFilesUnavailableMessage(),
              loading: 'Loading imaging files.',
            })}
            rows={imagingFiles?.rows.map((row) => ({
              id: row.id,
              cells: [
                row.uploadedAt ?? '—',
                row.fileName,
                row.modality ? `Modality ${row.modality}` : '—',
                '—',
                <Patient360DetailSheet trigger="View details" title={row.fileName}>
                  {row.contentType ? <p>{row.contentType}</p> : null}
                  {row.fileSize ? <p>{row.fileSize}</p> : null}
                  {row.modality ? <p>Modality {row.modality}</p> : null}
                </Patient360DetailSheet>,
              ],
            })) ?? []}
          />
          {imagingFiles ? (
            <Patient360ListPagination
              label="Imaging files"
              currentPage={imagingFiles.pageNumber}
              pageSize={imagingFiles.pageSize}
              totalCount={imagingFiles.totalCount}
              onPageChange={onImagingFilesPageChange ?? (() => undefined)}
            />
          ) : null}
        </Patient360Section>

        <Patient360Section id="p360-clinical-optical" title="Optical">
          <Patient360RecordTable
            caption="Optical"
            columns={[
              { header: 'Date' },
              { header: 'Type' },
              { header: 'Eye' },
              { header: 'Prescription/Order' },
              { header: 'Status' },
            ]}
            emptyState={clinicalHonesty('optical', bundle.optical, 'Loading optical orders.')}
            rows={bundle.optical.rows.map((row) => ({
              id: row.id,
              cells: [row.when ?? '—', row.title, row.eye ?? '—', row.prescription ?? '—', row.status ?? '—'],
            }))}
          />
        </Patient360Section>

        <Patient360Section id="p360-clinical-notes" title="Notes">
          <Patient360RecordTable
            caption="Clinical notes"
            columns={[
              { header: 'Date' },
              { header: 'Note Type' },
              { header: 'Author' },
              { header: 'Summary' },
              { header: 'Action' },
            ]}
            emptyState={clinicalHonesty('notes', bundle.notes, 'Loading chart notes.')}
            rows={bundle.notes.rows.map((row) => ({
              id: row.id,
              cells: [
                row.when ?? '—',
                row.noteType,
                row.author ?? '—',
                truncatePatient360Text(row.title),
                row.content ? (
                  <Patient360DetailSheet trigger="View chart note" title={row.title}>
                    <p>{row.content}</p>
                  </Patient360DetailSheet>
                ) : (
                  '—'
                ),
              ],
            }))}
          />
        </Patient360Section>

        <Patient360Section id="p360-clinical-specialty" title="Specialty diagnostics">
          {specialty}
        </Patient360Section>
      </div>
    </>
  );
}

export function Patient360ClinicalPanel() {
  const { patientId, summary } = usePatientRecord();
  const [bundle, setBundle] = useState<Patient360ClinicalBundle | null>(null);
  const [ipVitalsPage, setIpVitalsPage] = useState(1);
  const [ipVitals, setIpVitals] = useState<IpVitalsListResult | null>(null);
  const [imagingFilesPage, setImagingFilesPage] = useState(1);
  const [imagingFiles, setImagingFiles] = useState<ImagingFileListResult | null>(null);
  const [prescriptionPage, setPrescriptionPage] = useState(1);
  const [prescriptions, setPrescriptions] = useState<PrescriptionListResult | null>(null);
  const [codedDiagnosisPage, setCodedDiagnosisPage] = useState(1);
  const [codedDiagnoses, setCodedDiagnoses] = useState<CodedDiagnosisListResult | null>(null);

  useEffect(() => {
    setIpVitalsPage(1);
    setImagingFilesPage(1);
    setPrescriptionPage(1);
    setCodedDiagnosisPage(1);
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    setBundle(null);
    void loadPatient360Clinical(patientId).then((next) => {
      if (!cancelled) setBundle(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    setIpVitals(null);
    void loadPatient360IpVitals(patientId, ipVitalsPage).then((next) => {
      if (!cancelled) setIpVitals(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, ipVitalsPage]);

  useEffect(() => {
    let cancelled = false;
    setImagingFiles(null);
    void loadPatient360ImagingFiles(patientId, imagingFilesPage).then((next) => {
      if (!cancelled) setImagingFiles(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, imagingFilesPage]);

  useEffect(() => {
    let cancelled = false;
    setPrescriptions(null);
    void loadPatient360Prescriptions(patientId, prescriptionPage).then((next) => {
      if (!cancelled) setPrescriptions(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, prescriptionPage]);

  useEffect(() => {
    let cancelled = false;
    setCodedDiagnoses(null);
    void loadPatient360CodedDiagnoses(patientId, codedDiagnosisPage).then((next) => {
      if (!cancelled) setCodedDiagnoses(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, codedDiagnosisPage]);

  if (!summary) return null;

  return (
    <section
      id="patient-360-panel-clinical"
      role="tabpanel"
      aria-labelledby="patient-360-tab-clinical"
      className="min-w-0 overflow-x-hidden p-4"
      data-testid={patientLookupTestIds.recordSectionPanel('clinical')}
    >
      {bundle ? (
        <Patient360ClinicalView
          summary={summary}
          bundle={bundle}
          ipVitals={ipVitals}
          onIpVitalsPageChange={setIpVitalsPage}
          imagingFiles={imagingFiles}
          onImagingFilesPageChange={setImagingFilesPage}
          prescriptions={prescriptions}
          onPrescriptionsPageChange={setPrescriptionPage}
          codedDiagnoses={codedDiagnoses}
          onCodedDiagnosesPageChange={setCodedDiagnosisPage}
          specialty={<Patient360SpecialtyDiagnostics patientId={patientId} />}
        />
      ) : (
        <p role="status" className="text-sm text-gray-600">
          Loading clinical records.
        </p>
      )}
    </section>
  );
}
