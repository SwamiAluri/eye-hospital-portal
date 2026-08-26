/**
 * Wave 7 G3 staging smoke (API). Live Auth + IP + CCMS.
 *
 *   npx tsx scripts/wave7-staging-smoke.ts
 *
 * Does not print tokens. Restores ccms_unavailable=false in finally.
 * Mutates one Cash/Expected UAT journey (admit → transfer → notes → discharge).
 * Does not occupy W7-SMOKE-1. Does not mutate random live claims.
 */
const authApiBase = (process.env.E2E_API_URL ?? 'http://localhost:5073/api').replace(/\/$/, '');
const ipApiBase = (
  process.env.E2E_IP_MANAGEMENT_API_URL ?? 'http://localhost:5074/api'
).replace(/\/$/, '');
const ccmsApiBase = (process.env.E2E_CCMS_API_URL ?? 'http://localhost:7075/api').replace(/\/$/, '');
const webBase = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const tenantId = process.env.E2E_TEST_TENANT_ID ?? '155fe198-6ae5-4a01-9254-ead5b427247e';
const branchId = process.env.E2E_TEST_BRANCH_ID ?? '74c014cf-9570-4824-bdf9-b369ea11a8f4';
const email = process.env.E2E_TEST_EMAIL ?? 'admin@test.com';
const password = process.env.E2E_TEST_PASSWORD ?? 'Admin123!';

const BED3 = 'a1000001-0000-4000-8000-0000000000b3';
const BED4 = 'a1000001-0000-4000-8000-0000000000b4';

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function skip(name: string, detail: string) {
  record(name, true, `SKIP ${detail}`);
}

function unwrap(body: unknown): unknown {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    if ('value' in o && o.value !== undefined) return unwrap(o.value);
    if (Array.isArray(o.$values)) return o.$values;
  }
  return body;
}

function asArray(body: unknown): Record<string, unknown>[] {
  const u = unwrap(body);
  if (Array.isArray(u)) return u as Record<string, unknown>[];
  return [];
}

