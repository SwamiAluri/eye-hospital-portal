import { useEffect, useRef, RefObject } from 'react';

/**
 * Traps keyboard focus within the target container while active.
 * Restores focus to the previously focused element on cleanup.
 *
 * Usage:
 *   const containerRef = useFocusTrap(isOpen);
 *   <div ref={containerRef}>...</div>
 */
export function useFocusTrap(active: boolean): RefObject<HTMLDivElement> {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    // Save the currently focused element
    previouslyFocused.current = document.activeElement as HTMLElement;

    // Find all focusable elements
    const getFocusable = (): HTMLElement[] =>
      Array.from(
        containerRef.current!.querySelectorAll<HTMLElement>(
          'button:not([disabled]), ' +
          '[href], ' +
          'input:not([disabled]), ' +
          'select:not([disabled]), ' +
          'textarea:not([disabled]), ' +
          '[tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none');

    // Auto-focus the first focusable element
    const focusable = getFocusable();
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    // Handle Tab / Shift+Tab
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const els = getFocusable();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }

      const first = els[0];
      const last  = els[els.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is on last, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // Handle Escape key to close modal (optional — consumer can opt-in)
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus
      previouslyFocused.current?.focus();
    };
  }, [active]);

  return containerRef;
}
