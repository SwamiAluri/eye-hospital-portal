-- ============================================================
-- Migration 182: Align ccms_documents with CCMS EF model
--
-- Legacy migration 117 used document_stage + RLS tenant_isolation.
-- EF / CcmsApi expects document_category and optional audit columns.
--
-- Idempotent: safe on Azure (already document_category, RLS off).
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ccms_documents'
      AND column_name = 'document_stage'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ccms_documents'
      AND column_name = 'document_category'
  ) THEN
    ALTER TABLE ccms_documents RENAME COLUMN document_stage TO document_category;
  END IF;
END $$;

-- EF model columns missing from legacy 117 schema
ALTER TABLE ccms_documents
  ADD COLUMN IF NOT EXISTS uploaded_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by_user_id UUID;

ALTER TABLE ccms_documents DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON ccms_documents;

COMMIT;
