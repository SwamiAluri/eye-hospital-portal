/**
 * UAT-only: establish a real CoverageAllocationEngine summary so Step 12
 * enhancement reallocation can be live-certified.
 *
 * Does NOT invent a financial engine. Calls existing:
 *   POST /api/opdbills/ip-ensure
 *   POST /api/ccms/coverage-cases/{id}/billing/allocate  (CoverageAllocationEngine)
 *
 * Does NOT PATCH insurance_claim_amount / AmountPaid / BalanceDue / PatientShareAmount.
 * Does NOT insert ledger rows. Does NOT approve an enhancement.
 *
 * Default target: CCMS-W7-SMOKE-PARTIAL (approved 70_000, bill 105_000 remainder
 * already yields patient share). CopayPercent=10 is passed so InferCopayPercent
 * survives a later enhancement decide.
 *
 *   npx tsx scripts/seed-uat-enhancement-copay-fixture.ts
 *   npx tsx scripts/seed-uat-enhancement-copay-fixture.ts status
 *
 * Env: E2E_API_URL, E2E_IP_MANAGEMENT_API_URL, E2E_CCMS_API_URL,
 *      E2E_TEST_TENANT_ID, E2E_TEST_EMAIL, E2E_TEST_PASSWORD,
 *      UAT_ENHANCEMENT_CASE_ID, UAT_COPAY_PERCENT
 */
const authApiBase = (process.env.E2E_API_URL ?? 'http://localhost:5073/api').replace(/\/$/, '');
const ipApiBase = (
  process.env.E2E_IP_MANAGEMENT_API_URL
  ?? process.env.NEXT_PUBLIC_IP_MANAGEMENT_API_URL
  ?? 'http://localhost:5074/api'
).replace(/\/$/, '');
const ccmsApiBase = (
  process.env.E2E_CCMS_API_URL
  ?? process.env.NEXT_PUBLIC_CCMS_API_URL
  ?? 'http://localhost:7075/api'
).replace(/\/$/, '');
const tenantId = process.env.E2E_TEST_TENANT_ID ?? '155fe198-6ae5-4a01-9254-ead5b427247e';
const email = process.env.E2E_TEST_EMAIL ?? 'admin@test.com';
const password = process.env.E2E_TEST_PASSWORD ?? 'Admin123!';

/** Wave 7 partial-approval UAT case (journey-linked, approved 70k, bill 105k). */
const DEFAULT_CASE_ID = 'b2000001-0000-4000-8000-0000000000ca';
const COPAY_PERCENT = Number(process.env.UAT_COPAY_PERCENT ?? '10');
const statusOnly = (process.argv[2] ?? '').toLowerCase() === 'status';

type Json = Record<string, unknown>;

function unwrap(body: unknown): unknown {
  if (body && typeof body === 'object') {
    const o = body as Json;
    if ('value' in o && o.value !== undefined) return unwrap(o.value);
    if (Array.isArray(o.$values)) return o.$values;
  }
  return body;
}

function asObj(body: unknown): Json {
  const u = unwrap(body);
  if (u && typeof u === 'object' && !Array.isArray(u)) return u as Json;
  return {};
}

function pick(obj: Json, ...keys: string[]): unknown {
  const lower = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    const hit = lower[key.toLowerCase()];
    if (hit !== undefined && hit !== null) return hit;
  }
  return undefined;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return false;
}

/** Mirror of CoverageAllocationEngine.ComputeSplit (no exclusions). */
function computeSplit(totalBill: number, approvedLimit: number, copayPercent: number, deductible: number) {
  const payable = Math.max(0, totalBill);
  const limit = Math.max(0, approvedLimit);
  const covered = Math.min(payable, limit);
  const copay = Math.round((covered * Math.max(0, copayPercent) / 100) * 100) / 100;
  const insurance = Math.max(covered - copay - Math.max(0, deductible), 0);
  const patient = Math.max(payable - insurance, 0);
  return { covered, copay, insurance, patient };
}

async function json(res: Response) {
  const text = await res.text();
  try {
    return { status: res.status, body: text ? JSON.parse(text) : null, raw: text };
  } catch {
    return { status: res.status, body: null, raw: text };
  }
}

