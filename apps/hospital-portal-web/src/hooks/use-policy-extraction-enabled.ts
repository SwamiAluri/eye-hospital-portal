'use client';

import { useEffect, useState } from 'react';
import { getPolicyExtractionStatus } from '@/lib/api/ccms/ccms-policy-extraction.api';

function isExplicitlyDisabled(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 503;
}

/** Probes CCMS for PolicyExtraction:Enabled — hides OCR UI only when explicitly disabled. */
export function usePolicyExtractionEnabled(caseId?: string) {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!caseId) {
      setEnabled(null);
      return;
    }
    let cancelled = false;
    getPolicyExtractionStatus()
      .then((s) => {
        if (!cancelled) setEnabled(s.enabled);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 401/transient errors: fail open so logged-in users still see OCR when enabled on server
        setEnabled(isExplicitlyDisabled(err) ? false : true);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return enabled;
}