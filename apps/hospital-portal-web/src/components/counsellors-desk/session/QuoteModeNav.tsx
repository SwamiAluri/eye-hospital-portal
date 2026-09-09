'use client';

import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { CounsellingEyeSelector } from '@/components/counsellors-desk/session/CounsellingEyeSelector';
import { cn } from '@/lib/utils';

export type QuoteModeTab = 'custom' | 'package' | 'imaging' | 'labs';

export interface QuoteModeNavProps {
  activeTab: QuoteModeTab;
  onModeChange: (tab: QuoteModeTab) => void;
  selectedEye: CounsellingEyeOption;
  onEyeChange: (eye: CounsellingEyeOption) => void;
  eyeReadOnly?: boolean;
  isReadOnly?: boolean;
  investigationTabsEnabled?: boolean;
}

export function QuoteModeNav({
  activeTab,
  onModeChange,
  selectedEye,
  onEyeChange,
  eyeReadOnly = false,
  isReadOnly = false,
  investigationTabsEnabled = true,
}: QuoteModeNavProps) {
  const tabs: {
    id: QuoteModeTab;
    label: string;
    testId: string;
    disabled?: boolean;
  }[] = [
    { id: 'custom', label: counsellingCopy.customProcedure, testId: counsellingTestIds.tabCustom },
    { id: 'package', label: counsellingCopy.package, testId: counsellingTestIds.tabPackage },
    {
      id: 'imaging',
      label: counsellingCopy.imaging,
      testId: counsellingTestIds.tabImaging,
      disabled: !investigationTabsEnabled,
    },
    {
      id: 'labs',
      label: counsellingCopy.labs,
      testId: counsellingTestIds.tabLab,
      disabled: !investigationTabsEnabled,
    },
  ];

  return (
    <div
      className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"
      data-testid={counsellingTestIds.quoteModeNav}
    >
      <nav aria-label="Quote workspace" className="min-w-0 w-full flex-1">
        <ol className={counsellingSessionTokens.pillTabTrack}>
          {tabs.map(({ id, label, testId, disabled }) => {
            const isActive = activeTab === id;
            const isDisabled = isReadOnly || !!disabled;
            return (
              <li key={id}>
                <button
                  type="button"
                  data-testid={testId}
                  aria-current={isActive ? 'step' : undefined}
                  disabled={isDisabled}
                  title={
                    disabled && !investigationTabsEnabled
                      ? counsellingCopy.selectProcedureOrPackageFirst
                      : label
                  }
                  onClick={() => onModeChange(id)}
                  className={cn(
                    counsellingSessionTokens.pillTab,
                    isActive
                      ? counsellingSessionTokens.pillTabCurrent
                      : isDisabled && 'opacity-50',
                  )}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <CounsellingEyeSelector
        variant="inline"
        value={selectedEye}
        onChange={onEyeChange}
        readOnly={eyeReadOnly}
        disabled={isReadOnly}
        className="shrink-0 self-end xl:self-center"
      />
    </div>
  );
}
