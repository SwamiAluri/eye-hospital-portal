'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { examinationApi } from '@/lib/api';
import { format } from 'date-fns';

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

type DiagnosisRow = {
  diagnosis: string;
  firstDiagnosed: string;
  lastSeen: string;
  occurrences: number;
  doctorName?: string;
  status: string;
  treatment?: string;
  notes?: string;
};

function buildDiagnosesFromExams(exams: any[]): DiagnosisRow[] {
  const map = new Map<string, DiagnosisRow>();
  for (const exam of exams) {
    if (!exam.diagnosis) continue;
    const key = String(exam.diagnosis).toLowerCase();
    const examDate = exam.examinationDate || exam.createdAt;
    if (!map.has(key)) {
      map.set(key, {
        diagnosis: exam.diagnosis,
        firstDiagnosed: examDate,
        lastSeen: examDate,
        occurrences: 1,
        doctorName: exam.doctorName,
        status: exam.status || 'active',
        treatment: exam.treatment,
        notes: exam.notes,
      });
      continue;
    }
    const row = map.get(key)!;
    row.occurrences += 1;
    if (new Date(examDate).getTime() > new Date(row.lastSeen).getTime()) {
      row.lastSeen = examDate;
      row.doctorName = exam.doctorName;
      row.treatment = exam.treatment;
      row.notes = exam.notes;
      row.status = exam.status || row.status;
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
  );
}

export function DiagnosesTab({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<DiagnosisRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await examinationApi.getByPatientId(patientId);
        const diagnoses = buildDiagnosesFromExams(response.data || []);
        if (!cancelled) setRows(diagnoses);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return <div className="flex justify-center py-12 text-sm text-gray-500">Loading diagnoses…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">No diagnoses found</p>
        <p className="text-xs text-gray-400 mt-1">Diagnoses are recorded during clinical examinations</p>
      </div>
    );
  }

  const active = rows.filter((d) => d.status === 'active' || d.status === 'ongoing');
  const resolved = rows.filter((d) => d.status === 'resolved' || d.status === 'completed');

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Diagnoses & conditions</h3>

      <div>
        <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          Active diagnoses
        </h4>
        {active.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg text-sm text-gray-500">
            No active diagnoses
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((d) => (
              <div key={d.diagnosis} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex justify-between gap-2">
                  <h5 className="font-semibold text-gray-900">{d.diagnosis}</h5>
                  <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
                    Active
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  First: {formatDate(d.firstDiagnosed)} · Last: {formatDate(d.lastSeen)} ·{' '}
                  {d.occurrences} occurrence(s)
                </p>
                {d.treatment && <p className="text-sm text-gray-700 mt-2">{d.treatment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-800 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Resolved diagnoses
          </h4>
          <div className="space-y-2">
            {resolved.map((d) => (
              <div key={d.diagnosis} className="border border-gray-200 rounded-lg p-3">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-gray-900">{d.diagnosis}</span>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">Resolved</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {formatDate(d.firstDiagnosed)} – {formatDate(d.lastSeen)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
