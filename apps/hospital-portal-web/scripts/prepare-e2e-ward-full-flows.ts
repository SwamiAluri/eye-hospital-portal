/**
 * Ensures Expected + Admitted exist, then leaves ReadyForSurgery to seed:e2e:ward-ready.
 * Rebooks CancelledSurgery when Expected would be emptied by admit.
 */
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

type JourneyRow = { id: string; patientName: string | null; clinicalState: string; paymentMode?: string | null };

async function journeyDetail(h: Record<string, string>, id: string): Promise<{ paymentMode?: string | null } | null> {
  const res = await fetch(`${ipApiBase}/ip-management/journeys/${id}`, { headers: h });
  if (!res.ok) return null;
  return (await readJson(res)) as { paymentMode?: string | null };
}

function isCoverageMode(mode?: string | null): boolean {
  const m = (mode ?? '').toLowerCase();
  return m.includes('insurance') || m.includes('tpa') || m.includes('cghs') || m === 'coverage' || m.includes('cashless');
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': tenantId,
    'Content-Type': 'application/json',
  };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function listJourneys(h: Record<string, string>): Promise<JourneyRow[]> {
  const res = await fetch(`${ipApiBase}/ip-management/journeys?branchId=${branchId}&limit=500`, { headers: h });
  if (!res.ok) throw new Error(`List journeys failed: ${res.status} ${JSON.stringify(await readJson(res))}`);
  const rows = await readJson(res);
  return Array.isArray(rows) ? rows as JourneyRow[] : [];
}

async function main() {
  const loginRes = await fetch(`${authApiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, tenantId }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
  const login = (await loginRes.json()) as { accessToken: string };
  const h = headers(login.accessToken);

  const onboard = await fetch(
    `${ipApiBase}/ip-management/journeys/onboard-expected?branchId=${branchId}`,
    { method: 'POST', headers: h },
  );
  if (!onboard.ok) {
    console.warn(`onboard-expected: ${onboard.status} ${JSON.stringify(await readJson(onboard))}`);
  }

  let journeys = await listJourneys(h);
  const by = (state: string) => journeys.filter(j => j.clinicalState === state);

  const cancelled = by('CancelledSurgery');
  while (by('Expected').length < 2 && cancelled.length > 0) {
    const next = cancelled.shift()!;
    const res = await fetch(`${ipApiBase}/ip-management/journeys/${next.id}/rebook`, {
      method: 'POST',
      headers: h,
    });
    if (!res.ok) {
      console.warn(`  rebook failed ${next.patientName}: ${res.status} ${JSON.stringify(await readJson(res))}`);
      continue;
    }
    console.log(`Rebooked ${next.patientName} → Expected`);
    journeys = await listJourneys(h);
  }

  journeys = await listJourneys(h);
  const expected = () => journeys.filter(j => j.clinicalState === 'Expected');
  const admitted = () => journeys.filter(j => j.clinicalState === 'Admitted');
  const isUat = (j: JourneyRow) => j.id.startsWith('11111111');

  async function admitJourney(row: JourneyRow) {
    const wardsRes = await fetch(`${ipApiBase}/ip-management/wards?branchId=${branchId}`, { headers: h });
    const wards = (await readJson(wardsRes)) as Array<{ id: string }>;
    const wardId = Array.isArray(wards) ? wards[0]?.id : undefined;
    if (!wardId) throw new Error('No ward available to admit into.');
    const admitRes = await fetch(`${ipApiBase}/ip-management/journeys/${row.id}/admit`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        wardId,
        admissionType: 'DayCare',
        acknowledgeWarnings: true,
        overrideStateCheck: false,
        bypassFinancialClearance: false,
      }),
    });
    const admittedBody = await readJson(admitRes) as { clinicalState?: string };
    if (!admitRes.ok || admittedBody.clinicalState !== 'Admitted') {
      throw new Error(`Admit failed for ${row.patientName}: ${admitRes.status} ${JSON.stringify(admittedBody)}`);
    }
    console.log(`Admitted ${row.patientName} (${row.id})`);
    journeys = await listJourneys(h);
    await ensureOccupiedBed(h, row.id);
  }

  async function ensureOccupiedBed(h: Record<string, string>, journeyId: string) {
    const detail = await journeyDetail(h, journeyId) as { assignedBedId?: string | null; branchId?: string };
    if (detail?.assignedBedId) return;
    const internalKey = process.env.E2E_INTERNAL_API_KEY
      ?? process.env.AuthService__InternalApiKey
      ?? 'hp-internal-svc-key-change-in-production-2026';
    const bedsRes = await fetch(
      `${authApiBase}/internal/ip-beds?tenantId=${tenantId}&branchId=${branchId}`,
      { headers: { 'X-Internal-Key': internalKey } },
    );
    const beds = (await readJson(bedsRes)) as Array<{ bedId?: string; bedStatus?: string }>;
    const dest = Array.isArray(beds)
      ? beds.find(b => (b.bedStatus ?? '') === 'Available' && b.bedId)
      : undefined;
    if (!dest?.bedId) {
      console.warn('No Available Auth bed to occupy after admit.');
      return;
    }
    const xfer = await fetch(`${ipApiBase}/ip-management/journeys/${journeyId}/transfer-bed`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ assignedBedId: dest.bedId, reason: 'E2E occupy after admit' }),
    });
    if (!xfer.ok) {
      console.warn(`transfer-bed after admit: ${xfer.status} ${JSON.stringify(await readJson(xfer))}`);
    } else {
      console.log(`Occupied bed ${dest.bedId} for ${journeyId}`);
    }
  }

  if (admitted().length === 0) {
    const pool = expected();
    if (pool.length === 0) {
      throw new Error('No Expected journey to admit. Finalize OT counselling or rebook a cancelled surgery.');
    }
    const ranked: JourneyRow[] = [];
    for (const row of pool) {
      const d = await journeyDetail(h, row.id);
      ranked.push({ ...row, paymentMode: d?.paymentMode });
    }
    const order = [
      ...ranked.filter(j => !isUat(j) && !isCoverageMode(j.paymentMode)),
      ...ranked.filter(j => isUat(j) && !isCoverageMode(j.paymentMode)),
      ...ranked.filter(j => isCoverageMode(j.paymentMode)),
    ];
    let admittedOk = false;
    for (const toAdmit of order) {
      try {
        if (isCoverageMode(toAdmit.paymentMode)) {
          console.warn(`Trying coverage journey ${toAdmit.patientName} — CCMS must be reachable.`);
        }
        await admitJourney(toAdmit);
        admittedOk = true;
        break;
      } catch (err) {
        console.warn(err instanceof Error ? err.message : err);
      }
    }
    if (!admittedOk) {
      throw new Error('Could not admit any Expected journey (CCMS unreachable for coverage; no cash Expected).');
    }
  } else {
    console.log(`Admitted already present: ${admitted()[0].patientName}`);
    await ensureOccupiedBed(h, admitted()[0].id);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
