'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { patientProfileUrl } from '@/lib/patients/patient-routes';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { cn } from '@/lib/utils';
import { usePatientWorkspace } from './PatientWorkspaceProvider';

export function PatientWorkspaceTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const { tabs, closePatient } = usePatientWorkspace();

  const handleClose = (patientId: string) => {
    const closingActive =
      pathname === patientProfileUrl(patientId) ||
      pathname.startsWith(`${patientProfileUrl(patientId)}/`);
    const remaining = tabs.filter((t) => t.id !== patientId);
    closePatient(patientId);
    if (!closingActive) return;
    if (remaining.length > 0) {
      router.push(patientProfileUrl(remaining[0]!.id));
    } else {
      router.push('/dashboard/patients');
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div
      className="border-b border-gray-200 bg-gray-50/80 px-4 overflow-x-auto"
      data-testid={patientLookupTestIds.workspaceTabs}
    >
      <div className="flex items-center gap-1 min-w-max py-1.5">
        {tabs.map((tab) => {
          const href = patientProfileUrl(tab.id);
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const label = `${tab.firstName} ${tab.lastName}`.trim() || tab.mrn;
          return (
            <div
              key={tab.id}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border text-xs max-w-[200px]',
                active
                  ? 'bg-white border-emerald-200 text-emerald-900 shadow-sm'
                  : 'bg-transparent border-transparent text-gray-600 hover:bg-white hover:border-gray-200',
              )}
            >
              <Link
                href={href}
                className="truncate px-2.5 py-1.5 font-medium"
                title={label}
                data-testid={patientLookupTestIds.workspaceTab(tab.id)}
              >
                {label}
              </Link>
              <button
                type="button"
                className="p-1 mr-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                aria-label={`Close ${label}`}
                onClick={() => handleClose(tab.id)}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
