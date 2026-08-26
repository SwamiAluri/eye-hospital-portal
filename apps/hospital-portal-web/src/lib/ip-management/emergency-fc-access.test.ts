import { describe, expect, it } from 'vitest';
import { canApplyEmergencyFc } from './emergency-fc-access';

describe('canApplyEmergencyFc', () => {
  it('allows wildcard and ip.emergency_fc.apply', () => {
    expect(canApplyEmergencyFc(['*'])).toBe(true);
    expect(canApplyEmergencyFc(['ip.emergency_fc.apply'])).toBe(true);
  });

  it('does not grant Emergency FC from ward checklist edit or empty JWT', () => {
    expect(canApplyEmergencyFc([])).toBe(false);
    expect(canApplyEmergencyFc(undefined)).toBe(false);
    expect(canApplyEmergencyFc(['ward.checklist.edit'])).toBe(false);
    expect(canApplyEmergencyFc(['ip_management.view'])).toBe(false);
  });
});
