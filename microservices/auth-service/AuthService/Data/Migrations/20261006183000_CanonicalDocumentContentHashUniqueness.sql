-- Slice 3A: one active canonical identity per tenant + patient + SHA-256 content hash.
CREATE UNIQUE INDEX IF NOT EXISTS ux_canonical_documents_tenant_patient_hash
    ON canonical_documents (tenant_id, patient_id, content_hash)
    WHERE deleted_at IS NULL
      AND status = 'active'
      AND content_hash IS NOT NULL;
