'use client';

import { useState } from 'react';
import { LogOut, X } from 'lucide-react';
import { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { WardPostOpChecklist } from '@/components/ip-management/WardPostOpChecklist';
import { MergedMrGuardBanner } from '@/components/ip-management/MergedMrGuardBanner';
import { WARD_POSTOP_TEST_IDS } from '@/lib/ip-management/ward-postop-test-ids';
import { transitionClinicalWithGates } from '@/lib/ip-checklist/transition-gates';

function fmtDate(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export interface WardPostOpWorkspaceModalProps {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
}

type PostOpTab = 'Overview' | 'Form4Checklist';

export function WardPostOpWorkspaceModal({
  journey,
  onClose,
  onSaved,
}: WardPostOpWorkspaceModalProps) {
  const [activeTab, setActiveTab] = useState<PostOpTab>('Form4Checklist');
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');
  const isMergedReadOnly = !!journey.isPatientMerged;

  async function handleMarkReady() {
    setMarking(true);
    setError('');
    try {
      const result = await transitionClinicalWithGates(journey.id, { newState: 'ReadyForDischarge' });
      if (result) {
        onSaved({ ...journey, clinicalState: result.clinicalState });
        onClose();
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
               ?? (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message
               ?? (e instanceof Error ? e.message : null)
               ?? 'Failed to mark ready for discharge.';
      setError(msg);
    } finally {
      setMarking(false);
    }
  }

  const tabs: { key: PostOpTab; label: string; testId: string }[] = [
    { key: 'Overview', label: 'Overview', testId: WARD_POSTOP_TEST_IDS.tabOverview },
    { key: 'Form4Checklist', label: 'Form 4 Checklist', testId: WARD_POSTOP_TEST_IDS.tabForm4 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        data-testid={WARD_POSTOP_TEST_IDS.workspace}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold shrink-0">
              {(journey.patientName ?? '?').charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-gray-900">{journey.patientName ?? '—'}</p>
                <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{journey.uhid ?? '—'}</span>
                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Post-Op</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{journey.procedureName ?? '—'} · {journey.eyeOperated ?? '—'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex px-6 pt-3 border-b border-gray-100 shrink-0 gap-1">
          {tabs.map(({ key, label, testId }) => (
            <button
              key={key}
              type="button"
              data-testid={testId}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isMergedReadOnly && (
            <MergedMrGuardBanner
              canonicalPatientId={journey.canonicalPatientId}
              canonicalUhid={journey.canonicalUhid}
              className="mb-4"
            />
          )}
          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}

          {activeTab === 'Overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Ward / Bed', value: journey.wardName ? `${journey.wardName}${journey.bedNumber ? ` · ${journey.bedNumber}` : ''}` : '—' },
                  { label: 'Admitted', value: fmtDate(journey.admittedAt) },
                  { label: 'Surgery Date', value: fmtDate(journey.surgeryScheduledAt) },
                  { label: 'Admission Type', value: journey.admissionType ?? '—' },
                  { label: 'Financial State', value: journey.financialState },
                  { label: 'OT State', value: journey.otState },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                    <p className="font-semibold text-gray-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-violet-800">
                <p className="font-semibold mb-1">Post-Op recovery</p>
                <p className="text-xs">
                  Complete the Form 4 checklist, then mark ready for discharge when nursing care is complete.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'Form4Checklist' && (
            <WardPostOpChecklist
              journeyId={journey.id}
              patientId={journey.patientId ?? undefined}
              counselingSessionId={journey.counselingSessionId ?? undefined}
              readOnly={isMergedReadOnly}
            />
          )}
        </div>

        <div className="flex justify-between gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          {!isMergedReadOnly && (
          <button
            type="button"
            onClick={handleMarkReady}
            disabled={marking}
            data-testid={WARD_POSTOP_TEST_IDS.btnMarkReady}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {marking ? 'Marking…' : 'Mark Ready for Discharge'}
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
