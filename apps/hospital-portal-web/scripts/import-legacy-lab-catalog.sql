-- F1.7 — One-time import: lab_test_catalog → Service Catalog (INVESTIGATIONS / DIAGNOSTICS)
-- Run per tenant after reviewing category mapping. Idempotent on (tenant_id, test_code).
--
-- Prerequisites:
--   1. Service Catalog schema deployed (service_catalog_* tables)
--   2. Legacy rows in lab_test_catalog (deprecated GET /api/Counseling/master-catalog source)
--
-- Usage (psql):
--   \set tenant_id 'YOUR-TENANT-UUID'
--   \i scripts/import-legacy-lab-catalog.sql

-- Example mapping — adjust category_slug to match your catalog groups:
--   category ILIKE '%imaging%' OR '%oct%' → DIAGNOSTICS
--   else → INVESTIGATIONS

INSERT INTO service_catalog_categories (id, tenant_id, slug, name, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), :'tenant_id'::uuid, 'DIAGNOSTICS', 'Diagnostics', 10, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM service_catalog_categories WHERE tenant_id = :'tenant_id'::uuid AND slug = 'DIAGNOSTICS'
);

INSERT INTO service_catalog_categories (id, tenant_id, slug, name, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), :'tenant_id'::uuid, 'INVESTIGATIONS', 'Investigations', 20, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM service_catalog_categories WHERE tenant_id = :'tenant_id'::uuid AND slug = 'INVESTIGATIONS'
);

INSERT INTO service_catalog_variants (
  id, tenant_id, category_id, code, name, description, base_price, is_active, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  l.tenant_id,
  c.id,
  COALESCE(NULLIF(TRIM(l.test_code), ''), UPPER(REPLACE(l.test_name, ' ', '_'))),
  l.test_name,
  l.description,
  COALESCE(l.price, 0),
  COALESCE(l.is_active, true),
  NOW(),
  NOW()
FROM lab_test_catalog l
JOIN service_catalog_categories c
  ON c.tenant_id = l.tenant_id
 AND c.slug = CASE
      WHEN l.category ILIKE '%imaging%' OR l.category ILIKE '%diagnostic%' THEN 'DIAGNOSTICS'
      ELSE 'INVESTIGATIONS'
    END
WHERE l.tenant_id = :'tenant_id'::uuid
  AND l.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM service_catalog_variants v
    WHERE v.tenant_id = l.tenant_id AND v.code = COALESCE(NULLIF(TRIM(l.test_code), ''), UPPER(REPLACE(l.test_name, ' ', '_')))
  );

-- Post-import: sync counsellor investigation tabs via GET /api/servicecatalog/full (B2).
-- Deprecate lab_test_catalog writes; master-catalog endpoint returns 410 (F0.5).
