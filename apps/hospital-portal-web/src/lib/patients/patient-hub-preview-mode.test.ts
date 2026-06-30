import { describe, expect, it } from 'vitest';
import {
  isPatientHubDockViewport,
  resolveEffectivePreviewMode,
} from './patient-hub-preview-mode';

describe('patient-hub-preview-mode', () => {
  it('treats 1280px and above as dock viewport', () => {
    expect(isPatientHubDockViewport(1280)).toBe(true);
    expect(isPatientHubDockViewport(1279)).toBe(false);
  });

  it('forces floating below xl breakpoint', () => {
    expect(resolveEffectivePreviewMode('docked', 1279)).toBe('floating');
    expect(resolveEffectivePreviewMode('docked', 1440)).toBe('docked');
    expect(resolveEffectivePreviewMode('floating', 1440)).toBe('floating');
  });
});
