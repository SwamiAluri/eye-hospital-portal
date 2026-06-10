'use client';

import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  COUNSELLING_EYE_OPTIONS,
  type CounsellingEyeOption,
  counsellingEyeLabel,
} from '@/lib/counsellors-desk/counselling-eye';
import { CounsellingSegmented } from '@/components/counsellors-desk/session/primitives';

export type { CounsellingEyeOption };

const EYE_LABELS: Record<CounsellingEyeOption, string> = {
  RE: 'RE',
  LE: 'LE',
  BE: 'Both',
};

export interface CounsellingEyeSelectorProps {
  value: CounsellingEyeOption;
  onChange: (eye: CounsellingEyeOption) => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** Inline: single row beside a section title. Stacked: label above control. */
  variant?: 'inline' | 'stacked';
  className?: string;
}

/** RE / LE / Both — 21st segmented control pattern. */
export function CounsellingEyeSelector({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  variant = 'stacked',
  className,
}: CounsellingEyeSelectorProps) {
  const isDisabled = disabled || readOnly;

  if (variant === 'inline') {
    return (
      <div className={className}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-counselling-muted-foreground">
            Eye{readOnly ? ' (package)' : ''}
          </span>
          <CounsellingSegmented
            options={COUNSELLING_EYE_OPTIONS}
            selected={value}
            labels={EYE_LABELS}
            disabled={isDisabled}
            onChange={onChange}
            optionTestIds={{
              RE: counsellingTestIds.eyeRe,
              LE: counsellingTestIds.eyeLe,
              BE: counsellingTestIds.eyeBe,
            }}
          />
        </div>
        {readOnly ? (
          <p className="mt-1 text-[10px] text-counselling-muted-foreground/80">
            Locked while package pricing is active.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="mb-1.5 text-xs font-medium text-counselling-muted-foreground">
        Eye {readOnly ? '(from package)' : ''}
      </p>
      <CounsellingSegmented
        options={COUNSELLING_EYE_OPTIONS}
        selected={value}
        labels={EYE_LABELS}
        disabled={isDisabled}
        onChange={onChange}
        optionTestIds={{
          RE: counsellingTestIds.eyeRe,
          LE: counsellingTestIds.eyeLe,
          BE: counsellingTestIds.eyeBe,
        }}
      />
      {readOnly ? (
        <p className="mt-1 text-[11px] text-counselling-muted-foreground/80">
          Locked while package pricing is active.
        </p>
      ) : null}
    </div>
  );
}

export { counsellingEyeLabel };
