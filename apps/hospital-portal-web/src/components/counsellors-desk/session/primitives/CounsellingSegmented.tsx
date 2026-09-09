'use client';

import {
  SegmentedButtonGroup,
  type SegmentedButtonGroupProps,
} from '@/components/ui/segmented-button-group';

export type CounsellingSegmentedProps<T extends string = string> =
  SegmentedButtonGroupProps<T>;

/** RE/LE/BE, estimate mode, and other clinical mode selectors. */
export function CounsellingSegmented<T extends string = string>(
  props: CounsellingSegmentedProps<T>,
) {
  return (
    <SegmentedButtonGroup
      {...props}
      size={props.size ?? 'sm'}
      variant={props.variant ?? 'mode'}
    />
  );
}
