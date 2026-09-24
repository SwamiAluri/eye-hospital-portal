'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import {
  findCounsellorVariant,
  type CounsellorProcedureVariant,
} from '@/lib/master-data/clinical-catalog-master';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  CounsellingButton,
  CounsellingInfoAlert,
  CounsellingToggleGroup,
  CounsellingToggleGroupItem,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';
import { useCounsellingSession } from '@/components/counsellors-desk/session/CounsellingSessionContext';
import { useInvalidateCounsellorsDesk } from '@/hooks/use-counsellors-desk-queries';
import { biometryMissingEyePhrase } from '@/lib/ip-management/iol-diopter';
import { loadSuggestedIolPower } from '@/lib/ip-management/clinical-evaluation-prefill';
import {
  getSessionConcurrencyMessage,
  isSessionConcurrencyConflict,
} from '@/lib/counsellors-desk/session-concurrency';

export type ProcedureWorkspacePart = 'lens' | 'biometry';

export function variantUsesLensSubOptions(
  variant: CounsellorProcedureVariant | undefined,
): boolean {
  return (variant?.subOptions?.length ?? 0) > 0;
}

export function variantNeedsLensSection(
  variant: CounsellorProcedureVariant | undefined,
  iolOptions: IolMasterDto[],
): boolean {
  if (!variant) return false;
  // Prefer explicit sub-options (Alcon/Hoya, Vivity/PureSee, …) over catalog IOL picker.
  // EDOF and similar variants often have BOTH hasIolOptions=true and subOptions set;
  // the counsellor-facing choice is the sub-option label persisted as variantSubOption.
  if (variantUsesLensSubOptions(variant)) return true;
  return iolOptions.length > 0;
}

