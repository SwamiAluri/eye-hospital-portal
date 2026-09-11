/**
 * Widget Container Component
 * Wraps each widget with header, controls, and standardized styling
 */

'use client';

import React, { useState } from 'react';
import {
  X,
  CheckCircle2 as Check,
  XCircle as Ban,
  Activity as Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetConfig, WidgetSize } from '@/lib/widgets/widget-types';

export interface WidgetContainerProps {
  config: WidgetConfig;
  children: React.ReactNode;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onResize?: (size: WidgetSize) => void;
  className?: string;
}

export function WidgetContainer({
  config,
  children,
  onMinimize,
  onMaximize,
  onClose,
  onPin,
  onUnpin,
  onResize,
  className,
}: WidgetContainerProps) {
  const [showMenu, setShowMenu] = useState(false);
  const Icon = config.icon;

  // Size classes for responsive grid
  const sizeClasses: Record<WidgetSize, string> = {
    small: 'col-span-1',
    medium: 'col-span-1 md:col-span-2',
    large: 'col-span-1 md:col-span-2 lg:col-span-2',
    full: 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4',
  };

  // Height classes
  const heightClasses: Record<WidgetSize, string> = {
    small: 'min-h-[200px]',
    medium: 'min-h-[250px]',
    large: 'min-h-[400px]',
    full: 'min-h-[500px]',
  };

  return (
    <div
      className={cn(
        'widget-container',
        'rounded-lg border border-gray-200 bg-white shadow-sm',
        'flex flex-col overflow-hidden',
        'transition-all duration-200',
        config.isMinimized ? 'h-auto' : heightClasses[config.currentSize],
        sizeClasses[config.currentSize],
        config.isPinned && 'ring-2 ring-blue-200',
        className
      )}
      style={{
        minWidth: config.minWidth ? `${config.minWidth}px` : undefined,
        minHeight: config.isMinimized ? 'auto' : config.minHeight ? `${config.minHeight}px` : undefined,
      }}
    >
      {/* Widget Header */}
      <div className="widget-header flex items-center justify-between px-[var(--page-content-pad)] py-2.5 max-[1599px]:py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <Icon className="h-4 w-4 text-gray-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {config.title}
          </h3>
          {config.isPinned && (
            <Check className="h-3 w-3 text-blue-500 flex-shrink-0" />
          )}
        </div>

        {/* Widget Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Pin/Unpin Button */}
          {config.isPinnable && (
            <button
              onClick={() => (config.isPinned ? onUnpin?.() : onPin?.())}
              className="p-1.5 rounded hover:bg-gray-200 transition-colors"
              title={config.isPinned ? 'Unpin widget' : 'Pin widget'}
            >
              {config.isPinned ? (
                <Ban className="h-4 w-4 text-gray-600" />
              ) : (
                <Check className="h-4 w-4 text-gray-600" />
              )}
            </button>
          )}

          {/* Minimize/Maximize Button */}
          <button
            onClick={() => (config.isMinimized ? onMaximize?.() : onMinimize?.())}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title={config.isMinimized ? 'Maximize widget' : 'Minimize widget'}
          >
            {config.isMinimized ? (
              <X className="h-4 w-4 text-gray-600" />
            ) : (
              <X className="h-4 w-4 text-gray-600" />
            )}
          </button>

          {/* Size Menu (if resizable) */}
          {config.isResizable && config.allowedSizes.length > 1 && !config.isMinimized && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                title="Resize widget"
              >
                <Settings className="h-4 w-4 text-gray-600" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20">
                    {config.allowedSizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          onResize?.(size);
                          setShowMenu(false);
                        }}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors',
                          config.currentSize === size && 'bg-blue-50 text-blue-700 font-medium'
                        )}
                      >
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Close Button */}
          {config.isCloseable && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-red-100 hover:text-red-600 transition-colors"
              title="Close widget"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      {!config.isMinimized && (
        <div className="widget-content flex-1 overflow-auto p-[var(--page-content-pad)]">
          {children}
        </div>
      )}
    </div>
  );
}
