/**
 * Bedside vitals vs day-care limits (W-06 A4). Server transition-gates is authority;
 * this labels the vitals table with the words high/low.
 *
 * Ward capture stores temperature as °F (placeholder 98.6). Values above 45 convert to °C.
 */

export const DEFAULT_VITAL_THRESHOLD = {
  systolicMax: 180,
  diastolicMax: 110,
  pulseMin: 40,
  pulseMax: 140,
  spo2Min: 92,
  tempMaxC: 38.5,
} as const;

export type VitalDirection = 'high' | 'low';

export interface VitalFinding {
  measure: string;
  direction: VitalDirection;
  detail: string;
}

export interface VitalSignLike {
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  pulseRate?: number | null;
  oxygenSaturation?: number | null;
  temperature?: number | null;
}

export function toCelsius(stored: number): number {
  if (stored > 45) return Math.round(((stored - 32) * 5) / 9 * 10) / 10;
  return Math.round(stored * 10) / 10;
}

export function classifyVitals(
  vital: VitalSignLike | null | undefined,
  threshold = DEFAULT_VITAL_THRESHOLD,
): VitalFinding[] {
  if (!vital) return [];
  const findings: VitalFinding[] = [];
  const sys = vital.bloodPressureSystolic;
  const dia = vital.bloodPressureDiastolic;
  if (sys != null && sys > threshold.systolicMax) {
    findings.push({
      measure: 'Blood pressure',
      direction: 'high',
      detail: `${sys}/${dia ?? '—'} mmHg (usual limit ${threshold.systolicMax}/${threshold.diastolicMax})`,
    });
  } else if (dia != null && dia > threshold.diastolicMax) {
    findings.push({
      measure: 'Blood pressure',
      direction: 'high',
      detail: `${sys ?? '—'}/${dia} mmHg (usual limit ${threshold.systolicMax}/${threshold.diastolicMax})`,
    });
  }
  if (vital.pulseRate != null) {
    if (vital.pulseRate > threshold.pulseMax) {
      findings.push({
        measure: 'Pulse',
        direction: 'high',
        detail: `${vital.pulseRate} / min (usual ${threshold.pulseMin}–${threshold.pulseMax})`,
      });
    } else if (vital.pulseRate < threshold.pulseMin) {
      findings.push({
        measure: 'Pulse',
        direction: 'low',
        detail: `${vital.pulseRate} / min (usual ${threshold.pulseMin}–${threshold.pulseMax})`,
      });
    }
  }
  if (vital.oxygenSaturation != null && vital.oxygenSaturation < threshold.spo2Min) {
    findings.push({
      measure: 'SpO2',
      direction: 'low',
      detail: `${vital.oxygenSaturation}% (usual at least ${threshold.spo2Min}%)`,
    });
  }
  if (vital.temperature != null) {
    const c = toCelsius(vital.temperature);
    if (c > threshold.tempMaxC) {
      findings.push({
        measure: 'Temperature',
        direction: 'high',
        detail: `${c.toFixed(1)} °C (usual limit ${threshold.tempMaxC.toFixed(1)} °C)`,
      });
    }
  }
  return findings;
}

export function vitalNote(finding: VitalFinding | undefined): string {
  if (!finding) return 'Within range';
  return `${finding.direction === 'high' ? 'High' : 'Low'} · warning`;
}
