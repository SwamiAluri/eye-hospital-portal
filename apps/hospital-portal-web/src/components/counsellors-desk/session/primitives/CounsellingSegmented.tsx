'use client';

import {
  SegmentedButtonGroup,
  type SegmentedButtonGroupProps,
} from '@/components/ui/segmented-button-group';

export type CounsellingSegmentedProps<T extends string = string> =
  SegmentedButtonGroupProps<T>;

/** RE/LE/BE, Imaging/Lab, and other 2–4 option toggles. */
export function CounsellingSegmented<T extends string = string>(
  props: CounsellingSegmentedProps<T>,
) {
  return <SegmentedButtonGroup {...props} size={props.size ?? 'sm'} />;
}
