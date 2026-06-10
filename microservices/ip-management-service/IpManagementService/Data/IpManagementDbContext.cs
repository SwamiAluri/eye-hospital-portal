using Microsoft.EntityFrameworkCore;
using IpManagementService.Models.Domain;

namespace IpManagementService.Data;

public class IpManagementDbContext : DbContext
{
    public IpManagementDbContext(DbContextOptions<IpManagementDbContext> options)
        : base(options) { }

    public DbSet<Ward>                   Wards                    { get; set; }
    public DbSet<PatientJourney>         PatientJourneys          { get; set; }
    public DbSet<IpBillingTransaction>   BillingTransactions      { get; set; }
    public DbSet<IntraOpNote>            IntraOpNotes             { get; set; }
    public DbSet<IntraOpNotePreset>      IntraOpNotePresets       { get; set; }
    public DbSet<NurseChecklistItem>     NurseChecklistItems      { get; set; }
    public DbSet<NurseChecklistResponse> NurseChecklistResponses  { get; set; }
    public DbSet<SurgeonChecklistItem>   SurgeonChecklistItems    { get; set; }
    public DbSet<SurgeonChecklistResponse> SurgeonChecklistResponses { get; set; }
    public DbSet<PostOpInstruction>      PostOpInstructions       { get; set; }
    public DbSet<DischargeSummary>       DischargeSummaries       { get; set; }
    public DbSet<JourneyAuditLog>        JourneyAuditLogs         { get; set; }
    public DbSet<IolReturn>              IolReturns               { get; set; }
    public DbSet<SurgeryNoteTemplate>    SurgeryNoteTemplates     { get; set; }
    public DbSet<VitalSign>              VitalSigns               { get; set; }
    public DbSet<NurseRecord>            NurseRecords             { get; set; }
    public DbSet<IpPatient>              Patients                 { get; set; }

    // ── Master Data ───────────────────────────────────────────────────────
    public DbSet<IpIoType>              IoTypes                  { get; set; }
    public DbSet<OphthMedication>       OphthMedications         { get; set; }
    public DbSet<IolCatalogMaster>      IolCatalogMaster         { get; set; }

    // ── Pre-Op Clearance ─────────────────────────────────────────────────
    public DbSet<PreOpSectionItem>       PreOpSectionItems        { get; set; }
    public DbSet<PreOpClearance>         PreOpClearances          { get; set; }
    public DbSet<PreOpCompletion>        PreOpCompletions         { get; set; }
    public DbSet<PreOpDocument>          PreOpDocuments           { get; set; }
    public DbSet<PreOpSectionClearance>  PreOpSectionClearances   { get; set; }
    public DbSet<PreOpFollowUpTask>      PreOpFollowUpTasks        { get; set; }
    public DbSet<CounsellorChecklistCompletion> CounsellorChecklistCompletions { get; set; }
    public DbSet<PreOpMedicationLog>            PreOpMedicationLogs            { get; set; }
    public DbSet<SurgicalSafetyChecklist>     SurgicalSafetyChecklists       { get; set; }
    public DbSet<PacAssessment>               PacAssessments                 { get; set; }
    public DbSet<AnaesthesiaMonitoring>       AnaesthesiaMonitorings         { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ── IpPatient (patients table — read-only, owned by auth-service) ─
        modelBuilder.Entity<IpPatient>(e =>
        {
            e.ToTable("patient", t => t.ExcludeFromMigrations());
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.HealthId).HasColumnName("health_id");
            e.Property(p => p.MedicalRecordNumber).HasColumnName("medical_record_number");
            e.Property(p => p.FirstName).HasColumnName("first_name");
            e.Property(p => p.LastName).HasColumnName("last_name");
            e.Property(p => p.Gender).HasColumnName("gender");
            e.Property(p => p.DateOfBirth).HasColumnName("date_of_birth");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
        });

