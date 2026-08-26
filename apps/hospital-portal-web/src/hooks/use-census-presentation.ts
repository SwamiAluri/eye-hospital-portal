'use client';

import { useEffect, useState } from 'react';
import {
  CENSUS_DOCKED_MIN_PX,
  censusPresentationForWidth,
  type CensusPresentation,
} from '@/lib/ip-management/ip-census-layout';

/** Desktop-first so SSR and the first paint match the coordinator's working width. */
export function useCensusPresentation(): CensusPresentation {
  const [width, setWidth] = useState(CENSUS_DOCKED_MIN_PX);

  useEffect(() => {
    const apply = () => setWidth(window.innerWidth);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  return censusPresentationForWidth(width);
}
