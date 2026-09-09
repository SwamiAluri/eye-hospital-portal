'use client';

import { useMemo, type ReactNode } from 'react';

import type { CounsellingSession, CombinedPaymentType, DecisionType } from '@/types/counsellors-desk';

import type { IolMasterDto } from '@/lib/api/service-catalog.api';

import { CounsellingSessionLayout } from '@/components/counsellors-desk/session/CounsellingSessionLayout';

import { CounsellingQuotePanel } from '@/components/counsellors-desk/session/CounsellingQuotePanel';

import { CounsellingEstimatePhase } from '@/components/counsellors-desk/session/CounsellingEstimatePhase';

import { CounsellingDecisionPhase } from '@/components/counsellors-desk/session/CounsellingDecisionPhase';

import { CounsellingWrapupPhase } from '@/components/counsellors-desk/session/CounsellingWrapupPhase';
import { CounsellingFinishSummary } from '@/components/counsellors-desk/session/CounsellingFinishSummary';

import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';

import { useCounsellingSession } from '@/components/counsellors-desk/session/CounsellingSessionContext';

import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { resolveProcedureOverridePrice } from '@/lib/counsellors-desk/package-preview';

import { CounsellingButton, CounsellingInfoAlert } from '@/components/counsellors-desk/session/primitives';



