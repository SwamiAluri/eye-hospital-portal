import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusColors: Record<string, string> = {
  // User statuses
  Active: 'bg-green-100 text-green-800 border-green-200',
  Inactive: 'bg-gray-100 text-gray-800 border-gray-200',
  Suspended: 'bg-red-100 text-red-800 border-red-200',
  'On Leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'On-Leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  
  // Department/Branch statuses
  UnderMaintenance: 'bg-orange-100 text-orange-800 border-orange-200',
  'Under Maintenance': 'bg-orange-100 text-orange-800 border-orange-200',
  
  // Compliance statuses
  compliant: 'bg-green-100 text-green-800 border-green-200',
  Compliant: 'bg-green-100 text-green-800 border-green-200',
  partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'non-compliant': 'bg-red-100 text-red-800 border-red-200',
  'Non-Compliant': 'bg-red-100 text-red-800 border-red-200',
  
  // System health
  healthy: 'bg-green-100 text-green-800 border-green-200',
  Healthy: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
  Critical: 'bg-red-100 text-red-800 border-red-200',
  
  // Alert severity
  low: 'bg-sky-100 text-sky-800 border-sky-200',
  Low: 'bg-sky-100 text-sky-800 border-sky-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  
  // Subscription tiers
  Starter: 'bg-gray-100 text-gray-800 border-gray-200',
  Standard: 'bg-sky-100 text-sky-800 border-sky-200',
  Professional: 'bg-purple-100 text-purple-800 border-purple-200',
  Enterprise: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  
  // MFA status
  Enabled: 'bg-green-100 text-green-800 border-green-200',
  Disabled: 'bg-gray-100 text-gray-800 border-gray-200',
  
  // Default
  default: 'bg-gray-100 text-gray-800 border-gray-200',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function StatusBadge({
  status,
  size = 'md',
  className = '',
}: StatusBadgeProps) {
  const colorClass = statusColors[status] || statusColors.default;
  const sizeClass = sizeClasses[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${colorClass} ${sizeClass} ${className}`}
    >
      {status}
    </span>
  );
}
