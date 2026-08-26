-- ============================================================================
-- Migration 162: CCMS-060 collection-aware settlement projections
-- Billing PaymentReceived / PaymentReversed / PatientObligationChanged land
-- here instead of being ack-only. Patient collections do not create TPA
-- settlement rows. PARTIAL_SETTLEMENT → FULL_SETTLEMENT is added so a second
-- collection can complete the patient-obligation track.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ccms_collection_projections (
    id                          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID         NOT NULL,
    coverage_case_id            UUID         NOT NULL REFERENCES ccms_coverage_cases(id),
    bill_id                     UUID,
    net_collected               NUMERIC(14,2) NOT NULL DEFAULT 0,
    patient_obligation_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
    last_occurred_at            TIMESTAMPTZ,
    status                      VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by_user_id          UUID,
    updated_by_user_id          UUID,
    deleted_at                  TIMESTAMPTZ,
    row_version                 INT          NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ccms_collection_projection_case
    ON ccms_collection_projections (coverage_case_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_ccms_collection_projection_tenant
    ON ccms_collection_projections (tenant_id, updated_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE ccms_collection_projections IS
    'CCMS-060. Net patient collections vs obligation for a coverage case. Not TPA settlement.';

CREATE TABLE IF NOT EXISTS ccms_collection_events (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID         NOT NULL,
    coverage_case_id    UUID         NOT NULL REFERENCES ccms_coverage_cases(id),
    event_type          VARCHAR(64)  NOT NULL,
    source_ref_id       UUID,
    bill_id             UUID,
    amount              NUMERIC(14,2) NOT NULL DEFAULT 0,
    idempotency_key     VARCHAR(200),
    occurred_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    status              VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by_user_id  UUID,
    updated_by_user_id  UUID,
    deleted_at          TIMESTAMPTZ,
    row_version         INT          NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ccms_collection_event_source
    ON ccms_collection_events (tenant_id, event_type, source_ref_id)
    WHERE source_ref_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ccms_collection_event_idempotency
    ON ccms_collection_events (tenant_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_ccms_collection_event_case
    ON ccms_collection_events (coverage_case_id, occurred_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON TABLE ccms_collection_events IS
    'CCMS-060. Append-only billing ledger events applied to the collection projection.';

-- Completing a second collection from PARTIAL_SETTLEMENT was not in the 108 matrix.
DO $$
DECLARE
    v_def_id UUID;
    s_partial UUID;
    s_full UUID;
    v_system_tenant UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    SELECT id INTO v_def_id
    FROM ccms_workflow_definitions
    WHERE code = 'CCMS_MAIN' AND deleted_at IS NULL
    ORDER BY version DESC
    LIMIT 1;

    IF v_def_id IS NULL THEN
        RETURN;
    END IF;

    SELECT id INTO s_partial FROM ccms_workflow_states
    WHERE workflow_definition_id = v_def_id AND state_code = 'PARTIAL_SETTLEMENT' AND deleted_at IS NULL;
    SELECT id INTO s_full FROM ccms_workflow_states
    WHERE workflow_definition_id = v_def_id AND state_code = 'FULL_SETTLEMENT' AND deleted_at IS NULL;

    IF s_partial IS NULL OR s_full IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO ccms_workflow_transitions
        (id, tenant_id, workflow_definition_id, from_state_id, to_state_id, trigger_event,
         is_automatic, row_version, created_at, updated_at, status)
    SELECT gen_random_uuid(), v_system_tenant, v_def_id, s_partial, s_full, 'FULL_PAYMENT',
           FALSE, 1, NOW(), NOW(), 'active'
    WHERE NOT EXISTS (
        SELECT 1 FROM ccms_workflow_transitions t
        WHERE t.workflow_definition_id = v_def_id
          AND t.from_state_id = s_partial
          AND t.trigger_event = 'FULL_PAYMENT'
          AND t.deleted_at IS NULL
    );
END $$;

COMMIT;
