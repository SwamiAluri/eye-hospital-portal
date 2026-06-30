'use client';

import type { ReactNode } from 'react';
import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import type { MasterCatalogItem, InvestigationItem } from '@/types/counsellors-desk';
import type { UseCounsellingEstimateResult } from '@/hooks/use-counselling-estimate';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { CounsellingEstimateBuilderCard } from '@/components/counsellors-desk/session/CounsellingEstimateBuilderCard';
import { CounsellingInvestigationsCard } from '@/components/counsellors-desk/session/CounsellingInvestigationsCard';

export interface CounsellingEstimatePhaseProps {
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

export function CounsellingEstimatePhase({
  phaseNav,
  selectedInvestigations,
  onToggleInvestigation,
  onClearInvestigations,
  masterCatalogLoading,
  masterCatalogError,
  loadMasterCatalog,
  ...estimateProps
}: CounsellingEstimatePhaseProps) {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <CounsellingEstimateBuilderCard phaseNav={phaseNav} {...estimateProps} />

      <CounsellingInvestigationsCard
        masterCatalog={estimateProps.masterCatalog}
        masterCatalogLoading={masterCatalogLoading}
        masterCatalogError={masterCatalogError}
        onRetryMasterCatalog={loadMasterCatalog}
        selectedInvestigations={selectedInvestigations}
        onToggleInvestigation={onToggleInvestigation}
        onClearAll={onClearInvestigations}
        isReadOnly={estimateProps.isReadOnly}
        isPackageMode={estimateProps.estimate.isPackageMode}
        packageInvestigationIds={estimateProps.estimate.activeTemplate?.investigationIds ?? []}
      />
    </div>
  );
}
