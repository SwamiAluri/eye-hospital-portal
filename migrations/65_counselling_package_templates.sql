-- =====================================================================
-- Migration 65: Counselling package templates + counsellor discount settings
-- Purpose: Rich package definitions linked to service catalog for counsellor desk
-- Idempotent — safe to re-run
-- =====================================================================

-- ── 1. counselling_package_templates ────────────────────────────────────
CREATE TABLE IF NOT EXISTS counselling_package_templates (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID            NOT NULL,

    code                    VARCHAR(50)     NOT NULL,
    name                    VARCHAR(200)    NOT NULL,
    description             TEXT,
    category                VARCHAR(50),

    package_amount          NUMERIC(12,2)   NOT NULL,
    currency                VARCHAR(10)     NOT NULL DEFAULT 'INR',

    procedure_variant_id    UUID,
    default_eye             VARCHAR(10)     NOT NULL DEFAULT 'RE',
    variant_sub_option      VARCHAR(100),
    iol_id                  UUID,
    investigation_ids       JSONB           NOT NULL DEFAULT '[]'::jsonb,

    max_discount_percent    NUMERIC(5,2)    NOT NULL DEFAULT 50.00,
    legacy_master_code      VARCHAR(50),

    is_default              BOOLEAN         NOT NULL DEFAULT FALSE,
    sort_order              INTEGER         NOT NULL DEFAULT 0,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by_user_id      UUID,
    updated_by_user_id      UUID,
    deleted_at              TIMESTAMPTZ,

    CONSTRAINT uq_counselling_pkg_tpl_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_cpt_tenant_active
    ON counselling_package_templates (tenant_id)
    WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_cpt_category
    ON counselling_package_templates (tenant_id, category)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cpt_legacy_code
    ON counselling_package_templates (tenant_id, legacy_master_code)
    WHERE legacy_master_code IS NOT NULL AND deleted_at IS NULL;

-- ── 2. Entity type registry entry ───────────────────────────────────────
INSERT INTO master.entity_type_registry (entity_type, group_key, display_name, tab_label, sort_order)
VALUES ('counsellor.settings', 'counsellor', 'Counsellor Settings', 'Settings', 10)
ON CONFLICT (entity_type) DO NOTHING;

-- ── 3. Per-tenant counsellor settings + legacy package code mapping ─────
DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    FOR v_tenant_id IN SELECT id FROM public.tenant WHERE deleted_at IS NULL
    LOOP
        PERFORM set_config('app.current_tenant_id', v_tenant_id::text, false);

        -- Configurable max discount (default 50%)
        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, metadata, sort_order, is_system_locked)
        VALUES (
            v_tenant_id, 'counsellor', 'counsellor.settings', 'max_discount_percent',
            'Maximum Discount (%)',
            '{"percent":50,"flatCap":null}',
            1, TRUE
        )
        ON CONFLICT (tenant_id, entity_type, code) DO UPDATE
        SET label = EXCLUDED.label,
            metadata = EXCLUDED.metadata,
            sort_order = EXCLUDED.sort_order;

        -- Economy / standard package shells (admin links catalog IDs in Master Data UI)
        INSERT INTO counselling_package_templates (
            tenant_id, code, name, description, category, package_amount,
            default_eye, investigation_ids, max_discount_percent, legacy_master_code,
            is_default, sort_order, is_active
        ) VALUES
            (v_tenant_id, 'CAT-ECON', 'Cataract Economy',
             'Low-price cataract bundle — link procedure/IOL in Master Data',
             'Cataract', 45000, 'RE', '[]'::jsonb, 50, 'PHACO_STD', TRUE, 1, TRUE),
            (v_tenant_id, 'CAT-STD', 'Cataract Standard',
             'Standard cataract bundle — link procedure/IOL in Master Data',
             'Cataract', 55000, 'RE', '[]'::jsonb, 50, 'PHACO_PREM', FALSE, 2, TRUE),
            (v_tenant_id, 'RET-ECON', 'Retina Economy',
             'Economy retina surgery bundle',
             'Retina', 85000, 'RE', '[]'::jsonb, 50, 'RETINA_PKG', FALSE, 3, TRUE),
            (v_tenant_id, 'GLAU-STD', 'Glaucoma Standard',
             'Standard glaucoma surgery bundle',
             'Glaucoma', 40000, 'RE', '[]'::jsonb, 50, 'GLAUCOMA_PKG', FALSE, 4, TRUE),
            (v_tenant_id, 'LASIK-BASIC', 'LASIK Basic',
             'Basic LASIK package',
             'Refractive', 35000, 'RE', '[]'::jsonb, 50, 'LASIK_BASIC', FALSE, 5, TRUE),
            (v_tenant_id, 'LASIK-ADV', 'LASIK Advanced',
             'Advanced LASIK package',
             'Refractive', 45000, 'RE', '[]'::jsonb, 50, 'LASIK_ADV', FALSE, 6, TRUE),
            (v_tenant_id, 'CORNEA-PKG', 'Cornea Package',
             'Cornea procedure bundle',
             'Cornea', 60000, 'RE', '[]'::jsonb, 50, 'CORNEA_PKG', FALSE, 7, TRUE)
        ON CONFLICT (tenant_id, code) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            package_amount = EXCLUDED.package_amount,
            legacy_master_code = EXCLUDED.legacy_master_code,
            sort_order = EXCLUDED.sort_order,
            updated_at = NOW();
    END LOOP;
END $$;
