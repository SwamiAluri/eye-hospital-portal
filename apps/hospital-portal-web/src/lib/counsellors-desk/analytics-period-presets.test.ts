import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { AGING_ANALYTICS_PERIODS } from '@/components/counselor/FollowupAgingTable';

describe('CounselorAnalyticsTab period presets', () => {
  it('exposes only Phase 2D-safe summary period values (<= 30)', () => {
    const src = readFileSync(
      path.join(__dirname, '../../components/counselor/CounselorAnalyticsTab.tsx'),
      'utf8',
    );
    const block = src.match(/ANALYTICS_PERIODS\s*=\s*\[[\s\S]*?\]\s*as const/);
    expect(block).toBeTruthy();
    const values = [...block![0].matchAll(/value:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => v >= 1 && v <= 30)).toBe(true);
    expect(values).not.toContain(60);
    expect(values).not.toContain(90);
    expect(values).toEqual([7, 14, 30]);
  });

  it('aging presets include 365 and are independent from summary', () => {
    const values = AGING_ANALYTICS_PERIODS.map((p) => p.value);
    expect(values).toEqual([30, 90, 180, 365]);
    expect(values).not.toEqual([7, 14, 30]);
  });
});
