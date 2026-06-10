import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Tighter padding for inline list empty rows */
  compact?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  compact = false,
  action,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-center ${
        compact ? 'p-4' : 'p-12'
      }`}
    >
      {icon && <div className={`opacity-50 ${compact ? 'mb-2 text-3xl' : 'mb-4 text-6xl'}`}>{icon}</div>}
      <h3 className={`font-medium text-gray-900 ${compact ? 'text-sm' : 'mb-2 text-lg font-semibold'}`}>
        {title}
      </h3>
      {description && (
        <p className={`text-sm text-gray-600 ${compact ? 'mt-1' : 'mb-6'}`}>{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          style={{backgroundColor:'#10b981'}}
          onMouseEnter={e => e.currentTarget.style.backgroundColor='#059669'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor='#10b981'}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
