'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PatientContextBar } from '@/components/examination/PatientContextBar';
import DoctorComprehensiveExam from '@/components/doctors-desk/DoctorComprehensiveExam';
import { EncounterHpiSection } from '@/components/patients/encounter/EncounterHpiSection';
import { EncounterVitalsSection } from '@/components/patients/encounter/EncounterVitalsSection';
import { EncounterPhysicalExamSection } from '@/components/patients/encounter/EncounterPhysicalExamSection';
import { EncounterMedicationsSection } from '@/components/patients/encounter/EncounterMedicationsSection';
import { useBranchContext } from '@/hooks/use-branch-context';
import { usePatientSummaryQuery } from '@/hooks/use-patient-lookup-queries';
import { useEncounterDocumentation } from '@/hooks/use-encounter-documentation';
import { useHasPermission } from '@/hooks/use-permissions';
import { optometrySummaryApi } from '@/lib/api/optometry.api';
import { patientsEnhancedApi } from '@/lib/api/patients-enhanced.api';
import { recordVitals } from '@/lib/api/widgets.api';
import {
  calcPatientAge,
  formatPatientDob,
  resolvePatientMrn,
  resolvePatientPhone,
  resolvePatientPhotoUrl,
} from '@/lib/patients/patient-display-utils';
import { patientProfileUrl } from '@/lib/patients/patient-routes';
import { encounterSectionCompletion } from '@/lib/patients/encounter-types';
import { patientEncounterTestIds } from '@/lib/patients/patient-encounter-test-ids';

