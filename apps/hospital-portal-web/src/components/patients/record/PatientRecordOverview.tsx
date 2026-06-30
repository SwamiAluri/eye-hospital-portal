'use client';



import Link from 'next/link';

import { useMemo, type ReactNode } from 'react';

import {

  Activity,
  FileText,
  FolderOpen,
  HeartPulse,
  Upload,
} from 'lucide-react';

import { formatCareProgramLabel } from '@/lib/patients/patient-display-utils';

import type { ChartWidgetId } from '@/lib/patients/chart-layout';

import type { PatientRecordTabKey } from '@/lib/patients/patient-record-tabs';

import { patientRecordTabLabel } from '@/lib/patients/patient-record-tabs';

import { useChartLayout } from '@/hooks/use-chart-layout';
import { cn } from '@/lib/utils';
import { usePatientRecord } from './PatientRecordProvider';
import { PatientOverviewFormsCard } from './PatientOverviewFormsCard';
import { CcmGoalsWidget, CcmQualityWidget } from './CcmOverviewWidgets';



function allergyPills(allergies?: string | null) {

  if (!allergies?.trim()) return null;

  return allergies

    .split(/[,;]/)

    .map((a) => a.trim())

    .filter(Boolean);

}



const PAIRABLE: Record<ChartWidgetId, ChartWidgetId | null> = {

  medical_history: 'vitals',

  vitals: 'medical_history',

  documents: 'forms',

  forms: 'documents',

  activity: null,
  ccm_goals: 'ccm_quality',
  ccm_quality: 'ccm_goals',
};



