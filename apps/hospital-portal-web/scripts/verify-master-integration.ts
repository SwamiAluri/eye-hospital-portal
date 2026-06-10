/**
 * Master data integration CI — wired entity types must be referenced in frontend.
 * Run: npm run test:parity:master
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  MASTER_ENTITY_INTEGRATIONS,
  WIRED_MASTER_ENTITY_TYPES,
  type MasterIntegrationStatus,
} from '../src/lib/master-data/integration-manifest';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const SRC_ROOT = join(__dirname, '..', 'src');
const TEXT_EXT = new Set(['.ts', '.tsx']);

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      collectSourceFiles(full, out);
    } else if (TEXT_EXT.has(name.slice(name.lastIndexOf('.')))) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = collectSourceFiles(SRC_ROOT);
const sourceBlob = sourceFiles
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

function isReferencedInSource(entityType: string): boolean {
  const patterns = [
    `useMasterValues('${entityType}')`,
    `useMasterValues("${entityType}")`,
    `lookup/${entityType}`,
    `lookup('${entityType}')`,
    `'${entityType}'`,
  ];
  // use-clinical-catalog-master wraps surgery_type / iol_catalog
  if (entityType === 'clinical.surgery_type' || entityType === 'clinical.iol_catalog') {
    return sourceBlob.includes(entityType);
  }
  return patterns.some((p) => sourceBlob.includes(p));
}

// Registry sanity
const entityTypes = new Set<string>();
for (const row of MASTER_ENTITY_INTEGRATIONS) {
  assert(!entityTypes.has(row.entityType), `Duplicate manifest entry: ${row.entityType}`);
  entityTypes.add(row.entityType);
}

// Wired entities must be referenced
const missingWiring: string[] = [];
for (const entityType of WIRED_MASTER_ENTITY_TYPES) {
  if (!isReferencedInSource(entityType)) {
    missingWiring.push(entityType);
  }
}
assert(
  missingWiring.length === 0,
  `Wired master entities missing frontend reference:\n  ${missingWiring.join('\n  ')}`,
);

// Summary counts
const byStatus = new Map<MasterIntegrationStatus, number>();
for (const row of MASTER_ENTITY_INTEGRATIONS) {
  byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
}

console.log(`Master integration manifest: ${MASTER_ENTITY_INTEGRATIONS.length} entries`);
for (const [status, count] of [...byStatus.entries()].sort()) {
  console.log(`  ${status}: ${count}`);
}
console.log(`Wired entities verified in source: ${WIRED_MASTER_ENTITY_TYPES.length}`);
console.log('Master integration check passed.');
