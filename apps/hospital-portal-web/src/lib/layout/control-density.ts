/**
 * Opt-in workstation control density — does NOT change default Button/Input/Select.
 * Use density="workstation" to follow --control-height-workstation (40px ≥1600, 36px <1600).
 */
export type ControlDensity = 'default' | 'workstation';

export function controlDensityFieldClass(
  density: ControlDensity | undefined,
): string | undefined {
  if (density !== 'workstation') return undefined;
  return 'h-[var(--control-height-workstation)]';
}

/** Only md/default Button sizes participate; sm/lg stay explicit. */
export function controlDensityButtonClass(
  density: ControlDensity | undefined,
  size: 'sm' | 'md' | 'lg' | 'default' | null | undefined,
): string | undefined {
  if (density !== 'workstation') return undefined;
  const resolved = size ?? 'md';
  if (resolved === 'sm' || resolved === 'lg') return undefined;
  return 'h-[var(--control-height-workstation)] px-[var(--control-pad-x-workstation)] text-sm';
}
