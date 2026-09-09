'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import type { InvestigationItem, MasterCatalogItem } from '@/types/counsellors-desk';
import type { UseCounsellingEstimateResult } from '@/hooks/use-counselling-estimate';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSectionIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  CounsellingAlertDialog,
  CounsellingAlertDialogAction,
  CounsellingAlertDialogCancel,
  CounsellingAlertDialogContent,
  CounsellingAlertDialogDescription,
  CounsellingAlertDialogFooter,
  CounsellingAlertDialogHeader,
  CounsellingAlertDialogTitle,
  CounsellingEmptyState,
} from '@/components/counsellors-desk/session/primitives';
import { QuoteModeNav, type QuoteModeTab } from '@/components/counsellors-desk/session/QuoteModeNav';
import { QuoteProcedureCatalogGrid } from '@/components/counsellors-desk/session/QuoteProcedureCatalogGrid';
import { QuoteSelectionConfigurePanel } from '@/components/counsellors-desk/session/QuoteSelectionConfigurePanel';
import { PricingModeStatusStrip } from '@/components/counsellors-desk/session/PricingModeStatusStrip';
import { CounsellingPackageWorkspace } from '@/components/counsellors-desk/session/CounsellingPackageWorkspace';
import { CounsellingInvestigationsWorkspace } from '@/components/counsellors-desk/session/CounsellingInvestigationsWorkspace';

interface PendingProcedurePick {
  variantId: string;
  surgeryId: string;
  eye: CounsellingEyeOption;
}

export interface CounsellingEstimateBuilderCardProps {
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
  masterCatalogLoading?: boolean;
  masterCatalogError?: boolean;
  loadMasterCatalog?: () => void;
  quotedProcedurePrice?: number | null;
  selectedInvestigations: Map<string, InvestigationItem>;
  onSelectVariant: (variantId: string, surgeryId: string, eye: CounsellingEyeOption) => void;
  onClearVariant: () => void;
  onSelectEye: (eye: CounsellingEyeOption) => void;
  onEyeInvestigationSync: (eye: CounsellingEyeOption) => void;
  onVariantSubOption: (opt: string | null) => void;
  onSelectIol: (iolId: string | null) => void;
  onReEvaluate: () => void;
  onSwitchToRecommendedProcedure: (variantId: string, eye: CounsellingEyeOption) => void;
  onToggleInvestigation: (item: MasterCatalogItem) => void;
  onClearInvestigations: () => void;
  markDirty: () => void;
}

