const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

type KeyboardEl = {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
};

/** True when j/k/arrows would type into a field instead of moving census selection. */
export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as KeyboardEl;
  if (el.isContentEditable) return true;
  if (el.tagName && EDITABLE_TAGS.has(el.tagName)) return true;
  if (typeof el.closest === 'function') {
    return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
  }
  return false;
}

/**
 * Next row index for j/k and arrow keys.
 * No selection + down → first; no selection + up → last; otherwise clamp, no wrap.
 */
export function nextCensusIndex(
  current: number | null,
  delta: number,
  length: number,
): number | null {
  if (length <= 0) return null;
  if (current === null || current < 0) {
    return delta >= 0 ? 0 : length - 1;
  }
  const next = current + delta;
  if (next < 0) return 0;
  if (next >= length) return length - 1;
  return next;
}
