'use client';

import * as React from 'react';
import {
  Card as UiCard,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardDensity,
} from '@/components/ui/card';

/**
 * Counselling session Card — locks widget pad at desktop SoT (comfortable)
 * so Wave 4 workstation Card density does not alter approved session chrome.
 */
const CounsellingCard = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof UiCard>
>(({ density = 'comfortable', ...props }, ref) => (
  <UiCard ref={ref} density={density as CardDensity} {...props} />
));
CounsellingCard.displayName = 'CounsellingCard';

export {
  CounsellingCard,
  CardHeader as CounsellingCardHeader,
  CardTitle as CounsellingCardTitle,
  CardDescription as CounsellingCardDescription,
  CardContent as CounsellingCardContent,
  CardFooter as CounsellingCardFooter,
};
