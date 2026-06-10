/**
 * F1.7 — Run import-legacy-lab-catalog.sql for one tenant.
 *
 * Usage:
 *   $env:TENANT_ID="155fe198-6ae5-4a01-9254-ead5b427247e"
 *   $env:DATABASE_URL="postgresql://user:pass@localhost:5432/hospital"
 *   npx tsx scripts/run-import-legacy-lab-catalog.ts
 *
 * Requires `psql` on PATH. Idempotent — skips existing variant codes.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';

const TENANT_ID = process.env.TENANT_ID ?? process.env.E2E_TEST_TENANT_ID;
const DATABASE_URL = process.env.DATABASE_URL;

if (!TENANT_ID) {
  console.error('Set TENANT_ID (or E2E_TEST_TENANT_ID) to the tenant UUID.');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL to a PostgreSQL connection string.');
  process.exit(1);
}

const sqlPath = path.join(__dirname, 'import-legacy-lab-catalog.sql');
let sql = readFileSync(sqlPath, 'utf8');

sql = sql.replace(/:'tenant_id'/g, `'${TENANT_ID}'`);

const tmpFile = path.join(__dirname, `.import-lab-catalog-${Date.now()}.sql`);
writeFileSync(tmpFile, sql, 'utf8');

try {
  console.log(`Importing lab_test_catalog → service catalog for tenant ${TENANT_ID}…`);
  execSync(`psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${tmpFile}"`, {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('Import complete. Sync counsellor tabs via GET /api/servicecatalog/full (B2).');
} catch (e) {
  console.error('Import failed:', e);
  process.exit(1);
} finally {
  try {
    unlinkSync(tmpFile);
  } catch {
    /* ignore */
  }
}
