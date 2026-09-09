'use client';

import { priceSuffix } from '@/lib/api/service-catalog.api';
import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import { findCounsellorVariant, type CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import { type CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  CounsellingProceduresWorkspace,
  variantNeedsLensSection,
} from '@/components/counsellors-desk/session/CounsellingProceduresWorkspace';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives';
import { CounsellingEyeBadge } from '@/components/counsellors-desk/session/CounsellingEyeBadge';

export interface QuoteSelectionConfigurePanelProps {
  procedureVariants: CounsellorProcedureVariant[];
  procedureLoading: boolean;
  procedureError: boolean;
  loadProcedures: () => void;
  recommendedVariantIds: string[];
  selectedVariantId: string | null;
  selectedEye: CounsellingEyeOption;
  variantSubOption: string | null;
  iolOptions: IolMasterDto[];
  selectedIolId: string | null;
  isReadOnly: boolean;
  isDoneState: boolean;
  onClearVariant: () => void;
  onSelectVariant: (variantId: string, surgeryId: string, eye: CounsellingEyeOption) => void;
  onSelectEye: (eye: CounsellingEyeOption) => void;
  onEyeInvestigationSync: (eye: CounsellingEyeOption) => void;
  onVariantSubOption: (opt: string | null) => void;
  onSelectIol: (iolId: string | null) => void;
  onReEvaluate: () => void;
  markDirty: () => void;
}

export function QuoteSelectionConfigurePanel({
  onClearVariant,
  ...props
}: QuoteSelectionConfigurePanelProps) {
  const selectedVariant = findCounsellorVariant(props.procedureVariants, props.selectedVariantId);
  if (!selectedVariant) return null;

  const eyeForVariant =
    selectedVariant.priceType === 'BOTH_EYES' ? ('BE' as CounsellingEyeOption) : props.selectedEye;
  const showLens = variantNeedsLensSection(selectedVariant, props.iolOptions);

  const workspaceProps = {
    embedded: true as const,
    ...props,
    onSelectVariant: props.onSelectVariant,
  };

  return (
    <div
      className="space-y-3 rounded-lg border border-counselling-border/60 bg-counselling-muted/15 p-3"
      data-testid={counsellingTestIds.quoteSelectionConfigure}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0" data-testid={counsellingTestIds.quoteSelectedProcedure}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
            Selected
          </p>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-counselling-foreground">
            {sanitizeVariantName(selectedVariant.name)}
            <CounsellingEyeBadge
              eye={eyeForVariant}
              data-testid={counsellingTestIds.quoteSelectedEyeBadge}
            />
          </p>
          <p className="text-xs tabular-nums text-counselling-muted-foreground">
            ₹{selectedVariant.price.toLocaleString('en-IN')}
            {priceSuffix(selectedVariant.priceType)}
          </p>
        </div>
        {!props.isReadOnly ? (
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 text-xs"
            data-testid={counsellingTestIds.quoteChangeProcedure}
            onClick={onClearVariant}
          >
          Clear
        </CounsellingButton>
      ) : null}
    </div>

      {showLens ? (
        <div className="space-y-1.5 border-t border-counselling-border/40 pt-3">
          <p className="text-xs font-medium text-counselling-muted-foreground">Lens / sub-type / IOL</p>
          <CounsellingProceduresWorkspace {...workspaceProps} parts={['lens']} />
        </div>
      ) : null}

      <div className="space-y-1.5 border-t border-counselling-border/40 pt-3">
        <p className="text-xs font-medium text-counselling-muted-foreground">Biometry</p>
        <CounsellingProceduresWorkspace {...workspaceProps} parts={['biometry']} />
      </div>
    </div>
  );
}
