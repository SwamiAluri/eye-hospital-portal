'use client';

import { useState } from 'react';
import { X, Building2, ClipboardList, ListChecks, Stethoscope, Microscope } from 'lucide-react';
import { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { PreOpTab } from './PreOpTab';
import { WardChecklist } from './WardChecklist';
import { WardInvestigationChecklist } from './WardInvestigationChecklist';
import { PacAssessmentForm } from './PacAssessmentForm';
import { ChecklistPhaseSummary } from './ChecklistPhaseSummary';
import { StatusBadge } from '@/components/counsellors-desk/StatusBadge';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';

interface PreOpChecklistModalProps {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  /** Called after a successful admit. Receives the synthesised updated row. */
  onAdmitSuccess: (updated: PatientJourneyRowDto) => void;
  branchId?: string;
}

type ModalTab = 'investigation' | 'ward' | 'pac' | 'clearance';

const PAC_EDITABLE_STATES = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);

export function PreOpChecklistModal({
  journey,
  onClose,
  onAdmitSuccess,
  branchId,
}: PreOpChecklistModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('investigation');
  const { canEditWardChecklist, canEditPac } = useIpChecklistPermissions();
  const isReadOnly = journey.clinicalState !== 'Expected' || !canEditWardChecklist;
  const pacReadOnly = !PAC_EDITABLE_STATES.has(journey.clinicalState) || !canEditPac;

  function handleAdmitSuccess() {
    onAdmitSuccess({ ...journey, clinicalState: 'Admitted' });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Ward Pre-Operative Checklist
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {journey.patientName ?? '—'}
                {journey.uhid ? ` · MR: ${journey.uhid}` : ''}
                {journey.procedureName ? ` · ${journey.procedureName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={journey.clinicalState} size="sm" />
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-100 px-4 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('investigation')}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0',
              activeTab === 'investigation'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <Microscope className="h-4 w-4" />
            Investigation
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ward')}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'ward'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <ListChecks className="h-4 w-4" />
            Ward Checklist
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pac')}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'pac'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <Stethoscope className="h-4 w-4" />
            PAC
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clearance')}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'clearance'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            <ClipboardList className="h-4 w-4" />
            Pre-Op Clearance
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 p-4">
          <ChecklistPhaseSummary
            journeyId={journey.id}
            counselingSessionId={journey.counselingSessionId}
            paymentMode={journey.paymentMode ?? undefined}
          />
          {activeTab === 'investigation' ? (
            <WardInvestigationChecklist
              journeyId={journey.id}
              sessionId={journey.counselingSessionId ?? undefined}
              readOnly={isReadOnly}
            />
          ) : activeTab === 'ward' ? (
            <WardChecklist
              journeyId={journey.id}
              paymentMode={journey.paymentMode ?? undefined}
              sessionId={journey.counselingSessionId ?? undefined}
              financialState={journey.financialState}
              balanceDue={journey.balanceDue}
              readOnly={isReadOnly}
            />
          ) : activeTab === 'pac' ? (
            <PacAssessmentForm
              journeyId={journey.id}
              readOnly={pacReadOnly}
            />
          ) : (
            <PreOpTab
              journeyId={journey.id}
              clinicalState={journey.clinicalState}
              paymentMode={journey.paymentMode ?? undefined}
              branchId={branchId}
              onAdmitSuccess={handleAdmitSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}
