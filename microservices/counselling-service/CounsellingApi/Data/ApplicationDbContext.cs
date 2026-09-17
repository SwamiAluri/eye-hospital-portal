using CounsellingApi.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace CounsellingApi.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<PatientCounselling> PatientCounselling => Set<PatientCounselling>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<SessionPriceOverride> SessionPriceOverrides => Set<SessionPriceOverride>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ─── Patient ─────────────────────────────────────────────────────────────
        // Read-only projection of the shared `patients` table (owned by auth-service).
        // ExcludeFromMigrations() ensures EF never generates CREATE/DROP TABLE for it.
        // Do NOT require a JOIN to this table for counselling DML — local/shared DBs may
        // not expose `patients` in the counselling connection (42P01). PatientId is a
        // plain Guid column; display enrichment is optional and must not block Save.
        modelBuilder.Entity<Patient>(entity =>
        {
            entity.ToTable("patients", t => t.ExcludeFromMigrations());

            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.HealthId).HasColumnName("health_id").HasMaxLength(50);
            entity.Property(e => e.FirstName).HasColumnName("first_name").HasMaxLength(100);
            entity.Property(e => e.LastName).HasColumnName("last_name").HasMaxLength(100);
            entity.Property(e => e.Gender).HasColumnName("gender").HasMaxLength(20);
            entity.Property(e => e.ContactNumber).HasColumnName("contact_number").HasMaxLength(20);
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Ignore(e => e.CounsellingRecords);

            entity.HasIndex(e => new { e.TenantId, e.HealthId })
                  .IsUnique()
                  .HasFilter("health_id IS NOT NULL AND deleted_at IS NULL")
                  .HasDatabaseName("idx_patients_tenant_health_id");
        });

        // ─── PatientCounselling ──────────────────────────────────────────────────
        modelBuilder.Entity<PatientCounselling>(entity =>
        {
            entity.ToTable("patient_counselling");

            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id");
            entity.Property(e => e.PatientId).HasColumnName("patient_id");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(e => e.PreviousStatus).HasColumnName("previous_status").HasMaxLength(50);
            entity.Property(e => e.IsLocked).HasColumnName("is_locked");
            entity.Property(e => e.LockedBy).HasColumnName("locked_by").HasMaxLength(255);
            entity.Property(e => e.DecisionType).HasColumnName("decision_type").HasMaxLength(100);
            entity.Property(e => e.DecisionTimestamp).HasColumnName("decision_timestamp");
            entity.Property(e => e.ScheduledDate).HasColumnName("scheduled_date");
            entity.Property(e => e.PackageId).HasColumnName("package_id");
            entity.Property(e => e.PackageDetails).HasColumnName("package_details").HasColumnType("jsonb");
            entity.Property(e => e.PaymentType).HasColumnName("payment_type").HasMaxLength(50);
            entity.Property(e => e.InsuranceCompany).HasColumnName("insurance_company").HasMaxLength(200);
            entity.Property(e => e.PreviousPackageDetails).HasColumnName("previous_package_details");
            entity.Property(e => e.PreviousPackageAmount).HasColumnName("previous_package_amount").HasColumnType("numeric(12,2)");
            entity.Property(e => e.AddonReason).HasColumnName("addon_reason");
            entity.Property(e => e.IsRescheduled).HasColumnName("is_rescheduled");
            entity.Property(e => e.InvestigationIds).HasColumnName("investigation_ids");
            entity.Property(e => e.IsPackageEdited).HasColumnName("is_package_edited");
            entity.Property(e => e.FollowUpDate).HasColumnName("follow_up_date");
            entity.Property(e => e.FollowUpReason).HasColumnName("follow_up_reason");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").HasMaxLength(255);
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id").HasMaxLength(255);
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.RecordStatus).HasColumnName("record_status").HasMaxLength(50);

            // xmin-based optimistic concurrency (Npgsql 8.x idiomatic approach).
            entity.Property<uint>("xmin")
                  .HasColumnType("xid")
                  .IsRowVersion();

            entity.HasIndex(e => e.Status).HasDatabaseName("idx_pc_status");
            entity.HasIndex(e => e.TenantId).HasDatabaseName("idx_pc_tenant_id");
            entity.HasIndex(e => e.PatientId).HasDatabaseName("idx_pc_patient_id");

            // No EF FK/join to patients — avoids 42P01 when the shared table is absent.
            entity.Ignore(e => e.Patient);
        });

        // ─── AuditLog ────────────────────────────────────────────────────────────
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("counselling_audit_log");

            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CounsellingId).HasColumnName("counselling_id");
            entity.Property(e => e.ActionType).HasColumnName("action").HasMaxLength(100);
            entity.Property(e => e.PerformedBy).HasColumnName("performed_by").HasMaxLength(255);
            entity.Property(e => e.PerformedAt).HasColumnName("performed_at");
            entity.Property(e => e.FieldName).HasColumnName("field_name").HasMaxLength(100);
            entity.Property(e => e.OldValue).HasColumnName("old_value");
            entity.Property(e => e.NewValue).HasColumnName("new_value");

            entity.HasIndex(e => e.CounsellingId).HasDatabaseName("idx_cal_counselling_id");
            entity.HasIndex(e => e.PerformedAt).IsDescending().HasDatabaseName("idx_cal_performed_at");
        });

        // ─── SessionPriceOverride ────────────────────────────────────────────────
        modelBuilder.Entity<SessionPriceOverride>(entity =>
        {
            entity.ToTable("session_price_overrides");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
            entity.Property(e => e.CounsellingId).HasColumnName("counselling_id").IsRequired();
            entity.Property(e => e.VariantId).HasColumnName("variant_id").IsRequired();
            entity.Property(e => e.VariantName).HasColumnName("variant_name").HasMaxLength(200).IsRequired();
            entity.Property(e => e.BasePrice).HasColumnName("base_price").HasColumnType("numeric(12,2)").IsRequired();
            entity.Property(e => e.OverriddenPrice).HasColumnName("overridden_price").HasColumnType("numeric(12,2)").IsRequired();
            entity.Property(e => e.PriceType).HasColumnName("price_type").HasMaxLength(20).HasDefaultValue("FIXED");
            entity.Property(e => e.Reason).HasColumnName("reason").IsRequired();
            entity.Property(e => e.Remarks).HasColumnName("remarks");
            entity.Property(e => e.RequestedByType).HasColumnName("requested_by_type").HasMaxLength(10).IsRequired();
            entity.Property(e => e.RequestedByUserId).HasColumnName("requested_by_user_id");
            entity.Property(e => e.RequestedByName).HasColumnName("requested_by_name").HasMaxLength(255);
            entity.Property(e => e.RequestedByContact).HasColumnName("requested_by_contact").HasMaxLength(255);
            entity.Property(e => e.NotificationSent).HasColumnName("notification_sent").HasDefaultValue(false);
            entity.Property(e => e.NotificationSentAt).HasColumnName("notification_sent_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").HasMaxLength(255);
            entity.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id").HasMaxLength(255);
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.RecordStatus).HasColumnName("record_status").HasMaxLength(50).HasDefaultValue("active");
            entity.HasIndex(e => e.CounsellingId).HasDatabaseName("idx_spo_counselling_id");
            entity.HasIndex(e => e.TenantId).HasDatabaseName("idx_spo_tenant_id");
            entity.HasQueryFilter(e => e.DeletedAt == null && e.RecordStatus == "active");
        });
    }
}
