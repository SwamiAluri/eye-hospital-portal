'use client';

import Link from 'next/link';
import { Package, ArrowRight } from 'lucide-react';
import { useCounsellingPackageTemplates } from '@/hooks/use-counselling-packages';

export function CounsellingPackagesOverviewCard() {
  const { data: packages = [], isLoading } = useCounsellingPackageTemplates();

  const active = packages.filter((p) => p.isActive).length;
  const linked = packages.filter(
    (p) => p.procedureVariantId || p.iolId || (p.investigationIds?.length ?? 0) > 0,
  ).length;

  return (
    <Link
      href="/dashboard/master-data/counsellor/packages"
      className="group block rounded-xl border bg-white p-5 shadow-sm hover:border-teal-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
            <Package size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-teal-700">
              Counselling packages
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Bundled procedure + IOL + investigation templates for quotes
            </p>
          </div>
        </div>
        <ArrowRight
          size={18}
          className="text-gray-300 group-hover:text-teal-500 shrink-0 mt-1"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {isLoading ? (
          <span className="text-gray-400">Loading…</span>
        ) : (
          <>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
              {packages.length} packages
            </span>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-800">
              {active} active
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">
              {linked} linked to catalog
            </span>
          </>
        )}
      </div>
    </Link>
  );
}