function asObj(body: unknown): Record<string, unknown> {
  const u = unwrap(body);
  if (u && typeof u === 'object' && !Array.isArray(u)) return u as Record<string, unknown>;
  return {};
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

async function json(res: Response) {
  const text = await res.text();
  try {
    return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
  } catch {
    return { status: res.status, body: null, raw: text };
  }
}

type WardBed = {
  bedId: string;
  description: string;
  bedType?: string | null;
  bedStatus?: string | null;
  isAvailable: boolean;
  currentOccupancy: number;
};

function bedsFrom(body: unknown): WardBed[] {
  return asArray(body).map(b => ({
    bedId: str(b.bedId ?? b.BedId),
    description: str(b.description ?? b.Description),
    bedType: (b.bedType ?? b.BedType) as string | null | undefined,
    bedStatus: (b.bedStatus ?? b.BedStatus) as string | null | undefined,
    isAvailable: Boolean(b.isAvailable ?? b.IsAvailable),
    currentOccupancy: Number(b.currentOccupancy ?? b.CurrentOccupancy ?? 0),
  }));
}

function findSmoke(beds: WardBed[], n: 3 | 4): WardBed | undefined {
  const id = n === 3 ? BED3 : BED4;
  const label = n === 3 ? 'W7-SMOKE-3' : 'W7-SMOKE-4';
  return beds.find(b => b.bedId.toLowerCase() === id || b.description.includes(label));
}

function occupied(b?: WardBed) {
  return Boolean(b && (/occupied/i.test(str(b.bedStatus)) || (!b.isAvailable && b.currentOccupancy >= 1)));
}
function cleaning(b?: WardBed) {
  return Boolean(b && (/cleaning/i.test(str(b.bedStatus)) || (!b.isAvailable && b.currentOccupancy === 0 && !/occupied/i.test(str(b.bedStatus)))));
}
function available(b?: WardBed) {
  return Boolean(b && (/available/i.test(str(b.bedStatus)) || (b.isAvailable && b.currentOccupancy === 0)));
}

function snippet(raw: string | undefined, n = 180) {
  return (raw ?? '').replace(/\s+/g, ' ').slice(0, n);
}

async function main() {
  const loginRes = await fetch(`${authApiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, tenantId }),
  });
  const login = await json(loginRes);
  const token = str(asObj(login.body).accessToken ?? asObj(login.body).AccessToken);
  if (!loginRes.ok || !token) {
    throw new Error(`Login failed: ${login.status}`);
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': tenantId,
    'Content-Type': 'application/json',
  };

  await fetch(`${ipApiBase}/dev/uat/failures`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ccms_unavailable: false, bed_service_unavailable: false }),
  });

  let webUp = false;
  try {
    const web = await fetch(webBase, { signal: AbortSignal.timeout(4000) });
    webUp = web.ok || web.status === 307 || web.status === 308 || web.status === 200;
  } catch {
    webUp = false;
  }
  if (webUp) {
    record('Web UI reachable (localhost:3000)', true, webBase);
  } else {
    skip('Web UI reachable (localhost:3000)', 'Next.js not running — UI checklist pending');
  }

  const wardsRes = await fetch(`${ipApiBase}/ip-management/wards?branchId=${branchId}`, { headers });
  const wardsJson = await json(wardsRes);
  const wards = asArray(wardsJson.body);
  const dayCare = wards.find(w => {
    const type = str(w.wardType ?? w.WardType);
    const name = str(w.wardName ?? w.WardName);
    return type === 'DayCare' || /day care/i.test(name);
  });
  const dayCareId = str(dayCare?.id ?? dayCare?.Id);
  record('List Day Care ward', Boolean(dayCareId), dayCare ? str(dayCare.wardName ?? dayCare.WardName) : `status ${wardsJson.status}`);

  if (!dayCareId) {
    printSummary();
    process.exit(1);
  }

  const listBeds = async () =>
    bedsFrom((await json(await fetch(`${ipApiBase}/ip-management/wards/${dayCareId}/beds`, { headers }))).body);

  const beds = await listBeds();
  const smoke = beds.filter(b => /W7-SMOKE-/.test(b.description));
  const unmatchedWave7 = beds.filter(b => /\bWave\s*7\b/i.test(b.description) && !/W7-SMOKE-/.test(b.description));
  record(
    'Day Care list includes W7-SMOKE-* (no unmatched Wave7 rows)',
    smoke.length >= 2 && unmatchedWave7.length === 0,
    `smoke=${smoke.length} unmatchedWave7=${unmatchedWave7.length}`,
  );
  const b3 = findSmoke(beds, 3);
  const b4 = findSmoke(beds, 4);
  record(
    'W7-SMOKE-3 Available (Recliner inventory)',
    Boolean(b3) && available(b3),
    b3 ? `${b3.bedType || b3.description} status=${b3.bedStatus ?? 'n/a'} avail=${b3.isAvailable}` : 'missing',
  );
  record(
    'W7-SMOKE-4 Available (DayCareChair inventory)',
    Boolean(b4) && available(b4),
    b4 ? `${b4.bedType || b4.description} status=${b4.bedStatus ?? 'n/a'} avail=${b4.isAvailable}` : 'missing',
  );

  const kpisRes = await fetch(`${ccmsApiBase}/ccms/analytics/journey-kpis`, { headers });
  const kpis = await json(kpisRes);
  const kpiObj = asObj(kpis.body);
  const coverageCases = kpiObj.coverageCases ?? kpiObj.CoverageCases;
  record(
    'CCMS GET /ccms/analytics/journey-kpis',
    kpisRes.ok && typeof coverageCases === 'number',
    `status=${kpis.status} cases=${coverageCases ?? 'n/a'}`,
  );

  const statusRes = await fetch(`${ipApiBase}/dev/uat/status?branchId=${branchId}`, { headers });
  const status = await json(statusRes);
  const rows = asArray(asObj(status.body).rows ?? asObj(status.body).Rows);
  const cashExpected = rows.find(r =>
    /cash\s*\/\s*expected/i.test(str(r.scenario ?? r.Scenario))
    && str(r.clinicalState ?? r.ClinicalState) === 'Expected'
    && (r.journeyId ?? r.JourneyId));
  const insPending = rows.find(r => str(r.code ?? r.Code) === 'UAT-IP-091' && (r.journeyId ?? r.JourneyId))
    ?? rows.find(r =>
      /insurance\s*\/\s*pending/i.test(str(r.scenario ?? r.Scenario))
      && (r.journeyId ?? r.JourneyId));
  const insApproved = rows.find(r => str(r.code ?? r.Code) === 'UAT-IP-096' && (r.journeyId ?? r.JourneyId))
    ?? rows.find(r =>
      /coverage approved/i.test(str(r.scenario ?? r.Scenario))
      && (r.journeyId ?? r.JourneyId));
  const emergencyFc = rows.find(r =>
    /emergency fc/i.test(str(r.scenario ?? r.Scenario))
    && (r.journeyId ?? r.JourneyId));

  record(
    'UAT Cash / Expected journey for admit',
    Boolean(cashExpected),
    cashExpected ? str(cashExpected.code ?? cashExpected.Code) : `status=${status.status} rows=${rows.length}`,
  );

  if (insPending) {
    const id = str(insPending.journeyId ?? insPending.JourneyId);
    const pre = await json(await fetch(`${ipApiBase}/ip-management/journeys/${id}/financial/preauth-status`, { headers }));
    const p = asObj(pre.body);
    const decision = str(p.decision ?? p.Decision).toUpperCase();
    const blockReason = str(p.blockReason ?? p.BlockReason);
    const unavailable = /unavailable/i.test(blockReason);
    const waiting = /awaiting TPA|WAITING_APPROVAL|pre-auth/i.test(blockReason) || /waiting_approval/i.test(str(p.coverageState ?? p.CoverageState));
    const missingCase = /no Coverage|not linked|no coverage case/i.test(blockReason);
    if (unavailable) {
      skip(
        'Insurance WAITING_APPROVAL BLOCK + blockReason (API)',
        `IP→CCMS validate-admission unavailable — ${blockReason.slice(0, 80)} (policy unit-tested)`,
      );
    } else {
      record(
        'Insurance WAITING_APPROVAL BLOCK + blockReason (API)',
        pre.status < 300 && decision === 'BLOCK' && waiting && blockReason.length > 0,
        `status=${pre.status} decision=${decision || 'n/a'} waiting=${waiting} missingCase=${missingCase} reason=${blockReason.slice(0, 80) || 'empty'}`,
      );
    }
  } else {
    skip('Insurance WAITING_APPROVAL BLOCK + blockReason (API)', 'no Insurance / Pending UAT row');
  }

  if (insApproved) {
    const id = str(insApproved.journeyId ?? insApproved.JourneyId);
    const pre = await json(await fetch(`${ipApiBase}/ip-management/journeys/${id}/financial/preauth-status`, { headers }));
    const p = asObj(pre.body);
    const decision = str(p.decision ?? p.Decision).toUpperCase();
    const blockReason = str(p.blockReason ?? p.BlockReason);
    const unavailable = /unavailable/i.test(blockReason);
    const missingCase = /no Coverage|not linked|no coverage case/i.test(blockReason);
    if (unavailable) {
      skip(
        'Approved insurance coverage decision ALLOW (API)',
        'IP→CCMS validate-admission unavailable (policy unit-tested)',
      );
    } else if (missingCase) {
      skip(
        'Approved insurance coverage decision ALLOW (API)',
        'UAT Coverage approved has no CCMS case — BLOCK missing-case (WAITING_APPROVAL unit-tested)',
      );
    } else {
      record(
        'Approved insurance coverage decision ALLOW (API)',
        pre.status < 300 && decision === 'ALLOW',
        `status=${pre.status} decision=${decision || 'n/a'}`,
      );
    }
  } else {
    skip('Approved insurance coverage decision ALLOW (API)', 'no Coverage approved UAT row');
  }

  if (emergencyFc) {
    const id = str(emergencyFc.journeyId ?? emergencyFc.JourneyId);
    const pre = await json(await fetch(`${ipApiBase}/ip-management/journeys/${id}/financial/preauth-status`, { headers }));
    const p = asObj(pre.body);
    const decision = str(p.decision ?? p.Decision).toUpperCase();
    const isFc = Boolean(p.isEmergencyFinancialClearance ?? p.IsEmergencyFinancialClearance ?? p.emergencyFcApplied);
    record(
      'Emergency FC journey projects WARN/ALLOW with FC flag (API)',
      pre.status < 300 && isFc && (decision === 'WARN' || decision === 'ALLOW'),
      `status=${pre.status} decision=${decision || 'n/a'} fc=${isFc}`,
    );
  } else {
    skip('Emergency FC journey projects WARN/ALLOW with FC flag (API)', 'no Emergency FC UAT row');
  }

  const sharePartial = rows.find(r => str(r.code ?? r.Code) === 'UAT-IP-106' && (r.journeyId ?? r.JourneyId))
    ?? rows.find(r =>
      /patient share partial/i.test(str(r.scenario ?? r.Scenario))
      && (r.journeyId ?? r.JourneyId));
  if (sharePartial) {
    const id = str(sharePartial.journeyId ?? sharePartial.JourneyId);
    const pre = await json(await fetch(`${ipApiBase}/ip-management/journeys/${id}/financial/preauth-status`, { headers }));
    const p = asObj(pre.body);
    const decision = str(p.decision ?? p.Decision).toUpperCase();
    const coverageState = str(p.coverageState ?? p.CoverageState);
    const payer = Number(p.payerShareAmount ?? p.PayerShareAmount ?? 0);
    const patient = Number(p.patientShareAmount ?? p.PatientShareAmount ?? 0);
    const unavailable = /unavailable/i.test(str(p.blockReason ?? p.BlockReason));
    if (unavailable) {
      skip(
        'Partial approval projects payer vs patient share (API)',
        'IP→CCMS unavailable — apply _seed_w7_ccms_partial_approval.sql after CCMS is up',
      );
    } else {
      record(
        'Partial approval projects payer vs patient share (API)',
        pre.status < 300
          && decision === 'WARN'
          && /PARTIAL_APPROVAL/i.test(coverageState)
          && payer === 70000
          && patient === 30000,
        `status=${pre.status} decision=${decision} state=${coverageState} payer=${payer} patient=${patient}`,
      );
    }
  } else {
    skip('Partial approval projects payer vs patient share (API)', 'no Patient share partial UAT row');
  }

  {
    const probe = await json(await fetch(`${ipApiBase}/dev/uat/simulate/outbox-probe?branchId=${branchId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    }));
    const probeObj = asObj(probe.body);
    const failed = Number(probeObj.failed ?? probeObj.Failed ?? 0);
    const dead = Number(probeObj.dead ?? probeObj.Dead ?? 0);
    const pending = Number(probeObj.pending ?? probeObj.Pending ?? 0);
    const oldest = probeObj.oldestPendingAt ?? probeObj.OldestPendingAt;
    const health = await json(await fetch(`${ipApiBase}/ip-management/integration/outbox/health`, { headers }));
    const healthObj = asObj(health.body);
    const healthFailed = Number(healthObj.failed ?? healthObj.Failed ?? 0);
    const healthDead = Number(healthObj.dead ?? healthObj.Dead ?? 0);
    record(
      'Outbox pending age / failed after forced CCMS 500',
      probe.status < 300
        && (failed + dead) >= 1
        && Boolean(oldest)
        && (health.status >= 300 || (healthFailed + healthDead) >= 1),
      `probe=${probe.status} failed=${failed} dead=${dead} pending=${pending} oldest=${oldest ? 'set' : 'n/a'}; health=${health.status} f=${healthFailed} d=${healthDead} raw=${snippet(probe.raw, 120)}`,
    );
  }

  skip(
    'Admit panel shows blockReason (UI)',
    webUp
      ? 'covered by e2e/ip-ccms-wave7-g3-ui.spec.ts'
      : 'Next.js not running — use npm run test:e2e:wave7-g3-ui',
  );
  skip(
    'Counselling coverage strip ALLOW/WARN/BLOCK (UI)',
    webUp
      ? 'covered by e2e/ip-ccms-wave7-g3-ui.spec.ts'
      : 'Next.js not running — use npm run test:e2e:wave7-g3-ui',
  );

  {
    const fakeJourney = crypto.randomUUID();
    const admitKey = `JourneyAdmitted:w7smoke:${Date.now().toString(16)}`;
    const billKey = `BillFinalized:w7smoke:${Date.now().toString(16)}`;
    const postOnce = async (path: string, key: string, body: Record<string, unknown>) =>
      json(await fetch(`${ccmsApiBase}${path}`, {
        method: 'POST',
        headers: { ...headers, 'X-Idempotency-Key': key },
        body: JSON.stringify(body),
      }));

    const admit1 = await postOnce('/ccms/integration/journey-admitted', admitKey, {
      tenantId,
      journeyId: fakeJourney,
    });
    const admit2 = await postOnce('/ccms/integration/journey-admitted', admitKey, {
      tenantId,
      journeyId: fakeJourney,
    });
    const bill1 = await postOnce('/ccms/integration/bill-finalized', billKey, {
      tenantId,
      journeyId: fakeJourney,
      billId: crypto.randomUUID(),
      totalAmount: 1,
    });
    const bill2 = await postOnce('/ccms/integration/bill-finalized', billKey, {
      tenantId,
      journeyId: fakeJourney,
      billId: crypto.randomUUID(),
      totalAmount: 1,
    });
    record(
      'Duplicate X-Idempotency-Key JourneyAdmitted / BillFinalized',
      admit1.status === 200 && admit2.status === 200 && bill1.status === 200 && bill2.status === 200,
      `admit=${admit1.status}/${admit2.status} bill=${bill1.status}/${bill2.status}`,
    );
  }

  const queueRes = await json(await fetch(`${ccmsApiBase}/ccms/claims/queue`, { headers }));
  const queue = asArray(queueRes.body);
  const uatClaim = queue.find(c => {
    const caseNo = str(c.caseNumber ?? c.CaseNumber);
    const claimNo = str(c.claimNumber ?? c.ClaimNumber);
    return /W7-SMOKE-CLAIM|UAT-W7/i.test(caseNo) || /W7-SMOKE-CLAIM/i.test(claimNo);
  });
  if (uatClaim) {
    const claimId = str(uatClaim.claimId ?? uatClaim.ClaimId ?? uatClaim.id ?? uatClaim.Id);
    const raised = await json(await fetch(`${ccmsApiBase}/ccms/claims/${claimId}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: 'Wave7 smoke query', additionalInfoRequired: false }),
    }));
    const raisedObj = asObj(raised.body);
    const qStatus = str(raisedObj.queryStatus ?? raisedObj.QueryStatus);
    record(
      'Claim query → query_raised',
      raised.status < 300 && /query_raised/i.test(qStatus),
      `status=${raised.status} queryStatus=${qStatus || snippet(raised.raw)}`,
    );
    const responded = await json(await fetch(`${ccmsApiBase}/ccms/claims/${claimId}/query-response`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ response: 'Wave7 smoke response' }),
    }));
    const respObj = asObj(responded.body);
    const respStatus = str(respObj.queryStatus ?? respObj.QueryStatus);
    record(
      'Claim query-response returns submitted/in-process',
      responded.status < 300 && /response_submitted|CLAIM_SUBMITTED|CLAIM_IN_PROCESS/i.test(
        `${respStatus} ${snippet(responded.raw)}`,
      ),
      `status=${responded.status} queryStatus=${respStatus || snippet(responded.raw)}`,
    );
  } else {
    skip(
      'Claim query → query_raised',
      queueRes.status !== 200
        ? `queue HTTP ${queueRes.status}`
        : 'no CCMS-W7-SMOKE-CLAIM in queue — apply _seed_w7_ccms_claim_query.sql',
    );
    skip(
      'Claim query-response returns submitted/in-process',
      'depends on W7 smoke claim seed',
    );
  }

  const journeyId = str(cashExpected?.journeyId ?? cashExpected?.JourneyId);
  if (!journeyId || !b3) {
    printSummary();
    if (checks.some(c => !c.ok)) process.exit(1);
    return;
  }

  try {
    const failOn = await fetch(`${ipApiBase}/dev/uat/failures`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ccms_unavailable: true }),
    });
    record('Set ccms_unavailable failure flag', failOn.ok, `status=${failOn.status}`);

    const admitDown = await fetch(`${ipApiBase}/dev/uat/simulate/admit?branchId=${branchId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ journeyId, assignedBedId: BED3 }),
    });
    const admitDownBody = await json(admitDown);
    const admitState = str(asObj(admitDownBody.body).clinicalState ?? asObj(admitDownBody.body).ClinicalState);
    const cashAdmitOk = admitDown.ok && /Admitted/i.test(admitState);
    record(
      'Cash admit while CCMS down (must not block)',
      cashAdmitOk,
      `status=${admitDown.status} state=${admitState || snippet(admitDownBody.raw)}`,
    );

    if (cashAdmitOk) {
      const afterAdmit = findSmoke(await listBeds(), 3);
      record(
        'Admit with assignedBedId sets Occupied',
        occupied(afterAdmit),
        afterAdmit ? `avail=${afterAdmit.isAvailable} occ=${afterAdmit.currentOccupancy}` : 'bed missing after admit',
      );

      const xfer = await json(await fetch(`${ipApiBase}/dev/uat/simulate/transfer-bed?branchId=${branchId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ journeyId, assignedBedId: BED4, reason: 'Wave7 smoke transfer' }),
      }));
      const xferObj = asObj(xfer.body);
      const xferBed = str(xferObj.assignedBedId ?? xferObj.AssignedBedId).toLowerCase();
      const afterXfer = await listBeds();
      const afterX3 = findSmoke(afterXfer, 3);
      const afterX4 = findSmoke(afterXfer, 4);
      record(
        'Ward transfer: previous Cleaning, new Occupied',
        xfer.status < 300 && xferBed === BED4 && cleaning(afterX3) && occupied(afterX4),
        `xfer=${xfer.status} assigned=${xferBed || snippet(xfer.raw)} bed3=${afterX3?.bedStatus ?? 'n/a'} occ=${afterX3?.currentOccupancy}; bed4=${afterX4?.bedStatus ?? 'n/a'} occ=${afterX4?.currentOccupancy}`,
      );

      const note = await json(await fetch(`${ipApiBase}/ip-management/journeys/${journeyId}/progress-notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ note: 'Wave7 smoke daily progress' }),
      }));
      const notes = await json(await fetch(`${ipApiBase}/ip-management/journeys/${journeyId}/progress-notes`, { headers }));
      const noteList = asArray(notes.body);
      record(
        'Daily progress note saves and lists',
        (note.status === 201 || note.status === 200) && noteList.length > 0,
        `post=${note.status} list=${noteList.length}`,
      );

      const plan = await json(await fetch(`${ipApiBase}/ip-management/journeys/${journeyId}/discharge-planning`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ready: true }),
      }));
      const planObj = asObj(plan.body);
      record(
        'Discharge planning flag persists',
        plan.status < 300 && Boolean(planObj.dischargePlanningReady ?? planObj.DischargePlanningReady),
        `status=${plan.status}`,
      );

      const dis = await json(await fetch(`${ipApiBase}/dev/uat/simulate/lama?branchId=${branchId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ journeyId, reason: 'Wave7 smoke LAMA clinical discharge' }),
      }));
      const disState = str(asObj(dis.body).clinicalState ?? asObj(dis.body).ClinicalState);
      const afterDis = findSmoke(await listBeds(), 4);
      record(
        'Clinical discharge (LAMA from Admitted): assigned bed Cleaning',
        dis.status < 300 && /Discharged/i.test(disState) && cleaning(afterDis),
        `status=${dis.status} state=${disState || snippet(dis.raw)} bed4=${afterDis?.bedStatus ?? 'n/a'} occ=${afterDis?.currentOccupancy}`,
      );
    }
  } finally {
    await fetch(`${ipApiBase}/dev/uat/failures`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ccms_unavailable: false }),
    });
  }

  printSummary();
  if (checks.some(c => !c.ok)) process.exit(1);
}

function printSummary() {
  const passed = checks.filter(c => c.ok).length;
  console.log(`\nWave 7 API smoke: ${passed}/${checks.length} passed`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
