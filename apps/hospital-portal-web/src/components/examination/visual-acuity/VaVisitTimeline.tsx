'use client';



import { useState } from 'react';

import { buildVaVisitTimeline, buildVaVisitTimelineFromPatientHistory } from '@/lib/optometry/va-visit-timeline';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';

import { formatVaVisitDetail } from '@/lib/optometry/va-visit-detail-format';

import { ResponsiveFormSheet } from '@/components/examination/medical-history/ResponsiveFormSheet';



interface VaVisitTimelineProps {

  vaHistory?: unknown[];

  refHistory?: unknown[];

  patientOptometryHistory?: OptometryVisitExamRecord[];

  /** Tighter list for mobile nav strip. */

  compact?: boolean;

}



export function VaVisitTimeline({

  vaHistory = [],

  refHistory = [],

  patientOptometryHistory,

  compact = false,

}: VaVisitTimelineProps) {

  const entries = patientOptometryHistory?.length
    ? buildVaVisitTimelineFromPatientHistory(patientOptometryHistory)
    : buildVaVisitTimeline(vaHistory, refHistory);

  const [selected, setSelected] = useState<(typeof entries)[0] | null>(null);



  if (entries.length === 0) {

    return (

      <p className="text-[11px] text-slate-500 px-1 py-2 italic">No prior visits on file.</p>

    );

  }



  const detailSections = selected ? formatVaVisitDetail(selected.raw) : [];



  return (

    <>

      <p

        className={`font-semibold text-slate-600 uppercase tracking-wide px-1 mb-1 ${

          compact ? 'text-[10px]' : 'text-[10px]'

        }`}

      >

        Visit history

      </p>

      <ul className={`space-y-1 overflow-y-auto ${compact ? 'max-h-36' : 'max-h-48'}`}>

        {entries.map((e) => (

          <li key={e.id}>

            <button

              type="button"

              onClick={() => setSelected(e)}

              className="w-full text-left px-2 py-1.5 rounded-md text-[11px] hover:bg-emerald-50 border border-transparent hover:border-emerald-100 min-h-[44px] lg:min-h-0"

            >

              <span className="font-medium text-slate-800 block">

                {new Date(e.examinationDate || 0).toLocaleDateString(undefined, {

                  day: 'numeric',

                  month: 'short',

                  year: 'numeric',

                  timeZone: 'Asia/Kolkata',

                })}

              </span>

              <span className="text-slate-600 line-clamp-2">{e.label}</span>

            </button>

          </li>

        ))}

      </ul>



      {selected && (

        <ResponsiveFormSheet

          open

          onOpenChange={(open) => !open && setSelected(null)}

          title={`Visit · ${new Date(selected.examinationDate || 0).toLocaleDateString(undefined, {

            timeZone: 'Asia/Kolkata',

            day: 'numeric',

            month: 'short',

            year: 'numeric',

          })}`}

        >

          <div className="space-y-4">

            {selected.label && (

              <p className="text-xs text-slate-600 border-b border-slate-100 pb-2">{selected.label}</p>

            )}

            {detailSections.map((section) => (

              <div key={section.heading}>

                <h4 className="text-xs font-semibold text-slate-800 mb-1.5">{section.heading}</h4>

                <ul className="space-y-1 text-xs font-mono text-slate-700">

                  {section.lines.map((line) => (

                    <li key={`${section.heading}-${line}`}>{line}</li>

                  ))}

                </ul>

              </div>

            ))}

          </div>

        </ResponsiveFormSheet>

      )}

    </>

  );

}


