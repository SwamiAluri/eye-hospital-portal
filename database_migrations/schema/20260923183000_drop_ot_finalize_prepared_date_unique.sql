-- FS-G-13 / PD-OTPREP-09 — remove one-OTPrepared-per-tenant-date unique index.
-- Multi-patient same-day PrepareOtListAsync requires multiple OTPrepared rows per date.
-- Companion: AuthService/Database/20260923183000_drop_ot_finalize_prepared_date_unique.sql
-- Safe / idempotent.

DROP INDEX IF EXISTS ux_ot_finalize_prepared_date;
