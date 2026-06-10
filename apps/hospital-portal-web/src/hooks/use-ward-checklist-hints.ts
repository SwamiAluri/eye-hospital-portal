'use client';



import { useCallback, useEffect, useState } from 'react';

import { labOrdersApi } from '@/lib/api/lab-orders.api';

import biometryApi from '@/lib/api/biometry.api';

import { patientConsentsApi } from '@/lib/api/patient-consents.api';

import { prescriptionApi } from '@/lib/api/prescriptions.api';

import { imagingApi } from '@/lib/api/imaging.api';

import {

  buildWardIntegrationHints,

  type WardIntegrationContext,

} from '@/lib/ip-checklist/ward-integration';

import type { OutpatientIntegrationHint } from '@/lib/ip-checklist/outpatient-integration';



export function useWardChecklistHints(

  ctx: WardIntegrationContext,

  itemKeys: string[],

) {

  const [hints, setHints] = useState<OutpatientIntegrationHint[]>([]);

  const [loading, setLoading] = useState(false);



  const load = useCallback(async () => {

    if (!ctx.patientId && !ctx.sessionId) {

      setHints(buildWardIntegrationHints(

        { labOrders: [], biometry: [], consents: [], imagingOrders: [] },

        ctx,

        itemKeys,

      ));

      return;

    }



    setLoading(true);

    try {

      const [labOrders, biometry, consentsRes, rx, imagingOrders] = await Promise.all([

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

          ? prescriptionApi.getByPatient(ctx.patientId).catch(() => [])

          : Promise.resolve([]),

        ctx.patientId

          ? imagingApi.getPatientOrders(ctx.patientId).catch(() => [])

          : Promise.resolve([]),

      ]);



      const activeRx = Array.isArray(rx) && rx.some((p: { status?: string }) =>

        p.status === 'active' || p.status === 'Active');



      setHints(buildWardIntegrationHints(

        {

          labOrders,

          biometry,

          consents: consentsRes,

          imagingOrders,

          hasActivePrescription: activeRx,

        },

        ctx,

        itemKeys,

      ));

    } finally {

      setLoading(false);

    }

  }, [ctx.patientId, ctx.sessionId, ctx.financialState, ctx.balanceDue,

      ctx.emergencyFcApplied, ctx.anaesthesiaType, itemKeys.join(',')]);



  useEffect(() => {

    load();

  }, [load]);



  return { hints, loading, reload: load };

}

