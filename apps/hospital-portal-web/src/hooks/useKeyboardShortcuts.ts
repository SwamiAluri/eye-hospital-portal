import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keyboard Shortcuts Hook
 * Provides global keyboard shortcut support for common actions
 */

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = !!shortcut.ctrlKey === event.ctrlKey;
        const shiftMatches = !!shortcut.shiftKey === event.shiftKey;
        const altMatches = !!shortcut.altKey === event.altKey;
        const metaMatches = !!shortcut.metaKey === event.metaKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

/**
 * Global Counselor Workspace Shortcuts
 */
export function useCounselorWorkspaceShortcuts() {
  const router = useRouter();

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'n',
      ctrlKey: true,
      action: () => router.push('/dashboard/counsellors-desk/waiting-list'),
      description: 'Counsellor Waiting List (Ctrl+N)',
    },
    {
      key: 'f',
      ctrlKey: true,
      action: () => router.push('/dashboard/counsellors-desk/surgery-followup'),
      description: 'Follow-up Center (Ctrl+F)',
    },
    {
      key: 's',
      ctrlKey: true,
      shiftKey: true,
      action: () => router.push('/dashboard/counsellors-desk/finalize-surgery'),
      description: 'Finalize Surgery (Ctrl+Shift+S)',
    },
    {
      key: 'a',
      ctrlKey: true,
      shiftKey: true,
      action: () => router.push('/dashboard/counselor/analytics'),
      description: 'Counsellor Analytics (Ctrl+Shift+A)',
    },
    {
      key: '/',
      action: () => {
        // Focus search if available
        const searchInput = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (searchInput) {
          searchInput.focus();
        }
      },
      description: 'Focus Search (/)',
    },
    {
      key: '?',
      shiftKey: true,
      action: () => {
        // Show keyboard shortcuts help
        alert(
          `Keyboard Shortcuts:\n\n${shortcuts
            .map((s) => `${s.description}`)
            .join('\n')}`
        );
      },
      description: 'Show Shortcuts (?)',
    },
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}

/**
 * Keyboard Shortcuts Help Panel Component
 * TODO: Move to .tsx file when needed
 */
// export function KeyboardShortcutsHelp({
//   shortcuts,
//   isOpen,
//   onClose,
// }: {
//   shortcuts: KeyboardShortcut[];
//   isOpen: boolean;
//   onClose: () => void;
// }) {
//   // Component commented out - JSX not supported in .ts files
//   // To use this component, move it to a separate .tsx file
//   return null;
// }

