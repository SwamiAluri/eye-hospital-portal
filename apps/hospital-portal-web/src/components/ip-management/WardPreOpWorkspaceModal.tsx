'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Activity, ClipboardList, History, Lock, MessageSquare, Pill, Printer, Wallet, X } from 'lucide-react';
import { PatientJourneyRowDto, WardDto, ipManagementApi } from '@/lib/api/ip-management.api';
import { usePreOpReadiness } from '@/hooks/use-preop-readiness';
import { IpOverlayDialog } from '@/components/ip-management/IpOverlayDialog';
import { WardPreOpGateChip } from '@/components/ip-management/WardPreOpGateChip';
import { WardPreOpStepNav } from '@/components/ip-management/preop/WardPreOpStepNav';
import { PreOpReadinessBar } from '@/components/ip-management/preop/PreOpReadinessBar';
import { InvestigationsResultsPanel } from '@/components/ip-management/investigations/InvestigationsResultsPanel';
import { PacAssessmentForm } from '@/components/ip-management/PacAssessmentForm';
import { DepartmentClearancePanel } from '@/components/ip-management/department-clearance/DepartmentClearancePanel';
import { ConsentAuthorizationPanel } from '@/components/ip-management/preop/ConsentAuthorizationPanel';
import { FinancialClearancePanel } from '@/components/ip-management/preop/FinancialClearancePanel';
import { FastingMedicationPanel } from '@/components/ip-management/preop/FastingMedicationPanel';
import { ClinicalEvaluationPanel } from '@/components/ip-management/preop/ClinicalEvaluationPanel';
import { BedsideSafetyPanel } from '@/components/ip-management/preop/BedsideSafetyPanel';
import { PreOpMarkReadyFooter } from '@/components/ip-management/preop/PreOpMarkReadyFooter';
import { PreOpAuditDrawer } from '@/components/ip-management/preop/PreOpAuditDrawer';
import { AdmitPanel } from '@/components/ip-management/preop/AdmitPanel';
import { usePreOpRealtime } from '@/hooks/use-preop-realtime';
import { usePreOpClearanceOptional } from '@/components/ip-management/preop/PreOpClearanceProvider';
import {
  WardPreOpCareTabsPanel,
  WardPreOpCareTab,
  WardPreOpCareTabsHandle,
} from '@/components/ip-management/WardUpdationModal';
import { StatusBadge } from '@/components/counsellors-desk/StatusBadge';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { useUserDepartment } from '@/hooks/useUserDepartment';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import {
  defaultStepForRole,
  getPreOpStep,
  isStepHidden,
  legacyCareTab,
  legacyToStep,
  type PreOpStepKey,
} from '@/lib/ip-management/preop-steps';
import { canCancelTodaySurgery } from '@/lib/ip-management/ward-journey-helpers';
import { MergedMrGuardBanner } from '@/components/ip-management/MergedMrGuardBanner';
import { preOpPayerChipLabel } from '@/lib/ip-management/preop-payer-chip';
import {
  PreOpClearanceChangedBridge,
  PreOpClearanceProvider,
} from '@/components/ip-management/preop/PreOpClearanceProvider';

/** @deprecated v2 nav uses PreOpStepKey. Retained for caller deep-link compatibility. */
export type WardPreOpTopTab = 'wardChecklist' | 'vitals' | 'medLog' | 'nurseRecords' | 'remark';

export interface WardPreOpWorkspaceModalProps {
  journey: PatientJourneyRowDto;
  wards: WardDto[];
  branchId?: string;
  onClose: () => void;
  onJourneyUpdated: (updated: PatientJourneyRowDto) => void;
  /** Preferred v2 step. Wins over the legacy tab/section pair when set (IP-010). */
  initialStep?: PreOpStepKey;
  /** Legacy deep-link entry point — mapped to the v2 8-step model. */
  initialTopTab?: WardPreOpTopTab;
  /** Legacy checklist section deep-link — mapped to the v2 8-step model. */
  initialChecklistSection?: 'p0' | 'investigations' | 'clearance' | 'wardSafety' | 'pac';
  onRequestSendToOt?: () => void;
  onRequestCancelToday?: () => void;
}

