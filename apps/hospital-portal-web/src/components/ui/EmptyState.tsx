import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 text-center">
      {icon && <div className="mb-4 text-6xl opacity-50">{icon}</div>}
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="mb-6 text-sm text-gray-600">{description}</p>}
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
