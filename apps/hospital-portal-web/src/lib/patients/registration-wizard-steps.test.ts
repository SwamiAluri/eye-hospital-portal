import { describe, expect, it } from 'vitest';
import {
  getApplicableRegistrationSteps,
  getNextStepId,
  getPreviousStepId,
  getStepDisplayNumber,
  getStepperLayoutMode,
  isStepReached,
} from '@/lib/patients/registration-wizard-steps';

describe('registration-wizard-steps (dynamic applicable numbering)', () => {
  it('adult / guardian not applicable → six steps, Review = 6, Emergency = 4', () => {
    const steps = getApplicableRegistrationSteps(false);
    expect(steps.map((s) => s.id)).toEqual([
      'PERSONAL',
      'CONTACT',
      'IDENTITY',
      'EMERGENCY',
      'INSURANCE',
      'REVIEW',
    ]);
    expect(steps).toHaveLength(6);
    expect(getStepDisplayNumber('EMERGENCY', steps)).toBe(4);
    expect(getStepDisplayNumber('INSURANCE', steps)).toBe(5);
    expect(getStepDisplayNumber('REVIEW', steps)).toBe(6);
    expect(getStepperLayoutMode('PERSONAL', steps)).toBe('LEFT_CURRENT');
    expect(getStepperLayoutMode('CONTACT', steps)).toBe('CENTER_CURRENT');
    expect(getStepperLayoutMode('REVIEW', steps)).toBe('RIGHT_CURRENT');
  });

  it('guardian applicable → seven steps, Guardian = 4, Review = 7', () => {
    const steps = getApplicableRegistrationSteps(true);
    expect(steps.map((s) => s.id)).toEqual([
      'PERSONAL',
      'CONTACT',
      'IDENTITY',
      'GUARDIAN',
      'EMERGENCY',
      'INSURANCE',
      'REVIEW',
    ]);
    expect(steps).toHaveLength(7);
    expect(getStepDisplayNumber('GUARDIAN', steps)).toBe(4);
    expect(getStepDisplayNumber('EMERGENCY', steps)).toBe(5);
    expect(getStepDisplayNumber('REVIEW', steps)).toBe(7);
  });

  it('next/previous skip guardian when not applicable', () => {
    const steps = getApplicableRegistrationSteps(false);
    expect(getNextStepId('IDENTITY', steps)).toBe('EMERGENCY');
    expect(getPreviousStepId('EMERGENCY', steps)).toBe('IDENTITY');
    expect(getNextStepId('INSURANCE', steps)).toBe('REVIEW');
    expect(getPreviousStepId('REVIEW', steps)).toBe('INSURANCE');
  });

  it('reached comparison uses applicable order', () => {
    const adult = getApplicableRegistrationSteps(false);
    expect(isStepReached('EMERGENCY', 'REVIEW', adult)).toBe(true);
    expect(isStepReached('REVIEW', 'EMERGENCY', adult)).toBe(false);
    expect(isStepReached('GUARDIAN', 'REVIEW', adult)).toBe(false);
  });
});
