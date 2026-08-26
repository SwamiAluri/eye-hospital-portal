-- =============================================================================
-- 159_charge_catalog_mapping.sql
-- TASK MD-055 — Item/package → service catalog variant mapping + exception queue.
--
-- Additive only. Re-running is a no-op.
-- Prices stay on variant_prices; this table never stores a purchase rate.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS service_variant_item_map (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    item_id uuid NOT NULL,
    service_variant_id uuid NOT NULL,
    is_chargeable boolean NOT NULL DEFAULT true,
    non_chargeable_reason text,
    effective_from timestamptz NOT NULL DEFAULT now(),
    effective_to timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by_user_id uuid,
    updated_at timestamptz,
    updated_by_user_id uuid
);

COMMENT ON TABLE service_variant_item_map IS
    'MD-055: inventory item → billed service variant. Versioned by effective dates; never edited in place.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_sv_item_map_active
    ON service_variant_item_map (tenant_id, item_id)
    WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS ix_sv_item_map_variant
    ON service_variant_item_map (service_variant_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inv_item_master')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sv_item_map_item') THEN
        ALTER TABLE service_variant_item_map
            ADD CONSTRAINT fk_sv_item_map_item
            FOREIGN KEY (item_id) REFERENCES inv_item_master (id) ON DELETE RESTRICT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_variants')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sv_item_map_variant') THEN
        ALTER TABLE service_variant_item_map
            ADD CONSTRAINT fk_sv_item_map_variant
            FOREIGN KEY (service_variant_id) REFERENCES service_variants (id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS charge_exception (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    item_id uuid,
    package_template_id uuid,
    package_component_id uuid,
    source_type varchar(30) NOT NULL,
    source_ref_id uuid,
    opd_bill_id uuid,
    patient_journey_id uuid,
    quantity numeric(12,3) NOT NULL DEFAULT 1,
    estimated_value numeric(12,2) NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'Open',
    reason varchar(200),
    idempotency_key varchar(200),
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by_user_id uuid
);

COMMENT ON TABLE charge_exception IS
    'MD-055: parked charges that could not resolve to a priced catalog variant. Never posted at purchase rate.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_charge_exception_idempotency
    ON charge_exception (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_charge_exception_open
    ON charge_exception (tenant_id, status, item_id)
    WHERE status = 'Open';

CREATE TABLE IF NOT EXISTS package_component_map (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL,
    package_template_id uuid NOT NULL,
    component_key varchar(80) NOT NULL,
    component_name varchar(200) NOT NULL,
    service_variant_id uuid,
    allocation varchar(20) NOT NULL DEFAULT 'Fixed',
    covers_consumable boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz,
    created_by_user_id uuid,
    updated_by_user_id uuid
);

COMMENT ON TABLE package_component_map IS
    'MD-055: counselling package exploded lines. service_variant_id nullable until mapped; BILL-031 fails loud if still null.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_package_component_key
    ON package_component_map (tenant_id, package_template_id, component_key);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'counselling_package_templates')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pkg_component_template') THEN
        ALTER TABLE package_component_map
            ADD CONSTRAINT fk_pkg_component_template
            FOREIGN KEY (package_template_id) REFERENCES counselling_package_templates (id) ON DELETE CASCADE;
    END IF;
END $$;

-- Backfill procedure components from templates that already hold a variant.
INSERT INTO package_component_map (
    id, tenant_id, package_template_id, component_key, component_name,
    service_variant_id, allocation, covers_consumable, sort_order, created_at)
SELECT gen_random_uuid(), t.tenant_id, t.id, 'Procedure', 'Procedure',
       t.procedure_variant_id, 'Fixed', false, 0, now()
FROM counselling_package_templates t
WHERE t.deleted_at IS NULL
  AND t.procedure_variant_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM package_component_map m
      WHERE m.package_template_id = t.id AND m.component_key = 'Procedure'
  );

INSERT INTO package_component_map (
    id, tenant_id, package_template_id, component_key, component_name,
    service_variant_id, allocation, covers_consumable, sort_order, created_at)
SELECT gen_random_uuid(), t.tenant_id, t.id, 'IolAllowance', 'IOL allowance',
       NULL, 'Fixed', false, 1, now()
FROM counselling_package_templates t
WHERE t.deleted_at IS NULL
  AND t.iol_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM package_component_map m
      WHERE m.package_template_id = t.id AND m.component_key = 'IolAllowance'
  );

COMMIT;
