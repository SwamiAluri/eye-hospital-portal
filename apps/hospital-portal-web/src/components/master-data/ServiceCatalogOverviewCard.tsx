'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';
import { INVESTIGATIONS_CATALOG_HREF } from '@/components/master-data/ServiceCatalogInvestigationsCallout';

/** Fixed overview tile — Service Catalog is not returned by master-values/groups API. */
export function ServiceCatalogOverviewCard() {
  return (
    <Link href={INVESTIGATIONS_CATALOG_HREF} className="block hover:no-underline">
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-2 border-teal-200 hover:border-teal-400 bg-teal-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-5 w-5 text-teal-600" />
            Service Catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            Procedures, pricing, IOL — and <strong>investigations</strong> for Counsellor desk.
          </p>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-xs font-normal bg-white">
              Surgery
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal bg-sky-100 text-sky-800 border-sky-200">
              DIAGNOSTICS
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal bg-sky-100 text-sky-800 border-sky-200">
              INVESTIGATIONS
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal bg-white">
              IOL · Branch pricing
            </Badge>
          </div>
          <p className="text-xs text-teal-700 font-medium mt-3">Catalog-owned · Not master CRUD tabs</p>
        </CardContent>
      </Card>
    </Link>
  );
}