export function CounsellingTabPanel() {

  const ctx = useCounsellingSession();

  const {

    isSurgeryDoneState,

    isDoneState,

    isReadOnly,

    queueStatus,

    handleReEvaluate,

    procedureVariants,

    procedureLoading,

    procedureError,

    loadProcedures,

    selectedVariantId,

    selectedEye,

    setSelectedEye,

    setSelectedVariantId,

    setSelectedSurgeryId,

    variantSubOption,

    setVariantSubOption,

    iolOptions,

    selectedIolId,

    setSelectedIolId,

    selectedInvestigations,

    setSelectedInvestigations,

    toggleInvestigation,

    masterCatalog,

    masterCatalogLoading,

    masterCatalogError,

    loadMasterCatalog,

    savedOverrides,

    overridePrice,

    setOverridePrice,

    overrideReason,

    setOverrideReason,

    overrideRemarks,

    setOverrideRemarks,

    overrideRequesterType,

    setOverrideRequesterType,

    overrideStaffName,

    setOverrideStaffName,

    overrideStaffContact,

    setOverrideStaffContact,

    overrideSaving,

    overrideError,

    setOverrideError,

    setOverrideSaving,

    staffList,

    handleEditOverride,

    handleRemoveOverride,

    editingOverrideId,

    setEditingOverrideId,

    markDirty,

    session,

    paymentType,

    setPaymentType,

    insuranceCompany,

    setInsuranceCompany,

    insuranceProviderOptions,

    freeSurgeryReason,

    setFreeSurgeryReason,

    decision,

    setDecision,

    followUpReason,

    setFollowUpReason,

    followUpDate,

    setFollowUpDate,

    schedule,

    setIsScheduleModalOpen,

    counsellorNotes,

    setCounsellorNotes,

    patientRemarks,

    setPatientRemarks,

    doctorNotes,

    setDoctorNotes,

    wantToSeeDoctor,

    setWantToSeeDoctor,

    interestedToUpgrade,

    setInterestedToUpgrade,

    notRequiredPreAuth,

    setNotRequiredPreAuth,

    sessionId,

    setQueueStatus,

    setSavedOverrides,

    counsellingEstimate: estimate,

    packageTemplates,

    activePhase,

    finishSummaryActive,

    showCoverageWorkflow,

    coverageProgress,

    visitedPhases,

    phaseCompletion,

    phaseValidationContext,

    goToPhase,

    canGoToPhase,

  } = ctx;



  const templates = (packageTemplates ?? []) as CounsellingPackageTemplate[];

  const sess = session as CounsellingSession & {

    surgeries?: Array<{ name?: string; isRecommended?: boolean; variantId?: string }>;

  };



  const recommendedVariantIds = useMemo(

    () =>

      (sess?.surgeries ?? [])

        .filter((s) => s.isRecommended && s.variantId)

        .map((s) => s.variantId as string),

    [sess?.surgeries],

  );



  const doctorRecommendation = useMemo(() => {

    const rec = sess?.surgeries?.find((s) => s.isRecommended);

    return rec?.name ?? null;

  }, [sess?.surgeries]);

  const workspace = useMemo(() => {
    let phaseContent: ReactNode;

    if (activePhase === 'estimate') {
      phaseContent = (
        <CounsellingEstimatePhase
          estimate={estimate}
          procedureVariants={procedureVariants}
          procedureLoading={procedureLoading}
          procedureError={procedureError}
          loadProcedures={loadProcedures}
          recommendedVariantIds={recommendedVariantIds}
          doctorRecommendationName={doctorRecommendation}
          selectedVariantId={selectedVariantId}
          selectedEye={selectedEye}
          variantSubOption={variantSubOption}
          iolOptions={iolOptions as IolMasterDto[]}
          selectedIolId={selectedIolId}
          isReadOnly={isReadOnly}
          isDoneState={isDoneState}
          packageTemplates={templates}
          masterCatalog={masterCatalog}
          masterCatalogLoading={masterCatalogLoading}
          masterCatalogError={masterCatalogError}
          loadMasterCatalog={loadMasterCatalog}
          quotedProcedurePrice={resolveProcedureOverridePrice(savedOverrides, selectedVariantId)}
          selectedInvestigations={selectedInvestigations}
          onSelectVariant={(variantId, surgeryId, eye) => {
            setSelectedEye(eye);
            setSelectedSurgeryId(surgeryId);
            if (variantId !== selectedVariantId) {
              setSelectedVariantId(variantId);
              setVariantSubOption(null);
              setSelectedIolId(null);
            }
          }}
          onClearVariant={() => {
            setSelectedVariantId(null);
            setSelectedSurgeryId(null);
            setVariantSubOption(null);
            setSelectedIolId(null);
          }}
          onSelectEye={(eye) => {
            setSelectedEye(eye);
            if (selectedVariantId) {
              setSelectedSurgeryId(`type-${selectedVariantId}-${eye}`);
            }
          }}
          onEyeInvestigationSync={(eye) => {
            setSelectedInvestigations((prev) => {
              const next = new Map(prev);
              next.forEach((inv, key) => {
                if (inv.testType !== 'Lab') {
                  next.set(key, { ...inv, eye });
                }
              });
              return next;
            });
          }}
          onVariantSubOption={setVariantSubOption}
          onSelectIol={setSelectedIolId}
          onReEvaluate={handleReEvaluate}
          onSwitchToRecommendedProcedure={(variantId, eye) => {
            setSelectedEye(eye);
            setSelectedVariantId(variantId);
            setSelectedSurgeryId(`type-${variantId}-${eye}`);
            setVariantSubOption(null);
            setSelectedIolId(null);
          }}
          onToggleInvestigation={toggleInvestigation}
          onClearInvestigations={() => {
            setSelectedInvestigations(new Map());
            estimate.notifySelectionChange('investigation');
            markDirty();
          }}
          markDirty={markDirty}
        />
      );
    } else if (activePhase === 'decision') {
      phaseContent = (
        <CounsellingDecisionPhase
          paymentType={paymentType as CombinedPaymentType | ''}
          setPaymentType={setPaymentType}
          insuranceCompany={insuranceCompany}
          setInsuranceCompany={setInsuranceCompany}
          insuranceProviderOptions={insuranceProviderOptions}
          freeSurgeryReason={freeSurgeryReason}
          setFreeSurgeryReason={setFreeSurgeryReason}
          decision={decision as DecisionType | ''}
          setDecision={setDecision}
          followUpReason={followUpReason}
          setFollowUpReason={setFollowUpReason}
          followUpDate={followUpDate}
          setFollowUpDate={setFollowUpDate}
          schedule={schedule}
          setIsScheduleModalOpen={setIsScheduleModalOpen}
          isReadOnly={isReadOnly}
          markDirty={markDirty}
          phaseValidationContext={phaseValidationContext}
        />
      );
    } else if (finishSummaryActive) {
      const selectedVariant = procedureVariants.find((v) => v.id === selectedVariantId);
      phaseContent = (
        <CounsellingFinishSummary
          queueStatus={queueStatus}
          decision={decision as DecisionType | ''}
          paymentType={paymentType as string}
          insuranceCompany={insuranceCompany}
          schedule={schedule}
          finalPayableAmount={
            estimate.mergedEstimate.finalPayableAmount > 0
              ? estimate.mergedEstimate.finalPayableAmount
              : null
          }
          showCoverageWorkflow={showCoverageWorkflow}
          notRequiredPreAuth={notRequiredPreAuth}
          coverageProgress={coverageProgress}
          counsellorNotes={counsellorNotes}
          patientRemarks={patientRemarks}
          doctorNotes={doctorNotes}
          patientName={sess?.patientName}
          procedureName={selectedVariant?.name ?? doctorRecommendation}
          packageName={estimate.activeTemplate?.name ?? null}
          selectedEye={selectedEye}
          estimateLines={estimate.lines}
          itemizedSubtotal={estimate.itemizedSubtotal}
          discountAmount={estimate.discountAmount}
          baseBeforeDiscount={estimate.baseBeforeDiscount}
        />
      );
    } else {
      phaseContent = (
        <CounsellingWrapupPhase
          counselingSessionId={sessionId}
          counsellorNotes={counsellorNotes}
          setCounsellorNotes={setCounsellorNotes}
          patientRemarks={patientRemarks}
          setPatientRemarks={setPatientRemarks}
          doctorNotes={doctorNotes}
          setDoctorNotes={setDoctorNotes}
          wantToSeeDoctor={wantToSeeDoctor}
          setWantToSeeDoctor={setWantToSeeDoctor}
          interestedToUpgrade={interestedToUpgrade}
          setInterestedToUpgrade={setInterestedToUpgrade}
          notRequiredPreAuth={notRequiredPreAuth}
          setNotRequiredPreAuth={setNotRequiredPreAuth}
          isReadOnly={isReadOnly}
          markDirty={markDirty}
          phaseValidationContext={phaseValidationContext}
        />
      );
    }

    return phaseContent;
  }, [
    activePhase,
    estimate,

    procedureVariants,

    procedureLoading,

    procedureError,

    loadProcedures,

    recommendedVariantIds,

    doctorRecommendation,

    selectedVariantId,

    selectedEye,

    variantSubOption,

    iolOptions,

    selectedIolId,

    isReadOnly,

    isDoneState,

    templates,

    masterCatalog,

    masterCatalogLoading,

    masterCatalogError,

    loadMasterCatalog,

    savedOverrides,

    selectedInvestigations,

    setSelectedEye,

    setSelectedVariantId,

    setSelectedSurgeryId,

    setVariantSubOption,

    setSelectedIolId,

    handleReEvaluate,

    toggleInvestigation,

    setSelectedInvestigations,

    markDirty,

    paymentType,

    setPaymentType,

    insuranceCompany,

    setInsuranceCompany,

    insuranceProviderOptions,

    freeSurgeryReason,

    setFreeSurgeryReason,

    decision,

    setDecision,

    followUpReason,

    setFollowUpReason,

    followUpDate,

    setFollowUpDate,

    schedule,

    setIsScheduleModalOpen,

    counsellorNotes,

    setCounsellorNotes,

    patientRemarks,

    setPatientRemarks,

    doctorNotes,

    setDoctorNotes,

    wantToSeeDoctor,

    setWantToSeeDoctor,

    interestedToUpgrade,

    setInterestedToUpgrade,

    notRequiredPreAuth,

    setNotRequiredPreAuth,

    sessionId,

    phaseValidationContext,

    finishSummaryActive,

    queueStatus,

    showCoverageWorkflow,

    coverageProgress,

  ]);

  const overrideDialogProps = useMemo(
    () => ({
      sessionId,
      isReadOnly,
      isDoneState,
      savedOverrides,
      setSavedOverrides,
      setQueueStatus,
      overridePrice,
      setOverridePrice,
      overrideReason,
      setOverrideReason,
      overrideRemarks,
      setOverrideRemarks,
      overrideRequesterType,
      setOverrideRequesterType,
      overrideStaffName,
      setOverrideStaffName,
      overrideStaffContact,
      setOverrideStaffContact,
      overrideSaving,
      setOverrideSaving,
      overrideError,
      setOverrideError,
      editingOverrideId,
      setEditingOverrideId,
      staffList,
      onEditOverride: handleEditOverride,
      onRemoveOverride: handleRemoveOverride,
    }),
    [
      sessionId,
      isReadOnly,
      isDoneState,
      savedOverrides,
      setSavedOverrides,
      setQueueStatus,
      overridePrice,
      setOverridePrice,
      overrideReason,
      setOverrideReason,
      overrideRemarks,
      setOverrideRemarks,
      overrideRequesterType,
      setOverrideRequesterType,
      overrideStaffName,
      setOverrideStaffName,
      overrideStaffContact,
      setOverrideStaffContact,
      overrideSaving,
      setOverrideSaving,
      overrideError,
      setOverrideError,
      editingOverrideId,
      setEditingOverrideId,
      staffList,
      handleEditOverride,
      handleRemoveOverride,
    ],
  );

  return (

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-0 pt-3">

      {isSurgeryDoneState && (
        <CounsellingInfoAlert variant="info" className="mb-4 shrink-0" title="Surgery completed">
          This session is <strong>read-only</strong> — re-evaluation is not available after surgery.
        </CounsellingInfoAlert>
      )}

      {isDoneState && !finishSummaryActive && (
        <CounsellingInfoAlert
          variant="success"
          className="mb-4 shrink-0"
          title="Session completed"
          action={
            <CounsellingButton
              type="button"
              size="sm"
              onClick={handleReEvaluate}
              className="shrink-0 bg-green-700 hover:bg-green-800"
            >
              Re-evaluate
            </CounsellingButton>
          }
        >
          This session is <strong>read-only</strong>. Click <strong>Re-evaluate</strong> to reopen
          counselling and change the procedure, quote, or decision.
        </CounsellingInfoAlert>
      )}

      {queueStatus === 'AddOnSurgery' && !finishSummaryActive && (
        <CounsellingInfoAlert variant="info" className="mb-4 shrink-0" title="Upgraded case">
          Add-on surgery counselling is complete and <strong>read-only</strong>. Use Re-evaluate from
          a Done session path if the case must be reopened.
        </CounsellingInfoAlert>
      )}



      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CounsellingSessionLayout
        workspaceScroll={activePhase !== 'wrapup' || finishSummaryActive}
        workspace={workspace}
        quotePanel={
          finishSummaryActive ? null : (
          <CounsellingQuotePanel
            estimate={estimate}
            estimateDiscountType={estimate.mergedEstimate.discountType}
            estimateDiscountValue={estimate.mergedEstimate.discountValue}
            estimateDiscountReason={estimate.mergedEstimate.discountReason}
            selectedVariantId={selectedVariantId}
            selectedEye={selectedEye}
            procedureVariants={procedureVariants}
            savedOverrides={savedOverrides}
            isReadOnly={isReadOnly}
            activePhase={activePhase}
            overrideDialogProps={overrideDialogProps}
          />
          )
        }
      />
      </div>

    </div>

  );

}


