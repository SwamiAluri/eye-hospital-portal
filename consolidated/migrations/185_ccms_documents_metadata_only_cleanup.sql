-- ============================================================
-- Migration 185: soft-delete metadata-only ccms_documents rows
--
-- Rows created when the browser sent application/json instead of multipart
-- have empty blob_url, zero size, and null mime_type but status=active.
-- ============================================================

BEGIN;

UPDATE ccms_documents d
SET deleted_at = COALESCE(d.deleted_at, NOW()),
    updated_at = NOW(),
    status     = CASE WHEN d.status = 'active' THEN 'deleted' ELSE d.status END
WHERE d.deleted_at IS NULL
  AND d.status = 'active'
  AND (d.blob_url IS NULL OR TRIM(d.blob_url) = '')
  AND COALESCE(d.file_size_bytes, 0) = 0
  AND (d.mime_type IS NULL OR TRIM(d.mime_type) = '');

-- Also soft-delete active rows with blob path but zero bytes (never uploaded).
UPDATE ccms_documents d
SET deleted_at = COALESCE(d.deleted_at, NOW()),
    updated_at = NOW(),
    status     = CASE WHEN d.status = 'active' THEN 'deleted' ELSE d.status END
WHERE d.deleted_at IS NULL
  AND d.status = 'active'
  AND d.blob_url IS NOT NULL
  AND TRIM(d.blob_url) <> ''
  AND d.blob_url NOT ILIKE 'biometry://%'
  AND d.blob_url NOT ILIKE 'pacs://%'
  AND COALESCE(d.file_size_bytes, 0) = 0;

COMMIT;
