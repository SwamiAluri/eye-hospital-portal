'use client';

import { useEffect } from 'react';

/** Large Desktop expands at this CSS viewport width (same as Sidebar / token MQ). */
export const DENSITY_DESKTOP_MIN_MQ = '(min-width: 1600px)';

/**
 * Keeps documentElement[data-density-band] in sync with CSS viewport.
 * Tokens remain MQ-driven; this attribute is for diagnostics + CSS-first shell rules.
 */
export function useDensityBandAttribute() {
  useEffect(() => {
    const mq = window.matchMedia(DENSITY_DESKTOP_MIN_MQ);
    const apply = () => {
      document.documentElement.dataset.densityBand = mq.matches ? 'desktop' : 'workstation';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      delete document.documentElement.dataset.densityBand;
    };
  }, []);
}
