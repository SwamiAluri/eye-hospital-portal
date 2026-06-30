-- ============================================================================
-- Migration 147: Surgery-type scoping for ward bedside-safety items
-- Purpose:
--   The Bedside Safety (Form 2) checklist seeded every item for every journey,
--   so surgery-specific acts surfaced on irrelevant cases — e.g. "Toric IOL /
--   ICL Marking" appearing (and being tickable) on a LASIK journey.
--   pre_op_section_items.surgery_type_filter already exists but was unused for
--   WARD_CHECKLIST rows. This sets it for lens-based acts so the service can
--   compute applies_to_journey by matching the tokens against
--   patient_journey.procedure_name (see WardChecklistService.ItemAppliesToJourney,
--   mirroring WardInvestigationChecklistService).
-- Effect:
--   Items with a filter are hidden from the panel and excluded from the readiness
--   denominator when the journey's procedure does not match any token. Items left
--   with NULL filter continue to apply to all journeys.
-- Dependencies: 135_s1_ward_checklist.sql (seeds the items).
-- Date: 2026-06
-- ============================================================================

BEGIN;

-- Toric IOL / phakic ICL marking is only meaningful for lens-based procedures
-- (cataract / phaco / SICS / IOL / refractive ICL). Hidden for cornea-only
-- refractive surgery (LASIK / PRK / SMILE), oculoplasty, etc.
UPDATE pre_op_section_items
SET    surgery_type_filter = 'Cataract,Phaco,SICS,IOL,ICL,Lens,Refractive Lens',
       updated_at          = NOW()
WHERE  form_code  = 'WARD_CHECKLIST'
  AND  item_key   = 'toric_iol_icl_marking'
  AND  surgery_type_filter IS NULL
  AND  deleted_at IS NULL;

COMMIT;
