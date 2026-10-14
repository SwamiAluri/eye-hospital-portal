-- Non-destructive replacement lineage for canonical documents.
-- Does not drop blobs or existing rows.

ALTER TABLE canonical_documents
    ADD COLUMN IF NOT EXISTS superseded_by_document_id uuid NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_canonical_documents_superseded_by'
    ) THEN
        ALTER TABLE canonical_documents
            ADD CONSTRAINT fk_canonical_documents_superseded_by
            FOREIGN KEY (superseded_by_document_id) REFERENCES canonical_documents (id);
    END IF;
END $$;
