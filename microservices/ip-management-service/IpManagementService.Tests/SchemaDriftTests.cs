using IpManagementService.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IpManagementService.Tests;

public class SchemaDriftTests
{
    [Fact]
    public void Detector_FailsWhenEfColumnMissingFromBaselineAndSql()
    {
        var baseline = new HashSet<string>(StringComparer.Ordinal) { "patient_journey.id" };
        const string sql = "ALTER TABLE patient_journey ADD COLUMN unmark_ready_reason text;";
        var ef = new[]
        {
            new SchemaDrift.StoreColumn("patient_journey", "id"),
            new SchemaDrift.StoreColumn("patient_journey", "brand_new_col"),
        };

        var missing = SchemaDrift.Uncovered(ef, baseline, sql);

        Assert.Contains("patient_journey.brand_new_col", missing);
        Assert.DoesNotContain("patient_journey.id", missing);
    }

    [Fact]
    public void Detector_AcceptsNewColumnWhenNumberedSqlMentionsIt()
    {
        var baseline = new HashSet<string>(StringComparer.Ordinal) { "patient_journey.id" };
        const string sql = "ALTER TABLE patient_journey ADD COLUMN brand_new_col text;";
        var ef = new[]
        {
            new SchemaDrift.StoreColumn("patient_journey", "id"),
            new SchemaDrift.StoreColumn("patient_journey", "brand_new_col"),
        };

        Assert.Empty(SchemaDrift.Uncovered(ef, baseline, sql));
    }

    [Fact]
    public void IntegrationOutboxService_HasNoRuntimeDdl()
    {
        var root = SchemaDrift.FindRepoRoot();
        var src = File.ReadAllText(Path.Combine(
            root,
            "microservices", "ip-management-service", "IpManagementService", "Services",
            "IntegrationOutboxService.cs"));
        Assert.DoesNotContain("CREATE TABLE", src, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ALTER TABLE", src, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("CREATE INDEX", src, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("164_outbox_versioned_schema.sql", src);
    }

    [Fact]
    public void IpOwnedModel_IsCoveredByBaselineOrNumberedSql()
    {
        var root = SchemaDrift.FindRepoRoot();
        var baselinePath = Path.Combine(root, "consolidated", "schema", "ip-ef-baseline.json");
        using var db = NewContext();
        var catalog = SchemaDrift.ListOwnedStoreColumns(db);

        if (string.Equals(Environment.GetEnvironmentVariable("WRITE_IP_SCHEMA_BASELINE"), "1", StringComparison.Ordinal))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(baselinePath)!);
            File.WriteAllText(baselinePath, SchemaDrift.ToBaselineJson(catalog) + Environment.NewLine);
            return;
        }

