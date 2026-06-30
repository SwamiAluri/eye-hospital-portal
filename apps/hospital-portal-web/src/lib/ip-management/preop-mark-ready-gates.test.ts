import { describe, expect, it } from 'vitest';
import type { PreOpCompletionDto } from '@/lib/api/ip-management.api';
import { isLateralityAttested, normalizeOperativeEye } from './preop-laterality';
import { computeMarkReadyGates } from './preop-mark-ready-gates';

function completion(key: string, patch: Partial<PreOpCompletionDto> = {}): PreOpCompletionDto {
  return {
    id: key,
    clearanceId: 'c1',
    itemId: key,
    itemKey: key,
    itemLabel: key,
    category: 'Consent',
    isBlocking: true,
    requiresDocument: false,
    isCompleted: false,
    isBypassed: false,
    bypassReason: null,
    notes: null,
    documentId: null,
    completedByUserId: null,
    completedAt: null,
    updatedAt: '2026-01-01T00:00:00Z',
    ...patch,
  };
}

describe('preop-laterality', () => {
  it('normalizes operative eye labels', () => {
    expect(normalizeOperativeEye('OD')).toBe('OD');
    expect(normalizeOperativeEye('right eye')).toBe('OD');
  });

  it('requires marked-by and attested eye match', () => {
    const completions = [
      completion('surgery_site_marked', {
        isCompleted: true,
        notes: 'RS',
        resultValue: 'OD',
      }),
    ];
    expect(isLateralityAttested(completions, 'OD')).toBe(true);
    expect(isLateralityAttested(completions, 'OS')).toBe(false);
  });
});

describe('computeMarkReadyGates', () => {
  it('blocks when PAC, consent, labs, or laterality are incomplete', () => {
    const result = computeMarkReadyGates({
      investigation: {
        journeyId: 'j1',
        applicableCount: 1,
        completedCount: 0,
        anaesthesiaType: null,
        items: [],
        unverifiedCriticalKeys: ['serum_creatinine'],
      },
      pac: { assessmentStatus: 'Draft' } as never,
      detail: { completions: [] } as never,
      scheduledEye: 'OD',
    });

    expect(result.canMarkReady).toBe(false);
    expect(result.hardBlocks.map(b => b.code)).toEqual(
      expect.arrayContaining([
        'critical_labs_unverified',
        'surgical_consent_unsigned',
        'laterality_not_attested',
        'pac_incomplete',
      ]),
    );
  });

  it('allows mark ready when hard stops are cleared', () => {
    const result = computeMarkReadyGates({
      investigation: {
        journeyId: 'j1',
        applicableCount: 1,
        completedCount: 1,
        anaesthesiaType: null,
        items: [],
        unverifiedCriticalKeys: [],
      },
      pac: { assessmentStatus: 'Completed' } as never,
      detail: {
        completions: [
          completion('surgery_consent_signed', { isCompleted: true, category: 'Consent' }),
          completion('surgery_site_marked', {
            isCompleted: true,
            notes: 'RS',
            resultValue: 'OD',
          }),
        ],
      } as never,
      scheduledEye: 'OD',
    });

    expect(result.canMarkReady).toBe(true);
    expect(result.hardBlocks).toHaveLength(0);
  });
});
