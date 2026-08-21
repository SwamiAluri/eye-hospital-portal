-- P0: Shared CCMS integration consumer idempotency (multi-instance safe).
-- Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS ccms_integration_idempotency (
    idempotency_key  VARCHAR(200) PRIMARY KEY,
    seen_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    expires_at       TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_ccms_integration_idempotency_expires
    ON ccms_integration_idempotency (expires_at);

COMMENT ON TABLE ccms_integration_idempotency IS
  'P0 Phase 5 residual: durable X-Idempotency-Key store for JourneyAdmitted/SurgeryCompleted/PatientDischarged/BillFinalized consumers';
