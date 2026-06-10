/** Dropdown options for retinoscopy new-reading forms (leading Select / None). */

export const RETINOSCOPY_WORKING_DISTANCE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Select distance' },
  { value: '33', label: '33cm (3.00D)' },
  { value: '50', label: '50cm (2.00D)' },
  { value: '67', label: '67cm (1.50D)' },
];

export function retinoscopySphereOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [{ value: '', label: 'Select sphere' }];
  for (let i = -20; i <= 20; i += 0.25) {
    const value = i.toFixed(2);
    options.push({ value, label: `${i >= 0 ? '+' : ''}${value}D` });
  }
  return options;
}

export function retinoscopyCylinderOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [{ value: '', label: 'None' }];
  for (let i = 0; i >= -6; i -= 0.25) {
    const value = i.toFixed(2);
    options.push({ value, label: `${value}D` });
  }
  return options;
}

export function retinoscopyAxisOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [{ value: '', label: 'Select axis' }];
  for (let i = 0; i <= 180; i += 5) {
    options.push({ value: i.toString(), label: `${i}°` });
  }
  return options;
}

/** Subjective new-reading sphere selects (same lists, empty default). */
export function subjectiveSphereSelectValue(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return n.toFixed(2);
}