export function PatientRecordOverview({

  onOpenTab,

}: {

  onOpenTab?: (tab: PatientRecordTabKey) => void;

}) {

  const { summary, recentVisits } = usePatientRecord();
  const { layout } = useChartLayout();

  const vitals = summary?.latestVitals ?? null;

  const allergies = allergyPills(summary?.allergies);

  const programs = summary?.careProgramCodes ?? [];

  const engagements = summary?.activeEngagements ?? [];



  const consultationCount =

    recentVisits?.filter((v) => v.visitType?.toLowerCase().includes('consult')).length ?? 0;

  const openCount =

    recentVisits?.filter((v) =>

      ['waiting', 'in-progress', 'checked-in', 'open'].some((s) =>

        v.status?.toLowerCase().includes(s),

      ),

    ).length ?? 0;



  const orderedVisible = useMemo(

    () =>

      layout.widgets

        .filter((w) => w.visible !== false)

        .sort((a, b) => a.order - b.order),

    [layout.widgets],

  );



  const renderMedicalHistory = (paired = false) => (

    <div className={cn('bg-white border border-gray-200 rounded-xl p-4', paired && 'lg:col-span-2')}>

      <div className="flex items-center justify-between gap-2">

        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">

          <FileText className="w-4 h-4 text-emerald-600" />

          Medical history

        </h3>

        {onOpenTab && (

          <button

            type="button"

            onClick={() => onOpenTab('medical_records')}

            className="text-xs text-emerald-700 hover:text-emerald-900"

          >

            View all

          </button>

        )}

      </div>

      <div className="mt-3 space-y-3">

        <div>

          <div className="text-xs text-gray-500 mb-1">Allergies</div>

          {allergies && allergies.length > 0 ? (

            <div className="flex flex-wrap gap-1.5">

              {allergies.map((a) => (

                <span

                  key={a}

                  className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-800 ring-1 ring-red-100"

                >

                  {a}

                </span>

              ))}

            </div>

          ) : (

            <p className="text-sm text-gray-600">No allergies recorded</p>

          )}

        </div>

        <div className="text-sm text-gray-700">

          <span className="text-gray-500">Blood group:</span> {summary?.bloodGroup ?? '—'}

        </div>

        {programs.length > 0 && (

          <div className="flex flex-wrap gap-1.5">

            {programs.map((code) => (

              <span

                key={code}

                className="text-xs px-2 py-0.5 rounded-md bg-violet-50 text-violet-800 ring-1 ring-violet-100"

              >

                {formatCareProgramLabel(code)}

              </span>

            ))}

          </div>

        )}

      </div>

    </div>

  );



  const renderVitals = () => (

    <div className="bg-white border border-gray-200 rounded-xl p-4">

      <div className="flex items-center justify-between gap-2">

        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">

          <HeartPulse className="w-4 h-4 text-emerald-600" />

          Latest vitals

        </h3>

        {onOpenTab && (

          <button

            type="button"

            onClick={() => onOpenTab('vitals')}

            className="text-xs text-emerald-700 hover:text-emerald-900"

          >

            Flowsheet

          </button>

        )}

      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">

        {[

          {

            label: 'BP',

            value:

              vitals?.bloodPressureSystolic != null && vitals?.bloodPressureDiastolic != null

                ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`

                : '—',

          },

          { label: 'HR', value: vitals?.heartRate ?? '—' },

          {

            label: 'SpO₂',

            value: vitals?.oxygenSaturation != null ? `${vitals.oxygenSaturation}%` : '—',

          },

          { label: 'Temp', value: vitals?.temperature ?? '—' },

        ].map((item) => (

          <div key={item.label} className="rounded-lg bg-gray-50 p-3">

            <div className="text-xs text-gray-500">{item.label}</div>

            <div className="font-medium text-gray-900">{item.value}</div>

          </div>

        ))}

      </div>

      {vitals?.isStale && (

        <p className="mt-2 text-xs text-amber-700">Vitals may be stale — record now?</p>

      )}

    </div>

  );



  const renderDocuments = () => (

    <div className="bg-white border border-gray-200 rounded-xl p-4">

      <div className="flex items-center justify-between gap-2">

        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">

          <FolderOpen className="w-4 h-4 text-emerald-600" />

          Files & documents

        </h3>

        {onOpenTab && (

          <button

            type="button"

            onClick={() => onOpenTab('documents')}

            className="text-xs text-emerald-700 hover:text-emerald-900"

          >

            Open

          </button>

        )}

      </div>

      <p className="mt-3 text-sm text-gray-600">

        Upload consent forms, IDs, and imaging reports from the Documents tab.

      </p>

      <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500">

        <Upload className="w-3.5 h-3.5" />

        Drag & drop upload available in {patientRecordTabLabel('documents')}

      </div>

    </div>

  );



  const renderForms = () =>
    summary ? (
      <PatientOverviewFormsCard patientId={summary.id} onOpenTab={onOpenTab} />
    ) : null;



  const renderActivity = () => (

    <div className="bg-white border border-gray-200 rounded-xl p-4">

      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">

        <Activity className="w-4 h-4 text-emerald-600" />

        Activity

      </h3>

      <div className="grid grid-cols-3 gap-3">

        {[

          { label: 'Recent visits', value: recentVisits?.length ?? 0 },

          { label: 'Open visits', value: openCount },

          { label: 'Consultations', value: consultationCount },

        ].map((stat) => (

          <div key={stat.label} className="rounded-lg bg-gray-50 p-3 text-center">

            <div className="text-lg font-semibold text-gray-900">{stat.value}</div>

            <div className="text-xs text-gray-500">{stat.label}</div>

          </div>

        ))}

      </div>

      {engagements.length > 0 && (

        <div className="mt-3 flex flex-wrap gap-1.5">

          {engagements.map((e) => (

            <span

              key={`${e.type}-${e.label}`}

              className={cn(

                'text-[11px] px-2 py-0.5 rounded-md ring-1',

                'bg-emerald-50 text-emerald-800 ring-emerald-100',

              )}

            >

              {e.label}

              {e.status ? ` · ${e.status}` : ''}

            </span>

          ))}

        </div>

      )}

    </div>

  );



  const widgetNode = (id: ChartWidgetId): ReactNode => {

    switch (id) {

      case 'medical_history':

        return renderMedicalHistory();

      case 'vitals':

        return renderVitals();

      case 'documents':

        return renderDocuments();

      case 'forms':

        return renderForms();

      case 'activity':

        return renderActivity();

      case 'ccm_goals':

        return <CcmGoalsWidget />;

      case 'ccm_quality':

        return <CcmQualityWidget />;

      default:

        return null;

    }

  };



  const sections: ReactNode[] = [];

  for (let i = 0; i < orderedVisible.length; i += 1) {

    const current = orderedVisible[i];

    const next = orderedVisible[i + 1];

    const pairId = PAIRABLE[current.id];



    if (pairId && next?.id === pairId) {

      const isClinicalPair =

        current.id === 'medical_history' || current.id === 'vitals';

      const clinicalPaired = isClinicalPair;

      sections.push(

        <div

          key={`${current.id}-${next.id}`}

          className={cn(

            'grid gap-4',

            isClinicalPair ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2',

          )}

        >

          {current.id === 'medical_history'

            ? renderMedicalHistory(clinicalPaired)

            : widgetNode(current.id)}

          {next.id === 'medical_history'

            ? renderMedicalHistory(clinicalPaired)

            : widgetNode(next.id)}

        </div>,

      );

      i += 1;

      continue;

    }



    sections.push(
      <div key={current.id}>
        {current.id === 'medical_history'
          ? renderMedicalHistory(false)
          : widgetNode(current.id)}
      </div>,
    );

  }



  return (

    <div className="space-y-4">

      {sections}



      {summary?.assignedVisitId && (

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">

          Active visit assigned.{' '}

          <Link

            href={`/dashboard/patients/${summary.id}/encounter/${summary.assignedVisitId}`}

            className="font-medium underline underline-offset-2"

          >

            Continue encounter

          </Link>

        </div>

      )}

    </div>

  );

}


