'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export function AdminKpiTile({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  accent,
  href,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  iconBg: string;
  accent: string;
  href?: string;
  trend?: { value: number; positive: boolean };
}) {
  const inner = (
    <div
      className={`bg-white border border-gray-200 rounded-2xl p-4 flex items-start gap-3 hover:shadow-md transition-all border-l-4 ${accent} ${
        href ? 'cursor-pointer' : ''
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest leading-none mb-1">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
          {trend != null && (
            <span
              className={`text-xs font-semibold ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}
            >
              {trend.positive ? '+' : ''}
              {trend.value.toFixed(1)}%
            </span>
          )}
        </div>
        {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-2xl">
        {inner}
      </Link>
    );
  }
  return inner;
}
