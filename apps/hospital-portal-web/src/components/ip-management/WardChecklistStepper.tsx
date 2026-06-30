'use client';

import type { ReactNode } from 'react';
import { InvestigationsResultsPanel } from '@/components/ip-management/investigations/InvestigationsResultsPanel';
import { PacAssessmentForm } from '@/components/ip-management/PacAssessmentForm';
import { DepartmentClearancePanel } from '@/components/ip-management/department-clearance/DepartmentClearancePanel';
import { WardChecklist } from '@/components/ip-management/WardChecklist';
import { WardExpectedP0Banner } from '@/components/ip-management/WardExpectedP0Banner';
import { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { useUserDepartment } from '@/hooks/useUserDepartment';
import {
  ClipboardList,
  ListChecks,
  Microscope,
  Stethoscope,
  UserCheck,
} from 'lucide-react';

export type WardChecklistSection = 'p0' | 'investigations' | 'clearance' | 'wardSafety' | 'pac';

const PAC_EDITABLE_STATES = new Set(['Admitted', 'ReadyForSurgery']);
const CHECKLIST_EDITABLE_STATES = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);
const INVESTIGATION_EDITABLE_STATES = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);

const SECTION = '\u00A7';

const SECTIONS: {
  key: WardChecklistSection;
  label: string;
  short: string;
  icon: ReactNode;
}[] = [
  { key: 'p0', label: `${SECTION}0 P0 Outpatient`, short: 'P0', icon: <UserCheck className="h-3.5 w-3.5" /> },
  { key: 'investigations', label: `${SECTION}1 Investigations`, short: 'Investigations', icon: <Microscope className="h-3.5 w-3.5" /> },
  { key: 'clearance', label: `${SECTION}2 Dept Clearance`, short: 'Clearance', icon: <ClipboardList className="h-3.5 w-3.5" /> },
  { key: 'wardSafety', label: `${SECTION}3 Ward Safety`, short: 'Safety', icon: <ListChecks className="h-3.5 w-3.5" /> },
  { key: 'pac', label: `${SECTION}4 PAC`, short: 'PAC', icon: <Stethoscope className="h-3.5 w-3.5" /> },
];

export interface WardChecklistStepperProps {
  journey: PatientJourneyRowDto;
  branchId?: string;
  activeSection: WardChecklistSection;
  onSectionChange: (section: WardChecklistSection) => void;
  /** When true, all checklist sections are view-only (e.g. merged MR). */
  forceReadOnly?: boolean;
}

export function WardChecklistStepper({
  journey,
  branchId,
  activeSection,
  onSectionChange,
  forceReadOnly = false,
}: WardChecklistStepperProps) {
  const { canEditWardChecklist, canEditPac, canEnterInvestigation, canVerifyInvestigation } =
    useIpChecklistPermissions();
  const { primaryDeptCode } = useUserDepartment();

  const investigationReadOnly =
    forceReadOnly
    || !INVESTIGATION_EDITABLE_STATES.has(journey.clinicalState)
    || !canEnterInvestigation;
  const wardSafetyReadOnly =
    forceReadOnly
    || !CHECKLIST_EDITABLE_STATES.has(journey.clinicalState)
    || !canEditWardChecklist;
  const pacReadOnly =
    forceReadOnly
    || !PAC_EDITABLE_STATES.has(journey.clinicalState)
    || !canEditPac;

  return (
    <div className="space-y-4" data-testid={WARD_PREOP_TEST_IDS.tabWardChecklist}>
      <div className="flex flex-wrap gap-1 border-b border-gray-100 pb-2">
        {SECTIONS.map(section => (
          <button
            key={section.key}
            type="button"
            onClick={() => onSectionChange(section.key)}
            data-testid={
              section.key === 'investigations'
                ? WARD_PREOP_TEST_IDS.sectionNavInvestigations
                : section.key === 'clearance'
                  ? WARD_PREOP_TEST_IDS.sectionNavClearance
                  : section.key === 'wardSafety'
                    ? WARD_PREOP_TEST_IDS.sectionNavWardSafety
                    : section.key === 'pac'
                      ? WARD_PREOP_TEST_IDS.sectionNavPac
                      : undefined
            }
            className={[
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              activeSection === section.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100',
            ].join(' ')}
          >
            {section.icon}
            <span className="hidden sm:inline">{section.label}</span>
            <span className="sm:hidden">{section.short}</span>
          </button>
        ))}
      </div>

      {activeSection === 'p0' && (
        <WardExpectedP0Banner
          journeyId={journey.id}
          counselingSessionId={journey.counselingSessionId}
          clinicalState={journey.clinicalState}
        />
      )}

      {activeSection === 'investigations' && (
        <InvestigationsResultsPanel
          journeyId={journey.id}
          sessionId={journey.counselingSessionId ?? undefined}
          readOnly={investigationReadOnly}
          canVerify={canVerifyInvestigation}
        />
      )}

      {activeSection === 'clearance' && (
        <DepartmentClearancePanel
          journeyId={journey.id}
          clinicalState={journey.clinicalState}
          paymentMode={journey.paymentMode ?? undefined}
          currentUserDeptCode={primaryDeptCode}
          forceReadOnly={forceReadOnly}
        />
      )}

      {activeSection === 'wardSafety' && (
        <WardChecklist
          journeyId={journey.id}
          paymentMode={journey.paymentMode ?? undefined}
          sessionId={journey.counselingSessionId ?? undefined}
          patientId={journey.patientId ?? undefined}
          financialState={journey.financialState}
          balanceDue={journey.balanceDue}
          readOnly={wardSafetyReadOnly}
        />
      )}

      {activeSection === 'pac' && (
        <div className="space-y-3">
          {journey.clinicalState === 'Expected' && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Admit the patient to continue PAC. {SECTION}1 investigations and {SECTION}2 department clearance can be completed pre-admit.
            </p>
          )}
          <PacAssessmentForm journeyId={journey.id} readOnly={pacReadOnly} />
        </div>
      )}
    </div>
  );
}
