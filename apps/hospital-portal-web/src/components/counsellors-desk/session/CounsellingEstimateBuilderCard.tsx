'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import type { MasterCatalogItem } from '@/types/counsellors-desk';
import type { UseCounsellingEstimateResult } from '@/hooks/use-counselling-estimate';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSectionIds, counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  CounsellingAlertDialog,
  CounsellingAlertDialogAction,
  CounsellingAlertDialogCancel,
  CounsellingAlertDialogContent,
  CounsellingAlertDialogDescription,
  CounsellingAlertDialogFooter,
  CounsellingAlertDialogHeader,
  CounsellingAlertDialogTitle,
  CounsellingCard,
  CounsellingCardContent,
  CounsellingCardHeader,
  CounsellingCardTitle,
  CounsellingTabs,
  CounsellingTabsContent,
  CounsellingTabsList,
  CounsellingTabsTrigger,
} from '@/components/counsellors-desk/session/primitives';
import { CounsellingEyeSelector } from '@/components/counsellors-desk/session/CounsellingEyeSelector';
import { PricingModeStatusStrip } from '@/components/counsellors-desk/session/PricingModeStatusStrip';
import { ProcedureReadOnlyMirror } from '@/components/counsellors-desk/session/ProcedureReadOnlyMirror';
import { CounsellingProceduresWorkspace } from '@/components/counsellors-desk/session/CounsellingProceduresWorkspace';
import { CounsellingPackageWorkspace } from '@/components/counsellors-desk/session/CounsellingPackageWorkspace';

type EstimateTab = 'custom' | 'package';

interface PendingProcedurePick {
  variantId: string;
  surgeryId: string;
  eye: CounsellingEyeOption;
}

export interface CounsellingEstimateBuilderCardProps {
  phaseNav?: ReactNode;
  estimate: UseCounsellingEstimateResult;
  procedureVariants: CounsellorProcedureVariant[];
  procedureLoading: boolean;
  procedureError: boolean;
  loadProcedures: () => void;
  recommendedVariantIds: string[];
  doctorRecommendationName: string | null;
  selectedVariantId: string | null;
  selectedEye: CounsellingEyeOption;
  variantSubOption: string | null;
  iolOptions: IolMasterDto[];
  selectedIolId: string | null;
  isReadOnly: boolean;
  isDoneState: boolean;
  packageTemplates: CounsellingPackageTemplate[];
  masterCatalog: {
    imaging: MasterCatalogItem[];
    scan: MasterCatalogItem[];
    lab: MasterCatalogItem[];
  };
  quotedProcedurePrice?: number | null;
  onSelectVariant: (variantId: string, surgeryId: string, eye: CounsellingEyeOption) => void;
  onClearVariant: () => void;
  onSelectEye: (eye: CounsellingEyeOption) => void;
  onEyeInvestigationSync: (eye: CounsellingEyeOption) => void;
  onVariantSubOption: (opt: string | null) => void;
  onSelectIol: (iolId: string | null) => void;
  onReEvaluate: () => void;
  onSwitchToRecommendedProcedure: (variantId: string, eye: CounsellingEyeOption) => void;
  markDirty: () => void;
}

