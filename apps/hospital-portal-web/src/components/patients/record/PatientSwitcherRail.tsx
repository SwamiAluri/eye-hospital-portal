'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePatientSuggestQuery } from '@/hooks/use-patient-lookup-queries';
import { useBranchContext } from '@/hooks/use-branch-context';
import { patientProfileUrl } from '@/lib/patients/patient-routes';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { savePatientRecordNav } from '@/lib/patients/patient-record-nav';
import { cn } from '@/lib/utils';
import { usePatientWorkspace } from './PatientWorkspaceProvider';

export function PatientSwitcherRail({ activePatientId }: { activePatientId: string }) {
  const router = useRouter();
  const { branchId } = useBranchContext();
  const { tabs, touchPatient } = usePatientWorkspace();
  const [q, setQ] = useState('');
  const debounced = useDebouncedValue(q, 250);
  const suggestQuery = usePatientSuggestQuery(branchId, debounced, debounced.length >= 2);

  const handleOpen = (id: string, firstName: string, lastName: string, mrn: string) => {
    touchPatient({ id, firstName, lastName, mrn });
    const ids = tabs.map((t) => t.id);
    if (!ids.includes(id)) ids.unshift(id);
    savePatientRecordNav(ids, id);
    router.push(patientProfileUrl(id));
  };

  return (
    <aside
      className="w-full lg:w-[220px] shrink-0"
      data-testid={patientLookupTestIds.switcherRail}
    >
      <div className="bg-white border border-gray-200 rounded-xl p-3 sticky top-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Users className="w-4 h-4 text-emerald-600" />
          Patients
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="w-full text-xs pl-8 pr-2 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            data-testid={patientLookupTestIds.switcherSearch}
          />
        </div>

        {debounced.length >= 2 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {suggestQuery.isLoading && (
              <p className="text-xs text-gray-500 px-1">Searching…</p>
            )}
            {(suggestQuery.data ?? []).map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() =>
                  handleOpen(row.id, row.firstName, row.lastName, row.mrn)
                }
                className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-emerald-50 text-xs"
              >
                <div className="font-medium text-gray-900 truncate">
                  {row.firstName} {row.lastName}
                </div>
                <div className="text-gray-500 font-mono">{row.mrn}</div>
              </button>
            ))}
          </div>
        )}

        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">
            Recent
          </p>
          <div className="space-y-1">
            {tabs.length === 0 && (
              <p className="text-xs text-gray-500 px-1">Open patients appear here.</p>
            )}
            {tabs.map((tab) => {
              const active = tab.id === activePatientId;
              return (
                <Link
                  key={tab.id}
                  href={patientProfileUrl(tab.id)}
                  className={cn(
                    'block rounded-lg px-2 py-1.5 text-xs',
                    active
                      ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100'
                      : 'hover:bg-gray-50 text-gray-800',
                  )}
                >
                  <div className="font-medium truncate">
                    {tab.firstName} {tab.lastName}
                  </div>
                  <div className="text-gray-500 font-mono truncate">{tab.mrn}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
