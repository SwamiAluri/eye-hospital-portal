using Xunit;

namespace AuthService.Tests;

public class SchemaDriftTests
{
    [Fact]
    public void BillingCcmsOutboxService_HasNoRuntimeDdl()
    {
        var root = FindRepoRoot();
        var src = File.ReadAllText(Path.Combine(
            root,
            "microservices", "auth-service", "AuthService", "Services",
            "BillingCcmsOutboxService.cs"));
        Assert.DoesNotContain("CREATE TABLE", src, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ALTER TABLE", src, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("CREATE INDEX", src, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("164_outbox_versioned_schema.sql", src);
    }

    [Fact]
    public void Migration164_DefinesBillingOutbox()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(root, "consolidated", "migrations", "164_outbox_versioned_schema.sql"));
        Assert.Contains("CREATE TABLE IF NOT EXISTS billing_ccms_outbox", sql);
        Assert.Contains("idempotency_key", sql);
        Assert.Contains("abandon_reason", sql);
    }

    [Fact]
    public void Migration165_DefinesWardIdAndDayCareTypes()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(
            root, "consolidated", "migrations", "165_bed_inventory_ward_id_and_daycare_types.sql"));
        Assert.Contains("ADD COLUMN IF NOT EXISTS ward_id", sql);
        Assert.Contains("Recliner", sql);
        Assert.Contains("DayCareChair", sql);
        Assert.Contains("lower(btrim(b.ward_name)) = lower(btrim(w.ward_name))", sql);
    }

    [Fact]
    public void Migration167_AttachesWave7AliasToDayCare()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(
            root, "consolidated", "migrations", "167_bed_inventory_wave7_ward_attach.sql"));
        Assert.Contains("wave7", sql);
        Assert.Contains("DayCare", sql);
        Assert.Contains("ward_id = w.id", sql);
        Assert.Contains("ward_name = w.ward_name", sql);
    }

    [Fact]
    public void Wave7SmokeSeed_CleansEmptyCleaningAndInsertsAvailableDayCareTypes()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(
            root, "consolidated", "migrations", "_seed_w7_smoke_available_beds.sql"));
        Assert.Contains("W7-SMOKE-2", sql);
        Assert.Contains("bed_status = 'Cleaning'", sql);
        Assert.DoesNotContain("bed_status = 'Occupied'", sql);
        Assert.Contains("Recliner", sql);
        Assert.Contains("DayCareChair", sql);
        Assert.Contains("W7-SMOKE-3", sql);
        Assert.Contains("W7-SMOKE-4", sql);
        Assert.Contains("assigned_bed_id = b.id", sql);
        Assert.DoesNotContain("bed_status = 'Occupied'", sql);
    }

    [Fact]
    public void Wave7CcmsAdmissionGateSeed_LinksUatInsuranceJourneys()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(
            root, "consolidated", "migrations", "_seed_w7_ccms_admission_gates.sql"));
        Assert.Contains("UAT-IP-091", sql);
        Assert.Contains("WAITING_APPROVAL", sql);
        Assert.Contains("UAT-IP-096", sql);
        Assert.Contains("APPROVED", sql);
        Assert.Contains("CCMS-W7-SMOKE-APPROVED", sql);
        Assert.Contains("CCMS-2627-000014", sql);
    }

    [Fact]
    public void Wave7CcmsPartialApprovalSeed_LinksUatIp106Shares()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(
            root, "consolidated", "migrations", "_seed_w7_ccms_partial_approval.sql"));
        Assert.Contains("UAT-IP-106", sql);
        Assert.Contains("PARTIAL_APPROVAL", sql);
        Assert.Contains("CCMS-W7-SMOKE-PARTIAL", sql);
        Assert.Contains("70000", sql);
        Assert.Contains("100000", sql);
        Assert.DoesNotContain("CCMS-2627-000014", sql);
    }

    [Fact]
    public void Wave7CcmsClaimQuerySeed_CreatesDedicatedUatClaim()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(
            root, "consolidated", "migrations", "_seed_w7_ccms_claim_query.sql"));
        Assert.Contains("CCMS-W7-SMOKE-CLAIM", sql);
        Assert.Contains("CLM-W7-SMOKE-CLAIM", sql);
        Assert.Contains("CLAIM_SUBMITTED", sql);
        Assert.Contains("ccms_claim_packets", sql);
        Assert.Contains("ccms_coverage_authorizations", sql);
        Assert.DoesNotContain("CCMS-2627-000014", sql);
    }

    [Fact]
    public void Wave7CashExpectedRecycleSeed_RestoresUatIp001()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(
            root, "consolidated", "migrations", "_seed_w7_cash_expected_recycle.sql"));
        Assert.Contains("UAT-IP-001", sql);
        Assert.Contains("Expected", sql);
        Assert.Contains("Discharged", sql);
        Assert.Contains("is_discharged = false", sql);
        Assert.Contains("is_locked = false", sql);
        Assert.Contains("discharge_type = NULL", sql);
        Assert.Contains("155fe198-6ae5-4a01-9254-ead5b427247e", sql);
    }

    [Fact]
    public void Migration176_SeedsClaimQueryFsm()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(
            root, "consolidated", "migrations", "176_ccms_claim_query_fsm.sql"));
        Assert.Contains("CLAIM_QUERY_RAISED", sql);
        Assert.Contains("CLAIM_QUERY_RESPONDED", sql);
        Assert.Contains("RAISE_CLAIM_QUERY", sql);
        Assert.Contains("RESPOND_CLAIM_QUERY", sql);
        Assert.Contains("CONTINUE_CLAIM", sql);
        Assert.Contains("RETURN_TO_SUBMITTED", sql);
    }

    [Fact]
    public void Migration177_AddsPayerIdOnVariantPrices()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(
            root, "consolidated", "migrations", "177_variant_prices_payer_id.sql"));
        Assert.Contains("ADD COLUMN IF NOT EXISTS payer_id", sql);
        Assert.Contains("idx_variant_prices_payer", sql);
        Assert.Contains("ccms_insurance_providers", sql);
    }

    [Fact]
    public void Migration178_AddsConsignmentStock()
    {
        var root = FindRepoRoot();
        var sql = File.ReadAllText(Path.Combine(
            root, "consolidated", "migrations", "178_inv_consignment_stock.sql"));
        Assert.Contains("is_consignment_vendor", sql);
        Assert.Contains("is_consignment", sql);
        Assert.Contains("inv_stock_batches", sql);
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "consolidated", "migrations")))
                return dir.FullName;
            dir = dir.Parent;
        }

        throw new DirectoryNotFoundException("Could not find consolidated/migrations from " + AppContext.BaseDirectory);
    }
}
