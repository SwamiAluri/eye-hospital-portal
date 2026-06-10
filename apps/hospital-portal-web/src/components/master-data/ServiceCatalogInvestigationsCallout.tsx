'use client';

import Link from 'next/link';
import { Layers, ArrowRight, Microscope } from 'lucide-react';

export const SERVICE_CATALOG_HREF = '/dashboard/master-data/service-catalog';
/** Combined DIAGNOSTICS + INVESTIGATIONS — default Investigations tab */
export const INVESTIGATIONS_CATALOG_HREF = `${SERVICE_CATALOG_HREF}?mode=investigations&filter=investigations`;

type Props = {
  /** Shorter copy for inline banners */
  compact?: boolean;
  className?: string;
};

/**
 * Investigations are catalog-owned (B2) — not master.master_value CRUD.
 * Surfaces the Service Catalog admin path from Master Data screens.
 */
export function ServiceCatalogInvestigationsCallout({ compact = false, className = '' }: Props) {
  if (compact) {
    return (
      <p className={`text-sm text-sky-800 ${className}`}>
        Counsellor <strong>investigations</strong> (imaging + lab) are managed in{' '}
        <Link
          href={INVESTIGATIONS_CATALOG_HREF}
          className="font-semibold text-teal-700 hover:underline inline-flex items-center gap-0.5"
        >
          Service Catalog
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {' '}
        (<strong>DIAGNOSTICS</strong> + <strong>INVESTIGATIONS</strong>) — not in master value tabs.
      </p>
    );
  }

  return (
    <div
      className={`rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-teal-50/80 px-4 py-4 sm:px-5 ${className}`}
    >
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div className="flex gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-white border border-sky-100 flex items-center justify-center shrink-0">
            <Microscope className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Investigations live in Service Catalog</p>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Billable imaging and lab items for Counsellor desk are <strong>catalog-owned</strong> (
              <code className="text-xs">service_catalog.investigation</code>). Manage them under{' '}
              <strong>DIAGNOSTICS</strong> (imaging) and <strong>INVESTIGATIONS</strong> (lab) — use the{' '}
              <strong>Imaging + lab</strong> filter to view both together.
            </p>
          </div>
        </div>
        <Link
          href={INVESTIGATIONS_CATALOG_HREF}
          className="inline-flex items-center gap-2 shrink-0 px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Layers className="h-4 w-4" />
          Investigations (both)
        </Link>
      </div>
    </div>
  );
}
