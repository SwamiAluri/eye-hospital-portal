-- Create patient_allergies if missing (from 20260218163249_AddExaminationDraftsAndClinicalExaminationFields)
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS patient_allergies (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  allergen_name character varying(200) NOT NULL,
  allergen_type character varying(50) NOT NULL,
  severity character varying(20) NOT NULL,
  reaction character varying(500),
  onset_date timestamp with time zone,
  verified boolean NOT NULL DEFAULT false,
  verified_by character varying(200),
  notes character varying(1000),
  status character varying(20) NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  deleted_at timestamp with time zone,
  CONSTRAINT "PK_patient_allergies" PRIMARY KEY (id),
  CONSTRAINT "FK_patient_allergies_patient_patient_id"
    FOREIGN KEY (patient_id) REFERENCES patient (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_patient_allergies_patient_id"
  ON patient_allergies (patient_id);

CREATE INDEX IF NOT EXISTS "IX_patient_allergies_tenant_id_patient_id"
  ON patient_allergies (tenant_id, patient_id);

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260218163249_AddExaminationDraftsAndClinicalExaminationFields', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;
