-- Align public.password_reset_requests with EF entity AuthService.Models.Domain.PasswordResetRequest.
--
-- Root cause:
--   Live table was created from an early bootstrap (reset_token + created_at), matching
--   archive MIGRATION_REQUIRED.md. EF model / HIPAA migration expect reset_token_hash,
--   requested_at, requested_by_user_id, status. Migration 20260113154156 is recorded in
--   __EFMigrationsHistory but the live columns never matched (CreateTable skipped / diverged).
--
-- AuthService applies schema via SQL scripts (not EF auto-migrate). Apply this file via that path.
-- Idempotent. Safe when table is empty or when rows only have legacy columns.
-- Does NOT rewrite __EFMigrationsHistory (HIPAA id already present).

DO $align$
BEGIN
  -- Legacy bootstrap used reset_token; EF maps ResetTokenHash → reset_token_hash.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'password_reset_requests' AND column_name = 'reset_token'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'password_reset_requests' AND column_name = 'reset_token_hash'
  ) THEN
    ALTER TABLE password_reset_requests RENAME COLUMN reset_token TO reset_token_hash;
  END IF;
END
$align$;

ALTER TABLE password_reset_requests
  ADD COLUMN IF NOT EXISTS reset_token_hash character varying(500);

-- Prefer existing legacy token values when both columns somehow exist.
DO $copy$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'password_reset_requests' AND column_name = 'reset_token'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'password_reset_requests' AND column_name = 'reset_token_hash'
  ) THEN
    EXECUTE 'UPDATE password_reset_requests SET reset_token_hash = reset_token WHERE reset_token_hash IS NULL AND reset_token IS NOT NULL';
  END IF;
END
$copy$;

-- Empty/legacy rows without a hash cannot satisfy NOT NULL; use placeholder only for nulls.
UPDATE password_reset_requests
SET reset_token_hash = 'legacy-unmigrated'
WHERE reset_token_hash IS NULL;

ALTER TABLE password_reset_requests
  ALTER COLUMN reset_token_hash SET NOT NULL;

ALTER TABLE password_reset_requests
  ALTER COLUMN reset_token_hash TYPE character varying(500);

ALTER TABLE password_reset_requests
  ADD COLUMN IF NOT EXISTS requested_at timestamp with time zone;

DO $req$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'password_reset_requests' AND column_name = 'created_at'
  ) THEN
    EXECUTE $u$
      UPDATE password_reset_requests
      SET requested_at = COALESCE(requested_at, created_at AT TIME ZONE 'UTC', NOW())
      WHERE requested_at IS NULL
    $u$;
  ELSE
    UPDATE password_reset_requests
    SET requested_at = COALESCE(requested_at, NOW())
    WHERE requested_at IS NULL;
  END IF;
END
$req$;

ALTER TABLE password_reset_requests
  ALTER COLUMN requested_at SET DEFAULT (NOW());

ALTER TABLE password_reset_requests
  ALTER COLUMN requested_at SET NOT NULL;

ALTER TABLE password_reset_requests
  ADD COLUMN IF NOT EXISTS requested_by_user_id uuid;

ALTER TABLE password_reset_requests
  ADD COLUMN IF NOT EXISTS status character varying(20);

UPDATE password_reset_requests
SET status = 'pending'
WHERE status IS NULL;

ALTER TABLE password_reset_requests
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE password_reset_requests
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE password_reset_requests
  ADD COLUMN IF NOT EXISTS user_agent text;

ALTER TABLE password_reset_requests
  ADD COLUMN IF NOT EXISTS used_at timestamp with time zone;

ALTER TABLE password_reset_requests
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Align legacy timestamp-without-time-zone columns to EF timestamptz.
DO $tz$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'password_reset_requests'
      AND column_name = 'expires_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE password_reset_requests
      ALTER COLUMN expires_at TYPE timestamp with time zone
      USING expires_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'password_reset_requests'
      AND column_name = 'used_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE password_reset_requests
      ALTER COLUMN used_at TYPE timestamp with time zone
      USING used_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'password_reset_requests'
      AND column_name = 'requested_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE password_reset_requests
      ALTER COLUMN requested_at TYPE timestamp with time zone
      USING requested_at AT TIME ZONE 'UTC';
  END IF;
END
$tz$;

ALTER TABLE password_reset_requests
  ADD COLUMN IF NOT EXISTS ip_address character varying(45);

DO $ip$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'password_reset_requests'
      AND column_name = 'ip_address' AND data_type = 'text'
  ) THEN
    ALTER TABLE password_reset_requests
      ALTER COLUMN ip_address TYPE character varying(45);
  END IF;
END
$ip$;

-- Drop obsolete plaintext token column if rename already produced reset_token_hash.
DO $drop$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'password_reset_requests' AND column_name = 'reset_token'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'password_reset_requests' AND column_name = 'reset_token_hash'
  ) THEN
    ALTER TABLE password_reset_requests DROP COLUMN reset_token;
  END IF;
END
$drop$;

CREATE INDEX IF NOT EXISTS "IX_password_reset_requests_tenant_id"
  ON password_reset_requests (tenant_id);
