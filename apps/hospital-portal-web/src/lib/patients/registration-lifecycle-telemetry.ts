/**
 * Temporary registration lifecycle telemetry for Confirm & Create forensics.
 * Sanitized events only — never logs PHI (names, phone, DOB, MRN, tokens).
 *
 * Enable in browser:
 *   window.__HP_REG_LIFECYCLE_ENABLE__ = true
 * Read:
 *   window.__HP_REG_LIFECYCLE__
 */

export const REGISTRATION_RUNTIME_MARKER = 'patient-registration-runtime-v2';

export type RegistrationLifecycleEvent = {
  t: number;
  e: string;
  d?: Record<string, string | number | boolean | null | undefined>;
};

declare global {
  interface Window {
    __HP_REG_LIFECYCLE_ENABLE__?: boolean;
    __HP_REG_LIFECYCLE__?: RegistrationLifecycleEvent[];
  }
}

function enabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__HP_REG_LIFECYCLE_ENABLE__ === true) return true;
  // Always capture in local/dev so manual UAT + Playwright can read the buffer.
  return process.env.NODE_ENV === 'development';
}

export function regLife(event: string, data?: RegistrationLifecycleEvent['d']): void {
  if (!enabled()) return;
  if (!window.__HP_REG_LIFECYCLE__) window.__HP_REG_LIFECYCLE__ = [];
  window.__HP_REG_LIFECYCLE__.push({
    t: Date.now(),
    e: event,
    d: data,
  });
  // Keep buffer bounded.
  if (window.__HP_REG_LIFECYCLE__.length > 400) {
    window.__HP_REG_LIFECYCLE__.splice(0, window.__HP_REG_LIFECYCLE__.length - 400);
  }
}

export function regLifeClear(): void {
  if (typeof window === 'undefined') return;
  window.__HP_REG_LIFECYCLE__ = [];
}

export function regLifeSnapshot(): RegistrationLifecycleEvent[] {
  if (typeof window === 'undefined') return [];
  return [...(window.__HP_REG_LIFECYCLE__ ?? [])];
}
