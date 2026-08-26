-- =============================================================================
-- 164_outbox_versioned_schema.sql
-- TASK DB-005 — Replace runtime outbox DDL with versioned SQL.
--
-- `integration_outbox_event` and `billing_ccms_outbox` were created by
-- IntegrationOutboxService.EnsureSchemaAsync / BillingCcmsOutboxService.EnsureSchemaAsync
-- at process start. A failed CREATE silently disabled cross-module delivery.
--
-- This migration is the source of truth. EnsureSchemaAsync becomes a logged
-- no-op (table-exists check only) for one release.
--
-- Existing databases: CREATE IF NOT EXISTS is a no-op; 163 already added
-- abandon columns. Fresh databases get the full table from this file.
-- Idempotent: re-running is a no-op.
-- =============================================================================

BEGIN;

-- ── IP → CCMS / Billing lifecycle outbox ────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_outbox_event (
    id                      UUID PRIMARY KEY,
    tenant_id               UUID NOT NULL,
    event_type              VARCHAR(80) NOT NULL,
    aggregate_type          VARCHAR(80) NOT NULL,
    aggregate_id            UUID NOT NULL,
    correlation_id          UUID NULL,
    payload_json            TEXT NOT NULL,
    idempotency_key         VARCHAR(200) NOT NULL,
    occurred_at             TIMESTAMPTZ NOT NULL,
    status                  VARCHAR(20) NOT NULL,
    retry_count             INT NOT NULL DEFAULT 0,
    last_attempt_at         TIMESTAMPTZ NULL,
    processed_at            TIMESTAMPTZ NULL,
    error                   TEXT NULL,
    abandon_reason          TEXT NULL,
    compensating_action     TEXT NULL,
    abandoned_at            TIMESTAMPTZ NULL,
    abandoned_by_user_id    UUID NULL,
    created_at              TIMESTAMPTZ NOT NULL,
    updated_at              TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_integration_outbox_idempotency
    ON integration_outbox_event (idempotency_key);

CREATE INDEX IF NOT EXISTS ix_integration_outbox_pending
    ON integration_outbox_event (status, occurred_at)
    WHERE status IN ('Pending', 'Failed');

COMMENT ON TABLE integration_outbox_event IS
    'DB-005. Transactional IP outbox. Schema is versioned here, not created at runtime.';

-- ── Billing → CCMS outbox ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_ccms_outbox (
    id                      UUID PRIMARY KEY,
    tenant_id               UUID NOT NULL,
    event_type              VARCHAR(80) NOT NULL,
    aggregate_type          VARCHAR(80) NOT NULL,
    aggregate_id            UUID NOT NULL,
    correlation_id          UUID NULL,
    payload_json            TEXT NOT NULL,
    idempotency_key         VARCHAR(200) NOT NULL,
    occurred_at             TIMESTAMPTZ NOT NULL,
    status                  VARCHAR(20) NOT NULL,
    retry_count             INT NOT NULL DEFAULT 0,
    last_attempt_at         TIMESTAMPTZ NULL,
    processed_at            TIMESTAMPTZ NULL,
    error                   TEXT NULL,
    abandon_reason          TEXT NULL,
    compensating_action     TEXT NULL,
    abandoned_at            TIMESTAMPTZ NULL,
    abandoned_by_user_id    UUID NULL,
    created_at              TIMESTAMPTZ NOT NULL,
    updated_at              TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_billing_ccms_outbox_idempotency
    ON billing_ccms_outbox (idempotency_key);

CREATE INDEX IF NOT EXISTS ix_billing_ccms_outbox_pending
    ON billing_ccms_outbox (status, occurred_at)
    WHERE status IN ('Pending', 'Failed');

COMMENT ON TABLE billing_ccms_outbox IS
    'DB-005. Transactional Billing→CCMS outbox. Schema is versioned here, not created at runtime.';

COMMIT;
