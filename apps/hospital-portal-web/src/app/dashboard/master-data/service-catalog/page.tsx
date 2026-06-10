'use client';

import { Suspense } from 'react';
import { ServiceCatalogBrowser } from '@/components/admin/ServiceCatalogBrowser';

function ServiceCatalogLoading() {
  return (
    <div className="p-6 text-sm text-gray-500 animate-pulse">Loading service catalog…</div>
  );
}

export default function ServiceCatalogPage() {
  return (
    <Suspense fallback={<ServiceCatalogLoading />}>
      <ServiceCatalogBrowser />
    </Suspense>
  );
}
