-- ============================================================
-- Migration 181: CCMS Pre-auth Document Requirements Seed
--
-- Seeds tenant-global preauth document requirements (no payer FK).
-- Global rows apply to every case via PreAuthDocumentGate.RequirementAppliesToCase.
-- Document types align with legacy INTAKE_DOC_SLOTS / counsellor upload keys.
--
-- Idempotent: skips insert when an equivalent global preauth row already exists.
-- ============================================================

BEGIN;

-- Retire unusable rows (empty document_type cannot map to upload slots).
UPDATE ccms_document_requirements
SET deleted_at = NOW(),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND applies_at = 'preauth'
  AND (document_type IS NULL OR btrim(document_type) = '');

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  FOR v_tenant_id IN
    SELECT DISTINCT tenant_id
    FROM (
      SELECT tenant_id FROM ccms_insurance_providers WHERE deleted_at IS NULL
      UNION
      SELECT tenant_id FROM ccms_financial_years WHERE deleted_at IS NULL
    ) AS tenants
  LOOP
  -- Patient ID Proof
  IF NOT EXISTS (
    SELECT 1 FROM ccms_document_requirements
    WHERE tenant_id = v_tenant_id
      AND document_type = 'id_proof'
      AND applies_at = 'preauth'
      AND deleted_at IS NULL
      AND insurance_provider_id IS NULL
      AND tpa_provider_id IS NULL
      AND government_scheme_id IS NULL
  ) THEN
    INSERT INTO ccms_document_requirements
      (id, tenant_id, document_type, document_name, is_required, applies_at, created_at, updated_at, status, row_version)
    VALUES
      (gen_random_uuid(), v_tenant_id, 'id_proof', 'Patient ID Proof (Aadhaar / PAN / Passport)', TRUE, 'preauth', NOW(), NOW(), 'active', 1);
  END IF;

  -- Insurance card — front
  IF NOT EXISTS (
    SELECT 1 FROM ccms_document_requirements
    WHERE tenant_id = v_tenant_id
      AND document_type = 'insurance_card_front'
      AND applies_at = 'preauth'
      AND deleted_at IS NULL
      AND insurance_provider_id IS NULL
      AND tpa_provider_id IS NULL
      AND government_scheme_id IS NULL
  ) THEN
    INSERT INTO ccms_document_requirements
      (id, tenant_id, document_type, document_name, is_required, applies_at, created_at, updated_at, status, row_version)
    VALUES
      (gen_random_uuid(), v_tenant_id, 'insurance_card_front', 'Insurance Card — Front', TRUE, 'preauth', NOW(), NOW(), 'active', 1);
  END IF;

  -- Insurance card — back (optional)
  IF NOT EXISTS (
    SELECT 1 FROM ccms_document_requirements
    WHERE tenant_id = v_tenant_id
      AND document_type = 'insurance_card_back'
      AND applies_at = 'preauth'
      AND deleted_at IS NULL
      AND insurance_provider_id IS NULL
      AND tpa_provider_id IS NULL
      AND government_scheme_id IS NULL
  ) THEN
    INSERT INTO ccms_document_requirements
      (id, tenant_id, document_type, document_name, is_required, applies_at, created_at, updated_at, status, row_version)
    VALUES
      (gen_random_uuid(), v_tenant_id, 'insurance_card_back', 'Insurance Card — Back', FALSE, 'preauth', NOW(), NOW(), 'active', 1);
  END IF;

  -- Policy copy
  IF NOT EXISTS (
    SELECT 1 FROM ccms_document_requirements
    WHERE tenant_id = v_tenant_id
      AND document_type = 'policy_document'
      AND applies_at = 'preauth'
      AND deleted_at IS NULL
      AND insurance_provider_id IS NULL
      AND tpa_provider_id IS NULL
      AND government_scheme_id IS NULL
  ) THEN
    INSERT INTO ccms_document_requirements
      (id, tenant_id, document_type, document_name, is_required, applies_at, created_at, updated_at, status, row_version)
    VALUES
      (gen_random_uuid(), v_tenant_id, 'policy_document', 'Insurance Policy Copy', TRUE, 'preauth', NOW(), NOW(), 'active', 1);
  END IF;

  -- Doctor referral / prescription
  IF NOT EXISTS (
    SELECT 1 FROM ccms_document_requirements
    WHERE tenant_id = v_tenant_id
      AND document_type = 'doctor_referral'
      AND applies_at = 'preauth'
      AND deleted_at IS NULL
      AND insurance_provider_id IS NULL
      AND tpa_provider_id IS NULL
      AND government_scheme_id IS NULL
  ) THEN
    INSERT INTO ccms_document_requirements
      (id, tenant_id, document_type, document_name, is_required, applies_at, created_at, updated_at, status, row_version)
    VALUES
      (gen_random_uuid(), v_tenant_id, 'doctor_referral', 'Doctor''s Referral / Prescription', TRUE, 'preauth', NOW(), NOW(), 'active', 1);
  END IF;

  -- Optional pre-auth extras (not required for submit gate)
  IF NOT EXISTS (
    SELECT 1 FROM ccms_document_requirements
    WHERE tenant_id = v_tenant_id
      AND document_type = 'preauth_form'
      AND applies_at = 'preauth'
      AND deleted_at IS NULL
      AND insurance_provider_id IS NULL
      AND tpa_provider_id IS NULL
      AND government_scheme_id IS NULL
  ) THEN
    INSERT INTO ccms_document_requirements
      (id, tenant_id, document_type, document_name, is_required, applies_at, created_at, updated_at, status, row_version)
    VALUES
      (gen_random_uuid(), v_tenant_id, 'preauth_form', 'Pre-Authorization Form', FALSE, 'preauth', NOW(), NOW(), 'active', 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ccms_document_requirements
    WHERE tenant_id = v_tenant_id
      AND document_type = 'previous_claims'
      AND applies_at = 'preauth'
      AND deleted_at IS NULL
      AND insurance_provider_id IS NULL
      AND tpa_provider_id IS NULL
      AND government_scheme_id IS NULL
  ) THEN
    INSERT INTO ccms_document_requirements
      (id, tenant_id, document_type, document_name, is_required, applies_at, created_at, updated_at, status, row_version)
    VALUES
      (gen_random_uuid(), v_tenant_id, 'previous_claims', 'Previous Claim Documents', FALSE, 'preauth', NOW(), NOW(), 'active', 1);
  END IF;

  END LOOP;
END $$;

COMMIT;
