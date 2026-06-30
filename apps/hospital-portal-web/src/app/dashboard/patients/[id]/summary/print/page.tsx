"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useBranchContext } from "@/hooks/use-branch-context";
import { usePatientSummaryQuery } from "@/hooks/use-patient-lookup-queries";
import {
  calcPatientAge,
  formatCareProgramLabel,
  formatPatientDob,
} from "@/lib/patients/patient-display-utils";
import { patientHubUrl } from "@/lib/patients/patient-routes";

export default function PatientPrintSummaryPage() {
  const params = useParams();
  const patientId = params.id as string;
  const { branchId, isReady } = useBranchContext();
  const { data: summary, isLoading } = usePatientSummaryQuery(
    patientId,
    isReady ? branchId : null,
  );

  useEffect(() => {
    if (summary && !isLoading) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [summary, isLoading]);

  if (isLoading || !summary) {
    return (
      <div className="p-8 print:hidden">
        <p className="text-gray-600">Preparing print summary…</p>
      </div>
    );
  }

  const age = calcPatientAge(summary.dateOfBirth);

  return (
    <div className="min-h-screen bg-white text-gray-900 p-8 max-w-3xl mx-auto">
      <div className="print:hidden mb-6 flex items-center justify-between">
        <Link
          href={patientHubUrl()}
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Back to Patients
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded-lg"
        >
          Print
        </button>
      </div>

      <header className="border-b border-gray-200 pb-4 mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wide">
          Patient summary
        </p>
        <h1 className="text-2xl font-bold mt-1">
          {summary.firstName} {summary.lastName}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          MRN {summary.mrn} · {age != null ? `${age}y` : "—"} · {summary.gender}{" "}
          · DOB {formatPatientDob(summary.dateOfBirth) ?? "—"}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Generated {new Date().toLocaleString()}
        </p>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-semibold uppercase text-gray-500 mb-2">
          Active engagements
        </h2>
        {summary.activeEngagements.length === 0 ? (
          <p className="text-sm text-gray-600">None</p>
        ) : (
          <ul className="text-sm space-y-1">
            {summary.activeEngagements.map((e) => (
              <li key={`${e.type}-${e.label}`}>
                {e.label} — {e.status ?? "active"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <h2 className="font-semibold uppercase text-gray-500 text-xs mb-2">
            Contact
          </h2>
          <p>Phone: {summary.phone ?? "—"}</p>
          <p>Email: {summary.email ?? "—"}</p>
          <p>
            Emergency: {summary.emergencyContactName ?? "—"}
            {summary.emergencyContactPhone
              ? ` (${summary.emergencyContactPhone})`
              : ""}
          </p>
        </div>
        <div>
          <h2 className="font-semibold uppercase text-gray-500 text-xs mb-2">
            Clinical
          </h2>
          <p>Acuity: {summary.clinicalAcuity}</p>
          <p>Allergies: {summary.allergies ?? "Not documented"}</p>
          <p>Blood group: {summary.bloodGroup ?? "—"}</p>
        </div>
      </section>

      {summary.careProgramCodes.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase text-gray-500 mb-2">
            Care programs
          </h2>
          <p className="text-sm">
            {summary.careProgramCodes.map(formatCareProgramLabel).join(", ")}
          </p>
        </section>
      )}

      {summary.latestVitals && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase text-gray-500 mb-2">
            Latest vitals
          </h2>
          <p className="text-sm">
            BP {summary.latestVitals.bloodPressureSystolic}/
            {summary.latestVitals.bloodPressureDiastolic}· HR{" "}
            {summary.latestVitals.heartRate ?? "—"}· Temp{" "}
            {summary.latestVitals.temperature ?? "—"}°C · SpO₂{" "}
            {summary.latestVitals.oxygenSaturation ?? "—"}%
          </p>
          {summary.latestVitals.recordedAt && (
            <p className="text-xs text-gray-500 mt-1">
              Recorded{" "}
              {new Date(summary.latestVitals.recordedAt).toLocaleString()}
            </p>
          )}
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-semibold uppercase text-gray-500 mb-2">
          Insurance
        </h2>
        <p className="text-sm">
          {summary.insuranceProvider ?? "—"}
          {summary.insurancePolicyNumber
            ? ` · Policy ${summary.insurancePolicyNumber}`
            : ""}
        </p>
      </section>

      {summary.dataQuality.issues.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase text-gray-500 mb-2">
            Data quality notes
          </h2>
          <ul className="text-sm list-disc list-inside">
            {summary.dataQuality.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
