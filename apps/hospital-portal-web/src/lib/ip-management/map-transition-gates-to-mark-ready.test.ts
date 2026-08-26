import { describe, expect, it } from 'vitest';
import type { ChecklistGateResultDto } from '@/lib/api/ip-management.api';
import {
  mapTransitionGatesToMarkReady,
  mergeMarkReadyGates,
  navigateStepForGateCode,
} from './map-transition-gates-to-mark-ready';

function gates(partial: Partial<ChecklistGateResultDto> = {}): ChecklistGateResultDto {
  return {
    transition: 'ReadyForSurgery',
    canProceed: true,
    requiresOverride: false,
    warnings: [],
    ...partial,
  };
}

describe('navigateStepForGateCode', () => {
  it('opens Consent for unsigned consent and laterality', () => {
    expect(navigateStepForGateCode('surgical_consent_unsigned')).toBe('consent');
    expect(navigateStepForGateCode('laterality_not_attested')).toBe('consent');
    expect(navigateStepForGateCode('laterality_not_scheduled')).toBe('consent');
  });

  it('opens Nursing records for dilation and vitals warns', () => {
    expect(navigateStepForGateCode('dilation_not_ready')).toBe('records');
    expect(navigateStepForGateCode('dilation_not_recorded')).toBe('records');
    expect(navigateStepForGateCode('vitals_out_of_range')).toBe('records');
    expect(navigateStepForGateCode('vitals_not_recorded')).toBe('records');
  });

  it('opens Investigations / PAC / Evaluation for the matching codes', () => {
    expect(navigateStepForGateCode('critical_labs_unverified')).toBe('investigations');
    expect(navigateStepForGateCode('pac_incomplete')).toBe('pac');
    expect(navigateStepForGateCode('clinical_evaluation_unsigned')).toBe('evaluation');
  });
});

describe('mapTransitionGatesToMarkReady', () => {
  it('returns null when the API produced no result', () => {
    expect(mapTransitionGatesToMarkReady(null)).toBeNull();
    expect(mapTransitionGatesToMarkReady(undefined)).toBeNull();
  });

  it('maps unsigned consent to a hard block that opens the consent step', () => {
    const result = mapTransitionGatesToMarkReady(gates({
      canProceed: false,
      warnings: [{
        code: 'surgical_consent_unsigned',
        message: 'Surgical consent must be signed with the consent PDF on file.',
        severity: 'block',
        canOverride: false,
      }],
    }));

    expect(result).not.toBeNull();
    expect(result!.canMarkReady).toBe(false);
    expect(result!.hardBlocks).toEqual([
      expect.objectContaining({
        code: 'surgical_consent_unsigned',
        message: 'Surgical consent must be signed with the consent PDF on file.',
        severity: 'block',
        navigateStep: 'consent',
      }),
    ]);
    expect(result!.softWarnings).toHaveLength(0);
  });

  it('keeps a clear gate as one-click ready', () => {
    const result = mapTransitionGatesToMarkReady(gates({ canProceed: true, warnings: [] }));
    expect(result!.canMarkReady).toBe(true);
    expect(result!.hardBlocks).toHaveLength(0);
    expect(result!.softWarnings).toHaveLength(0);
  });

  it('does not block on dilation or vitals warnings', () => {
    const result = mapTransitionGatesToMarkReady(gates({
      canProceed: true,
      warnings: [
        { code: 'dilation_not_ready', message: 'Dilation is not ready yet.', severity: 'warn', canOverride: false },
        { code: 'vitals_out_of_range', message: 'Blood pressure is high.', severity: 'warn', canOverride: false },
      ],
    }));
    expect(result!.canMarkReady).toBe(true);
    expect(result!.hardBlocks).toHaveLength(0);
    expect(result!.softWarnings.map(w => w.code)).toEqual(['dilation_not_ready', 'vitals_out_of_range']);
    expect(result!.softWarnings[0].navigateStep).toBe('records');
    expect(result!.softWarnings[0].careTab).toBe('medLog');
    expect(result!.softWarnings[1].careTab).toBe('vitals');
  });

  it('does not block on a shown soft warning', () => {
    const result = mapTransitionGatesToMarkReady(gates({
      canProceed: false,
      requiresOverride: true,
      warnings: [{
        code: 'clinical_evaluation_unsigned',
        message: 'Clinical evaluation is not yet signed off by a doctor.',
        severity: 'warn',
        canOverride: true,
      }],
    }));

    expect(result!.canMarkReady).toBe(true);
    expect(result!.softWarnings.map(w => w.code)).toEqual(['clinical_evaluation_unsigned']);
    expect(result!.softWarnings[0].navigateStep).toBe('evaluation');
  });

  it('merges server dilation warns with client hard blocks fail-closed', () => {
    const client = mapTransitionGatesToMarkReady(gates({
      canProceed: false,
      warnings: [{
        code: 'surgical_consent_unsigned',
        message: 'Surgical consent must be signed with the consent PDF on file.',
        severity: 'block',
        canOverride: false,
      }],
    }))!;
    const server = mapTransitionGatesToMarkReady(gates({
      canProceed: true,
      warnings: [{
        code: 'dilation_not_recorded',
        message: 'No dilating drop is recorded.',
        severity: 'warn',
        canOverride: false,
      }],
    }));
    const merged = mergeMarkReadyGates(client, server);
    expect(merged.canMarkReady).toBe(false);
    expect(merged.hardBlocks.map(b => b.code)).toEqual(['surgical_consent_unsigned']);
    expect(merged.softWarnings.map(w => w.code)).toEqual(['dilation_not_recorded']);
  });

  it('fails closed when canProceed is false and no reasons were returned', () => {
    const result = mapTransitionGatesToMarkReady(gates({ canProceed: false, warnings: [] }));
    expect(result!.canMarkReady).toBe(false);
    expect(result!.hardBlocks[0].code).toBe('transition_blocked');
  });
});
