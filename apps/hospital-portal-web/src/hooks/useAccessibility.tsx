// Accessibility Hooks for WCAG 2.1 AA Compliance
// Keyboard navigation, focus management, screen reader announcements

import { useEffect, useRef, useCallback } from 'react';

/**
 * Keyboard navigation hook for imaging viewers
 * Implements WCAG 2.1 Success Criterion 2.1.1 (Keyboard accessible)
 */
export function useKeyboardNavigation(callbacks: {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onRotate?: () => void;
  onReset?: () => void;
  onPanUp?: () => void;
  onPanDown?: () => void;
  onPanLeft?: () => void;
  onPanRight?: () => void;
  onNextTool?: () => void;
  onPrevTool?: () => void;
  onSave?: () => void;
  onClose?: () => void;
}) {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Zoom controls
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        callbacks.onZoomIn?.();
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        callbacks.onZoomOut?.();
      }

      // Rotation
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        callbacks.onRotate?.();
      }

      // Reset viewport
      if (e.key === '0' && e.ctrlKey) {
        e.preventDefault();
        callbacks.onReset?.();
      }

      // Pan with arrow keys
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        callbacks.onPanUp?.();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        callbacks.onPanDown?.();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        callbacks.onPanLeft?.();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        callbacks.onPanRight?.();
      }

      // Tool navigation with Tab
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        callbacks.onPrevTool?.();
      } else if (e.key === 'Tab') {
        // Allow normal tab navigation in most cases
      }

      // Save (Ctrl+S)
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        callbacks.onSave?.();
      }

      // Close (Escape)
      if (e.key === 'Escape') {
        e.preventDefault();
        callbacks.onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [callbacks]);
}

/**
 * Focus trap hook for modal dialogs
 * Implements WCAG 2.1 Success Criterion 2.4.3 (Focus Order)
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element on mount
    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    container.addEventListener('keydown', handleTabKey);
    return () => container.removeEventListener('keydown', handleTabKey);
  }, [containerRef, isActive]);
}

/**
 * Screen reader announcements hook
 * Implements WCAG 2.1 Success Criterion 4.1.3 (Status Messages)
 */
export function useScreenReaderAnnouncement() {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create invisible announcer element
    const announcer = document.createElement('div');
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    announcer.style.position = 'absolute';
    announcer.style.left = '-10000px';
    announcer.style.width = '1px';
    announcer.style.height = '1px';
    announcer.style.overflow = 'hidden';
    document.body.appendChild(announcer);
    announcerRef.current = announcer;

    return () => {
      document.body.removeChild(announcer);
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcerRef.current) {
      announcerRef.current.setAttribute('aria-live', priority);
      announcerRef.current.textContent = message;
      
      // Clear after reading
      setTimeout(() => {
        if (announcerRef.current) {
          announcerRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  return announce;
}

/**
 * Color contrast validator (for WCAG AA compliance)
 * Implements WCAG 2.1 Success Criterion 1.4.3 (Contrast Minimum)
 */
export function getContrastRatio(foreground: string, background: string): number {
  const getLuminance = (rgb: string) => {
    const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
    const sRGB = [r, g, b].map((val) => {
      const normalized = val / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Validate if color combination meets WCAG AA standards
 * Normal text: 4.5:1, Large text: 3:1
 */
export function meetsWCAGAA(foreground: string, background: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Auto-focus management for dynamic content
 * Implements WCAG 2.1 Success Criterion 2.4.3 (Focus Order)
 */
export function useAutoFocus(shouldFocus: boolean = true) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (shouldFocus && elementRef.current) {
      // Delay to ensure DOM is ready
      const timer = setTimeout(() => {
        elementRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shouldFocus]);

  return elementRef;
}

/**
 * Skip to content link for keyboard users
 * Implements WCAG 2.1 Success Criterion 2.4.1 (Bypass Blocks)
 */
export function SkipToContent({ targetId }: { targetId: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="skip-to-content"
      onClick={(e) => {
        e.preventDefault();
        const target = document.getElementById(targetId);
        target?.focus();
        target?.scrollIntoView({ behavior: 'smooth' });
      }}
    >
      Skip to main content
    </a>
  );
}

/**
 * Accessible tooltip with ARIA
 * Implements WCAG 2.1 Success Criterion 1.4.13 (Content on Hover or Focus)
 */
interface TooltipProps {
  children: React.ReactNode;
  content: string;
  id: string;
}

export function AccessibleTooltip({ children, content, id }: TooltipProps) {
  return (
    <div className="relative inline-block">
      <div
        role="tooltip"
        id={id}
        aria-describedby={id}
        className="group"
      >
        {children}
        <span
          className="absolute hidden group-hover:block group-focus-within:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50"
          role="tooltip"
        >
          {content}
          <span className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></span>
        </span>
      </div>
    </div>
  );
}

/**
 * Loading spinner with screen reader support
 * Implements WCAG 2.1 Success Criterion 4.1.3 (Status Messages)
 */
export function AccessibleLoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
      <span className="sr-only">{message}</span>
    </div>
  );
}

/**
 * Custom checkbox with ARIA for better screen reader support
 */
interface AccessibleCheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
}

export function AccessibleCheckbox({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  description,
}: AccessibleCheckboxProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-5 h-5 mt-0.5 border-2 border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-describedby={description ? `${id}-description` : undefined}
      />
      <div>
        <label
          htmlFor={id}
          className="text-sm font-medium text-gray-300 cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <p id={`${id}-description`} className="text-xs text-gray-400 mt-1">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
