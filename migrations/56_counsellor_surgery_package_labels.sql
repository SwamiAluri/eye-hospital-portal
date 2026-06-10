-- =====================================================================
-- Counsellor surgery package labels (B1)
-- Align master counsellor.surgery_package with counsellor desk UI options
-- =====================================================================

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id FROM tenant LOOP
        -- Retire generic tier labels (replaced by clinical package names)
        UPDATE master.master_value
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = rec.id
          AND entity_type = 'counsellor.surgery_package'
          AND code IN ('BASIC', 'STANDARD', 'PREMIUM', 'CORPORATE', 'GOVT')
          AND deleted_at IS NULL;

        INSERT INTO master.master_value (tenant_id, group_key, entity_type, code, label, sort_order)
        VALUES
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'PHACO_STD',    'Phaco Standard',   1),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'PHACO_PREM',   'Phaco Premium',    2),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'LASIK_BASIC',  'LASIK Basic',      3),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'LASIK_ADV',    'LASIK Advanced',   4),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'RETINA_PKG',   'Retina Package',   5),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'CORNEA_PKG',   'Cornea Package',   6),
            (rec.id, 'counsellor', 'counsellor.surgery_package', 'GLAUCOMA_PKG', 'Glaucoma Package', 7)
        ON CONFLICT (tenant_id, entity_type, code) DO UPDATE
        SET label = EXCLUDED.label,
            sort_order = EXCLUDED.sort_order,
            is_active = true,
            deleted_at = NULL,
            updated_at = CURRENT_TIMESTAMP;
    END LOOP;
END $$;