        Assert.True(File.Exists(baselinePath), "Missing consolidated/schema/ip-ef-baseline.json (DB-005).");
        var baseline = SchemaDrift.ReadBaselineKeys(File.ReadAllText(baselinePath));
        var sql = SchemaDrift.ConcatNumberedSql(root);
        var missing = SchemaDrift.Uncovered(catalog, baseline, sql);
        Assert.True(
            missing.Count == 0,
            "EF columns not in the DB-005 baseline and not mentioned in consolidated/migrations:\n - "
            + string.Join("\n - ", missing));
    }

    [Fact]
    public void Migration164_CreatesBothOutboxTables()
    {
        var root = SchemaDrift.FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "164_outbox_versioned_schema.sql"));
        Assert.Contains("CREATE TABLE IF NOT EXISTS integration_outbox_event", sql);
        Assert.Contains("CREATE TABLE IF NOT EXISTS billing_ccms_outbox", sql);
        Assert.Contains("abandon_reason", sql);
        Assert.Contains("ux_integration_outbox_idempotency", sql);
        Assert.Contains("ux_billing_ccms_outbox_idempotency", sql);
    }

    [Fact]
    public void Migration165_AddsWardIdAndDayCareBedTypes()
    {
        var root = SchemaDrift.FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "165_bed_inventory_ward_id_and_daycare_types.sql"));
        Assert.Contains("ward_id", sql);
        Assert.Contains("Recliner", sql);
        Assert.Contains("DayCareChair", sql);
    }

    [Fact]
    public void Migration166_CreatesJourneySlotAndPointer()
    {
        var root = SchemaDrift.FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "166_journey_slot.sql"));
        Assert.Contains("CREATE TABLE IF NOT EXISTS journey_slot", sql);
        Assert.Contains("slot_id", sql);
        Assert.Contains("ux_journey_slot_theatre_session_seq", sql);
        Assert.Contains("released_at IS NULL", sql);
        Assert.Contains("idx_journey_slot_tenant_date_session", sql);
    }

    [Fact]
    public void CcmsHttpClient_IsRegisteredAgainstTheInjectedInterface()
    {
        var root = SchemaDrift.FindRepoRoot();
        var src = File.ReadAllText(Path.Combine(
            root,
            "microservices", "ip-management-service", "IpManagementService", "Program.cs"));
        Assert.Contains("AddHttpClient<ICcmsAdmissionClient, CcmsAdmissionClient>", src);
        Assert.DoesNotContain("AddScoped<ICcmsAdmissionClient, CcmsAdmissionClient>", src);
    }

    [Fact]
    public void Migration167_AttachesWave7BedsToDayCare()
    {
        var root = SchemaDrift.FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "167_bed_inventory_wave7_ward_attach.sql"));
        Assert.Contains("wave7", sql);
        Assert.Contains("DayCare", sql);
        Assert.Contains("ward_id = w.id", sql);
    }

    [Fact]
    public void Migration169_CreatesIpVitalThreshold()
    {
        var root = SchemaDrift.FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "169_ip_vital_threshold.sql"));
        Assert.Contains("CREATE TABLE IF NOT EXISTS ip_vital_threshold", sql);
        Assert.Contains("systolic_max", sql);
        Assert.Contains("temp_max_c", sql);
        Assert.Contains("CHECK (severity IN ('warn', 'block'))", sql);
    }

    [Fact]
    public void Migration168_CreatesJourneySafetyToken()
    {
        var root = SchemaDrift.FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "168_journey_safety_token.sql"));
        Assert.Contains("CREATE TABLE IF NOT EXISTS journey_safety_token", sql);
        Assert.Contains("token_code", sql);
        Assert.Contains("barcode_value", sql);
        Assert.Contains("laterality", sql);
        Assert.Contains("revoked_at", sql);
        Assert.Contains("ux_journey_safety_token_active", sql);
        Assert.Contains("ux_journey_safety_token_code", sql);
    }

    [Fact]
    public void Migration172_SeedsSafetyTokenPrint()
    {
        var root = SchemaDrift.FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "172_safety_token_print.sql"));
        Assert.Contains("ip.safety_token.print", sql);
        Assert.Contains("NURSE", sql);
        Assert.Contains("IP COORDINATOR", sql);
        Assert.Contains("('NURSE',          'ip.safety_token.print')", sql);
        Assert.DoesNotContain("('SURGEON'", sql);
    }

    [Fact]
    public void Migration173_AddsFollowupAppointmentId()
    {
        var root = SchemaDrift.FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "173_postop_followup_appointment.sql"));
        Assert.Contains("followup_appointment_id", sql);
        Assert.Contains("ix_post_op_instr_followup_appt", sql);
        Assert.Contains("appointment.create", sql);
        Assert.Contains("NURSE", sql);
        Assert.Contains("IP COORDINATOR", sql);
        Assert.DoesNotContain("follow_up_appointments", sql);
    }

    [Fact]
    public void Migration174_CreatesPostOpTaperStep()
    {
        var root = SchemaDrift.FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "174_post_op_taper_step.sql"));
        Assert.Contains("CREATE TABLE IF NOT EXISTS post_op_taper_step", sql);
        Assert.Contains("frequency_label", sql);
        Assert.Contains("ux_post_op_taper_active_step", sql);
        Assert.Contains("deleted_at IS NULL", sql);
        Assert.DoesNotContain("CREATE TABLE IF NOT EXISTS follow_up_appointments", sql);
    }

    [Fact]
    public void Migration175_CopiesOpdFieldsOnJourneyCreate()
    {
        var root = SchemaDrift.FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "175_opd_copy_into_journey.sql"));
        Assert.Contains("fn_create_patient_journey_on_ot_prepared", sql);
        Assert.Contains("biometry_records", sql);
        Assert.Contains("calculated_iol", sql);
        Assert.Contains("COALESCE(NULLIF(TRIM(NEW.iol_power), ''), v_session_iol)", sql);
        Assert.Contains("counseling_sessions", sql);
    }

    [Fact]
    public void Migration176_SeedsClaimQueryFsm()
    {
        var root = SchemaDrift.FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "176_ccms_claim_query_fsm.sql"));
        Assert.Contains("RAISE_CLAIM_QUERY", sql);
        Assert.Contains("CLAIM_QUERY_RAISED", sql);
    }

    [Fact]
    public void AddBilling_GoneAndHl7PacsAreWired()
    {
        var root = SchemaDrift.FindRepoRoot();
        var program = File.ReadAllText(Path.Combine(
            root, "microservices", "ip-management-service", "IpManagementService", "Program.cs"));
        Assert.Contains("IHl7AdtPublisher", program);
        Assert.Contains("IPacsWorklistPublisher", program);
        var outbox = File.ReadAllText(Path.Combine(
            root, "microservices", "ip-management-service", "IpManagementService", "Services",
            "IntegrationOutboxService.cs"));
        Assert.Contains("_hl7.PublishAsync", outbox);
        Assert.Contains("_pacs.PublishAsync", outbox);
    }

    private static IpManagementDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<IpManagementDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new IpManagementDbContext(options);
    }
}
