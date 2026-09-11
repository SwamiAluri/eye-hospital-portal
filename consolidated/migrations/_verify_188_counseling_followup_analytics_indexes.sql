-- ============================================================
-- Verify Migration 188: Counsellor Follow-up / Analytics indexes
-- Run after applying 188_counseling_followup_analytics_indexes.sql
-- ============================================================

DO $$
DECLARE
  missing text := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_cs_analytics_tenant_session'
  ) THEN
    missing := missing || 'idx_cs_analytics_tenant_session; ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_cs_followup_intention_contact'
  ) THEN
    missing := missing || 'idx_cs_followup_intention_contact; ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_cs_pending_decision_session'
  ) THEN
    missing := missing || 'idx_cs_pending_decision_session; ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_callback_tenant_date'
  ) THEN
    missing := missing || 'idx_callback_tenant_date; ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_pj_discharged_followup'
  ) THEN
    missing := missing || 'idx_pj_discharged_followup; ';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION 'Migration 188 verification failed — missing indexes: %', missing;
  END IF;

  RAISE NOTICE 'Migration 188 verification OK — all five Phase 2E indexes present.';
END $$;
