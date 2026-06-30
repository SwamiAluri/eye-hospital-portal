-- Post-migration verification for ward & IP journey (Phases 1-4)
SELECT artifact, applied FROM (
  SELECT '135 ward checklist items' AS artifact,
         EXISTS(SELECT 1 FROM pre_op_section_items WHERE form_code = 'WARD_CHECKLIST') AS applied
  UNION ALL SELECT '136 medication log table',
         EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'pre_op_medication_log')
  UNION ALL SELECT '136 post-op form items',
         EXISTS(SELECT 1 FROM pre_op_section_items WHERE form_code = 'WARD_POSTOP')
  UNION ALL SELECT '137 surgical safety table',
         EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'surgical_safety_checklist')
  UNION ALL SELECT '138 pac_assessment',
         EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'pac_assessment')
  UNION ALL SELECT '138 anaesthesia_monitoring',
         EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'anaesthesia_monitoring')
  UNION ALL SELECT '139 anaesthesia.pac.edit perm',
         EXISTS(SELECT 1 FROM permissions WHERE "Code" = 'anaesthesia.pac.edit')
  UNION ALL SELECT '140 investigation preop items',
         EXISTS(SELECT 1 FROM pre_op_section_items WHERE form_code = 'WARD_INVESTIGATION_PREOP')
  UNION ALL SELECT '140 checklist_phase_status col',
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_journey' AND column_name = 'checklist_phase_status')
  UNION ALL SELECT '142 result_value col',
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'pre_op_completions' AND column_name = 'result_value')
  UNION ALL SELECT '142 ward.investigation.enter',
         EXISTS(SELECT 1 FROM permissions WHERE "Code" = 'ward.investigation.enter')
  UNION ALL SELECT '143 cancel pending_rebook col',
         EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_journey' AND column_name = 'pending_rebook')
  UNION ALL SELECT '143 counsellor preop items',
         EXISTS(SELECT 1 FROM pre_op_section_items WHERE item_key = 'couns_preop_blood_sugar')
) x
ORDER BY artifact;
