/**
 * CI — wired manifest entity types must exist in SQL registry migrations.
 * Run: npm run test:parity:master-registry
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { WIRED_MASTER_ENTITY_TYPES } from '../src/lib/master-data/integration-manifest';

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'migrations');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/** Extract entity_type values from INSERT INTO master.entity_type_registry … */
function collectRegistryEntityTypes(): Set<string> {
  const types = new Set<string>();
  const insertRe =
    /INSERT\s+INTO\s+master\.entity_type_registry[^;]*VALUES\s*([\s\S]*?);/gi;

  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    let match: RegExpExecArray | null;
    while ((match = insertRe.exec(sql)) !== null) {
      const valuesBlock = match[1];
      const rowRe = /\(\s*'([^']+)'/g;
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowRe.exec(valuesBlock)) !== null) {
        types.add(rowMatch[1]);
      }
    }
  }

  return types;
}

const registryTypes = collectRegistryEntityTypes();
assert(registryTypes.size >= 50, `Expected 50+ registry types from migrations, got ${registryTypes.size}`);

const missingFromRegistry: string[] = [];
for (const entityType of WIRED_MASTER_ENTITY_TYPES) {
  if (!registryTypes.has(entityType)) {
    missingFromRegistry.push(entityType);
  }
}

assert(
  missingFromRegistry.length === 0,
  `Wired manifest entity types missing from entity_type_registry migrations:\n  ${missingFromRegistry.join('\n  ')}`,
);

console.log(`Master registry parity: ${WIRED_MASTER_ENTITY_TYPES.length} wired types ⊆ ${registryTypes.size} registry entries — OK`);
