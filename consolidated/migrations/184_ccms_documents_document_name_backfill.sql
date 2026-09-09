-- ============================================================
-- Migration 184: Backfill missing ccms_documents.document_name values
-- ============================================================

BEGIN;

UPDATE ccms_documents
SET document_name = COALESCE(
    NULLIF(TRIM(document_name), ''),
    NULLIF(REPLACE(TRIM(document_type), '_', ' '), ''),
    'document'
)
WHERE document_name IS NULL OR TRIM(document_name) = '';

ALTER TABLE ccms_documents
  ALTER COLUMN document_name SET NOT NULL;

COMMIT;
