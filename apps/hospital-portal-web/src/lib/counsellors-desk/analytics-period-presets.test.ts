import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

describe('CounselorAnalyticsTab period presets', () => {
  it('exposes only Phase 2D-safe period values (<= 30)', () => {
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
});
