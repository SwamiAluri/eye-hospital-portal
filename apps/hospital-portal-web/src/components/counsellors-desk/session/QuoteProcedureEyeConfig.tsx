'use client';

import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingEyeSelector } from '@/components/counsellors-desk/session/CounsellingEyeSelector';
import { CounsellingSegmented } from '@/components/counsellors-desk/session/primitives';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';

type EstimateTab = 'custom' | 'package';

export interface QuoteProcedureEyeConfigProps {
  selectedEye: CounsellingEyeOption;
  onEyeChange: (eye: CounsellingEyeOption) => void;
  eyeReadOnly?: boolean;
  activeTab: EstimateTab;
  onModeChange: (mode: EstimateTab) => void;
  isReadOnly: boolean;
}

/** Eye + estimate type controls — configuration, not navigation. */
export function QuoteProcedureEyeConfig({
  selectedEye,
  onEyeChange,
  eyeReadOnly = false,
  activeTab,
  onModeChange,
  isReadOnly,
}: QuoteProcedureEyeConfigProps) {
  return (
    <div
      className={counsellingSessionTokens.quoteConfigRow}
      data-testid={counsellingTestIds.quoteConfig}
    >
      <div className={counsellingSessionTokens.quoteConfigControl}>
        <CounsellingEyeSelector
          value={selectedEye}
          onChange={onEyeChange}
          disabled={isReadOnly}
          readOnly={eyeReadOnly}
          variant="stacked"
        />
      </div>
      <div className={counsellingSessionTokens.quoteConfigControl}>
        <p className={counsellingSessionTokens.quoteConfigLabel}>Estimate type</p>
        <CounsellingSegmented
          options={['custom', 'package'] as const}
          selected={activeTab}
          onChange={(v) => onModeChange(v as EstimateTab)}
          labels={{
            custom: counsellingCopy.customProcedure,
            package: counsellingCopy.package,
          }}
          optionTestIds={{
            custom: counsellingTestIds.tabCustom,
            package: counsellingTestIds.tabPackage,
          }}
          data-testid="counselling-estimate-mode"
          className="w-full"
          variant="mode"
          disabled={isReadOnly}
        />
      </div>
    </div>
  );
}