const PAC_EDITABLE_STATES = new Set(['Admitted', 'ReadyForSurgery']);
const CHECKLIST_EDITABLE_STATES = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);
const INVESTIGATION_EDITABLE_STATES = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);
const CARE_EDITABLE_STATES = new Set(['Admitted', 'ReadyForSurgery']);

const CARE_SUB_TABS: { key: WardPreOpCareTab; label: string; icon: React.ReactNode }[] = [
  { key: 'vitals', label: 'Vitals', icon: <Activity className="h-4 w-4" /> },
  { key: 'medLog', label: 'Medication Log', icon: <Pill className="h-4 w-4" /> },
  { key: 'nurseRecords', label: 'Nurse Records', icon: <ClipboardList className="h-4 w-4" /> },
  { key: 'remark', label: 'Remark', icon: <MessageSquare className="h-4 w-4" /> },
];

const SECTION = '\u00A7';

export function WardPreOpWorkspaceModal(props: WardPreOpWorkspaceModalProps) {
  return (
    <PreOpClearanceProvider
      journeyId={props.journey.id}
      paymentMode={props.journey.paymentMode ?? undefined}
    >
      <WardPreOpWorkspaceModalInner {...props} />
    </PreOpClearanceProvider>
  );
}

function WardPreOpWorkspaceModalInner({
  journey,
  wards,
  branchId,
  onClose,
  onJourneyUpdated,
  initialStep: initialStepProp,
  initialTopTab = 'wardChecklist',
  initialChecklistSection = 'investigations',
  onRequestSendToOt,
  onRequestCancelToday,
}: WardPreOpWorkspaceModalProps) {
  const { canEditWardChecklist, canEditPac, canEnterInvestigation, canVerifyInvestigation, canSignClinicalEvaluation, canAmendClinicalEvaluationInOt } =
    useIpChecklistPermissions();
  const { primaryDeptCode, loading: deptLoading } = useUserDepartment();

  const initialStep = useMemo(() => {
    const step = initialStepProp ?? legacyToStep(initialTopTab, initialChecklistSection);
    // Expected patients land on Admission & bed (S-05 mockup step 1).
    if (journey.clinicalState === 'Expected' && !initialStepProp && initialTopTab === 'wardChecklist' && initialChecklistSection === 'investigations') {
      return 'admit';
    }
    if (step === 'records' && journey.clinicalState === 'Expected') return 'admit';
    if (isStepHidden(getPreOpStep(step), journey.clinicalState)) {
      return journey.clinicalState === 'Expected' ? 'admit' : 'investigations';
    }
    return step;
  }, [initialStepProp, initialTopTab, initialChecklistSection, journey.clinicalState]);

  const [activeStep, setActiveStep] = useState<PreOpStepKey>(initialStep);
  const [careTab, setCareTab] = useState<WardPreOpCareTab>(legacyCareTab(initialTopTab));
  const [markingReady, setMarkingReady] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [journeyDiagnosis, setJourneyDiagnosis] = useState<string | null>(null);
  const careRef = useRef<WardPreOpCareTabsHandle>(null);
  const clearanceCtx = usePreOpClearanceOptional();

  useEffect(() => {
    let cancelled = false;
    void ipManagementApi.getJourneyDetail(journey.id).then(detail => {
      if (!cancelled) setJourneyDiagnosis(detail?.diagnosis ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [journey.id]);

  const titleId = useId();

  // Readiness rollup (Phase 13): single load powering the top bar + per-step counts.
  // Decoupled from navigation (Phase 14): the rollup refreshes only when data actually
  // changes — each panel reports edits via `onChanged` → `reloadReadiness()`. Clicking a
  // step therefore reloads only the right-hand panel, never the whole shell.
  const { readiness, markReadyGates, dilation, pac, loading: readinessLoading, reload: reloadReadiness } = usePreOpReadiness({
    journeyId: journey.id,
    clinicalState: journey.clinicalState,
    paymentMode: journey.paymentMode ?? undefined,
    financialState: journey.financialState,
    scheduledEye: journey.eyeOperated,
  });

  usePreOpRealtime(journey.id, () => {
    void reloadReadiness();
    void clearanceCtx?.reload();
  });

  // Role-adaptive default step (Phase 13 / blueprint §20): when the workspace is opened
  // without an explicit deep-link, jump to the step the logged-in role owns, once the
  // user's department has resolved. A manual step change cancels the auto-select.
  const explicitDeepLink = !(initialTopTab === 'wardChecklist' && initialChecklistSection === 'investigations');
  const roleDefaultApplied = useRef(false);
  useEffect(() => {
    if (roleDefaultApplied.current) return;
    if (explicitDeepLink) {
      roleDefaultApplied.current = true;
      return;
    }
    if (deptLoading) return;
    roleDefaultApplied.current = true;
    const target = defaultStepForRole({
      primaryDeptCode,
      canEditPac,
      canEnterInvestigation,
      canEditWardChecklist,
      clinicalState: journey.clinicalState,
    });
    if (target !== activeStep) setActiveStep(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptLoading, explicitDeepLink, primaryDeptCode]);

  function handleStepChange(step: PreOpStepKey, extras?: { careTab?: WardPreOpCareTab }) {
    roleDefaultApplied.current = true;
    setActiveStep(step);
    if (extras?.careTab) setCareTab(extras.careTab);
  }

  // Safety net: never leave the active step on an admission-gated step that is hidden
  // pre-admit (e.g. a programmatic "go to PAC" while still Expected).
  useEffect(() => {
    if (isStepHidden(getPreOpStep(activeStep), journey.clinicalState)) {
      setActiveStep(journey.clinicalState === 'Expected' ? 'admit' : 'investigations');
    }
  }, [activeStep, journey.clinicalState]);

  const isMergedReadOnly = !!journey.isPatientMerged;
  const careTabsVisible = journey.clinicalState !== 'Expected';
  const careReadOnly =
    isMergedReadOnly
    || !CARE_EDITABLE_STATES.has(journey.clinicalState)
    || journey.clinicalState === 'Discharged'
    || !canEditWardChecklist;

  const investigationReadOnly =
    isMergedReadOnly
    || !INVESTIGATION_EDITABLE_STATES.has(journey.clinicalState)
    || !canEnterInvestigation;
  const wardSafetyReadOnly =
    isMergedReadOnly
    || !CHECKLIST_EDITABLE_STATES.has(journey.clinicalState)
    || !canEditWardChecklist;
  const pacReadOnly =
    isMergedReadOnly
    || !PAC_EDITABLE_STATES.has(journey.clinicalState)
    || !canEditPac;
  // Consent & financial can be captured pre-admit; only merged/discharged or RBAC locks them.
  const consentReadOnly =
    isMergedReadOnly
    || journey.clinicalState === 'Discharged'
    || !canEditWardChecklist;
  const financialReadOnly = consentReadOnly;

  async function handleMarkReady() {
    if (markReadyGates && !markReadyGates.canMarkReady) {
      toast.error('Resolve the hard stops in the footer before marking ready.');
      return;
    }
    if (!careRef.current) return;
    setMarkingReady(true);
    try {
      await careRef.current.saveAndMarkReady();
      reloadReadiness();
    } finally {
      setMarkingReady(false);
    }
  }

  function handleCareSaved(updated: PatientJourneyRowDto) {
    onJourneyUpdated(updated);
    onClose();
  }

  // Admission now happens inline below the Pre-OT Prep step (no separate modal).
  const canAdmit = !isMergedReadOnly && journey.clinicalState === 'Expected';
  const showMarkReady = !isMergedReadOnly && journey.clinicalState === 'Admitted' && !careReadOnly;
  const showSendToOt =
    !isMergedReadOnly && journey.clinicalState === 'ReadyForSurgery' && onRequestSendToOt;
  const showCancelToday =
    !isMergedReadOnly && onRequestCancelToday && canCancelTodaySurgery(journey);

  // Hidden care panel keeps the Mark-Ready handle mounted when off the records step.
  const mountHiddenCare =
    journey.clinicalState === 'Admitted' && activeStep !== 'records';

  function renderStepBody() {
    const step = getPreOpStep(activeStep);

    if (step.admitStep) {
      return (
        <AdmitPanel
          journey={journey}
          wards={wards}
          onAdmitted={updated => {
            onJourneyUpdated(updated);
            setActiveStep('evaluation');
          }}
          onCancelled={updated => onJourneyUpdated(updated)}
        />
      );
    }

    if (step.investigations) {
      return (
        <InvestigationsResultsPanel
          journeyId={journey.id}
          sessionId={journey.counselingSessionId ?? undefined}
          readOnly={investigationReadOnly}
          canVerify={canVerifyInvestigation}
          onChanged={reloadReadiness}
        />
      );
    }

    if (step.key === 'evaluation') {
      return (
        <ClinicalEvaluationPanel
          journeyId={journey.id}
          counselingSessionId={journey.counselingSessionId}
          journeyDiagnosis={journeyDiagnosis}
          clinicalState={journey.clinicalState}
          paymentMode={journey.paymentMode ?? undefined}
          procedureName={journey.procedureName ?? undefined}
          eyeOperated={journey.eyeOperated ?? undefined}
          forceReadOnly={isMergedReadOnly}
          canEditClinicalEvaluation={canEditWardChecklist}
          canSignClinicalEvaluation={canSignClinicalEvaluation}
          canAmendClinicalEvaluationInOt={canAmendClinicalEvaluationInOt}
          onChanged={reloadReadiness}
        />
      );
    }

    if (step.key === 'consent') {
      return (
        <ConsentAuthorizationPanel
          journeyId={journey.id}
          clinicalState={journey.clinicalState}
          paymentMode={journey.paymentMode ?? undefined}
          eyeOperated={journey.eyeOperated ?? undefined}
          readOnly={consentReadOnly}
          onChanged={reloadReadiness}
        />
      );
    }

    if (step.key === 'financial') {
      return (
        <FinancialClearancePanel
          journeyId={journey.id}
          clinicalState={journey.clinicalState}
          paymentMode={journey.paymentMode ?? undefined}
          financialState={journey.financialState}
          balanceDue={journey.balanceDue}
          packageAmount={journey.packageAmount}
          totalPaid={journey.totalPaid}
          isEmergencyFc={journey.isEmergencyFc}
          readOnly={financialReadOnly}
          onChanged={reloadReadiness}
        />
      );
    }

    if (step.key === 'fasting') {
      return (
        <div className="space-y-4">
          <FastingMedicationPanel
            journeyId={journey.id}
            clinicalState={journey.clinicalState}
            paymentMode={journey.paymentMode ?? undefined}
            readOnly={financialReadOnly}
            pac={pac}
            pacLoading={readinessLoading}
            stepReadiness={readiness?.byKey.fasting}
            onChanged={reloadReadiness}
          />
          {/* Pharmacy Preparation remains a real departmental category (Request/Respond). */}
          <DepartmentClearancePanel
            journeyId={journey.id}
            clinicalState={journey.clinicalState}
            paymentMode={journey.paymentMode ?? undefined}
            currentUserDeptCode={primaryDeptCode}
            forceReadOnly={isMergedReadOnly}
            categoryFilter={['Pharmacy Preparation']}
            hideSummary
            flat
            quietLoading
            onChanged={reloadReadiness}
          />
        </div>
      );
    }

    if (step.careStep) {
      if (!careTabsVisible) {
        return (
          <LockedStepNotice message="Vitals, medication log and nurse records open once the patient is admitted." />
        );
      }
      return (
        <div className="space-y-3">
          <div
            role="tablist"
            aria-label="Care records"
            className="flex gap-1 border-b border-gray-100 pb-2 overflow-x-auto"
          >
            {CARE_SUB_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={careTab === tab.key}
                data-testid={WARD_PREOP_TEST_IDS.careTab(tab.key)}
                onClick={() => setCareTab(tab.key)}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors shrink-0',
                  careTab === tab.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100',
                ].join(' ')}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <WardPreOpCareTabsPanel
            ref={careRef}
            journey={journey}
            wards={wards}
            activeTab={careTab}
            readOnly={careReadOnly}
            onSaved={handleCareSaved}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {step.pac && (
          <div className="space-y-3">
            {journey.clinicalState === 'Expected' && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                Admit the patient to complete PAC. {SECTION}1 investigations and department
                clearance can be completed pre-admit.
              </p>
            )}
            <PacAssessmentForm
              journeyId={journey.id}
              anaesthetistName={journey.anaesthetistName}
              readOnly={pacReadOnly}
              onNavigateInvestigations={() => setActiveStep('investigations')}
              onNavigateVitals={() => setActiveStep('records')}
              onNavigateEvaluation={() => setActiveStep('evaluation')}
              onChanged={reloadReadiness}
            />
          </div>
        )}

        {step.wardSafety && (
          <BedsideSafetyPanel
            journeyId={journey.id}
            paymentMode={journey.paymentMode ?? undefined}
            sessionId={journey.counselingSessionId ?? undefined}
            patientId={journey.patientId ?? undefined}
            financialState={journey.financialState}
            balanceDue={journey.balanceDue}
            readOnly={wardSafetyReadOnly}
            clinicalState={journey.clinicalState}
            stepReadiness={readiness?.byKey.bedside}
            onChanged={reloadReadiness}
          />
        )}

        {step.clearanceCategories && step.clearanceCategories.length > 0 && (
          <DepartmentClearancePanel
            journeyId={journey.id}
            clinicalState={journey.clinicalState}
            paymentMode={journey.paymentMode ?? undefined}
            currentUserDeptCode={primaryDeptCode}
            forceReadOnly={isMergedReadOnly}
            categoryFilter={step.clearanceCategories}
            hideSummary={step.key === 'bedside'}
            flat={step.key === 'bedside'}
            quietLoading={step.key === 'bedside'}
            onChanged={reloadReadiness}
          />
        )}
      </div>
    );
  }

  return (
    <>
    <IpOverlayDialog
      onClose={onClose}
      size="6xl"
      title="Ward Pre-Operative Workspace"
      testId={WARD_PREOP_TEST_IDS.workspace}
      className="max-h-[92vh] min-h-[min(85vh,900px)]"
    >
      <PreOpClearanceChangedBridge onChanged={reloadReadiness} />
      <div
        aria-labelledby={titleId}
        className="flex flex-col max-h-[92vh] min-h-[min(85vh,900px)]"
      >
        {/* Header */}
        <div className="ws-head shrink-0 sticky top-0 z-10">
          <div className="min-w-0">
            <div className="name" id={titleId}>Ward Pre-Operative Workspace</div>
            <div className="ident">
              {journey.patientName ?? '—'}
              {journey.uhid ? ` · MR: ${journey.uhid}` : ''}
              {journey.procedureName ? ` · ${journey.procedureName}` : ''}
              {journey.eyeOperated ? ` · ${journey.eyeOperated}` : ''}
            </div>
              {/* Context line (Phase 13 §5): payer + outpatient handoff at a glance */}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                  <Wallet className="h-3 w-3" aria-hidden="true" />
                  Payer: {preOpPayerChipLabel(journey.paymentMode)}
                </span>
                {(journey.balanceDue ?? 0) > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    Balance ₹{(journey.balanceDue ?? 0).toLocaleString('en-IN')}
                  </span>
                )}
                {journey.counselingSessionId && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    Outpatient summary ✓
                  </span>
                )}
              </div>
            </div>
          <span className="spacer" />
          <div className="flex items-center gap-3 shrink-0">
            <StatusBadge status={journey.clinicalState} size="sm" />
            {journey.patientId && (
              <a
                href={`/dashboard/patients/${journey.patientId}/summary/print`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={WARD_PREOP_TEST_IDS.printSummary}
                title="Print pre-op summary"
                aria-label="Print pre-op summary (opens in a new tab)"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Print</span>
              </a>
            )}
            <button
              type="button"
              data-testid={WARD_PREOP_TEST_IDS.auditDrawerToggle}
              onClick={() => setAuditOpen(true)}
              title="Activity and audit log"
              aria-label="Open activity and audit log"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <History className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Activity</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close workspace"
              className="inline-flex h-8 w-8 items-center justify-center text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Readiness rollup + optional gate chip */}
        <div className="px-3 pt-2 shrink-0 border-b border-gray-100 space-y-2">
          {isMergedReadOnly && (
            <div className="px-1 pt-1">
              <MergedMrGuardBanner
                canonicalPatientId={journey.canonicalPatientId}
                canonicalUhid={journey.canonicalUhid}
              />
            </div>
          )}
          <PreOpReadinessBar
            readiness={readiness}
            loading={readinessLoading}
            gateSlot={
              canAdmit || showMarkReady || showSendToOt ? (
                <WardPreOpGateChip journeyId={journey.id} clinicalState={journey.clinicalState} />
              ) : null
            }
          />
        </div>

        {/* Two-pane: vertical step rail (no horizontal scroll) + active step body */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="shrink-0 overflow-y-auto border-b border-gray-100 p-2 lg:w-72 lg:border-b-0 lg:border-r xl:w-80">
            <WardPreOpStepNav
              activeStep={activeStep}
              onStepChange={handleStepChange}
              clinicalState={journey.clinicalState}
              readiness={readiness?.byKey}
            />
          </aside>

          <div
            className="min-h-0 flex-1 overflow-y-auto p-4"
            role="tabpanel"
            data-testid={WARD_PREOP_TEST_IDS.stepPanel(activeStep)}
          >
            {renderStepBody()}

            {/* Keep Mark-Ready handle mounted when off the records step */}
            {mountHiddenCare && (
              <div className="hidden" aria-hidden>
                <WardPreOpCareTabsPanel
                  ref={careRef}
                  journey={journey}
                  wards={wards}
                  activeTab="remark"
                  readOnly={careReadOnly}
                  onSaved={handleCareSaved}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer CTAs — Mark Ready hard stops + primary actions (Phase 6) */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 space-y-3">
          {showMarkReady && (
            <PreOpMarkReadyFooter
              gates={markReadyGates}
              loading={readinessLoading}
              markingReady={markingReady}
              onMarkReady={() => void handleMarkReady()}
              onNavigateStep={handleStepChange}
              dilation={dilation}
            />
          )}
          <div className="flex justify-end gap-2">
            {showCancelToday && (
              <button
                type="button"
                data-testid={WARD_PREOP_TEST_IDS.cancelTodayBtn}
                onClick={onRequestCancelToday}
                className="mr-auto px-4 py-2 text-sm border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 font-medium"
              >
                Cancel Today&apos;s Surgery
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            {showSendToOt && (
              <button
                type="button"
                data-testid={WARD_PREOP_TEST_IDS.btnSendOt}
                onClick={onRequestSendToOt}
                className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium"
              >
                Send to OT
              </button>
            )}
          </div>
        </div>
      </div>
    </IpOverlayDialog>
      <PreOpAuditDrawer
        journeyId={journey.id}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
      />
    </>
  );
}

function LockedStepNotice({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Lock className="h-7 w-7 text-gray-300" aria-hidden="true" />
      <p className="text-sm text-gray-500 max-w-sm">{message}</p>
    </div>
  );
}
