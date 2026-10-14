import { describe, expect, it } from 'vitest';
import {
  isPatient360DocumentZoomed,
  nearestPatient360DocumentZoom,
  nextPatient360DocumentZoomIn,
  nextPatient360DocumentZoomOut,
  PATIENT_360_DOCUMENT_FIT_ZOOM,
  PATIENT_360_DOCUMENT_ZOOM_STEPS,
  patient360DocumentZoomLabel,
} from '@/lib/patients/patient-360-document-preview-zoom';

describe('patient 360 document preview zoom', () => {
  it('starts at fit and steps through controlled increments', () => {
    expect(PATIENT_360_DOCUMENT_FIT_ZOOM).toBe(100);
    expect(PATIENT_360_DOCUMENT_ZOOM_STEPS).toEqual([50, 75, 100, 125, 150, 200]);
    expect(nextPatient360DocumentZoomIn(100)).toBe(125);
    expect(nextPatient360DocumentZoomIn(200)).toBe(200);
    expect(nextPatient360DocumentZoomOut(100)).toBe(75);
    expect(nextPatient360DocumentZoomOut(50)).toBe(50);
    expect(nearestPatient360DocumentZoom(130)).toBe(125);
    expect(patient360DocumentZoomLabel(125)).toBe('125%');
  });

  it('treats only zoom above fit as pan-enabled', () => {
    expect(isPatient360DocumentZoomed(100)).toBe(false);
    expect(isPatient360DocumentZoomed(75)).toBe(false);
    expect(isPatient360DocumentZoomed(125)).toBe(true);
  });
});
