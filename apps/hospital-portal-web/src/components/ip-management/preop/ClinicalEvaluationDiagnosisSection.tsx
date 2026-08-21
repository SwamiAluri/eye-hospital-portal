'use client';



import { useEffect, useMemo, useState } from 'react';

import { Search, Star, X } from 'lucide-react';

import { ICD10SearchPanel } from '@/components/clinical/ICD10SearchPanel';

import type { DiagnosisCode } from '@/types/diagnosis';

import {

  formatWardDiagnosisSummary,

  mergeDiagnosisFromIcd,

  type ClinicalEvaluationFields,

  type DiagnosisLaterality,

  type OutpatientDiagnosisSource,

  type WardDiagnosisEntry,

} from '@/lib/ip-management/clinical-evaluation';

import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';



export interface ClinicalEvaluationDiagnosisSectionProps {

  fields: ClinicalEvaluationFields;

  sourceDiagnosis: OutpatientDiagnosisSource | null;

  disabled: boolean;

  patientId?: string | null;

  patientAge?: number | null;

  patientGender?: string | null;

  defaultLaterality?: DiagnosisLaterality;

  onChange: (patch: Partial<ClinicalEvaluationFields>) => void;

}



function lateralityLabel(lat?: DiagnosisLaterality): string {

  if (lat === 'OD') return 'OD';

  if (lat === 'OS') return 'OS';

  return 'OU';

}



