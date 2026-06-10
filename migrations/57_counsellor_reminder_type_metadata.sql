-- =====================================================================
-- Program B: reminder_type metadata templates for counsellor desk
-- =====================================================================

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id FROM tenant LOOP
        UPDATE master.master_value
        SET metadata = jsonb_build_object('template', t.template),
            updated_at = CURRENT_TIMESTAMP
        FROM (VALUES
            ('counsellor.reminder_type', 'PRE_OP_DAY',    'Hi {name}, this is a reminder about your upcoming procedure tomorrow. Please follow pre-op instructions and contact us with any questions.'),
            ('counsellor.reminder_type', 'APPOINTMENT',   'Hi {name}, this is a friendly reminder about your upcoming appointment at our hospital. Please confirm or contact us to reschedule.'),
            ('counsellor.reminder_type', 'FOLLOW_UP',     'Hi {name}, we are checking in for your follow-up. Please reach out to our care team with any concerns.'),
            ('counsellor.reminder_type', 'PAYMENT_DUE',   'Hi {name}, this is a reminder that a payment is due. Please contact our billing desk at your earliest convenience.'),
            ('counsellor.reminder_type', 'RESULT_READY',  'Hi {name}, your test results are ready. Please visit or call the hospital to discuss them with your care team.')
        ) AS t(entity_type, code, template)
        WHERE master.master_value.tenant_id = rec.id
          AND master.master_value.entity_type = t.entity_type
          AND master.master_value.code = t.code
          AND master.master_value.deleted_at IS NULL;
    END LOOP;
END $$;
