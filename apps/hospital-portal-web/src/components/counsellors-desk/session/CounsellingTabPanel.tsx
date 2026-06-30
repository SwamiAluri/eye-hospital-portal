'use client';

import { useMemo, type ReactNode } from 'react';

import type { CounsellingSession, CombinedPaymentType, DecisionType } from '@/types/counsellors-desk';

import type { IolMasterDto } from '@/lib/api/service-catalog.api';

import { CounsellingPhaseNav } from '@/components/counsellors-desk/session/CounsellingPhaseNav';

import { CounsellingSessionLayout } from '@/components/counsellors-desk/session/CounsellingSessionLayout';

import { CounsellingQuotePanel } from '@/components/counsellors-desk/session/CounsellingQuotePanel';

import { CounsellingEstimatePhase } from '@/components/counsellors-desk/session/CounsellingEstimatePhase';

import { CounsellingDecisionPhase } from '@/components/counsellors-desk/session/CounsellingDecisionPhase';

import { CounsellingWrapupPhase } from '@/components/counsellors-desk/session/CounsellingWrapupPhase';

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

    visitedPhases,

    phaseCompletion,

    goToPhase,

    canGoToPhase,

    setActiveMainTab,

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

  const phaseNav = useMemo(
    () => (
      <CounsellingPhaseNav
        activePhase={activePhase}
        visitedPhases={visitedPhases}
        phaseCompletion={phaseCompletion}
        onPhaseSelect={goToPhase}
        canGoToPhase={canGoToPhase}
      />
    ),
    [activePhase, visitedPhases, phaseCompletion, goToPhase, canGoToPhase],
  );

  const workspace = useMemo(() => {

    if (activePhase === 'estimate') {

      return (

        <CounsellingEstimatePhase
          phaseNav={phaseNav}
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

            setSelectedVariantId(variantId);

            setSelectedSurgeryId(surgeryId);

            setVariantSubOption(null);

          }}

          onClearVariant={() => {

            setSelectedVariantId(null);

            setSelectedSurgeryId(null);

            setVariantSubOption(null);

          }}

          onSelectEye={setSelectedEye}

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

    }



    if (activePhase === 'decision') {

      return (

        <CounsellingDecisionPhase
          phaseNav={phaseNav}
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

          onOpenCoverageTab={() => setActiveMainTab('coverage')}

        />

      );

    }



    return (

      <CounsellingWrapupPhase
        phaseNav={phaseNav}
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

      />

    );

  }, [

    activePhase,

    phaseNav,

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

    setActiveMainTab,

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

    <div className={counsellingSessionTokens.page + ' flex min-h-0 flex-1 flex-col overflow-hidden p-5'}>

      {isSurgeryDoneState && (
        <CounsellingInfoAlert variant="info" className="mb-4 shrink-0" title="Surgery completed">
          This session is <strong>read-only</strong> — re-evaluation is not available after surgery.
        </CounsellingInfoAlert>
      )}

      {isDoneState && (
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
          You can update the package/price or reschedule below. To change the procedure, click{' '}
          <strong>Re-evaluate</strong> — this will reopen the session.
        </CounsellingInfoAlert>
      )}

      {queueStatus === 'AddOnSurgery' && (
        <CounsellingInfoAlert variant="info" className="mb-4 shrink-0" title="Upgraded case">
          Package was upgraded on this completed session. Update the new package details and save to
          confirm the add-on surgery.
        </CounsellingInfoAlert>
      )}



      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CounsellingSessionLayout workspace={workspace} quotePanel={

          <CounsellingQuotePanel

            estimate={estimate}

            estimateDiscountType={estimate.mergedEstimate.discountType}

            estimateDiscountValue={estimate.mergedEstimate.discountValue}

            estimateDiscountReason={estimate.mergedEstimate.discountReason}

            selectedVariantId={selectedVariantId}

            procedureVariants={procedureVariants}

            savedOverrides={savedOverrides}

            isReadOnly={isReadOnly}

            activePhase={activePhase}

            onGoToBuildQuote={() => goToPhase('estimate')}

            overrideDialogProps={overrideDialogProps}

          />

        }

      />

      </div>

    </div>

  );

}


