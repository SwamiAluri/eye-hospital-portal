-- L3-COM-01 / COM-02 Option A: explicit Laboratory catalog non-billable semantics.
-- Backward compatible: existing rows default to false (UNMAPPED when ServiceVariantId IS NULL).

ALTER TABLE laboratory_test_definitions
    ADD COLUMN IF NOT EXISTS is_non_billable boolean NOT NULL DEFAULT false;
