/** Normal baseline values for posterior fundus bilateral highlights. */
export const PS_NORMAL = {
  mediaClarity: 'Clear',
  overallFinding: 'Normal',
  discColor: 'Pink',
  discMargins: 'Distinct',
  absent: 'Absent',
  fovealReflex: 'Present',
  macularEdema: 'Absent',
  drusen: 'Absent',
  retinaConfig: 'Normal/Attached',
  retinalHemorrhage: 'Absent',
  retinalExudates: 'Absent',
  diabeticRetinopathy: 'None',
  peripheralDegeneration: 'Absent',
  avRatio: '2:3',
  avCrossing: 'None',
  vitreousClarity: 'Clear',
  vitreousCells: 'Absent',
  vitreousSyneresis: 'Normal',
  peripheralAppearance: 'Normal',
  viewExtent: 'Fully visible',
} as const;

export function isPsSelectAbnormal(value: string | undefined, normal: string): boolean {
  return Boolean(value && value !== normal);
}