function EncounterPageContent() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;
  const visitId = params.visitId as string;

  const { branchId, isReady } = useBranchContext();
  const canView = useHasPermission('CLINICAL:EXAMINATION:VIEW');
  const canEdit = useHasPermission('CLINICAL:EXAMINATION:EDIT');

  const summaryQuery = usePatientSummaryQuery(isReady ? patientId : null, isReady ? branchId : null);
  const summary = summaryQuery.data;

  const {
    documentation,
    isLoading: docLoading,
    updateHpi,
    updateVitals,
    updatePhysicalExam,
    updateMedications,
    saveNow,
    lastSaved,
    isSaving,
    hasUnsavedChanges,
  } = useEncounterDocumentation(patientId, visitId, canEdit);

  const [patientData, setPatientData] = useState<Record<string, unknown> | null>(null);
  const [optometryData, setOptometryData] = useState<unknown>(null);
  const [contextLoading, setContextLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        setContextLoading(true);
        const [patient, optometry] = await Promise.all([
          patientsEnhancedApi.getPatient(patientId).catch(() => null),
          optometrySummaryApi.getCompleteSummary(patientId).catch(() => null),
        ]);
        if (cancelled) return;

        if (patient) {
          const firstName = patient.firstName || patient.personalInfo?.firstName || '';
          const lastName = patient.lastName || patient.personalInfo?.lastName || '';
          const dob = patient.dateOfBirth || patient.personalInfo?.dateOfBirth;
          setPatientData({
            id: patient.id,
            name: `${firstName} ${lastName}`.trim() || `Patient ${patientId.slice(0, 8)}`,
            mrn:
              patient.medicalRecordNumber ||
              patient.personalInfo?.medicalRecordNumber ||
              summary?.mrn,
            age: dob ? calcPatientAge(dob) : null,
            dateOfBirth: dob,
            gender: patient.gender || patient.personalInfo?.gender,
            phone: patient.contactNumber || patient.contactInfo?.primaryPhone,
            chiefComplaint: patient.currentChiefComplaint || summary?.reasonForVisit || 'Clinical encounter',
          });
        } else if (summary) {
          setPatientData({
            id: summary.id,
            name: `${summary.firstName} ${summary.lastName}`.trim(),
            mrn: summary.mrn,
            age: calcPatientAge(summary.dateOfBirth),
            dateOfBirth: summary.dateOfBirth,
            gender: summary.gender,
            phone: summary.phone,
            chiefComplaint: summary.reasonForVisit || 'Clinical encounter',
          });
        }

        setOptometryData(optometry);
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [patientId, summary]);

  const sectionProgress = useMemo(
    () => encounterSectionCompletion(documentation),
    [documentation],
  );

  const handleSaveEncounter = useCallback(async () => {
    try {
      await saveNow();

      const vitals = documentation.vitals;
      const shouldRecordVitals =
        vitals.heartRate != null ||
        vitals.temperature != null ||
        vitals.bpSystolic != null ||
        vitals.bpDiastolic != null ||
        vitals.oxygenSaturation != null;

      if (shouldRecordVitals && canEdit) {
        await recordVitals(patientId, {
          measuredAt: new Date().toISOString(),
          bloodPressure: {
            systolic: vitals.bpSystolic ?? 0,
            diastolic: vitals.bpDiastolic ?? 0,
          },
          pulseRate: vitals.heartRate ?? 0,
          temperature: vitals.temperature ?? 0,
          oxygenSaturation: vitals.oxygenSaturation ?? undefined,
          flagged: false,
          notes: vitals.notes,
        });
      }

      toast.success('Encounter documentation saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save encounter documentation');
    }
  }, [saveNow, documentation.vitals, canEdit, patientId]);

  const handleComplete = useCallback(() => {
    toast.success('Encounter marked complete — finalize ophthalmic exam below if needed');
    void router.push(patientProfileUrl(patientId));
  }, [router, patientId]);

  const handleBack = useCallback(() => {
    router.push(patientProfileUrl(patientId));
  }, [router, patientId]);

  const loading =
    !isReady || (summaryQuery.isLoading && !summaryQuery.isError) || contextLoading || docLoading;

  if (!canView) {
    return (
      <div className="p-6 text-sm text-slate-600">
        You do not have permission to view clinical encounters.
      </div>
    );
  }

  const displayName = summary
    ? `${summary.firstName} ${summary.lastName}`.trim()
    : (patientData?.name as string | undefined) ?? null;

  return (
    <div className="min-h-screen bg-slate-50" data-testid={patientEncounterTestIds.page}>
      <PatientContextBar
        loading={loading}
        name={displayName}
        firstName={summary?.firstName}
        lastName={summary?.lastName}
        mrn={resolvePatientMrn(undefined, summary?.mrn ?? (patientData?.mrn as string | undefined))}
        age={summary ? calcPatientAge(summary.dateOfBirth) : (patientData?.age as number | null)}
        gender={summary?.gender ?? (patientData?.gender as string | undefined) ?? null}
        bloodGroup={summary?.bloodGroup}
        dateOfBirthLabel={formatPatientDob(summary?.dateOfBirth ?? (patientData?.dateOfBirth as string))}
        phone={resolvePatientPhone(
          summary ? { contactNumber: summary.phone ?? undefined } : undefined,
        )}
        photoUrl={resolvePatientPhotoUrl(summary?.photoThumbnailUrl)}
        complaint={summary?.reasonForVisit ?? (patientData?.chiefComplaint as string | undefined)}
        visitLabel={`Encounter · visit ${visitId.slice(0, 8)}`}
        allergies={
          summary?.allergies
            ? summary.allergies.split(/[,;]/).map((name) => ({ name: name.trim() })).filter((a) => a.name)
            : []
        }
        savedSections={sectionProgress.completed}
        totalSections={sectionProgress.total}
        lastSavedAt={lastSaved}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        canEdit={canEdit}
        onSaveExam={handleSaveEncounter}
        onComplete={handleComplete}
        onBack={handleBack}
      />

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        {summaryQuery.isError && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Patient summary could not be loaded. You can still document this encounter; header details may
            be incomplete.
          </p>
        )}
        <EncounterHpiSection
          value={documentation.hpi}
          onChange={updateHpi}
          disabled={!canEdit || loading}
        />
        <EncounterVitalsSection
          value={documentation.vitals}
          onChange={updateVitals}
          disabled={!canEdit || loading}
        />
        <EncounterPhysicalExamSection
          value={documentation.physicalExam}
          onChange={updatePhysicalExam}
          disabled={!canEdit || loading}
        />
        <EncounterMedicationsSection
          patientId={patientId}
          diagnosis={summary?.reasonForVisit}
          value={documentation.medications}
          onChange={updateMedications}
          disabled={!canEdit || loading}
        />

        <section
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          data-testid={patientEncounterTestIds.ophthalmicExam}
        >
          <h2 className="text-base font-semibold text-slate-900">Ophthalmic examination</h2>
          <p className="mt-1 text-sm text-slate-600">
            Full structured exam — shared with doctors desk and optometry workflows.
          </p>
          <div className="mt-4">
            {patientData ? (
              <DoctorComprehensiveExam
                patientId={patientId}
                visitId={visitId}
                patientData={patientData}
                optometryData={optometryData}
                onSave={() => undefined}
                canEdit={canEdit}
              />
            ) : (
              <p className="text-sm text-slate-500">Loading examination workspace…</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function EncounterPage() {
  return (
    <ProtectedRoute requiredPermission="CLINICAL:EXAMINATION:VIEW">
      <EncounterPageContent />
    </ProtectedRoute>
  );
}
