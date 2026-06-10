'use client';



import { useEffect, useState } from 'react';

import Link from 'next/link';

import { masterValuesApi } from '@/lib/api';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';

import { ServiceCatalogOverviewCard } from '@/components/master-data/ServiceCatalogOverviewCard';
import { CounsellingPackagesOverviewCard } from '@/components/master-data/CounsellingPackagesOverviewCard';

import { ServiceCatalogInvestigationsCallout } from '@/components/master-data/ServiceCatalogInvestigationsCallout';

import { MasterDataErrorState } from '@/components/master-data/MasterDataErrorState';

import { parseMasterApiError } from '@/lib/master-data/master-api-errors';

import {

  masterDataGroupIcon,

  masterDataGroupSlug,

} from '@/lib/master-data/master-data-groups';



// ─── Types ────────────────────────────────────────────────────────────────────



interface MasterGroup {

  groupKey: string;

  displayName: string;

  entityTypes: Array<{

    entityType: string;

    displayName: string;

    tabLabel: string;

    sortOrder: number;

  }>;

}



// ─── Page ─────────────────────────────────────────────────────────────────────



export default function MasterDataOverviewPage() {

  const [groups, setGroups] = useState<MasterGroup[]>([]);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState<ReturnType<typeof parseMasterApiError> | null>(null);



  useEffect(() => {

    masterValuesApi

      .getGroups()

      .then((res) => {

        const data: MasterGroup[] = res.data?.data ?? res.data ?? [];

        setGroups(Array.isArray(data) ? data : []);

        setLoadError(null);

      })

      .catch((err) => {

        setGroups([]);

        setLoadError(parseMasterApiError(err));

      })

      .finally(() => setLoading(false));

  }, []);



  if (loading) {

    return (

      <div className="p-6 text-muted-foreground animate-pulse">Loading master data groups…</div>

    );

  }



  if (loadError) {

    return (

      <div className="p-6">

        <MasterDataErrorState

          title="Master Data unavailable"

          message={loadError.message}

          permissionDenied={loadError.permissionDenied}

        />

      </div>

    );

  }



  return (

    <div className="p-6 space-y-6">

      {/* Page Header */}

      <div>

        <h1 className="text-2xl font-bold">Master Data</h1>

        <p className="text-sm text-muted-foreground mt-1">

          Manage system-wide reference values used across all modules.

          Changes here affect all dropdowns and options throughout the portal.

          Billable <strong>investigations</strong> are in Service Catalog, not master value tabs.

        </p>

      </div>



      <ServiceCatalogInvestigationsCallout className="max-w-4xl" />



      {/* Group Cards */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        <ServiceCatalogOverviewCard />
        <CounsellingPackagesOverviewCard />

        {groups.map((group) => {

          const slug = masterDataGroupSlug(group.groupKey);

          const icon = masterDataGroupIcon(group.groupKey);

          return (

            <Link

              key={group.groupKey}

              href={`/dashboard/master-data/${slug}`}

              className="block hover:no-underline"

            >

              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-2 hover:border-primary/30">

                <CardHeader className="pb-2">

                  <CardTitle className="text-base flex items-center gap-2">

                    <span className="text-xl">{icon}</span>

                    {group.displayName}

                  </CardTitle>

                </CardHeader>

                <CardContent>

                  <div className="flex flex-wrap gap-1">

                    {group.entityTypes

                      .sort((a, b) => a.sortOrder - b.sortOrder)

                      .map((et) => (

                        <Badge key={et.entityType} variant="secondary" className="text-xs font-normal">

                          {et.tabLabel}

                        </Badge>

                      ))}

                  </div>

                  <p className="text-xs text-muted-foreground mt-3">

                    {group.entityTypes.length} entity type{group.entityTypes.length !== 1 ? 's' : ''}

                  </p>

                </CardContent>

              </Card>

            </Link>

          );

        })}

      </div>



      {groups.length === 0 && (

        <div className="text-center py-16 text-muted-foreground">

          <p className="text-lg">No master data groups found.</p>

          <p className="text-sm mt-1">

            Run migrations 51–65 on the database and ensure Master Data feature flags are enabled.

          </p>

        </div>

      )}

    </div>

  );

}