export function ClinicalEvaluationDiagnosisSection({

  fields,

  sourceDiagnosis,

  disabled,

  patientId,

  patientAge,

  patientGender,

  defaultLaterality = 'OU',

  onChange,

}: ClinicalEvaluationDiagnosisSectionProps) {

  const [icdExpanded, setIcdExpanded] = useState(fields.diagnoses.length === 0);



  useEffect(() => {

    if (fields.diagnoses.length === 0 && !disabled) {

      setIcdExpanded(true);

    }

  }, [fields.diagnoses.length, disabled]);



  const existingDiagnoses = useMemo<DiagnosisCode[]>(

    () =>

      fields.diagnoses.map((d, i) => ({

        id: `${d.icd10}-${d.laterality}-${i}`,

        code: d.icd10,

        description: d.description,

        category: '',

        icdVersion: 'ICD-10',

        isOphthalmology: true,

        laterality: d.laterality ?? null,

      })),

    [fields.diagnoses],

  );



  function applyDiagnoses(

    diagnoses: WardDiagnosisEntry[],

    diagnosisStatus: ClinicalEvaluationFields['diagnosisStatus'],

    diagnosisOverrideReason?: string,

  ) {

    onChange({

      diagnoses,

      diagnosisStatus,

      diagnosisOverrideReason: diagnosisOverrideReason ?? fields.diagnosisOverrideReason,

      diagnosisSummary: formatWardDiagnosisSummary(diagnoses),

    });

  }



  function confirmOutpatient() {

    if (!sourceDiagnosis) return;

    const lat = sourceDiagnosis.laterality ?? defaultLaterality;

    const entry: WardDiagnosisEntry = {

      icd10: sourceDiagnosis.icd10 ?? '',

      description: sourceDiagnosis.description,

      laterality: lat,

      isPrimary: true,

    };

    applyDiagnoses([entry], 'confirmed');

    setIcdExpanded(false);

  }



  function handleIcdSelect(code: DiagnosisCode, laterality: 'OD' | 'OS' | 'OU', isPrimary: boolean) {

    const merged = mergeDiagnosisFromIcd(

      fields.diagnoses,

      { code: code.code, description: code.description },

      laterality,

      isPrimary,

    );

    const overridden =

      sourceDiagnosis

      && !merged.some(

        d =>

          d.description === sourceDiagnosis.description

          && (sourceDiagnosis.icd10 ? d.icd10 === sourceDiagnosis.icd10 : true),

      );

    applyDiagnoses(

      merged,

      overridden ? 'overridden' : fields.diagnosisStatus === 'confirmed' ? 'confirmed' : 'pending',

    );

  }



  return (

    <div className="space-y-2">

      <div className="flex items-center justify-between gap-2">

        <label className="text-xs font-medium text-gray-700">

          Pre-operative diagnosis <span className="text-red-600">*</span>

        </label>

        {!disabled && !icdExpanded && (

          <button

            type="button"

            onClick={() => setIcdExpanded(true)}

            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"

          >

            <Search className="h-3.5 w-3.5" aria-hidden="true" />

            Search ICD-10

          </button>

        )}

      </div>



      {sourceDiagnosis && (

        <div className="rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs text-sky-900">

          <p className="font-medium text-sky-800">From outpatient</p>

          <p className="mt-0.5">

            {sourceDiagnosis.icd10 ? `${sourceDiagnosis.icd10} — ` : ''}

            {sourceDiagnosis.description}

          </p>

          {!disabled && fields.diagnosisStatus !== 'confirmed' && fields.diagnosisStatus !== 'overridden' && (

            <div className="mt-2 flex flex-wrap gap-2">

              <button

                type="button"

                data-testid={WARD_PREOP_TEST_IDS.clinicalEvalConfirmOpDiagnosis}

                onClick={confirmOutpatient}

                className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"

              >

                Confirm as documented

              </button>

              <button

                type="button"

                onClick={() => setIcdExpanded(true)}

                className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"

              >

                Change diagnosis

              </button>

            </div>

          )}

        </div>

      )}



      {fields.diagnoses.length > 0 ? (

        <ul

          data-testid={WARD_PREOP_TEST_IDS.clinicalEvalDiagnosis}

          className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50/50 p-2"

        >

          {fields.diagnoses.map((d, i) => (

            <li key={`${d.icd10}-${d.laterality}-${i}`} className="flex items-start justify-between gap-2 text-sm">

              <span className="text-gray-800">

                {d.isPrimary && (

                  <Star className="mr-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-label="Primary" />

                )}

                {d.icd10 ? <span className="font-mono text-xs text-gray-500">{d.icd10}</span> : null}

                {d.icd10 ? ' — ' : ''}

                {d.description}

                <span className="ml-1 text-xs text-gray-500">{lateralityLabel(d.laterality)}</span>

              </span>

              {!disabled && (

                <button

                  type="button"

                  aria-label="Remove diagnosis"

                  onClick={() => {

                    const next = fields.diagnoses.filter((_, idx) => idx !== i);

                    applyDiagnoses(next, next.length === 0 ? 'pending' : fields.diagnosisStatus);

                  }}

                  className="text-gray-400 hover:text-red-600"

                >

                  <X className="h-4 w-4" />

                </button>

              )}

            </li>

          ))}

        </ul>

      ) : null}



      {!disabled && (

        <ICD10SearchPanel

          expanded={icdExpanded}

          onDone={() => setIcdExpanded(false)}

          onSelect={handleIcdSelect}

          patientId={patientId ?? undefined}

          patientAge={patientAge ?? undefined}

          patientGender={patientGender ?? undefined}

          existingDiagnoses={existingDiagnoses}

          defaultLaterality={defaultLaterality}

          disabled={disabled}

          compact

          data-testid={WARD_PREOP_TEST_IDS.clinicalEvalIcdSearch}

        />

      )}



      {fields.diagnosisStatus === 'overridden' && (

        <div>

          <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="eval-dx-override-reason">

            Override reason <span className="text-red-600">*</span>

          </label>

          <input

            id="eval-dx-override-reason"

            type="text"

            disabled={disabled}

            value={fields.diagnosisOverrideReason}

            onChange={e => onChange({ diagnosisOverrideReason: e.target.value })}

            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"

          />

        </div>

      )}



      <div>

        <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="eval-clinical-note">

          Clinical note <span className="font-normal text-gray-500">(optional)</span>

        </label>

        <input

          id="eval-clinical-note"

          data-testid={WARD_PREOP_TEST_IDS.clinicalEvalClinicalNote}

          type="text"

          disabled={disabled}

          value={fields.clinicalNote}

          onChange={e => onChange({ clinicalNote: e.target.value })}

          placeholder="e.g. Immature cataract with irregular astigmatism"

          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"

        />

      </div>

    </div>

  );

}

