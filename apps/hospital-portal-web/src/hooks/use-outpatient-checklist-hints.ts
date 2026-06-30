'use client';



import { useCallback, useEffect, useState } from 'react';

import { labOrdersApi } from '@/lib/api/lab-orders.api';

import biometryApi from '@/lib/api/biometry.api';

import { patientConsentsApi } from '@/lib/api/patient-consents.api';

import { optometrySummaryApi } from '@/lib/api/optometry.api';

import { examinationApi } from '@/lib/api/doctorQueue.api';

import {

  buildOutpatientIntegrationHints,

  type OutpatientIntegrationContext,

  type OutpatientIntegrationHint,

} from '@/lib/ip-checklist/outpatient-integration';



function readAdviceField(adviceData: unknown, key: string): unknown {
  if (!adviceData || typeof adviceData !== 'object') return undefined;
  return (adviceData as Record<string, unknown>)[key];
}

function examSignalsAdviceConfirmed(exam: {
  adviceData?: unknown;
  status?: string;
}): boolean {
  if (exam.status !== 'Completed' && exam.status !== 'Signed') return false;
  const confirmed = readAdviceField(exam.adviceData, 'adviceConfirmed')
    ?? readAdviceField(exam.adviceData, 'surgeryAdvised')
    ?? readAdviceField(exam.adviceData, 'confirmed');
  if (typeof confirmed === 'boolean') return confirmed;
  const instructions = readAdviceField(exam.adviceData, 'instructions');
  return Array.isArray(instructions) && instructions.length > 0;
}

function examSignalsCardiacFitness(exam: {
  investigationsOrdered?: string[];
  adviceData?: unknown;
  primaryDiagnosis?: string;
}): boolean {
  const structured = readAdviceField(exam.adviceData, 'cardiacFitnessConfirmed')
    ?? readAdviceField(exam.adviceData, 'physicianFitnessOnFile');
  if (typeof structured === 'boolean') return structured;

  const hay = [
    ...(exam.investigationsOrdered ?? []),
    JSON.stringify(exam.adviceData ?? ''),
    exam.primaryDiagnosis ?? '',
  ].join(' ').toLowerCase();

  return /cardiac|ecg|echo|fitness|physician/.test(hay);
}



export function useOutpatientChecklistHints(ctx: OutpatientIntegrationContext) {

  const [hints, setHints] = useState<OutpatientIntegrationHint[]>([]);

  const [loading, setLoading] = useState(false);



  const load = useCallback(async () => {

    if (!ctx.patientId && !ctx.sessionId) {

      setHints(buildOutpatientIntegrationHints(

        { labOrders: [], biometry: [], consents: [], optometryCompletedExams: [] },

        ctx,

      ));

      return;

    }



    setLoading(true);

    try {

      const [labOrders, biometry, consentsRes, optStatus, doctorHistory] = await Promise.all([

        ctx.sessionId

          ? labOrdersApi.getSessionLabOrders(ctx.sessionId).catch(() => [])

          : Promise.resolve([]),

        ctx.patientId

          ? biometryApi.getByPatient(ctx.patientId).catch(() => [])

          : Promise.resolve([]),

        ctx.patientId

          ? patientConsentsApi.getByPatient(ctx.patientId).then(r => r.data ?? []).catch(() => [])

          : Promise.resolve([]),

        ctx.patientId

          ? optometrySummaryApi.getExamStatus(ctx.patientId).catch(() => null)

          : Promise.resolve(null),

        ctx.patientId

          ? examinationApi.getPatientHistory(ctx.patientId, { limit: 5 }).catch(() => [])

          : Promise.resolve([]),

      ]);



      const completedExams: string[] = Array.isArray(optStatus?.completedExams)

        ? optStatus.completedExams

        : Array.isArray(optStatus?.exams)

          ? optStatus.exams

          : [];



      const signedExams = (doctorHistory ?? []).filter(e =>
        e.status === 'Completed' || e.status === 'Signed');

      const doctorConsultCompleted = signedExams.some(examSignalsAdviceConfirmed)
        || signedExams.length > 0;

      const physicianCardiacFitnessOnFile = signedExams.some(examSignalsCardiacFitness);



      setHints(buildOutpatientIntegrationHints(

        {

          labOrders,

          biometry,

          consents: consentsRes,

          optometryCompletedExams: completedExams,

          doctorConsultCompleted,

          physicianCardiacFitnessOnFile,

        },

        ctx,

      ));

    } finally {

      setLoading(false);

    }

  }, [ctx.patientId, ctx.sessionId, ctx.paymentType, ctx.notRequiredPreAuth, ctx.ccmsCurrentState, ctx.packageRate]);



  useEffect(() => {

    load();

  }, [load]);



  return { hints, loading, reload: load };

}

