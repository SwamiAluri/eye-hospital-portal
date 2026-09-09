'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CounsellingDiscountType } from '@/types/counselling-estimate';
import type { UseCounsellingEstimateResult } from '@/hooks/use-counselling-estimate';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { formatInr } from '@/lib/counsellors-desk/package-preview';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  CounsellingButton,
  CounsellingInput,
  CounsellingLabel,
  CounsellingSegmented,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

const DISCOUNT_TYPE_OPTIONS = ['percent', 'flat'] as const;
type DiscountTypeOption = (typeof DISCOUNT_TYPE_OPTIONS)[number];

const DISCOUNT_TYPE_LABELS: Record<DiscountTypeOption, string> = {
  percent: '%',
  flat: '₹ Flat',
};

export interface QuoteDiscountPanelProps {
  estimate: UseCounsellingEstimateResult;
  draftType: CounsellingDiscountType | null;
  setDraftType: (t: CounsellingDiscountType | null) => void;
  draftValue: string;
  setDraftValue: (v: string) => void;
  draftReason: string;
  setDraftReason: (v: string) => void;
  applyDiscount: () => void;
  canApply: boolean;
  isReadOnly: boolean;
  estimateDiscountType: CounsellingDiscountType | null;
  estimateDiscountValue: number;
  /** When false (default), panel starts collapsed — Notes Estimate rail. */
  defaultOpen?: boolean;
}

export function QuoteDiscountPanel({
  estimate,
  draftType,
  setDraftType,
  draftValue,
  setDraftValue,
  draftReason,
  setDraftReason,
  applyDiscount,
  canApply,
  isReadOnly,
  estimateDiscountType,
  estimateDiscountValue,
  defaultOpen = false,
}: QuoteDiscountPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const selectedType = draftType ?? '';
  const hasApplied = !!estimateDiscountType && estimateDiscountValue > 0;

  return (
    <section
      className="border-t border-counselling-border/40 pt-3"
      data-testid={counsellingTestIds.quoteDiscountPanel}
      aria-labelledby="counselling-quote-discount-heading"
    >
      <button
        type="button"
        id="counselling-quote-discount-heading"
        data-testid={counsellingTestIds.quoteDiscountToggle}
        aria-expanded={open}
        aria-controls="counselling-quote-discount-body"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md bg-counselling-muted/50 px-3 py-2.5',
          'text-left text-xs font-semibold text-counselling-foreground',
          'transition-colors hover:bg-counselling-muted/70',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span>{counsellingCopy.applyDiscount}</span>
          {hasApplied ? (
            <span className="truncate text-[11px] font-medium text-counselling-primary">
              {estimateDiscountType === 'percent'
                ? `${estimateDiscountValue}% applied`
                : `${formatInr(estimateDiscountValue)} applied`}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-counselling-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div id="counselling-quote-discount-body" className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <CounsellingLabel className="text-xs text-counselling-muted-foreground">
              {counsellingCopy.discountType}
            </CounsellingLabel>
            <CounsellingSegmented
              options={[...DISCOUNT_TYPE_OPTIONS]}
              selected={selectedType}
              labels={DISCOUNT_TYPE_LABELS}
              disabled={isReadOnly}
              onChange={(v) => {
                const t = v as DiscountTypeOption | '';
                setDraftType(t || null);
                if (!t) setDraftValue('');
              }}
              size="sm"
              optionTestIds={{
                percent: counsellingTestIds.quoteDiscountType('percent'),
                flat: counsellingTestIds.quoteDiscountType('flat'),
              }}
            />
          </div>

          {draftType ? (
            <CounsellingInput
              type="number"
              min="0"
              disabled={isReadOnly}
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              label={
                draftType === 'percent'
                  ? counsellingCopy.discountValuePercent
                  : counsellingCopy.discountValueFlat
              }
              placeholder={
                draftType === 'percent' ? counsellingCopy.discountValuePercentPlaceholder : '0'
              }
              className="tabular-nums"
              data-testid={counsellingTestIds.quoteDiscountValue}
            />
          ) : null}

          <CounsellingInput
            type="text"
            disabled={isReadOnly}
            value={draftReason}
            onChange={(e) => setDraftReason(e.target.value)}
            label={counsellingCopy.discountReasonLabel}
            placeholder={counsellingCopy.discountReasonPlaceholder}
            data-testid={counsellingTestIds.quoteDiscountReason}
          />

          <p className="text-[10px] leading-snug text-counselling-muted-foreground">
            Max without manager: {estimate.effectiveMaxDiscountPercent}%
            {estimate.tenantMaxDiscountFlat != null && estimate.tenantMaxDiscountFlat > 0 ? (
              <span> or {formatInr(estimate.tenantMaxDiscountFlat)} flat</span>
            ) : null}{' '}
            (cap {formatInr(estimate.maxDiscountAmount)})
          </p>

          {!isReadOnly ? (
            <CounsellingButton
              type="button"
              size="sm"
              disabled={!canApply}
              onClick={applyDiscount}
              data-testid={counsellingTestIds.quoteDiscountApply}
              className="w-full sm:w-auto"
            >
              {counsellingCopy.applyDiscountAction}
            </CounsellingButton>
          ) : null}

          {estimate.discountExceeded ? (
            <p className="text-[10px] font-medium text-amber-700">
              {counsellingCopy.discountExceededCap}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
