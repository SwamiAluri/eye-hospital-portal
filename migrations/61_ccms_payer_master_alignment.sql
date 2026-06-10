-- =============================================
-- Migration 61: Align CCMS insurance payers with master.insurance.provider
-- Seeds/updates ccms_insurance_providers from master_value per tenant.
-- Identity (name/code) comes from Master Data; CCMS holds finance/contact fields.
-- =============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_ccms_ins_prov_code'
    ) THEN
        ALTER TABLE ccms_insurance_providers
            ADD CONSTRAINT uq_ccms_ins_prov_code UNIQUE (tenant_id, provider_code);
    END IF;
END;
$$;

DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    FOR v_tenant_id IN SELECT id FROM public.tenant WHERE deleted_at IS NULL
    LOOP
        PERFORM set_config('app.current_tenant_id', v_tenant_id::text, false);

        INSERT INTO ccms_insurance_providers
            (id, tenant_id, provider_name, provider_code, payer_category,
             pre_auth_required, claim_submission_mode, status, row_version,
             created_at, updated_at)
        SELECT
            gen_random_uuid(),
            v_tenant_id,
            mv.label,
            mv.code,
            'insurance',
            TRUE,
            'manual',
            'active',
            1,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM master.master_value mv
        WHERE mv.tenant_id = v_tenant_id
          AND mv.entity_type = 'insurance.provider'
          AND mv.is_active = TRUE
          AND (mv.deleted_at IS NULL)
        ON CONFLICT (tenant_id, provider_code) DO UPDATE SET
            provider_name = EXCLUDED.provider_name,
            payer_category = 'insurance',
            updated_at = CURRENT_TIMESTAMP,
            deleted_at = NULL,
            status = CASE
                WHEN ccms_insurance_providers.status = 'deleted' THEN 'active'
                ELSE ccms_insurance_providers.status
            END;
    END LOOP;
END;
$$;
