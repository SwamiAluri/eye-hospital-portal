/**
 * CLI: Seed / reset / reseed UAT IP dataset via development-only IP APIs.
 * Requires EnableUatDataSeeder=true and non-Production environment.
 *
 *   npx tsx scripts/seed-uat-dataset.ts seed
 *   npx tsx scripts/seed-uat-dataset.ts reset
 *   npx tsx scripts/seed-uat-dataset.ts reseed
 *   npx tsx scripts/seed-uat-dataset.ts status
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

const action = (process.argv[2] ?? 'seed').toLowerCase();

async function main() {
  const loginRes = await fetch(`${authApiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, tenantId }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  const login = (await loginRes.json()) as { accessToken: string };
  const headers = {
    Authorization: `Bearer ${login.accessToken}`,
    'X-Tenant-ID': tenantId,
    'Content-Type': 'application/json',
  };

  const path = action === 'status' ? 'status' : action;
  const method = action === 'status' ? 'GET' : 'POST';
  const url = `${ipApiBase}/dev/uat/${path}?branchId=${branchId}`;
  const res = await fetch(url, { method, headers, body: method === 'POST' ? '{}' : undefined });
  const text = await res.text();
  console.log(res.status, text.slice(0, 4000));
  if (!res.ok) process.exit(1);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
