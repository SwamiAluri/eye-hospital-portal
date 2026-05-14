import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  onClick?: () => void;
}

const colorClasses = {
  blue: { bg: 'rgba(16,185,129,0.08)', icon: '#10b981' },
  green: { bg: 'rgba(16,185,129,0.08)', icon: '#10b981' },
  yellow: { bg: 'rgba(245,158,11,0.08)', icon: '#f59e0b' },
  red: { bg: 'rgba(239,68,68,0.08)', icon: '#ef4444' },
  purple: { bg: 'rgba(139,92,246,0.08)', icon: '#8b5cf6' },
  gray: { bg: 'rgba(107,114,128,0.08)', icon: '#6b7280' },
};

export function StatCard({
  title,
  value,
  icon,
  trend,
  subtitle,
  color = 'blue',
  onClick,
}: StatCardProps) {
  const c = colorClasses[color];

  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 transition-shadow ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {trend && (
              <span className={`text-xs font-semibold ${
                trend.isPositive ? 'text-emerald-600' : 'text-red-500'
              }`}>
                {trend.isPositive ? '▲' : '▼'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
        </div>
        {icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{backgroundColor: c.bg, color: c.icon}}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
