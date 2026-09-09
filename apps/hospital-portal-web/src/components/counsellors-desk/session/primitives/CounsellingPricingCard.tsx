'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { cn } from '@/lib/utils';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';

export interface CounsellingPricingCardProps {
  name: string;
  code?: string;
  priceLabel: string;
  features?: string[];
  extraFeatureCount?: number;
  savingsLabel?: string;
  badges?: ReactNode;
  selected?: boolean;
  suggested?: boolean;
  disabled?: boolean;
  /** CTA when not selected — default "Select package" for package cards */
  selectLabel?: string;
  /** CTA when selected — default "Selected" */
  selectedLabel?: string;
  onSelect?: () => void;
  className?: string;
  'data-testid'?: string;
}

/**
 * Package selection card — 21st.dev pricing-card pattern
 * https://21st.dev/community/components/s/pricing-card
 */
export function CounsellingPricingCard({
  name,
  code,
  priceLabel,
  features = [],
  extraFeatureCount = 0,
  savingsLabel,
  badges,
  selected = false,
  suggested = false,
  disabled,
  selectLabel = 'Select package',
  selectedLabel = 'Selected',
  onSelect,
  className,
  'data-testid': testId,
}: CounsellingPricingCardProps) {
  const visibleFeatures = features.slice(0, 5);

  return (
    <Card
      data-testid={testId}
      className={cn(
        counsellingSessionTokens.card,
        'flex h-full flex-col transition-all',
        selected && 'border-counselling-primary ring-2 ring-counselling-primary/25/80',
        suggested && !selected && 'border-amber-200 bg-amber-50/30',
        !selected && !suggested && 'hover:border-counselling-primary/40',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{name}</CardTitle>
            {code ? <CardDescription className="text-xs">{code}</CardDescription> : null}
          </div>
          <p className="shrink-0 text-base font-bold tabular-nums text-counselling-primary">{priceLabel}</p>
        </div>
        {badges ? <div className="flex flex-wrap gap-1.5">{badges}</div> : null}
      </CardHeader>
      <CardContent className="flex-1 space-y-2 pb-3 pt-0">
        <ul className="space-y-1.5">
          {visibleFeatures.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-counselling-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-counselling-primary" aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        {extraFeatureCount > 0 ? (
          <p className="text-xs text-counselling-muted-foreground">+{extraFeatureCount} more included</p>
        ) : null}
        {savingsLabel ? (
          <Badge className="bg-emerald-100 text-xs text-emerald-800 hover:bg-emerald-100">
            {savingsLabel}
          </Badge>
        ) : null}
      </CardContent>
      <CardFooter className="pt-0">
        <CounsellingButton
          type="button"
          variant={selected ? 'primary' : 'outline'}
          className="w-full"
          disabled={disabled}
          onClick={onSelect}
        >
          {selected ? selectedLabel : selectLabel}
        </CounsellingButton>
      </CardFooter>
    </Card>
  );
}