function fail(message: string): never {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

async function main() {
  const loginRes = await json(await fetch(`${authApiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, tenantId }),
  }));
  if (loginRes.status !== 200) fail(`Login failed: ${loginRes.status} ${loginRes.raw.slice(0, 400)}`);
  const token = str(pick(asObj(loginRes.body), 'accessToken', 'token'));
  if (!token) fail('Login succeeded but no accessToken');

  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': tenantId,
    'Content-Type': 'application/json',
  };

  const caseId = process.env.UAT_ENHANCEMENT_CASE_ID ?? DEFAULT_CASE_ID;
  const caseRes = await json(await fetch(`${ccmsApiBase}/ccms/coverage-cases/${caseId}`, { headers }));
  if (caseRes.status !== 200) fail(`GET coverage case ${caseId}: ${caseRes.status} ${caseRes.raw.slice(0, 400)}`);
  const coverage = asObj(caseRes.body);
  const caseNumber = str(pick(coverage, 'caseNumber'));
  const journeyId = str(pick(coverage, 'journeyId'));
  const currentState = str(pick(coverage, 'currentState'));
  const caseApproved = num(pick(coverage, 'approvedAmount'));
  if (!journeyId) fail(`${caseNumber || caseId} has no journeyId — CCMS cannot push allocation to Billing`);
  if (caseApproved <= 0) fail(`${caseNumber || caseId} ApprovedAmount is ${caseApproved}`);

  const authzRes = await json(await fetch(`${ccmsApiBase}/ccms/coverage-cases/${caseId}/authorization`, { headers }));
  const authz = asObj(authzRes.body);
  const authApproved = num(pick(authz, 'approvedAmount'));
  const approvedLimit = Math.max(authApproved, caseApproved);

  const journeyRes = await json(await fetch(`${ipApiBase}/ip-management/journeys/${journeyId}`, { headers }));
  if (journeyRes.status !== 200) {
    fail(`GET journey ${journeyId}: ${journeyRes.status} ${journeyRes.raw.slice(0, 400)}`);
  }
  const journey = asObj(journeyRes.body);
  const journeyStatus = str(pick(journey, 'status', 'currentStatus', 'journeyStatus'));

  const ensureRes = await json(await fetch(`${authApiBase}/opdbills/ip-ensure`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ patientJourneyId: journeyId }),
  }));
  if (ensureRes.status < 200 || ensureRes.status >= 300) {
    fail(`POST ip-ensure: ${ensureRes.status} ${ensureRes.raw.slice(0, 400)}`);
  }
  const ensured = asObj(ensureRes.body);
  const billId = str(pick(ensured, 'id'));
  if (!billId) fail('ip-ensure returned no bill id');

  const billRes = await json(await fetch(`${authApiBase}/opdbills/${billId}`, { headers }));
  if (billRes.status !== 200) fail(`GET opdbill ${billId}: ${billRes.status} ${billRes.raw.slice(0, 400)}`);
  const billBefore = asObj(billRes.body);
  const billNumber = str(pick(billBefore, 'billNumber'));
  const gross = num(pick(billBefore, 'grossAmount'));
  const amountPaid = num(pick(billBefore, 'amountPaid'));
  const claimBefore = num(pick(billBefore, 'insuranceClaimAmount'));
  const isFinalized = bool(pick(billBefore, 'isFinalized'));
  const isLocked = bool(pick(billBefore, 'isLocked'));
  if (gross <= 0) fail(`Bill ${billNumber} GrossAmount is ${gross} — allocate would create a zero summary`);
  if (isFinalized) fail(`Bill ${billNumber} is finalized — Step 12 cert needs an open bill`);
  if (isLocked) fail(`Bill ${billNumber} is locked — Step 12 cert needs an unlocked bill`);

  const expected = computeSplit(gross, approvedLimit, COPAY_PERCENT, 0);

  const summaryRes = await json(await fetch(`${ccmsApiBase}/ccms/coverage-cases/${caseId}/billing`, { headers }));
  const existing = summaryRes.status === 200 ? asObj(summaryRes.body) : {};
  const existingTotal = num(pick(existing, 'totalBillAmount'));
  const existingPatient = num(pick(existing, 'patientShareAmount'));
  const existingIns = num(pick(existing, 'insuranceShareAmount'));
  const existingCopay = num(pick(existing, 'copayAmount'));

  const alreadyReady =
    existingTotal > 0
    && existingPatient > 0
    && Math.abs(existingTotal - gross) < 0.01
    && Math.abs(existingPatient - expected.patient) < 0.01
    && Math.abs(existingIns - expected.insurance) < 0.01;

  console.log('CASE', caseNumber, caseId);
  console.log('JOURNEY', journeyId, journeyStatus || '(status omitted)');
  console.log('BILL', billNumber, billId, `gross=${gross}`, `paid=${amountPaid}`, `claimBefore=${claimBefore}`, `finalized=${isFinalized}`, `locked=${isLocked}`);
  console.log('LIMIT', `case=${caseApproved}`, `auth=${authApproved}`, `resolved=${approvedLimit}`, `state=${currentState}`);
  console.log('EXPECTED', `copayPct=${COPAY_PERCENT}`, `ins=${expected.insurance}`, `pat=${expected.patient}`, `copayAmt=${expected.copay}`);

  if (statusOnly) {
    if (alreadyReady) {
      console.log('STATUS READY existing summary matches engine split');
      process.exit(0);
    }
    fail(`STATUS NOT READY summary total=${existingTotal} ins=${existingIns} pat=${existingPatient} copay=${existingCopay}`);
  }

  if (alreadyReady) {
    console.log('SKIP allocate — CcmsBillingSummary already matches CoverageAllocationEngine split');
  } else {
    const allocateBody = {
      billId,
      BillId: billId,
      totalBillAmount: gross,
      TotalBillAmount: gross,
      copayPercent: COPAY_PERCENT,
      CopayPercent: COPAY_PERCENT,
      deductibleAmount: 0,
      DeductibleAmount: 0,
    };
    const allocRes = await json(await fetch(`${ccmsApiBase}/ccms/coverage-cases/${caseId}/billing/allocate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(allocateBody),
    }));
    if (allocRes.status !== 200 && allocRes.status !== 201) {
      fail(`POST allocate: ${allocRes.status} ${allocRes.raw.slice(0, 800)}`);
    }
    const allocated = asObj(allocRes.body);
    console.log(
      'ALLOCATE',
      allocRes.status,
      `total=${num(pick(allocated, 'totalBillAmount'))}`,
      `ins=${num(pick(allocated, 'insuranceShareAmount'))}`,
      `pat=${num(pick(allocated, 'patientShareAmount'))}`,
      `copay=${num(pick(allocated, 'copayAmount'))}`,
    );
  }

  const afterSummaryRes = await json(await fetch(`${ccmsApiBase}/ccms/coverage-cases/${caseId}/billing`, { headers }));
  if (afterSummaryRes.status !== 200) fail(`GET billing summary after allocate: ${afterSummaryRes.status}`);
  const afterSummary = asObj(afterSummaryRes.body);
  const total = num(pick(afterSummary, 'totalBillAmount'));
  const patientShare = num(pick(afterSummary, 'patientShareAmount'));
  const insuranceShare = num(pick(afterSummary, 'insuranceShareAmount'));
  const copayAmt = num(pick(afterSummary, 'copayAmount'));
  const summaryBillId = str(pick(afterSummary, 'billId'));

  const afterBillRes = await json(await fetch(`${authApiBase}/opdbills/${billId}`, { headers }));
  const afterBill = asObj(afterBillRes.body);
  const claimAfter = num(pick(afterBill, 'insuranceClaimAmount'));
  const paidAfter = num(pick(afterBill, 'amountPaid'));
  const dueAfter = num(pick(afterBill, 'balanceDue'));
  const finalizedAfter = bool(pick(afterBill, 'isFinalized'));
  const lockedAfter = bool(pick(afterBill, 'isLocked'));

  if (total <= 0) fail(`CcmsBillingSummary.total_bill_amount is ${total} — allocate JSON may not have bound TotalBillAmount`);
  if (patientShare <= 0) fail(`patient_share_amount is ${patientShare} — fixture is not usable for copay certification`);
  if (Math.abs(patientShare - expected.patient) > 0.05) {
    fail(`patient share ${patientShare} != engine expected ${expected.patient}`);
  }
  if (Math.abs(insuranceShare - expected.insurance) > 0.05) {
    fail(`insurance share ${insuranceShare} != engine expected ${expected.insurance}`);
  }
  if (claimAfter <= 0) {
    fail(`OpdBill.InsuranceClaimAmount is ${claimAfter} — CoverageAllocationEngine did not push Billing`);
  }
  if (Math.abs(claimAfter - insuranceShare) > 0.05) {
    fail(`Billing InsuranceClaimAmount ${claimAfter} != CCMS insuranceShare ${insuranceShare}`);
  }
  if (finalizedAfter || lockedAfter) fail('Bill became finalized or locked — fixture is no longer certifiable');

  console.log('CCMS_SUMMARY', `total=${total}`, `ins=${insuranceShare}`, `pat=${patientShare}`, `copay=${copayAmt}`, `billId=${summaryBillId}`);
  console.log('BILLING', `claim=${claimAfter}`, `paid=${paidAfter}`, `due=${dueAfter}`, `finalized=${finalizedAfter}`, `locked=${lockedAfter}`);
  console.log('READY Step 12 enhancement copay fixture is live. Do not approve enhancement in this step.');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