function CounsellorBiometryStatus({
  selectedEye,
  isReadOnly,
}: {
  selectedEye: CounsellingEyeOption;
  isReadOnly: boolean;
}) {
  const { sessionId, session, updateSessionVersion } = useCounsellingSession();
  const { invalidateSession } = useInvalidateCounsellorsDesk();
  const [missing, setMissing] = useState(false);
  const [available, setAvailable] = useState(false);
  const [plannedPower, setPlannedPower] = useState<string | null>(session?.iolPower ?? null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const patientId = session?.patientId;
    if (!patientId) return;
    let cancelled = false;
    void (async () => {
      const power = await loadSuggestedIolPower(patientId, selectedEye);
      if (cancelled) return;
      setMissing(!power);
      setAvailable(!!power);
      if (power) setPlannedPower(power);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.patientId, selectedEye]);

  async function refresh() {
    setRefreshing(true);
    try {
      const snap = await counsellorsDeskApi.refreshSessionFromOpd(sessionId, session?.version);
      setMissing(snap.biometryMissing === true);
      setAvailable(snap.biometryMissing !== true);
      if (snap.iolPower) setPlannedPower(snap.iolPower);
      updateSessionVersion(snap.version);
      invalidateSession(sessionId);
      if (snap.biometryMissing) {
        toast.error(`No biometry on file for the ${snap.eyePhrase ?? biometryMissingEyePhrase(selectedEye)}.`);
      } else {
        toast.success('Copied latest OPD biometry onto this session.');
      }
    } catch (err) {
      // Phase 3I Slice 7 (PD-S7-06): stop on 409 — never overwrite; no auto-retry.
      if (isSessionConcurrencyConflict(err)) {
        toast.error(getSessionConcurrencyMessage(err));
        invalidateSession(sessionId);
        return;
      }
      toast.error('Could not refresh from OPD.');
    } finally {
      setRefreshing(false);
    }
  }

  const refreshButton = (
    <CounsellingButton
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 shrink-0 px-2 text-xs"
      data-testid={counsellingTestIds.refreshFromOpd}
      disabled={isReadOnly || refreshing}
      onClick={() => void refresh()}
    >
      {refreshing ? 'Refreshing…' : 'Refresh from OPD'}
    </CounsellingButton>
  );

  if (missing) {
    return (
      <div data-testid={counsellingTestIds.quoteBiometryStatus}>
        <CounsellingInfoAlert
          variant="warning"
          title={`Biometry unavailable for ${biometryMissingEyePhrase(selectedEye)}`}
          action={refreshButton}
        >
          Package can still be selected without biometry on file.
        </CounsellingInfoAlert>
      </div>
    );
  }

  if (available) {
    return (
      <div data-testid={counsellingTestIds.quoteBiometryStatus}>
        <CounsellingInfoAlert variant="info" title="Biometry available">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {plannedPower ? (
                <>
                  Planned IOL power <span className="font-semibold">{plannedPower}</span>
                </>
              ) : (
                'Latest OPD biometry is on file for this eye.'
              )}
            </span>
            {refreshButton}
          </div>
        </CounsellingInfoAlert>
      </div>
    );
  }

  return (
    <p className={counsellingSessionTokens.quoteBiometryStatus} data-testid={counsellingTestIds.quoteBiometryStatus}>
      Checking biometry…
    </p>
  );
}

export interface CounsellingProceduresWorkspaceProps {
  embedded?: boolean;
  parts?: ProcedureWorkspacePart[];
  procedureVariants: CounsellorProcedureVariant[];
  selectedVariantId: string | null;
  selectedEye: CounsellingEyeOption;
  variantSubOption: string | null;
  iolOptions: IolMasterDto[];
  selectedIolId: string | null;
  isReadOnly: boolean;
  onVariantSubOption: (opt: string | null) => void;
  onSelectIol: (iolId: string | null) => void;
  markDirty: () => void;
  /** Retained for API compatibility with configure panel spread props. */
  procedureLoading?: boolean;
  procedureError?: boolean;
  loadProcedures?: () => void;
  recommendedVariantIds?: string[];
  isDoneState?: boolean;
  onSelectVariant?: (variantId: string, surgeryId: string, eye: CounsellingEyeOption) => void;
  onClearVariant?: () => void;
  onSelectEye?: (eye: CounsellingEyeOption) => void;
  onEyeInvestigationSync?: (eye: CounsellingEyeOption) => void;
  onReEvaluate?: () => void;
}

export function CounsellingProceduresWorkspace({
  embedded = false,
  parts = ['lens', 'biometry'],
  procedureVariants,
  selectedVariantId,
  selectedEye,
  variantSubOption,
  iolOptions,
  selectedIolId,
  isReadOnly,
  onVariantSubOption,
  onSelectIol,
  markDirty,
}: CounsellingProceduresWorkspaceProps) {
  const showLens = parts.includes('lens');
  const showBiometry = parts.includes('biometry');
  const selectedVariant = findCounsellorVariant(procedureVariants, selectedVariantId);
  const useSubOptions = variantUsesLensSubOptions(selectedVariant);

  const lensSubtypeBlock =
    selectedVariant && useSubOptions ? (
      <div className="space-y-1.5">
        <CounsellingToggleGroup
          type="single"
          value={variantSubOption ?? ''}
          onValueChange={(v) => {
            onVariantSubOption(v || null);
            markDirty();
          }}
          className="flex flex-wrap gap-1"
          aria-invalid={!variantSubOption}
        >
          {selectedVariant.subOptions!.map((opt) => (
            <CounsellingToggleGroupItem
              key={opt}
              value={opt}
              disabled={isReadOnly}
              className={cn('text-xs', !variantSubOption && 'ring-1 ring-amber-300/80')}
              data-testid={`counselling-subtype-${opt.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {opt}
            </CounsellingToggleGroupItem>
          ))}
        </CounsellingToggleGroup>
        {!variantSubOption ? (
          <p className="text-xs text-amber-800" role="alert">
            Select a lens / sub-type before saving.
          </p>
        ) : null}
      </div>
    ) : null;

  const iolBlock =
    selectedVariant && !useSubOptions && iolOptions.length > 0 ? (
      <CounsellingToggleGroup
        type="single"
        value={selectedIolId ?? ''}
        onValueChange={(v) => {
          onSelectIol(v || null);
          markDirty();
        }}
        disabled={isReadOnly}
        className="flex flex-wrap gap-1"
      >
        {iolOptions.map((iol) => (
          <CounsellingToggleGroupItem
            key={iol.id}
            value={iol.id}
            disabled={isReadOnly}
            className="text-xs"
            data-testid={`counselling-iol-${iol.id}`}
          >
            {sanitizeVariantName(iol.brandManufacturer || iol.modelName)}
          </CounsellingToggleGroupItem>
        ))}
      </CounsellingToggleGroup>
    ) : null;

  const lensContent = lensSubtypeBlock ?? iolBlock;

  const content = (
    <>
      {showLens ? lensContent : null}
      {showBiometry ? <CounsellorBiometryStatus selectedEye={selectedEye} isReadOnly={isReadOnly} /> : null}
    </>
  );

  if (embedded) return content;

  return (
    <section id="counselling-step-1" className="scroll-mt-24 p-4">
      {content}
    </section>
  );
}
