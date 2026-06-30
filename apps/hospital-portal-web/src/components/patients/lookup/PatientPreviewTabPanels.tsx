"use client";

import { useEffect, useState } from "react";
import { examinationApi, prescriptionsApi } from "@/lib/api";
import { labReportsApi, type LabReport } from "@/lib/api/lab-reports.api";
import type { PatientSummary } from "@/types/patient-lookup";
import { PreviewVitalsTabEmpty, hasPreviewVitalsData } from "@/components/patients/lookup/PreviewVitalsGrid";
import { cn } from "@/lib/utils";

type PreviewTab = "vitals" | "eye" | "records" | "meds" | "labs";

const TABS: { key: PreviewTab; label: string }[] = [
  { key: "vitals", label: "Vitals" },
  { key: "eye", label: "Eye" },
  { key: "records", label: "Records" },
  { key: "meds", label: "Meds" },
  { key: "labs", label: "Labs" },
];

function TabSkeleton() {
  return <div className="h-24 bg-gray-50 rounded-lg animate-pulse" />;
}

function VitalsPanel({ summary }: { summary: PatientSummary | undefined }) {
  return <PreviewVitalsTabEmpty vitals={summary?.latestVitals} />;
}

function EyePanel({ summary }: { summary: PatientSummary | undefined }) {
  const vitals = summary?.latestVitals;
  if (!hasPreviewVitalsData(vitals)) {
    return <p className="text-sm text-gray-500">No eye measurements recorded.</p>;
  }

  const vaOd = vitals?.visualAcuityOd;
  const vaOs = vitals?.visualAcuityOs;
  const iopOd = vitals?.iopOd;
  const iopOs = vitals?.iopOs;

  return (
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
        <dt className="text-[11px] font-medium uppercase text-gray-500">VA OD</dt>
        <dd className="mt-1 font-medium text-gray-900">{vaOd ?? '—'}</dd>
      </div>
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
        <dt className="text-[11px] font-medium uppercase text-gray-500">VA OS</dt>
        <dd className="mt-1 font-medium text-gray-900">{vaOs ?? '—'}</dd>
      </div>
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
        <dt className="text-[11px] font-medium uppercase text-gray-500">IOP OD</dt>
        <dd className="mt-1 font-medium text-gray-900">
          {iopOd != null ? `${iopOd} mmHg` : '—'}
        </dd>
      </div>
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
        <dt className="text-[11px] font-medium uppercase text-gray-500">IOP OS</dt>
        <dd className="mt-1 font-medium text-gray-900">
          {iopOs != null ? `${iopOs} mmHg` : '—'}
        </dd>
      </div>
    </dl>
  );
}

function RecordsPanel({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<{ label: string; date?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await examinationApi.getByPatientId(patientId).catch(() => ({ data: [] }));
        const exams = (res.data ?? []).slice(0, 5);
        if (cancelled) return;
        setItems(
          exams.map((e: { id: string; examinationDate?: string; chiefComplaint?: string }) => ({
            label: e.chiefComplaint || "Examination",
            date: e.examinationDate,
          })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) return <TabSkeleton />;
  if (items.length === 0) return <p className="text-sm text-gray-500">No recent records.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item, i) => (
        <li key={i} className="border-b border-gray-50 last:border-0 pb-2">
          <p className="text-gray-900">{item.label}</p>
          {item.date && (
            <p className="text-xs text-gray-500">{new Date(item.date).toLocaleDateString()}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function MedsPanel({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<{ name: string; status?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await prescriptionsApi.getByPatient(patientId);
        const rows = (res.data ?? []).slice(0, 5);
        if (cancelled) return;
        setItems(
          rows.map((p: { medicationName?: string; drugName?: string; status?: string }) => ({
            name: p.medicationName || p.drugName || "Prescription",
            status: p.status,
          })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) return <TabSkeleton />;
  if (items.length === 0) return <p className="text-sm text-gray-500">No active medications.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex justify-between gap-2 border-b border-gray-50 last:border-0 pb-2">
          <span className="text-gray-900">{item.name}</span>
          {item.status && (
            <span className="text-xs text-gray-500 capitalize shrink-0">{item.status}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function LabsPanel({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<LabReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await labReportsApi.getByPatient(patientId, {});
        if (cancelled) return;
        setItems((res.data ?? []).slice(0, 5));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) return <TabSkeleton />;
  if (items.length === 0) return <p className="text-sm text-gray-500">No lab results.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.id} className="border-b border-gray-50 last:border-0 pb-2">
          <p className="text-gray-900">{item.testName || "Lab report"}</p>
          <p className="text-xs text-gray-500 capitalize">
            {item.status}
            {(item.completedAt || item.orderedAt)
              ? ` · ${new Date(item.completedAt || item.orderedAt!).toLocaleDateString()}`
              : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function PatientPreviewTabPanels({
  patientId,
  summary,
}: {
  patientId: string;
  summary: PatientSummary | undefined;
}) {
  const [tab, setTab] = useState<PreviewTab>("vitals");

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex border-b border-gray-100 bg-gray-50/80">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 text-xs font-medium py-2 px-1 transition-colors",
              tab === t.key
                ? "text-emerald-800 bg-white border-b-2 border-emerald-600 -mb-px"
                : "text-gray-500 hover:text-gray-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-3 min-h-[6rem]">
        {tab === "vitals" && <VitalsPanel summary={summary} />}
        {tab === "eye" && <EyePanel summary={summary} />}
        {tab === "records" && <RecordsPanel patientId={patientId} />}
        {tab === "meds" && <MedsPanel patientId={patientId} />}
        {tab === "labs" && <LabsPanel patientId={patientId} />}
      </div>
    </div>
  );
}
