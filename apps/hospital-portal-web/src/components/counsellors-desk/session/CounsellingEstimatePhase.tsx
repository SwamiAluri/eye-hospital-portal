'use client';

import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingEstimateBuilderCard } from '@/components/counsellors-desk/session/CounsellingEstimateBuilderCard';
import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import type { MasterCatalogItem, InvestigationItem } from '@/types/counsellors-desk';
import type { UseCounsellingEstimateResult } from '@/hooks/use-counselling-estimate';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';

export interface CounsellingEstimatePhaseProps {
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
  /** True when caller lacks package_templates.read — do not imply catalog load failure. */
  packageTemplatesAccessDenied?: boolean;
  /** Lazy-load package catalog when Quote → Package is opened. */
  requestPackageCatalog?: () => void;
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

/** Wave 2G — Quote phase is a single builder with Procedure | Package | Imaging | Labs tabs. */
export function CounsellingEstimatePhase(props: CounsellingEstimatePhaseProps) {
  return (
    <div
      className={`${counsellingSessionTokens.quoteWorkspace} pb-4`}
      data-testid={counsellingTestIds.quoteWorkspace}
    >
      <CounsellingEstimateBuilderCard {...props} />
    </div>
  );
}
