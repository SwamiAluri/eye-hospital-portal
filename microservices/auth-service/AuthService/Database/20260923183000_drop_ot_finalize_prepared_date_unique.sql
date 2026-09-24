-- FS-G-13 / PD-OTPREP-09 — remove one-OTPrepared-per-tenant-date unique index.
-- Multi-patient same-day PrepareOtListAsync requires multiple OTPrepared rows per date.
-- Safe / idempotent.

DROP INDEX IF EXISTS ux_ot_finalize_prepared_date;
