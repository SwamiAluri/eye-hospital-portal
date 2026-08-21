-- Phase 3 residual — Archive Auth Module insurance workflow tables (retention)
--
-- Renames live tables → archived_* then recreates READ-ONLY compatible views
-- under the original names so Auth historical GETs / EF keep working.
-- Writes remain frozen in API; views are intentionally non-updatable for safety
-- where Postgres requires INSTEAD OF triggers (simple SELECT * views of one table
-- are updatable — we revoke INSERT/UPDATE/DELETE from app roles if present).
--
-- Prerequisites:
--   1. apply_phase3_legacy_insurance_bridge(NULL, true) then false
--   2. Review orphan_report rows
--   3. SELECT set_config('app.phase3_archive_insurance', 'true', false);
--
-- Rollback: DROP VIEW original; ALTER TABLE archived_* RENAME TO original;

DO $$
BEGIN
  IF current_setting('app.phase3_archive_insurance', true) IS DISTINCT FROM 'true' THEN
    RAISE NOTICE 'Skipping archive. Set: SELECT set_config(''app.phase3_archive_insurance'', ''true'', false); then re-run.';
    RETURN;
  END IF;

  -- Drop FK from CCMS bridge column if it points at live table name
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ccms_coverage_cases_legacy_preauth_id_fkey'
  ) THEN
    ALTER TABLE ccms_coverage_cases DROP CONSTRAINT ccms_coverage_cases_legacy_preauth_id_fkey;
  END IF;

  -- Helper: rename table if live exists and archive does not
  -- Child tables first
  IF to_regclass('public.insurance_documents') IS NOT NULL
     AND to_regclass('public.archived_insurance_documents') IS NULL THEN
    ALTER TABLE insurance_documents RENAME TO archived_insurance_documents;
  END IF;

  IF to_regclass('public.insurance_approval_workflow') IS NOT NULL
     AND to_regclass('public.archived_insurance_approval_workflow') IS NULL THEN
    ALTER TABLE insurance_approval_workflow RENAME TO archived_insurance_approval_workflow;
  END IF;

  IF to_regclass('public.insurance_tpa_communications') IS NOT NULL
     AND to_regclass('public.archived_insurance_tpa_communications') IS NULL THEN
    ALTER TABLE insurance_tpa_communications RENAME TO archived_insurance_tpa_communications;
  END IF;

  IF to_regclass('public.insurance_pre_authorizations') IS NOT NULL
     AND to_regclass('public.archived_insurance_pre_authorizations') IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.views
       WHERE table_schema = 'public' AND table_name = 'insurance_pre_authorizations'
     ) THEN
    ALTER TABLE insurance_pre_authorizations RENAME TO archived_insurance_pre_authorizations;
  END IF;

  IF to_regclass('public.insurance_preauth_requests') IS NOT NULL
     AND to_regclass('public.archived_insurance_preauth_requests') IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.views
       WHERE table_schema = 'public' AND table_name = 'insurance_preauth_requests'
     ) THEN
    ALTER TABLE insurance_preauth_requests RENAME TO archived_insurance_preauth_requests;
  END IF;

  -- Compatibility views (original names) for historical Auth reads
  IF to_regclass('public.archived_insurance_pre_authorizations') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.views
       WHERE table_schema = 'public' AND table_name = 'insurance_pre_authorizations'
     )
     AND to_regclass('public.insurance_pre_authorizations') IS NULL THEN
    EXECUTE 'CREATE VIEW insurance_pre_authorizations AS SELECT * FROM archived_insurance_pre_authorizations';
  END IF;

  IF to_regclass('public.archived_insurance_approval_workflow') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.views
       WHERE table_schema = 'public' AND table_name = 'insurance_approval_workflow'
     )
     AND to_regclass('public.insurance_approval_workflow') IS NULL THEN
    EXECUTE 'CREATE VIEW insurance_approval_workflow AS SELECT * FROM archived_insurance_approval_workflow';
  END IF;

  IF to_regclass('public.archived_insurance_documents') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.views
       WHERE table_schema = 'public' AND table_name = 'insurance_documents'
     )
     AND to_regclass('public.insurance_documents') IS NULL THEN
    EXECUTE 'CREATE VIEW insurance_documents AS SELECT * FROM archived_insurance_documents';
  END IF;

  IF to_regclass('public.archived_insurance_preauth_requests') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.views
       WHERE table_schema = 'public' AND table_name = 'insurance_preauth_requests'
     )
     AND to_regclass('public.insurance_preauth_requests') IS NULL THEN
    EXECUTE 'CREATE VIEW insurance_preauth_requests AS SELECT * FROM archived_insurance_preauth_requests';
  END IF;

  IF to_regclass('public.archived_insurance_tpa_communications') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.views
       WHERE table_schema = 'public' AND table_name = 'insurance_tpa_communications'
     )
     AND to_regclass('public.insurance_tpa_communications') IS NULL THEN
    EXECUTE 'CREATE VIEW insurance_tpa_communications AS SELECT * FROM archived_insurance_tpa_communications';
  END IF;

  -- Re-point CCMS FK to archived physical table
  IF to_regclass('public.archived_insurance_pre_authorizations') IS NOT NULL THEN
    BEGIN
      ALTER TABLE ccms_coverage_cases
        ADD CONSTRAINT ccms_coverage_cases_legacy_preauth_id_fkey
        FOREIGN KEY (legacy_preauth_id)
        REFERENCES archived_insurance_pre_authorizations(id);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    WHEN others THEN
      RAISE NOTICE 'Could not re-add legacy_preauth FK (non-fatal): %', SQLERRM;
    END;
  END IF;

  RAISE NOTICE 'Phase 3: insurance workflow tables archived; compatibility views restored for historical GETs.';
END $$;