export function CounsellingEstimateBuilderCard({
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
  masterCatalogLoading,
  masterCatalogError,
  loadMasterCatalog,
  selectedInvestigations,
  onSelectVariant,
  onClearVariant,
  onSelectEye,
  onEyeInvestigationSync,
  onVariantSubOption,
  onSelectIol,
  onReEvaluate,
  onSwitchToRecommendedProcedure,
  onToggleInvestigation,
  onClearInvestigations,
  markDirty,
}: CounsellingEstimateBuilderCardProps) {
  const [activeTab, setActiveTab] = useState<QuoteModeTab>(estimate.isPackageMode ? 'package' : 'custom');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingPickRef = useRef<PendingProcedurePick | null>(null);
  const prevTemplateIdRef = useRef<string | null>(estimate.activeTemplate?.id ?? null);

  const hasBaseSelection = Boolean(selectedVariantId || estimate.activeTemplate);
  const investigationTabsEnabled = hasBaseSelection;

  useEffect(() => {
    const templateId = estimate.activeTemplate?.id ?? null;
    if (templateId && templateId !== prevTemplateIdRef.current) {
      setActiveTab('package');
    }
    prevTemplateIdRef.current = templateId;
  }, [estimate.activeTemplate?.id]);

  useEffect(() => {
    if (!investigationTabsEnabled && (activeTab === 'imaging' || activeTab === 'labs')) {
      setActiveTab(estimate.isPackageMode ? 'package' : 'custom');
    }
  }, [activeTab, estimate.isPackageMode, investigationTabsEnabled]);

  const handleEyeChange = useCallback(
    (eye: CounsellingEyeOption) => {
      onSelectEye(eye);
      onEyeInvestigationSync(eye);
      // Package mode: eye must not re-enter procedure-select (clears package + toast spam).
      if (selectedVariantId && !estimate.isPackageMode) {
        onSelectVariant(selectedVariantId, `type-${selectedVariantId}-${eye}`, eye);
      }
      markDirty();
    },
    [
      estimate.isPackageMode,
      markDirty,
      onEyeInvestigationSync,
      onSelectEye,
      onSelectVariant,
      selectedVariantId,
    ],
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

  const handleSwitchToCustom = useCallback(
    (opts?: { clearSelection?: boolean }) => {
      if (isReadOnly) return;
      estimate.setEstimateMode('custom');
      setActiveTab('custom');
      if (opts?.clearSelection) {
        onClearVariant();
        onSelectIol(null);
      }
    },
    [estimate, isReadOnly, onClearVariant, onSelectIol],
  );

  const handleSelectPackage = useCallback(
    (templateId: string) => {
      if (isReadOnly) return;
      estimate.selectPackage(templateId);
      setActiveTab('package');
    },
    [estimate, isReadOnly],
  );

  const handleClearSelection = useCallback(() => {
    if (isReadOnly) return;
    if (estimate.isPackageMode) {
      estimate.setEstimateMode('custom');
    }
    onClearVariant();
    onSelectIol(null);
    setActiveTab((tab) => (tab === 'imaging' || tab === 'labs' ? 'custom' : tab));
    markDirty();
  }, [estimate, isReadOnly, markDirty, onClearVariant, onSelectIol]);

  const handleModeChange = useCallback(
    (mode: QuoteModeTab) => {
      if ((mode === 'imaging' || mode === 'labs') && !investigationTabsEnabled) return;
      if (mode === 'custom' && estimate.isPackageMode) {
        // Leaving package via tab: force re-pick so custom and package never feel dual-active
        handleSwitchToCustom({ clearSelection: true });
        return;
      }
      setActiveTab(mode);
    },
    [estimate.isPackageMode, handleSwitchToCustom, investigationTabsEnabled],
  );

  const showPackageStatus = estimate.isPackageMode && !!estimate.activeTemplate;
  const showCustomSelected =
    activeTab === 'custom' && !!selectedVariantId && !estimate.isPackageMode;
  const showPackageSelected = activeTab === 'package' && !!estimate.activeTemplate;

  const configureProps = useMemo(
    () => ({
      procedureVariants,
      procedureLoading,
      procedureError,
      loadProcedures,
      recommendedVariantIds,
      selectedVariantId,
      selectedEye,
      variantSubOption,
      iolOptions,
      selectedIolId,
      isReadOnly,
      isDoneState,
      onClearVariant: handleClearSelection,
      onSelectVariant: handleSelectVariant,
      onSelectEye,
      onEyeInvestigationSync,
      onVariantSubOption,
      onSelectIol,
      onReEvaluate,
      markDirty,
    }),
    [
      procedureVariants,
      procedureLoading,
      procedureError,
      loadProcedures,
      recommendedVariantIds,
      selectedVariantId,
      selectedEye,
      variantSubOption,
      iolOptions,
      selectedIolId,
      isReadOnly,
      isDoneState,
      handleClearSelection,
      handleSelectVariant,
      onSelectEye,
      onEyeInvestigationSync,
      onVariantSubOption,
      onSelectIol,
      onReEvaluate,
      markDirty,
    ],
  );

  const investigationProps = {
    embedded: true as const,
    masterCatalog,
    masterCatalogLoading,
    masterCatalogError,
    onRetryMasterCatalog: loadMasterCatalog,
    selectedInvestigations,
    onToggleInvestigation,
    onClearAll: onClearInvestigations,
    isReadOnly,
    isPackageMode: estimate.isPackageMode,
    packageInvestigationIds: estimate.activeTemplate?.investigationIds ?? [],
    hideSectionChrome: true,
  };

  return (
    <>
      <div id={counsellingSectionIds.estimateBuilder} className="scroll-mt-24 space-y-4">
        <QuoteModeNav
          activeTab={activeTab}
          onModeChange={handleModeChange}
          selectedEye={selectedEye}
          onEyeChange={handleEyeChange}
          isReadOnly={isReadOnly}
          investigationTabsEnabled={investigationTabsEnabled}
        />

        {showPackageStatus && activeTab === 'package' ? (
          <PricingModeStatusStrip
            isPackageMode={estimate.isPackageMode}
            activeTemplate={estimate.activeTemplate}
            selectedVariantId={selectedVariantId}
            selectedEye={selectedEye}
            procedureVariants={procedureVariants}
            onSwitchToCustom={() => handleSwitchToCustom()}
            onClear={handleClearSelection}
          />
        ) : null}

        {activeTab === 'custom' ? (
          showCustomSelected ? (
            <QuoteSelectionConfigurePanel {...configureProps} />
          ) : (
            <QuoteProcedureCatalogGrid
              procedureVariants={procedureVariants}
              procedureLoading={procedureLoading}
              procedureError={procedureError}
              loadProcedures={loadProcedures}
              recommendedVariantIds={recommendedVariantIds}
              selectedVariantId={selectedVariantId}
              selectedEye={selectedEye}
              isReadOnly={isReadOnly}
              isDoneState={isDoneState}
              onPickVariant={handleSelectVariant}
              onReEvaluate={onReEvaluate}
              markDirty={markDirty}
            />
          )
        ) : null}

        {activeTab === 'package' ? (
          <>
            <CounsellingPackageWorkspace
              embedded
              collapseBrowseWhenSelected
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
            {showPackageSelected ? <QuoteSelectionConfigurePanel {...configureProps} /> : null}
          </>
        ) : null}

        {activeTab === 'imaging' ? (
          investigationTabsEnabled ? (
            <CounsellingInvestigationsWorkspace {...investigationProps} forceCategory="imaging" />
          ) : (
            <CounsellingEmptyState
              compact
              title={counsellingCopy.imaging}
            />
          )
        ) : null}

        {activeTab === 'labs' ? (
          investigationTabsEnabled ? (
            <CounsellingInvestigationsWorkspace {...investigationProps} forceCategory="lab" />
          ) : (
            <CounsellingEmptyState
              compact
              title={counsellingCopy.labs}
            />
          )
        ) : null}
      </div>

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
            <CounsellingAlertDialogCancel
              onClick={() => {
                pendingPickRef.current = null;
              }}
            >
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
