import { describe, expect, it } from 'vitest';
import { classifyVitals, toCelsius, vitalNote } from './vital-thresholds';

describe('vital-thresholds', () => {
  it('labels 192/114 as high blood pressure', () => {
    const findings = classifyVitals({
      bloodPressureSystolic: 192,
      bloodPressureDiastolic: 114,
      pulseRate: 88,
      oxygenSaturation: 98,
      temperature: 98.6,
    });
    expect(findings).toEqual([
      expect.objectContaining({ measure: 'Blood pressure', direction: 'high' }),
    ]);
    expect(vitalNote(findings[0])).toBe('High · warning');
  });

  it('treats 98.6 F as in-range Celsius', () => {
    expect(toCelsius(98.6)).toBe(37);
    expect(classifyVitals({
      bloodPressureSystolic: 128,
      bloodPressureDiastolic: 78,
      pulseRate: 72,
      oxygenSaturation: 98,
      temperature: 98.6,
    })).toEqual([]);
  });

  it('uses the word low for pulse and SpO2', () => {
    const findings = classifyVitals({
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 70,
      pulseRate: 32,
      oxygenSaturation: 88,
      temperature: 98.2,
    });
    expect(findings.map(f => `${f.measure}:${f.direction}`)).toEqual(['Pulse:low', 'SpO2:low']);
  });
});
