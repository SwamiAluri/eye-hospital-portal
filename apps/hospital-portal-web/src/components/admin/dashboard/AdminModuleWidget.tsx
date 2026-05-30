'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ModuleSnapshot } from '@/lib/admin/module-snapshot-config';
import { MODULE_SNAPSHOT_CONFIGS } from '@/lib/admin/module-snapshot-config';

const severityDot = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  critical: 'bg-red-500',
};

export function AdminModuleWidget({ snapshot }: { snapshot: ModuleSnapshot }) {
  const config = MODULE_SNAPSHOT_CONFIGS.find((c) => c.moduleId === snapshot.moduleId);
  const Icon = config?.icon;
  const iconBg = config?.iconBg ?? 'bg-gray-100 text-gray-600';
  const accent = config?.accent ?? 'border-l-gray-400';

  return (
    <Link
      href={snapshot.href}
      className={`block bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition-all border-l-4 ${accent} focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <p className="text-sm font-semibold text-gray-900 truncate">{snapshot.label}</p>
        </div>
        <ArrowUpRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
      <dl className="space-y-2">
        {snapshot.metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between gap-2">
            <dt className="text-xs text-gray-500 truncate">{m.label}</dt>
            <dd className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              {m.severity && (
                <span className={`w-1.5 h-1.5 rounded-full ${severityDot[m.severity]}`} />
              )}
              {m.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-[10px] text-gray-400 mt-3">Open module →</p>
    </Link>
  );
}
