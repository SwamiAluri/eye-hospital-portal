/**

 * Lists ward journeys by clinical state for E2E (Expected / Admitted / ReadyForSurgery).

 * Writes `e2e/.ward-fixtures.json` for local Playwright runs.

 *

 * Usage:

 *   npm run resolve:e2e:ward

 *

 * Optional env overrides for pinned journeys:

 *   E2E_WARD_EXPECTED_JOURNEY_ID

 *   E2E_WARD_ADMITTED_JOURNEY_ID

 *   E2E_WARD_READY_JOURNEY_ID

 *

 * Set E2E_WARD_FULL_FLOWS=1 when all three states have at least one journey.

 */

import { writeFileSync, mkdirSync } from 'node:fs';

import { dirname, join } from 'node:path';

import { fileURLToPath } from 'node:url';



const authApiBase = (process.env.E2E_API_URL ?? 'http://localhost:5073/api').replace(/\/$/, '');

const ipApiBase = (

  process.env.E2E_IP_MANAGEMENT_API_URL

  ?? process.env.NEXT_PUBLIC_IP_MANAGEMENT_API_URL

  ?? 'http://localhost:5074/api'

).replace(/\/$/, '');

const tenantId = process.env.E2E_TEST_TENANT_ID ?? '155fe198-6ae5-4a01-9254-ead5b427247e';

const branchId = process.env.E2E_TEST_BRANCH_ID ?? '74c014cf-9570-4824-bdf9-b369ea11a8f4';

const email = process.env.E2E_TEST_EMAIL ?? 'admin@test.com';

const password = process.env.E2E_TEST_PASSWORD ?? 'Admin123!';



type JourneyRow = {

  id: string;

  patientName: string | null;

  clinicalState: string;

  counselingSessionId?: string | null;

};



type WardFixturesFile = {

  branchId: string;

  tenantId: string;

  resolvedAt: string;

  fullFlowsReady: boolean;

  expectedJourneyId: string | null;

  admittedJourneyId: string | null;

  readyJourneyId: string | null;

  expectedCounselingSessionId: string | null;

  journeys: JourneyRow[];

};



function pickByState(rows: JourneyRow[], state: string, envOverride?: string): JourneyRow | undefined {

  if (envOverride) {

    const pinned = rows.find((j) => j.id === envOverride);

    if (pinned) return pinned;

  }

  return rows.find((j) => j.clinicalState === state);

}



async function main() {

  const loginRes = await fetch(`${authApiBase}/auth/login`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({ email, password, tenantId }),

  });

  if (!loginRes.ok) {

    console.error('Login failed', await loginRes.text());

    process.exit(1);

  }

  const login = (await loginRes.json()) as { accessToken: string };

  const headers = {

    Authorization: `Bearer ${login.accessToken}`,

    'X-Tenant-ID': tenantId,

  };



  const journeysRes = await fetch(

    `${ipApiBase}/ip-management/journeys?branchId=${branchId}`,

    { headers },

  );

  if (!journeysRes.ok) {

    console.error('Journey fetch failed', await journeysRes.text());

    process.exit(1);

  }

  const journeys = (await journeysRes.json()) as JourneyRow[];



  for (const state of ['Expected', 'Admitted', 'ReadyForSurgery'] as const) {

    const rows = journeys.filter((j) => j.clinicalState === state);

    console.log(`\n${state}: ${rows.length}`);

    for (const j of rows.slice(0, 5)) {

      const session = j.counselingSessionId ? ` session=${j.counselingSessionId}` : '';

      console.log(`  - ${j.patientName ?? '—'} (${j.id})${session}`);

    }

  }



  const expected = pickByState(journeys, 'Expected', process.env.E2E_WARD_EXPECTED_JOURNEY_ID);

  const admitted = pickByState(journeys, 'Admitted', process.env.E2E_WARD_ADMITTED_JOURNEY_ID);

  const ready = pickByState(journeys, 'ReadyForSurgery', process.env.E2E_WARD_READY_JOURNEY_ID);

  const fullFlowsReady = Boolean(expected && admitted && ready);



  const payload: WardFixturesFile = {

    branchId,

    tenantId,

    resolvedAt: new Date().toISOString(),

    fullFlowsReady,

    expectedJourneyId: expected?.id ?? null,

    admittedJourneyId: admitted?.id ?? null,

    readyJourneyId: ready?.id ?? null,

    expectedCounselingSessionId: expected?.counselingSessionId ?? null,

    journeys: journeys.filter((j) =>

      ['Expected', 'Admitted', 'ReadyForSurgery'].includes(j.clinicalState),

    ),

  };



  const scriptDir = dirname(fileURLToPath(import.meta.url));

  const outDir = join(scriptDir, '..', 'e2e');

  mkdirSync(outDir, { recursive: true });

  const outPath = join(outDir, '.ward-fixtures.json');

  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');



  console.log(`\nWrote ${outPath}`);

  console.log(`E2E_WARD_FULL_FLOWS ready: ${fullFlowsReady ? 'yes' : 'no'}`);



  if (expected) console.log(`E2E_WARD_EXPECTED_JOURNEY_ID=${expected.id}`);

  if (admitted) console.log(`E2E_WARD_ADMITTED_JOURNEY_ID=${admitted.id}`);

  if (ready) console.log(`E2E_WARD_READY_JOURNEY_ID=${ready.id}`);

  if (expected?.counselingSessionId) {

    console.log(`E2E_COUNSELLING_SESSION_ID=${expected.counselingSessionId}`);

  }



  if (!fullFlowsReady) {

    console.log('\nTip: finalize OT counselling to create Expected journeys, then admit / mark ready.');

    console.log('     npm run resolve:e2e:counselling && npm run resolve:e2e:ward');

  }

}



main().catch((err) => {

  console.error(err);

  process.exit(1);

});


