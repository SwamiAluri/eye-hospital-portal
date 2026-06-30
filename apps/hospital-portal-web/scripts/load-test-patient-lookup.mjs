/**
 * Concurrent load smoke test for GET /patients/lookup.
 * Usage: node scripts/load-test-patient-lookup.mjs
 */

const AUTH_BASE = process.env.AUTH_BASE_URL ?? 'http://localhost:5073/api';
const EMAIL = process.env.LOGIN_EMAIL ?? 'admin@test.com';
const PASSWORD = process.env.LOGIN_PASSWORD ?? 'Admin123!';
const TENANT_ID = process.env.TENANT_ID ?? '155fe198-6ae5-4a01-9254-ead5b427247e';
const BRANCH_ID = process.env.BRANCH_ID ?? '74c014cf-9570-4824-bdf9-b369ea11a8f4';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 10);
const REQUESTS = Number(process.env.REQUESTS ?? 100);

async function login() {
  const res = await fetch(`${AUTH_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantId: TENANT_ID }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  const token = data.accessToken ?? data.token ?? data.jwt;
  if (!token) throw new Error('No token in login response');
  return token;
}

async function lookup(token) {
  const url = new URL(`${AUTH_BASE}/patients/lookup`);
  url.searchParams.set('branchId', BRANCH_ID);
  url.searchParams.set('tab', 'all');
  url.searchParams.set('page', '1');
  url.searchParams.set('pageSize', '25');
  const started = performance.now();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-ID': TENANT_ID,
    },
  });
  const ms = performance.now() - started;
  return { ok: res.ok, ms, status: res.status };
}

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function main() {
  console.log(`Login → ${REQUESTS} lookups @ concurrency ${CONCURRENCY}`);
  const token = await login();

  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < REQUESTS) {
      const i = cursor++;
      if (i >= REQUESTS) break;
      results.push(await lookup(token));
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const failures = results.filter((r) => !r.ok);
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);

  console.log(`OK: ${results.length - failures.length}/${results.length}`);
  console.log(`p50: ${p50.toFixed(0)}ms  p95: ${p95.toFixed(0)}ms`);
  if (failures.length) {
    console.log('Sample failure:', failures[0]);
  }

  const failRate = failures.length / results.length;
  if (failRate > 0.05 || p95 > 3000) {
    console.error('Load test thresholds exceeded');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