export function CounsellingEstimateBuilderCard({
  phaseNav,
  estimate,
  procedureVariants,
  procedureLoading,
  procedureError,
  loadProcedures,
  recommendedVariantIds,
  doctorRecommendationName,
  selectedVariantId,
  selectedEye,
  variantSubOption,
  iolOptions,
  selectedIolId,
  isReadOnly,
  isDoneState,
  packageTemplates,
  masterCatalog,
  quotedProcedurePrice = null,
  onSelectVariant,
  onClearVariant,
  onSelectEye,
  onEyeInvestigationSync,
  onVariantSubOption,
  onSelectIol,
  onReEvaluate,
  onSwitchToRecommendedProcedure,
  markDirty,
}: CounsellingEstimateBuilderCardProps) {
  const [activeTab, setActiveTab] = useState<EstimateTab>(
    estimate.isPackageMode ? 'package' : 'custom',
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingPickRef = useRef<PendingProcedurePick | null>(null);
  const prevTemplateIdRef = useRef<string | null>(estimate.activeTemplate?.id ?? null);

  useEffect(() => {
    const templateId = estimate.activeTemplate?.id ?? null;
    if (templateId && templateId !== prevTemplateIdRef.current) {
      setActiveTab('package');
    }
    prevTemplateIdRef.current = templateId;
  }, [estimate.activeTemplate?.id]);

  const handleEyeChange = useCallback(
    (eye: CounsellingEyeOption) => {
      onSelectEye(eye);
      onEyeInvestigationSync(eye);
      if (selectedVariantId) {
        onSelectVariant(selectedVariantId, `type-${selectedVariantId}-${eye}`, eye);
      }
      markDirty();
    },
    [markDirty, onEyeInvestigationSync, onSelectEye, onSelectVariant, selectedVariantId],
  );

  const applyProcedurePick = useCallback(
    (pick: PendingProcedurePick) => {
      onSelectVariant(pick.variantId, pick.surgeryId, pick.eye);
    },
    [onSelectVariant],
  );

  const handleSelectVariant = useCallback(
    (variantId: string, surgeryId: string, eye: CounsellingEyeOption) => {
      if (estimate.isPackageMode && !isReadOnly) {
        pendingPickRef.current = { variantId, surgeryId, eye };
        setConfirmOpen(true);
        return;
      }
      applyProcedurePick({ variantId, surgeryId, eye });
    },
    [applyProcedurePick, estimate.isPackageMode, isReadOnly],
  );

  const handleConfirmSwitchToCustom = useCallback(() => {
    const pick = pendingPickRef.current;
    pendingPickRef.current = null;
    setConfirmOpen(false);
    estimate.setEstimateMode('custom');
    setActiveTab('custom');
    if (pick) applyProcedurePick(pick);
  }, [applyProcedurePick, estimate]);

  const handleSwitchToCustom = useCallback(() => {
    if (isReadOnly) return;
    estimate.setEstimateMode('custom');
    setActiveTab('custom');
  }, [estimate, isReadOnly]);

  const handleSelectPackage = useCallback(
    (templateId: string) => {
      if (isReadOnly) return;
      estimate.selectPackage(templateId);
      setActiveTab('package');
    },
    [estimate, isReadOnly],
  );

  const handleModeChange = useCallback(
    (mode: EstimateTab) => {
      setActiveTab(mode);
      if (mode === 'custom' && estimate.isPackageMode) {
        handleSwitchToCustom();
      }
    },
    [estimate.isPackageMode, handleSwitchToCustom],
  );

  const eyeReadOnly = estimate.isPackageMode && !!estimate.activeTemplate;
  const showPackageStatus = estimate.isPackageMode && !!estimate.activeTemplate;

  return (
    <>
      <CounsellingCard
        id={counsellingSectionIds.estimateBuilder}
        className={`${counsellingSessionTokens.card} scroll-mt-24`}
      >
        <CounsellingCardHeader className={counsellingSessionTokens.cardHeader}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CounsellingCardTitle className={counsellingSessionTokens.sectionTitle}>
              {counsellingCopy.buildEstimate}
            </CounsellingCardTitle>
            <CounsellingEyeSelector
              value={selectedEye}
              onChange={handleEyeChange}
              disabled={isReadOnly}
              readOnly={eyeReadOnly}
              variant="inline"
              className="shrink-0"
            />
          </div>
        </CounsellingCardHeader>

        <CounsellingCardContent className={`${counsellingSessionTokens.cardBody} space-y-3`}>
          {phaseNav}
          <CounsellingTabs value={activeTab} onValueChange={(v) => handleModeChange(v as EstimateTab)}>
            <CounsellingTabsList className="grid h-9 w-full grid-cols-2">
              <CounsellingTabsTrigger value="custom" data-testid={counsellingTestIds.tabCustom} className="text-sm">
                {counsellingCopy.customProcedure}
              </CounsellingTabsTrigger>
              <CounsellingTabsTrigger value="package" data-testid={counsellingTestIds.tabPackage} className="text-sm">
                {counsellingCopy.package}
              </CounsellingTabsTrigger>
            </CounsellingTabsList>

            {showPackageStatus && (
              <PricingModeStatusStrip
                isPackageMode={estimate.isPackageMode}
                activeTemplate={estimate.activeTemplate}
                selectedVariantId={selectedVariantId}
                selectedEye={selectedEye}
                procedureVariants={procedureVariants}
                onSwitchToCustom={handleSwitchToCustom}
              />
            )}

            <CounsellingTabsContent value="custom" className="mt-3">
              {estimate.isPackageMode ? (
                <ProcedureReadOnlyMirror
                  procedureVariants={procedureVariants}
                  selectedVariantId={selectedVariantId}
                  selectedEye={selectedEye}
                  variantSubOption={variantSubOption}
                  selectedIolId={selectedIolId}
                  iolOptions={iolOptions}
                  activeTemplate={estimate.activeTemplate}
                  isReadOnly={isReadOnly}
                  onSwitchToCustom={handleSwitchToCustom}
                />
              ) : (
                <CounsellingProceduresWorkspace
                  embedded
                  procedureVariants={procedureVariants}
                  procedureLoading={procedureLoading}
                  procedureError={procedureError}
                  loadProcedures={loadProcedures}
                  recommendedVariantIds={recommendedVariantIds}
                  selectedVariantId={selectedVariantId}
                  selectedEye={selectedEye}
                  variantSubOption={variantSubOption}
                  iolOptions={iolOptions}
                  selectedIolId={selectedIolId}
                  isReadOnly={isReadOnly}
                  isDoneState={isDoneState}
                  onSelectVariant={handleSelectVariant}
                  onClearVariant={onClearVariant}
                  onSelectEye={onSelectEye}
                  onEyeInvestigationSync={onEyeInvestigationSync}
                  onVariantSubOption={onVariantSubOption}
                  onSelectIol={onSelectIol}
                  onReEvaluate={onReEvaluate}
                  markDirty={markDirty}
                  quotedProcedurePrice={quotedProcedurePrice}
                />
              )}
            </CounsellingTabsContent>

            <CounsellingTabsContent value="package" className="mt-3">
              <CounsellingPackageWorkspace
                embedded
                estimate={estimate}
                packageTemplates={packageTemplates}
                procedureVariants={procedureVariants}
                masterCatalog={masterCatalog}
                recommendedVariantIds={recommendedVariantIds}
                doctorRecommendationName={doctorRecommendationName}
                selectedVariantId={selectedVariantId}
                selectedEye={selectedEye}
                isReadOnly={isReadOnly}
                onSelectPackage={handleSelectPackage}
                onSwitchToRecommendedProcedure={onSwitchToRecommendedProcedure}
              />
            </CounsellingTabsContent>
          </CounsellingTabs>
        </CounsellingCardContent>
      </CounsellingCard>

      <CounsellingAlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <CounsellingAlertDialogContent>
          <CounsellingAlertDialogHeader>
            <CounsellingAlertDialogTitle>Switch to custom pricing?</CounsellingAlertDialogTitle>
            <CounsellingAlertDialogDescription>
              Selecting a different procedure will clear the active package
              {estimate.activeTemplate ? ` (“${estimate.activeTemplate.name}”)` : ''}.
            </CounsellingAlertDialogDescription>
          </CounsellingAlertDialogHeader>
          <CounsellingAlertDialogFooter>
            <CounsellingAlertDialogCancel onClick={() => { pendingPickRef.current = null; }}>
              Cancel
            </CounsellingAlertDialogCancel>
            <CounsellingAlertDialogAction onClick={handleConfirmSwitchToCustom}>
              Switch to custom
            </CounsellingAlertDialogAction>
          </CounsellingAlertDialogFooter>
        </CounsellingAlertDialogContent>
      </CounsellingAlertDialog>
    </>
  );
}
