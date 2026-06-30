import { describe, expect, it } from 'vitest';
import { hasPreviewVitalsData } from '@/components/patients/lookup/PreviewVitalsGrid';

describe('preview vitals helpers', () => {
  it('hasPreviewVitalsData is false when empty', () => {
    expect(hasPreviewVitalsData(null)).toBe(false);
    expect(hasPreviewVitalsData(undefined)).toBe(false);
    expect(hasPreviewVitalsData({})).toBe(false);
  });

  it('hasPreviewVitalsData is true when any metric exists', () => {
    expect(hasPreviewVitalsData({ heartRate: 80 })).toBe(true);
    expect(hasPreviewVitalsData({ visualAcuityOd: '6/6' })).toBe(true);
    expect(hasPreviewVitalsData({ iopOd: 14 })).toBe(true);
    expect(hasPreviewVitalsData({ weightKg: 70 })).toBe(true);
  });
});