        // ── Ward ──────────────────────────────────────────────────────────
        modelBuilder.Entity<Ward>(e =>
        {
            e.ToTable("ward");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.BranchId).HasColumnName("branch_id");
            e.Property(p => p.WardName).HasColumnName("ward_name");
            e.Property(p => p.WardType).HasColumnName("ward_type");
            e.Property(p => p.Floor).HasColumnName("floor");
            e.Property(p => p.TotalBeds).HasColumnName("total_beds");
            e.Property(p => p.IsActive).HasColumnName("is_active");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── PatientJourney ───────────────────────────────────────────────
        modelBuilder.Entity<PatientJourney>(e =>
        {
            e.ToTable("patient_journey");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.BranchId).HasColumnName("branch_id");
            e.Property(p => p.PatientId).HasColumnName("patient_id");
            e.Property(p => p.Uhid).HasColumnName("uhid");
            e.Property(p => p.OtFinalizeScheduleId).HasColumnName("ot_finalize_schedule_id");
            e.Property(p => p.CounselingSessionId).HasColumnName("counseling_session_id");
            e.Property(p => p.AdmissionId).HasColumnName("admission_id");
            e.Property(p => p.WardId).HasColumnName("ward_id");
            e.Property(p => p.ClinicalState).HasColumnName("clinical_state");
            e.Property(p => p.OtState).HasColumnName("ot_state");
            e.Property(p => p.FinancialState).HasColumnName("financial_state");
            e.Property(p => p.PostOpState).HasColumnName("post_op_state");
            e.Property(p => p.ProcedureName).HasColumnName("procedure_name");
            e.Property(p => p.EyeOperated).HasColumnName("eye_operated");
            e.Property(p => p.PrimarySurgeonId).HasColumnName("primary_surgeon_id");
            e.Property(p => p.AnaesthesiaType).HasColumnName("anaesthesia_type");
            e.Property(p => p.SurgeryScheduledAt).HasColumnName("surgery_scheduled_at");
            e.Property(p => p.IolPower).HasColumnName("iol_power");
            e.Property(p => p.IolIssuedFromIp).HasColumnName("iol_issued_from_ip");
            e.Property(p => p.IolBarcodeVerified).HasColumnName("iol_barcode_verified");
            e.Property(p => p.IolBarcode).HasColumnName("iol_barcode");
            e.Property(p => p.AnaesthetistName).HasColumnName("anaesthetist_name");
            e.Property(p => p.OperationTheatreName).HasColumnName("operation_theatre_name");
            e.Property(p => p.AssistantName).HasColumnName("assistant_name");
            e.Property(p => p.ScrubNurseNames).HasColumnName("scrub_nurse_names");
            e.Property(p => p.AdmissionType).HasColumnName("admission_type");
            e.Property(p => p.AdmittingDoctorId).HasColumnName("admitting_doctor_id");
            e.Property(p => p.PrimaryNurseId).HasColumnName("primary_nurse_id");
            e.Property(p => p.BedNumber).HasColumnName("bed_number");
            e.Property(p => p.RoomNumber).HasColumnName("room_number");
            e.Property(p => p.AttendantName).HasColumnName("attendant_name");
            e.Property(p => p.AttendantPhone).HasColumnName("attendant_phone");
            e.Property(p => p.AttendantRelationship).HasColumnName("attendant_relationship");
            e.Property(p => p.AdmittedAt).HasColumnName("admitted_at");
            e.Property(p => p.WardCheckInAt).HasColumnName("ward_check_in_at");
            e.Property(p => p.InformedOtTeamAt).HasColumnName("informed_ot_team_at");
            e.Property(p => p.XylocaineSensitivityResult).HasColumnName("xylocaine_sensitivity_result");
            e.Property(p => p.MedicationLogSurgeryNotes).HasColumnName("medication_log_surgery_notes");
            e.Property(p => p.WardPostopIolChecks).HasColumnName("ward_postop_iol_checks");
            e.Property(p => p.SentToOtAt).HasColumnName("sent_to_ot_at");
            e.Property(p => p.ReceivedFromOtAt).HasColumnName("received_from_ot_at");
            e.Property(p => p.WardCheckoutAt).HasColumnName("ward_checkout_at");
            e.Property(p => p.SurgeryStartedAt).HasColumnName("surgery_started_at");
            e.Property(p => p.SurgeryEndedAt).HasColumnName("surgery_ended_at");
            e.Property(p => p.DischargedAt).HasColumnName("discharged_at");
            e.Property(p => p.IsLocked).HasColumnName("is_locked");
            e.Property(p => p.IsBillingLocked).HasColumnName("is_billing_locked");
            e.Property(p => p.IsClinicalLocked).HasColumnName("is_clinical_locked");
            e.Property(p => p.IsDischarged).HasColumnName("is_discharged");
            e.Property(p => p.EmergencyFcApplied).HasColumnName("emergency_fc_applied");
            e.Property(p => p.EmergencyFcReason).HasColumnName("emergency_fc_reason");
            e.Property(p => p.EmergencyFcApprovedBy).HasColumnName("emergency_fc_approved_by");
            e.Property(p => p.EmergencyFcApprovedAt).HasColumnName("emergency_fc_approved_at");
            e.Property(p => p.GovernmentApprovalSubmitted).HasColumnName("government_approval_submitted");
            e.Property(p => p.InsurancePreauthSubmitted).HasColumnName("insurance_preauth_submitted");
            e.Property(p => p.IsCampPatient).HasColumnName("is_camp_patient");
            e.Property(p => p.DischargeOverrideApplied).HasColumnName("discharge_override_applied");
            e.Property(p => p.DischargeOverrideReason).HasColumnName("discharge_override_reason");
            e.Property(p => p.DischargeOverrideBy).HasColumnName("discharge_override_by");
            e.Property(p => p.OtReturnReason).HasColumnName("ot_return_reason");
            e.Property(p => p.ChecklistPhaseStatus).HasColumnName("checklist_phase_status");
            e.Property(p => p.WhoSupervisorOverrideApplied).HasColumnName("who_supervisor_override_applied");
            e.Property(p => p.WhoSupervisorOverrideBy).HasColumnName("who_supervisor_override_by");
            e.Property(p => p.WhoSupervisorOverrideAt).HasColumnName("who_supervisor_override_at");
            e.Property(p => p.PackageAmount).HasColumnName("package_amount");
            e.Property(p => p.TotalAdvances).HasColumnName("total_advances");
            e.Property(p => p.TotalPaid).HasColumnName("total_paid");
            // balance_due is GENERATED ALWAYS — map as read-only
            e.Property(p => p.BalanceDue).HasColumnName("balance_due").ValueGeneratedOnAddOrUpdate();
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── IpBillingTransaction ─────────────────────────────────────────
        modelBuilder.Entity<IpBillingTransaction>(e =>
        {
            e.ToTable("ip_billing_transactions");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.BranchId).HasColumnName("branch_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.TransactionType).HasColumnName("transaction_type");
            e.Property(p => p.PaymentMode).HasColumnName("payment_mode");
            e.Property(p => p.Amount).HasColumnName("amount");
            e.Property(p => p.ReferenceNumber).HasColumnName("reference_number");
            e.Property(p => p.ReceiptNumber).HasColumnName("receipt_number");
            e.Property(p => p.Notes).HasColumnName("notes");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── IntraOpNote ───────────────────────────────────────────────────
        modelBuilder.Entity<IntraOpNote>(e =>
        {
            e.ToTable("intra_op_notes");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.BranchId).HasColumnName("branch_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.PrimarySurgeonId).HasColumnName("primary_surgeon_id");
            e.Property(p => p.AssistantSurgeonId).HasColumnName("assistant_surgeon_id");
            e.Property(p => p.AnesthesiologistId).HasColumnName("anesthesiologist_id");
            e.Property(p => p.ScrubNurseId).HasColumnName("scrub_nurse_id");
            e.Property(p => p.SurgeryStartTime).HasColumnName("surgery_start_time");
            e.Property(p => p.SurgeryEndTime).HasColumnName("surgery_end_time");
            e.Property(p => p.AnesthesiaType).HasColumnName("anesthesia_type");
            e.Property(p => p.AnesthesiaNotes).HasColumnName("anesthesia_notes");
            e.Property(p => p.ProcedurePerformed).HasColumnName("procedure_performed");
            e.Property(p => p.EyeOperated).HasColumnName("eye_operated");
            e.Property(p => p.Findings).HasColumnName("findings");
            e.Property(p => p.Complications).HasColumnName("complications");
            e.Property(p => p.ImplantUsed).HasColumnName("implant_used");
            e.Property(p => p.ImplantPower).HasColumnName("implant_power");
            e.Property(p => p.BloodLossMl).HasColumnName("blood_loss_ml");
            e.Property(p => p.IvFluidMl).HasColumnName("iv_fluid_ml");
            e.Property(p => p.SpecimenSent).HasColumnName("specimen_sent");
            e.Property(p => p.SpecimenDetails).HasColumnName("specimen_details");
            e.Property(p => p.NotesStatus).HasColumnName("notes_status");
            e.Property(p => p.SignedAt).HasColumnName("signed_at");
            e.Property(p => p.SignedByUserId).HasColumnName("signed_by_user_id");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── IntraOpNotePreset ───────────────────────────────────────────────────────────────────
        modelBuilder.Entity<IntraOpNotePreset>(e =>
        {
            e.ToTable("intra_op_note_presets");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.FieldName).HasColumnName("field_name");
            e.Property(p => p.OptionLabel).HasColumnName("option_label");
            e.Property(p => p.DisplayOrder).HasColumnName("display_order");
            e.Property(p => p.IsSystemDefault).HasColumnName("is_system_default");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── NurseChecklistItem ────────────────────────────────────────────
        modelBuilder.Entity<NurseChecklistItem>(e =>
        {
            e.ToTable("nurse_checklist_items");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.ItemLabel).HasColumnName("item_label");
            e.Property(p => p.ItemOrder).HasColumnName("item_order");
            e.Property(p => p.IsActive).HasColumnName("is_active");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
        });

        // ── NurseChecklistResponse ────────────────────────────────────────
        modelBuilder.Entity<NurseChecklistResponse>(e =>
        {
            e.ToTable("nurse_checklist_responses");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.ChecklistItemId).HasColumnName("checklist_item_id");
            e.Property(p => p.IsCompleted).HasColumnName("is_completed");
            e.Property(p => p.Notes).HasColumnName("notes");
            e.Property(p => p.CompletedByUserId).HasColumnName("completed_by_user_id");
            e.Property(p => p.CompletedAt).HasColumnName("completed_at");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
        });

        // ── SurgeonChecklistItem ──────────────────────────────────────────
        modelBuilder.Entity<SurgeonChecklistItem>(e =>
        {
            e.ToTable("surgeon_checklist_items");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.ItemLabel).HasColumnName("item_label");
            e.Property(p => p.ItemOrder).HasColumnName("item_order");
            e.Property(p => p.IsActive).HasColumnName("is_active");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
        });

        // ── SurgeonChecklistResponse ──────────────────────────────────────
        modelBuilder.Entity<SurgeonChecklistResponse>(e =>
        {
            e.ToTable("surgeon_checklist_responses");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.ChecklistItemId).HasColumnName("checklist_item_id");
            e.Property(p => p.IsCompleted).HasColumnName("is_completed");
            e.Property(p => p.Notes).HasColumnName("notes");
            e.Property(p => p.CompletedByUserId).HasColumnName("completed_by_user_id");
            e.Property(p => p.CompletedAt).HasColumnName("completed_at");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
        });

        // ── PostOpInstruction ─────────────────────────────────────────────
        modelBuilder.Entity<PostOpInstruction>(e =>
        {
            e.ToTable("post_op_instructions");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.Medications).HasColumnName("medications");
            e.Property(p => p.ActivityRestrictions).HasColumnName("activity_restrictions");
            e.Property(p => p.DietaryInstructions).HasColumnName("dietary_instructions");
            e.Property(p => p.FollowupDate).HasColumnName("followup_date");
            e.Property(p => p.FollowupDoctorId).HasColumnName("followup_doctor_id");
            e.Property(p => p.EyeCareInstructions).HasColumnName("eye_care_instructions");
            e.Property(p => p.WarningSigns).HasColumnName("warning_signs");
            e.Property(p => p.IsSaved).HasColumnName("is_saved");
            e.Property(p => p.SavedAt).HasColumnName("saved_at");
            e.Property(p => p.SavedByUserId).HasColumnName("saved_by_user_id");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
        });

        // ── DischargeSummary ──────────────────────────────────────────────
        modelBuilder.Entity<DischargeSummary>(e =>
        {
            e.ToTable("discharge_summary");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.ConditionAtDischarge).HasColumnName("condition_at_discharge");
            e.Property(p => p.DiagnosisCodes).HasColumnName("diagnosis_codes");
            e.Property(p => p.ProceduresPerformed).HasColumnName("procedures_performed");
            e.Property(p => p.HospitalCourse).HasColumnName("hospital_course");
            e.Property(p => p.DischargeInstructions).HasColumnName("discharge_instructions");
            e.Property(p => p.MedicationsOnDischarge).HasColumnName("medications_on_discharge");
            e.Property(p => p.FollowUpPlan).HasColumnName("follow_up_plan");
            e.Property(p => p.FormatType).HasColumnName("format_type");
            e.Property(p => p.SummaryStatus).HasColumnName("summary_status");
            e.Property(p => p.FinalBillAmount).HasColumnName("final_bill_amount");
            e.Property(p => p.FinalizedAt).HasColumnName("finalized_at");
            e.Property(p => p.FinalizedBy).HasColumnName("finalized_by");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── JourneyAuditLog ───────────────────────────────────────────────
        modelBuilder.Entity<JourneyAuditLog>(e =>
        {
            e.ToTable("journey_audit_log");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.Action).HasColumnName("action");
            e.Property(p => p.StateType).HasColumnName("state_type");
            e.Property(p => p.OldValue).HasColumnName("old_value");
            e.Property(p => p.NewValue).HasColumnName("new_value");
            e.Property(p => p.PreviousState).HasColumnName("previous_state").HasColumnType("jsonb");
            e.Property(p => p.NewState).HasColumnName("new_state").HasColumnType("jsonb");
            e.Property(p => p.PerformedByUserId).HasColumnName("performed_by_user_id");
            e.Property(p => p.PerformedAt).HasColumnName("performed_at");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── IolReturn ─────────────────────────────────────────────────────
        modelBuilder.Entity<IolReturn>(e =>
        {
            e.ToTable("iol_returns");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.IolPower).HasColumnName("iol_power");
            e.Property(p => p.IolBatch).HasColumnName("iol_batch");
            e.Property(p => p.IolBarcode).HasColumnName("iol_barcode");
            e.Property(p => p.Reason).HasColumnName("reason");
            e.Property(p => p.ReturnedAt).HasColumnName("returned_at");
            e.Property(p => p.ReturnedByUserId).HasColumnName("returned_by_user_id");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── SurgeryNoteTemplate ───────────────────────────────────────────
        modelBuilder.Entity<SurgeryNoteTemplate>(e =>
        {
            e.ToTable("surgery_note_templates");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.FieldLabel).HasColumnName("field_label");
            e.Property(p => p.FieldType).HasColumnName("field_type");
            e.Property(p => p.FieldOrder).HasColumnName("field_order");
            e.Property(p => p.IsRequired).HasColumnName("is_required");
            e.Property(p => p.Options).HasColumnName("options");
            e.Property(p => p.IsActive).HasColumnName("is_active");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
        });

        // ── VitalSign ─────────────────────────────────────────────────────
        modelBuilder.Entity<VitalSign>(e =>
        {
            e.ToTable("vital_sign");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.JourneyId).HasColumnName("journey_id");
            e.Property(p => p.RecordedAt).HasColumnName("recorded_at");
            e.Property(p => p.Temperature).HasColumnName("temperature");
            e.Property(p => p.BloodPressureSystolic).HasColumnName("blood_pressure_systolic");
            e.Property(p => p.BloodPressureDiastolic).HasColumnName("blood_pressure_diastolic");
            e.Property(p => p.PulseRate).HasColumnName("pulse_rate");
            e.Property(p => p.RespiratoryRate).HasColumnName("respiratory_rate");
            e.Property(p => p.OxygenSaturation).HasColumnName("oxygen_saturation");
            e.Property(p => p.Weight).HasColumnName("weight");
            e.Property(p => p.Height).HasColumnName("height");
            e.Property(p => p.Notes).HasColumnName("notes");
            e.Property(p => p.Context).HasColumnName("context");
            e.Property(p => p.RecordedByUserId).HasColumnName("recorded_by_user_id");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── NurseRecord ───────────────────────────────────────────────────
        modelBuilder.Entity<NurseRecord>(e =>
        {
            e.ToTable("nurse_record");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.JourneyId).HasColumnName("journey_id");
            e.Property(p => p.RecordedAt).HasColumnName("recorded_at");
            e.Property(p => p.ShiftType).HasColumnName("shift_type");
            e.Property(p => p.NursingNotes).HasColumnName("nursing_notes");
            e.Property(p => p.MedicationsGiven).HasColumnName("medications_given");
            e.Property(p => p.IntakeOutputNotes).HasColumnName("intake_output_notes");
            e.Property(p => p.PainScore).HasColumnName("pain_score");
            e.Property(p => p.AlertnessLevel).HasColumnName("alertness_level");
            e.Property(p => p.RecordedByUserId).HasColumnName("recorded_by_user_id");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── PreOpSectionItem ───────────────────────────────────────────────
        modelBuilder.Entity<PreOpSectionItem>(e =>
        {
            e.ToTable("pre_op_section_items");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.Category).HasColumnName("category");
            e.Property(p => p.ItemKey).HasColumnName("item_key");
            e.Property(p => p.ItemLabel).HasColumnName("item_label");
            e.Property(p => p.Description).HasColumnName("description");
            e.Property(p => p.DepartmentOwner).HasColumnName("department_owner");
            e.Property(p => p.IsMandatory).HasColumnName("is_mandatory");
            e.Property(p => p.IsBlocking).HasColumnName("is_blocking");
            e.Property(p => p.RequiresDocument).HasColumnName("requires_document");
            e.Property(p => p.PatientTypeFilter).HasColumnName("patient_type_filter");
            e.Property(p => p.SurgeryTypeFilter).HasColumnName("surgery_type_filter");
            e.Property(p => p.DisplayOrder).HasColumnName("display_order");
            e.Property(p => p.IsActive).HasColumnName("is_active");
            e.Property(p => p.FormCode).HasColumnName("form_code");
            e.Property(p => p.FormContext).HasColumnName("form_context");
            e.Property(p => p.ResponsibleDepartmentCode).HasColumnName("responsible_department_code");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── CounsellorChecklistCompletion ──────────────────────────────────
        modelBuilder.Entity<CounsellorChecklistCompletion>(e =>
        {
            e.ToTable("counsellor_checklist_completions");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.CounselingSessionId).HasColumnName("counseling_session_id");
            e.Property(p => p.ItemId).HasColumnName("item_id");
            e.Property(p => p.IsCompleted).HasColumnName("is_completed");
            e.Property(p => p.IsBypassed).HasColumnName("is_bypassed");
            e.Property(p => p.BypassReason).HasColumnName("bypass_reason");
            e.Property(p => p.Notes).HasColumnName("notes");
            e.Property(p => p.CompletedByUserId).HasColumnName("completed_by_user_id");
            e.Property(p => p.CompletedByRole).HasColumnName("completed_by_role");
            e.Property(p => p.CompletedAt).HasColumnName("completed_at");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── SurgicalSafetyChecklist ────────────────────────────────────────
        modelBuilder.Entity<SurgicalSafetyChecklist>(e =>
        {
            e.ToTable("surgical_safety_checklist");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.IdentityConfirmed).HasColumnName("identity_confirmed");
            e.Property(p => p.EyeRe).HasColumnName("eye_re");
            e.Property(p => p.EyeLe).HasColumnName("eye_le");
            e.Property(p => p.TopicalAntibioticsUsed).HasColumnName("topical_antibiotics_used");
            e.Property(p => p.SurgeryType).HasColumnName("surgery_type");
            e.Property(p => p.BillingVerifiedOverride).HasColumnName("billing_verified_override");
            e.Property(p => p.AscanVerified).HasColumnName("ascan_verified");
            e.Property(p => p.AllergyKnown).HasColumnName("allergy_known");
            e.Property(p => p.AllergyDetails).HasColumnName("allergy_details");
            e.Property(p => p.ConsentFormChecked).HasColumnName("consent_form_checked");
            e.Property(p => p.FitnessConfirmed).HasColumnName("fitness_confirmed");
            e.Property(p => p.BeforeAnaesthesiaCompletedAt).HasColumnName("before_anaesthesia_completed_at");
            e.Property(p => p.BeforeAnaesthesiaCompletedBy).HasColumnName("before_anaesthesia_completed_by");
            e.Property(p => p.WhoPatientIdentity).HasColumnName("who_patient_identity");
            e.Property(p => p.WhoCorrectEye).HasColumnName("who_correct_eye");
            e.Property(p => p.WhoCorrectProcedure).HasColumnName("who_correct_procedure");
            e.Property(p => p.WhoConsentConfirmed).HasColumnName("who_consent_confirmed");
            e.Property(p => p.WhoSurgeonUserId).HasColumnName("who_surgeon_user_id");
            e.Property(p => p.WhoNurseUserId).HasColumnName("who_nurse_user_id");
            e.Property(p => p.WhoCompletedAt).HasColumnName("who_completed_at");
            e.Property(p => p.ProcedureNameRecorded).HasColumnName("procedure_name_recorded");
            e.Property(p => p.PostopMedicationInstructed).HasColumnName("postop_medication_instructed");
            e.Property(p => p.PostopPositionInstructed).HasColumnName("postop_position_instructed");
            e.Property(p => p.AfterSurgeryCompletedAt).HasColumnName("after_surgery_completed_at");
            e.Property(p => p.AfterSurgeryCompletedBy).HasColumnName("after_surgery_completed_by");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── PacAssessment ──────────────────────────────────────────────────
        modelBuilder.Entity<PacAssessment>(e =>
        {
            e.ToTable("pac_assessment");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.AssessedAt).HasColumnName("assessed_at");
            e.Property(p => p.PreOpDiagnosis).HasColumnName("pre_op_diagnosis");
            e.Property(p => p.Bp).HasColumnName("bp");
            e.Property(p => p.Hr).HasColumnName("hr");
            e.Property(p => p.PhysicalStatusAsa).HasColumnName("physical_status_asa");
            e.Property(p => p.Investigations).HasColumnName("investigations");
            e.Property(p => p.Allergies).HasColumnName("allergies");
            e.Property(p => p.SystemicReview).HasColumnName("systemic_review");
            e.Property(p => p.PastAnaestheticHistory).HasColumnName("past_anaesthetic_history");
            e.Property(p => p.AirwayExam).HasColumnName("airway_exam");
            e.Property(p => p.AnaesthesiaPlan).HasColumnName("anaesthesia_plan");
            e.Property(p => p.PeriOpExplained).HasColumnName("peri_op_explained");
            e.Property(p => p.ConsentType).HasColumnName("consent_type");
            e.Property(p => p.CurrentMedications).HasColumnName("current_medications");
            e.Property(p => p.PreOpConsultations).HasColumnName("pre_op_consultations");
            e.Property(p => p.MedicationsAdvised).HasColumnName("medications_advised");
            e.Property(p => p.InvestigationsAdvised).HasColumnName("investigations_advised");
            e.Property(p => p.CompletedByDesignation).HasColumnName("completed_by_designation");
            e.Property(p => p.AssessmentStatus).HasColumnName("assessment_status");
            e.Property(p => p.CompletedByUserId).HasColumnName("completed_by_user_id");
            e.Property(p => p.CompletedAt).HasColumnName("completed_at");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── AnaesthesiaMonitoring ──────────────────────────────────────────
        modelBuilder.Entity<AnaesthesiaMonitoring>(e =>
        {
            e.ToTable("anaesthesia_monitoring");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.PreOpPulse).HasColumnName("pre_op_pulse");
            e.Property(p => p.PreOpBp).HasColumnName("pre_op_bp");
            e.Property(p => p.PreOpSpo2).HasColumnName("pre_op_spo2");
            e.Property(p => p.PreOpConsentConfirmed).HasColumnName("pre_op_consent_confirmed");
            e.Property(p => p.PreOpReviewAt).HasColumnName("pre_op_review_at");
            e.Property(p => p.MonitoringReadings).HasColumnName("monitoring_readings");
            e.Property(p => p.DischargePr).HasColumnName("discharge_pr");
            e.Property(p => p.DischargeBp).HasColumnName("discharge_bp");
            e.Property(p => p.GeneralConditionNormal).HasColumnName("general_condition_normal");
            e.Property(p => p.DischargeRemarks).HasColumnName("discharge_remarks");
            e.Property(p => p.DischargeClearedBy).HasColumnName("discharge_cleared_by");
            e.Property(p => p.DischargeClearedAt).HasColumnName("discharge_cleared_at");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── PreOpMedicationLog ─────────────────────────────────────────────
        modelBuilder.Entity<PreOpMedicationLog>(e =>
        {
            e.ToTable("pre_op_medication_log");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.MedicationId).HasColumnName("medication_id");
            e.Property(p => p.MedicineName).HasColumnName("medicine_name");
            e.Property(p => p.DoseNumber).HasColumnName("dose_number");
            e.Property(p => p.AdministeredAt).HasColumnName("administered_at");
            e.Property(p => p.AdministeredByUserId).HasColumnName("administered_by_user_id");
            e.Property(p => p.Notes).HasColumnName("notes");
            e.Property(p => p.DisplayOrder).HasColumnName("display_order");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── PreOpClearance ─────────────────────────────────────────────────
        modelBuilder.Entity<PreOpClearance>(e =>
        {
            e.ToTable("pre_op_clearance");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.JourneyId).HasColumnName("journey_id");
            e.Property(p => p.PaymentModeSnapshot).HasColumnName("payment_mode_snapshot");
            e.Property(p => p.InsurancePreauthId).HasColumnName("insurance_preauth_id");
            e.Property(p => p.OverallStatus).HasColumnName("overall_status");
            e.Property(p => p.OverallClearance).HasColumnName("overall_clearance");
            e.Property(p => p.IsDeferred).HasColumnName("is_deferred");
            e.Property(p => p.DeferredReason).HasColumnName("deferred_reason");
            e.Property(p => p.ClearedAt).HasColumnName("cleared_at");
            e.Property(p => p.ClearedByUserId).HasColumnName("cleared_by_user_id");
            e.Property(p => p.ClearanceNotes).HasColumnName("clearance_notes");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── PreOpCompletion ────────────────────────────────────────────────
        modelBuilder.Entity<PreOpCompletion>(e =>
        {
            e.ToTable("pre_op_completions");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.ClearanceId).HasColumnName("clearance_id");
            e.Property(p => p.ItemId).HasColumnName("item_id");
            e.Property(p => p.IsCompleted).HasColumnName("is_completed");
            e.Property(p => p.IsBypassed).HasColumnName("is_bypassed");
            e.Property(p => p.BypassReason).HasColumnName("bypass_reason");
            e.Property(p => p.Notes).HasColumnName("notes");
            e.Property(p => p.DocumentId).HasColumnName("document_id");
            e.Property(p => p.CompletedByUserId).HasColumnName("completed_by_user_id");
            e.Property(p => p.CompletedByRole).HasColumnName("completed_by_role");
            e.Property(p => p.CompletedAt).HasColumnName("completed_at");
            e.Property(p => p.Source).HasColumnName("source");
            e.Property(p => p.CopiedAt).HasColumnName("copied_at");
            e.Property(p => p.CounsellorCompletionId).HasColumnName("counsellor_completion_id");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── PreOpDocument ──────────────────────────────────────────────────
        modelBuilder.Entity<PreOpDocument>(e =>
        {
            e.ToTable("pre_op_documents");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.ClearanceId).HasColumnName("clearance_id");
            e.Property(p => p.DocumentType).HasColumnName("document_type");
            e.Property(p => p.FileName).HasColumnName("file_name");
            e.Property(p => p.FileUrl).HasColumnName("file_url");
            e.Property(p => p.ContentType).HasColumnName("content_type");
            e.Property(p => p.FileSizeBytes).HasColumnName("file_size_bytes");
            e.Property(p => p.IsVerified).HasColumnName("is_verified");
            e.Property(p => p.VerifiedByUserId).HasColumnName("verified_by_user_id");
            e.Property(p => p.VerifiedAt).HasColumnName("verified_at");
            e.Property(p => p.Notes).HasColumnName("notes");
            e.Property(p => p.UploadedByUserId).HasColumnName("uploaded_by_user_id");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── IpIoType (global master — no tenant) ──────────────────────────
        modelBuilder.Entity<IpIoType>(e =>
        {
            e.ToTable("ip_io_type");
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.Category).HasColumnName("category");
            e.Property(p => p.Label).HasColumnName("label");
            e.Property(p => p.Unit).HasColumnName("unit");
            e.Property(p => p.DisplayOrder).HasColumnName("display_order");
            e.Property(p => p.Status).HasColumnName("status");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
        });

        // ── PreOpSectionClearance ──────────────────────────────────────────
        modelBuilder.Entity<PreOpSectionClearance>(e =>
        {
            e.ToTable("preop_section_clearance");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.ClearanceId).HasColumnName("clearance_id");
            e.Property(p => p.SectionCategory).HasColumnName("section_category");
            e.Property(p => p.ResponsibleDepartmentCode).HasColumnName("responsible_department_code");
            e.Property(p => p.Status).HasColumnName("status");
            e.Property(p => p.RequestedByUserId).HasColumnName("requested_by_user_id");
            e.Property(p => p.RequestedAt).HasColumnName("requested_at");
            e.Property(p => p.RespondedByUserId).HasColumnName("responded_by_user_id");
            e.Property(p => p.RespondedAt).HasColumnName("responded_at");
            e.Property(p => p.ResponseNotes).HasColumnName("response_notes");
            e.Property(p => p.IsExternalResponder).HasColumnName("is_external_responder");
            e.Property(p => p.ExternalResponderName).HasColumnName("external_responder_name");
            e.Property(p => p.ExternalResponderContact).HasColumnName("external_responder_contact");
            e.Property(p => p.ConfirmedByUserId).HasColumnName("confirmed_by_user_id");
            e.Property(p => p.ConfirmedAt).HasColumnName("confirmed_at");
            e.Property(p => p.ConfirmationNotes).HasColumnName("confirmation_notes");
            e.Property(p => p.Urgency).HasColumnName("urgency");
            e.Property(p => p.RejectionReason).HasColumnName("rejection_reason");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.ActiveStatus).HasColumnName("active_status");
        });

        // ── PreOpFollowUpTask ──────────────────────────────────────────────
        modelBuilder.Entity<PreOpFollowUpTask>(e =>
        {
            e.ToTable("pre_op_follow_up_tasks", t => t.ExcludeFromMigrations());
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.ClearanceId).HasColumnName("clearance_id");
            e.Property(p => p.PatientJourneyId).HasColumnName("patient_journey_id");
            e.Property(p => p.SectionCategory).HasColumnName("section_category");
            e.Property(p => p.ItemKey).HasColumnName("item_key");
            e.Property(p => p.ItemLabel).HasColumnName("item_label");
            e.Property(p => p.BypassReason).HasColumnName("bypass_reason");
            e.Property(p => p.Urgency).HasColumnName("urgency");
            e.Property(p => p.DueBy).HasColumnName("due_by");
            e.Property(p => p.TaskStatus).HasColumnName("task_status");
            e.Property(p => p.CompletedByUserId).HasColumnName("completed_by_user_id");
            e.Property(p => p.CompletedAt).HasColumnName("completed_at");
            e.Property(p => p.CompletionNotes).HasColumnName("completion_notes");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── IolCatalogMaster ──────────────────────────────────────────────
        modelBuilder.Entity<IolCatalogMaster>(e =>
        {
            e.ToTable("iol_catalog_master", t => t.ExcludeFromMigrations());
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.ModelName).HasColumnName("model_name");
            e.Property(p => p.Brand).HasColumnName("brand_manufacturer");
            e.Property(p => p.IolType).HasColumnName("iol_type");
            e.Property(p => p.Origin).HasColumnName("origin");
            e.Property(p => p.LensCategory).HasColumnName("lens_category");
            e.Property(p => p.Material).HasColumnName("material");
            e.Property(p => p.PowerRangeMin).HasColumnName("power_range_min");
            e.Property(p => p.PowerRangeMax).HasColumnName("power_range_max");
            e.Property(p => p.PowerIncrement).HasColumnName("power_increment");
            e.Property(p => p.DistanceRange).HasColumnName("distance_range");
            e.Property(p => p.AConstant).HasColumnName("a_constant");
            e.Property(p => p.DefaultPrice).HasColumnName("default_price");
            e.Property(p => p.ProductCode).HasColumnName("product_code");
            e.Property(p => p.IsActive).HasColumnName("is_active");
            e.Property(p => p.DisplayOrder).HasColumnName("display_order");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.CreatedByUserId).HasColumnName("created_by_user_id");
            e.Property(p => p.UpdatedByUserId).HasColumnName("updated_by_user_id");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            e.Property(p => p.Status).HasColumnName("status");
        });

        // ── OphthMedication (read-only, owned by auth-service) ────────────
        modelBuilder.Entity<OphthMedication>(e =>
        {
            e.ToTable("ophth_medication", t => t.ExcludeFromMigrations());
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.TenantId).HasColumnName("tenant_id");
            e.Property(p => p.GenericName).HasColumnName("generic_name");
            e.Property(p => p.DrugClass).HasColumnName("drug_class");
            e.Property(p => p.Route).HasColumnName("route");
            e.Property(p => p.Status).HasColumnName("status");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.DeletedAt).HasColumnName("deleted_at");
        });
    }
}
