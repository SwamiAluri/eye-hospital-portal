-- ============================================================================
-- Migration 194: Repair service_variants UTF-8 mojibake for em dash (U+2014)
--
-- ROOT CAUSE (live UAT audit 2026-09-15):
--   service_variants.variant_name stores double-encoded em dash bytes:
--     correct "—" (U+2014) UTF-8 = E2 80 94
--     stored mojibake "â€”" UTF-8 = C3 A2 E2 82 AC E2 80 9D
--   API returns application/json; charset=utf-8 correctly — corruption is in DB rows.
--   Authoritative source names (archive/sql/other/update_catalog_sai_jyothi.sql) use real —.
--
-- SCOPE (audit):
--   Exactly 7 service_variants rows (ICL + PPV codes). No catalog_services / categories hits.
--
-- SAFETY:
--   Replaces ONLY the exact mojibake byte sequence for em dash.
--   Idempotent: after repair, the LIKE no longer matches.
--   No frontend string replacement. No blind global Latin-1 scrub.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_bad  TEXT := convert_from(decode('c3a2e282ace2809d', 'hex'), 'UTF8'); -- â€”
    v_good TEXT := U&'\2014'; -- —
    v_cnt  INT;
BEGIN
    SELECT count(*) INTO v_cnt
    FROM service_variants
    WHERE position(v_bad IN variant_name) > 0;

    RAISE NOTICE '194: service_variants rows with em-dash mojibake before repair: %', v_cnt;

    UPDATE service_variants
    SET variant_name = replace(variant_name, v_bad, v_good),
        updated_at = NOW()
    WHERE position(v_bad IN variant_name) > 0;

    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    RAISE NOTICE '194: service_variants rows repaired: %', v_cnt;
END $$;

COMMIT;
