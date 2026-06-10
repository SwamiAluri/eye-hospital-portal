-- =============================================
-- Migration 63: Service Catalog → Master Data sync (all tenants)
-- Upserts clinical.surgery_type from service_variants and clinical.iol_catalog
-- from iol_master. Catalog-linked rows are system-locked with syncedFromCatalog metadata.
-- =============================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_variant RECORD;
    v_iol RECORD;
    v_code TEXT;
    v_meta JSONB;
    v_active BOOLEAN;
    v_existing_id UUID;
BEGIN
    FOR v_tenant_id IN SELECT id FROM public.tenant WHERE deleted_at IS NULL
    LOOP
        PERFORM set_config('app.current_tenant_id', v_tenant_id::text, false);

        -- ── Surgery types (service_variants) ───────────────────────────────
        FOR v_variant IN
            SELECT
                sv.id AS variant_id,
                sv.variant_code,
                sv.variant_name,
                sv.price_type,
                sv.has_iol_options,
                sv.display_order,
                sv.is_active AS variant_active,
                sv.status AS variant_status,
                cs.id AS service_id,
                cs.service_code,
                cs.is_active AS service_active,
                cs.status AS service_status,
                sc.code AS category_code,
                sc.name AS category_name,
                sc.is_active AS category_active,
                sc.status AS category_status
            FROM service_variants sv
            JOIN catalog_services cs ON cs.id = sv.catalog_service_id AND cs.deleted_at IS NULL
            JOIN service_categories sc ON sc.id = cs.category_id AND sc.deleted_at IS NULL
            WHERE sv.deleted_at IS NULL
        LOOP
            v_code := COALESCE(
                NULLIF(TRIM(UPPER(v_variant.variant_code)), ''),
                'SV_' || UPPER(SUBSTRING(v_variant.variant_id::text, 1, 8))
            );
            v_active := v_variant.variant_active
                AND v_variant.service_active
                AND v_variant.category_active
                AND LOWER(v_variant.variant_status) = 'active'
                AND LOWER(v_variant.service_status) = 'active'
                AND LOWER(v_variant.category_status) = 'active';
            v_meta := jsonb_build_object(
                'syncedFromCatalog', true,
                'catalogVariantId', v_variant.variant_id::text,
                'catalogServiceId', v_variant.service_id::text,
                'catalogServiceCode', v_variant.service_code,
                'categoryCode', v_variant.category_code,
                'categoryName', v_variant.category_name,
                'priceType', v_variant.price_type,
                'hasIolOptions', v_variant.has_iol_options,
                'catalogActive', v_active
            );

            SELECT mv.id INTO v_existing_id
            FROM master.master_value mv
            WHERE mv.tenant_id = v_tenant_id
              AND mv.entity_type = 'clinical.surgery_type'
              AND (
                  mv.metadata::jsonb->>'catalogVariantId' = v_variant.variant_id::text
                  OR UPPER(mv.code) = v_code
              )
            ORDER BY mv.deleted_at NULLS FIRST
            LIMIT 1;

            IF v_existing_id IS NULL THEN
                INSERT INTO master.master_value (
                    tenant_id, group_key, entity_type, code, label, metadata,
                    sort_order, is_active, is_system_locked, created_at, updated_at
                ) VALUES (
                    v_tenant_id, 'clinical', 'clinical.surgery_type', v_code,
                    TRIM(v_variant.variant_name), v_meta, v_variant.display_order,
                    v_active, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
            ELSE
                UPDATE master.master_value SET
                    metadata = v_meta,
                    sort_order = v_variant.display_order,
                    is_active = v_active,
                    is_system_locked = true,
                    deleted_at = NULL,
                    disabled_at = CASE WHEN v_active THEN NULL ELSE disabled_at END,
                    disabled_by_user_id = CASE WHEN v_active THEN NULL ELSE disabled_by_user_id END,
                    disabled_reason = CASE WHEN v_active THEN NULL ELSE disabled_reason END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = v_existing_id;
            END IF;
        END LOOP;

        -- Deactivate orphaned catalog-synced surgery types
        UPDATE master.master_value mv SET
            is_active = false,
            disabled_at = COALESCE(disabled_at, CURRENT_TIMESTAMP),
            disabled_reason = COALESCE(disabled_reason, 'Service catalog item removed or deactivated'),
            updated_at = CURRENT_TIMESTAMP
        WHERE mv.tenant_id = v_tenant_id
          AND mv.entity_type = 'clinical.surgery_type'
          AND mv.deleted_at IS NULL
          AND mv.is_active = true
          AND (mv.metadata::jsonb->>'syncedFromCatalog')::boolean = true
          AND NOT EXISTS (
              SELECT 1 FROM service_variants sv
              WHERE sv.deleted_at IS NULL
                AND sv.id::text = mv.metadata::jsonb->>'catalogVariantId'
          );

        -- ── IOL catalog (iol_master) ─────────────────────────────────────
        FOR v_iol IN
            SELECT
                im.id AS iol_id,
                im.product_code,
                im.model_name,
                im.brand_manufacturer,
                im.iol_type,
                im.origin,
                im.power_range_min,
                im.power_range_max,
                im.display_order,
                im.is_active AS iol_active,
                im.status AS iol_status
            FROM iol_master im
            WHERE im.deleted_at IS NULL
        LOOP
            v_code := COALESCE(
                NULLIF(TRIM(UPPER(v_iol.product_code)), ''),
                'IOL_' || UPPER(SUBSTRING(v_iol.iol_id::text, 1, 8))
            );
            v_active := v_iol.iol_active AND LOWER(v_iol.iol_status) = 'active';
            v_meta := jsonb_build_object(
                'syncedFromCatalog', true,
                'catalogIolId', v_iol.iol_id::text,
                'manufacturer', v_iol.brand_manufacturer,
                'model', v_iol.model_name,
                'lens_type', CASE LOWER(TRIM(v_iol.iol_type))
                    WHEN 'monofocal' THEN 'spheric'
                    WHEN 'toric' THEN 'toric'
                    WHEN 'multifocal' THEN 'multifocal'
                    WHEN 'edof' THEN 'extended'
                    WHEN 'extended' THEN 'extended'
                    WHEN 'aspheric' THEN 'aspheric'
                    ELSE LOWER(TRIM(v_iol.iol_type))
                END,
                'origin', v_iol.origin,
                'productCode', v_iol.product_code,
                'sphere_power_min', v_iol.power_range_min,
                'sphere_power_max', v_iol.power_range_max,
                'catalogActive', v_active
            );

            SELECT mv.id INTO v_existing_id
            FROM master.master_value mv
            WHERE mv.tenant_id = v_tenant_id
              AND mv.entity_type = 'clinical.iol_catalog'
              AND (
                  mv.metadata::jsonb->>'catalogIolId' = v_iol.iol_id::text
                  OR UPPER(mv.code) = v_code
              )
            ORDER BY mv.deleted_at NULLS FIRST
            LIMIT 1;

            IF v_existing_id IS NULL THEN
                INSERT INTO master.master_value (
                    tenant_id, group_key, entity_type, code, label, metadata,
                    sort_order, is_active, is_system_locked, created_at, updated_at
                ) VALUES (
                    v_tenant_id, 'clinical', 'clinical.iol_catalog', v_code,
                    TRIM(v_iol.brand_manufacturer || ' ' || v_iol.model_name), v_meta,
                    v_iol.display_order, v_active, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
            ELSE
                UPDATE master.master_value SET
                    metadata = v_meta,
                    sort_order = v_iol.display_order,
                    is_active = v_active,
                    is_system_locked = true,
                    deleted_at = NULL,
                    disabled_at = CASE WHEN v_active THEN NULL ELSE disabled_at END,
                    disabled_by_user_id = CASE WHEN v_active THEN NULL ELSE disabled_by_user_id END,
                    disabled_reason = CASE WHEN v_active THEN NULL ELSE disabled_reason END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = v_existing_id;
            END IF;
        END LOOP;

        -- Deactivate orphaned catalog-synced IOL rows
        UPDATE master.master_value mv SET
            is_active = false,
            disabled_at = COALESCE(disabled_at, CURRENT_TIMESTAMP),
            disabled_reason = COALESCE(disabled_reason, 'Service catalog item removed or deactivated'),
            updated_at = CURRENT_TIMESTAMP
        WHERE mv.tenant_id = v_tenant_id
          AND mv.entity_type = 'clinical.iol_catalog'
          AND mv.deleted_at IS NULL
          AND mv.is_active = true
          AND (mv.metadata::jsonb->>'syncedFromCatalog')::boolean = true
          AND NOT EXISTS (
              SELECT 1 FROM iol_master im
              WHERE im.deleted_at IS NULL
                AND im.id::text = mv.metadata::jsonb->>'catalogIolId'
          );
    END LOOP;
END;
$$;
