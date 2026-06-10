-- =====================================================================
-- Migration 66: Link counselling package templates to service catalog IDs
-- Maps legacy_master_code → clinical.surgery_type → catalogVariantId
-- Idempotent — only fills NULL procedure_variant_id / empty investigation_ids
-- =====================================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_updated INT;
BEGIN
    FOR v_tenant_id IN SELECT id FROM public.tenant WHERE deleted_at IS NULL
    LOOP
        PERFORM set_config('app.current_tenant_id', v_tenant_id::text, false);

        -- ── Procedure variant from synced master surgery types ─────────────
        UPDATE counselling_package_templates cpt
        SET procedure_variant_id = src.variant_id,
            updated_at = NOW()
        FROM (
            SELECT
                t.id AS template_id,
                (mv.metadata::jsonb->>'catalogVariantId')::uuid AS variant_id
            FROM counselling_package_templates t
            JOIN master.master_value mv
              ON mv.tenant_id = t.tenant_id
             AND mv.entity_type = 'clinical.surgery_type'
             AND mv.deleted_at IS NULL
             AND mv.is_active = TRUE
             AND (mv.metadata::jsonb->>'catalogVariantId') IS NOT NULL
             AND UPPER(mv.code) = CASE t.legacy_master_code
                WHEN 'PHACO_STD'  THEN 'PHACO'
                WHEN 'PHACO_PREM' THEN 'PHACO'
                WHEN 'RETINA_PKG' THEN 'VITRECTOMY'
                WHEN 'GLAUCOMA_PKG' THEN 'TRAB'
                WHEN 'LASIK_BASIC' THEN 'LASIK'
                WHEN 'LASIK_ADV'   THEN 'LASIK'
                WHEN 'CORNEA_PKG'  THEN 'PKP'
                ELSE NULL
             END
            WHERE t.tenant_id = v_tenant_id
              AND t.deleted_at IS NULL
              AND t.procedure_variant_id IS NULL
              AND t.legacy_master_code IS NOT NULL
        ) src
        WHERE cpt.id = src.template_id
          AND src.variant_id IS NOT NULL;

        GET DIAGNOSTICS v_updated = ROW_COUNT;
        RAISE NOTICE 'Tenant %: linked % package procedure_variant_id', v_tenant_id, v_updated;

        -- ── Default economy IOL (first active Indian IOL) for cataract packs ─
        UPDATE counselling_package_templates cpt
        SET iol_id = src.iol_id,
            updated_at = NOW()
        FROM (
            SELECT t.id AS template_id, im.id AS iol_id
            FROM counselling_package_templates t
            JOIN LATERAL (
                SELECT im.id
                FROM iol_master im
                WHERE im.deleted_at IS NULL
                  AND im.is_active = TRUE
                  AND LOWER(COALESCE(im.origin, '')) = 'indian'
                ORDER BY im.display_order, im.model_name
                LIMIT 1
            ) im ON TRUE
            WHERE t.tenant_id = v_tenant_id
              AND t.deleted_at IS NULL
              AND t.iol_id IS NULL
              AND t.category = 'Cataract'
              AND t.procedure_variant_id IS NOT NULL
        ) src
        WHERE cpt.id = src.template_id;

        -- Default investigations from service catalog when investigation_ids is empty
        UPDATE counselling_package_templates cpt
        SET investigation_ids = src.inv_ids,
            updated_at = NOW()
        FROM (
            SELECT
                t.id AS template_id,
                COALESCE(
                    (
                        SELECT jsonb_agg(DISTINCT sv.id::text ORDER BY sv.id::text)
                        FROM service_variants sv
                        JOIN catalog_services cs ON cs.id = sv.catalog_service_id
                        JOIN service_categories sc ON sc.id = cs.category_id
                        WHERE sv.is_active = TRUE
                          AND cs.is_active = TRUE
                          AND sc.is_active = TRUE
                          AND sc.code IN ('DIAGNOSTICS', 'INVESTIGATIONS')
                          AND UPPER(sv.variant_code) = ANY(
                              CASE t.code
                                  WHEN 'CAT-ECON' THEN ARRAY['BSCAN', 'LAB-CBC']
                                  WHEN 'CAT-STD'  THEN ARRAY['BSCAN', 'OCT', 'LAB-CBC', 'LAB-BG']
                                  WHEN 'RET-ECON' THEN ARRAY['OCT', 'BSCAN', 'LAB-CBC']
                                  WHEN 'GLAU-STD' THEN ARRAY['OCT', 'LAB-CBC', 'LAB-ECG']
                                  ELSE ARRAY[]::text[]
                              END
                          )
                    ),
                    '[]'::jsonb
                ) AS inv_ids
            FROM counselling_package_templates t
            WHERE t.tenant_id = v_tenant_id
              AND t.deleted_at IS NULL
              AND jsonb_array_length(COALESCE(t.investigation_ids, '[]'::jsonb)) = 0
              AND t.code IN ('CAT-ECON', 'CAT-STD', 'RET-ECON', 'GLAU-STD')
        ) src
        WHERE cpt.id = src.template_id
          AND jsonb_array_length(src.inv_ids) > 0;

    END LOOP;
END $$;
