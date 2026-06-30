'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { MoreVertical } from 'lucide-react';
import { WARD_PREOP_V2_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Accessible name for the trigger. */
  label?: string;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Contextual overflow ("⋯") menu — replaces repeated inline Save/Upload/Verify
 * buttons across the workspace (blueprint §14). Fully keyboard accessible:
 * arrow-key navigation, Escape to close, click-outside, and focus return to trigger.
 */
export function ActionMenu({
  items,
  label = 'Actions',
  align = 'right',
  className = '',
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const enabledItems = items.filter(i => !i.disabled);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      const first = items.findIndex(i => !i.disabled);
      setActiveIndex(first === -1 ? 0 : first);
    }
  }, [open, items]);

  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function close(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) buttonRef.current?.focus();
  }

  function moveActive(dir: 1 | -1) {
    setActiveIndex(prev => {
      let next = prev;
      for (let i = 0; i < items.length; i++) {
        next = (next + dir + items.length) % items.length;
        if (!items[next]?.disabled) break;
      }
      return next;
    });
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveActive(-1);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        break;
    }
  }

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        data-testid={WARD_PREOP_V2_TEST_IDS.actionMenuButton}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          data-testid={WARD_PREOP_V2_TEST_IDS.actionMenu}
          onKeyDown={onMenuKeyDown}
          className={`absolute z-30 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                ref={el => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                data-testid={WARD_PREOP_V2_TEST_IDS.actionMenuItem(item.id)}
                onClick={() => {
                  if (item.disabled) return;
                  item.onSelect();
                  close();
                }}
                className={[
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                  item.disabled
                    ? 'cursor-not-allowed text-gray-300'
                    : item.destructive
                      ? 'text-rose-600 hover:bg-rose-50'
                      : 'text-gray-700 hover:bg-gray-50',
                  index === activeIndex && !item.disabled ? 'bg-gray-50' : '',
                ].join(' ')}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {item.label}
              </button>
            );
          })}
          {enabledItems.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">No actions available</p>
          )}
        </div>
      )}
    </div>
  );
}
