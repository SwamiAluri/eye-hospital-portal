using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace LaboratoryApi.Tests;

public class LaboratoryDbContextShellTests
{
    [Fact]
    public void Model_Contains_Only_Lms_Owned_Entity_Types()
    {
        var options = new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        using var db = new LaboratoryDbContext(options);
        var names = db.Model.GetEntityTypes().Select(t => t.ClrType).ToHashSet();
        Assert.Contains(typeof(LmsCatalogueItem), names);
        Assert.Contains(typeof(LmsCatalogueVersion), names);
        Assert.Contains(typeof(LmsCataloguePanelComponent), names);
        Assert.Contains(typeof(LmsCatalogueBranchApplicability), names);
        Assert.Contains(typeof(LmsOrder), names);
        Assert.Contains(typeof(LmsOrderVersion), names);
        Assert.Contains(typeof(LmsOrderSelection), names);
        Assert.Contains(typeof(LmsOrderTest), names);
        Assert.Contains(typeof(LmsOrderNumberSequence), names);
        Assert.Contains(typeof(LmsOrderIdempotencyRecord), names);
        Assert.Contains(typeof(LmsCollectionTask), names);
        Assert.Contains(typeof(LmsCollectionTaskOrderTest), names);
        Assert.Contains(typeof(LmsCollectionIdempotencyRecord), names);
        Assert.Contains(typeof(LmsCollectionTaskNumberSequence), names);
        Assert.Contains(typeof(LmsSpecimen), names);
        Assert.Contains(typeof(LmsSpecimenOrderTest), names);
        Assert.Contains(typeof(LmsSpecimenIdempotencyRecord), names);
        Assert.Contains(typeof(LmsAccessionNumberSequence), names);
        Assert.Contains(typeof(LmsSpecimenBarcodeConfiguration), names);
        Assert.Contains(typeof(LmsBarcodeNumberSequence), names);
        Assert.Contains(typeof(LmsSpecimenBarcode), names);
        Assert.Contains(typeof(LmsSpecimenLabelPrintEvent), names);
        Assert.Contains(typeof(LmsResult), names);
        Assert.Contains(typeof(LmsResultVersion), names);
        Assert.Contains(typeof(LmsResultIdempotencyRecord), names);
        Assert.Contains(typeof(LmsCriticalResultEvent), names);
        Assert.Contains(typeof(LmsReport), names);
        Assert.Contains(typeof(LmsReportVersion), names);
        Assert.Contains(typeof(LmsReportVersionSource), names);
        Assert.Contains(typeof(LmsReportDraftSourceClaim), names);
        Assert.Contains(typeof(LmsReportIdempotencyRecord), names);
        Assert.Contains(typeof(LmsReportNumberConfiguration), names);
        Assert.Contains(typeof(LmsReportNumberSequence), names);
        Assert.Contains(typeof(LmsReportPdfTemplateVersion), names);
        Assert.Contains(typeof(LmsReportPdfSignatory), names);
        Assert.Contains(typeof(LmsReportOfficialPdfArtifact), names);
        Assert.Contains(typeof(LmsReportOfficialPdfJob), names);
        Assert.Equal(37, names.Count);
        Assert.All(names, t => Assert.StartsWith("Lms", t.Name));
    }

    [Fact]
    public void Source_Does_Not_Reference_Legacy_Pathology_Tables()
    {
        var root = FindRepoRoot();
        var dataDir = Path.Combine(root, "microservices", "laboratory-service", "LaboratoryApi");
        var sources = Directory.GetFiles(dataDir, "*.cs", SearchOption.AllDirectories)
            .Select(File.ReadAllText);

        var joined = string.Join('\n', sources);
        Assert.DoesNotContain("LaboratoryTestDefinition", joined);
        Assert.DoesNotContain("laboratory_test_definitions", joined);
        Assert.DoesNotContain("LabReport", joined);
        Assert.Contains("lms_catalogue_items", joined);
        Assert.Contains("lms_catalogue_versions", joined);
        Assert.Contains("lms_orders", joined);
        Assert.Contains("lms_order_versions", joined);
        Assert.Contains("lms_collection_tasks", joined);
        Assert.Contains("lms_collection_task_order_tests", joined);
        Assert.Contains("lms_specimens", joined);
        Assert.Contains("lms_specimen_order_tests", joined);
        Assert.Contains("lms_reports", joined);
        Assert.Contains("lms_report_versions", joined);
        Assert.DoesNotContain("laboratory_reports", joined);
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "microservices")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new InvalidOperationException("Repo root not found");
    }
}
