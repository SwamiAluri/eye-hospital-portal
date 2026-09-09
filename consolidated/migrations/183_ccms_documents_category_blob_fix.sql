-- ============================================================
-- Migration 183: ccms_documents document_category + blob integrity
--
-- Fixes:
-- 1. Dual legacy columns (document_stage + document_category) leaving NULL category on EF insert
-- 2. Nullable document_category without default
-- 3. Legacy stage values (pre_auth) not matching EF filter (preauth)
-- 4. Orphan blob_url rows whose path does not reference the owning coverage_case_id
-- ============================================================

BEGIN;

-- When both legacy document_stage and EF document_category exist, merge then drop stage.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ccms_documents' AND column_name = 'document_stage'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ccms_documents' AND column_name = 'document_category'
  ) THEN
    UPDATE ccms_documents
    SET document_category = COALESCE(NULLIF(TRIM(document_category), ''), NULLIF(TRIM(document_stage), ''), 'preauth')
    WHERE document_category IS NULL OR TRIM(document_category) = '';

    ALTER TABLE ccms_documents DROP COLUMN document_stage;
  END IF;
END $$;

-- Ensure EF column exists (Azure may already have it from EF migrations).
ALTER TABLE ccms_documents
  ADD COLUMN IF NOT EXISTS document_category VARCHAR(30);

-- Backfill NULL / empty categories and normalize legacy values.
UPDATE ccms_documents
SET document_category = 'preauth'
WHERE document_category IS NULL OR TRIM(document_category) = '';

UPDATE ccms_documents
SET document_category = CASE LOWER(TRIM(document_category))
    WHEN 'pre_auth' THEN 'preauth'
    WHEN 'pre-auth' THEN 'preauth'
    WHEN 'general' THEN 'preauth'
    WHEN 'authorization' THEN 'preauth'
    WHEN 'claims' THEN 'claim'
    WHEN 'settlements' THEN 'settlement'
    ELSE LOWER(TRIM(document_category))
  END
WHERE document_category IS NOT NULL;

ALTER TABLE ccms_documents
  ALTER COLUMN document_category SET DEFAULT 'preauth';

ALTER TABLE ccms_documents
  ALTER COLUMN document_category SET NOT NULL;

-- Soft-delete pointer rows whose blob path cannot belong to the case (e.g. seeded test URLs).
UPDATE ccms_documents d
SET deleted_at = COALESCE(d.deleted_at, NOW()),
    updated_at = NOW(),
    status     = CASE WHEN d.status = 'active' THEN 'deleted' ELSE d.status END
WHERE d.deleted_at IS NULL
  AND d.blob_url IS NOT NULL
  AND d.blob_url NOT ILIKE 'biometry://%'
  AND d.blob_url NOT ILIKE 'pacs://%'
  AND d.blob_url NOT ILIKE '%' || LOWER(d.coverage_case_id::text) || '%';

-- Replace legacy stage index when present.
DROP INDEX IF EXISTS idx_ccms_doc_stage;
CREATE INDEX IF NOT EXISTS idx_ccms_doc_category
  ON ccms_documents (coverage_case_id, document_category);

COMMIT;
