using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace AuthService.Tests;

public class LaboratoryClinicalCatalogBootstrapTests
{
    private static readonly Guid TenantId = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");

    [Fact]
    public async Task Bootstrap_ImportsLabTypeOnly_IsIdempotent_AndFindsCbc()
    {
        await using var db = CreateDb();
        db.LabTestCatalog.AddRange(
            Lab("Complete Blood Count (CBC)", "CBC001", "Haematology", "Lab", "Blood (EDTA)", 4),
            Lab("Complete Blood Count (CBC)", "CBC", "Pre-Operative Panel", "Lab", null, null),
            Lab("HbA1c (Glycated Haemoglobin)", "HBA1C001", "Blood Sugar", "Lab", "Blood (EDTA)", 6),
            Lab("Optical Coherence Tomography", "OCT001", "Ophthalmic", "Imaging", null, null),
            Lab("Electrocardiogram (ECG)", "ECG001", "Cardiac", "Lab", "N/A", 1),
            Lab("Fundus Photo", "FP001", "Ophthalmic", "Scan", null, null));
        await db.SaveChangesAsync();

        var env = new FakeHostEnvironment("Development");
        var first = await LaboratoryClinicalCatalogBootstrap.EnsureFromLabTestCatalogAsync(db, TenantId, env);
        Assert.Equal(6, first.SourceTotal);
        // CBC001 + CBC + HBA1C001 eligible; Imaging/Scan/ECG excluded
        Assert.Equal(3, first.Eligible);
        Assert.Equal(3, first.Imported);
        Assert.Equal(0, first.AlreadyExisting);
        Assert.True(first.CbcFound);
        Assert.Contains("CBC001", first.CbcCodes);
        Assert.Contains("CBC", first.CbcCodes);
        Assert.Equal(3, await db.LaboratoryTestDefinitions.CountAsync());
        Assert.DoesNotContain(await db.LaboratoryTestDefinitions.Select(d => d.LocalCode).ToListAsync(),
            c => c is "OCT001" or "ECG001" or "FP001");

        var cbc001 = await db.LaboratoryTestDefinitions
            .Include(d => d.SpecimenOptions)
            .SingleAsync(d => d.LocalCode == "CBC001");
        Assert.Equal("Complete Blood Count (CBC)", cbc001.Name);
        Assert.Equal("Haematology", cbc001.Category);
        Assert.Equal("Blood (EDTA)", cbc001.SpecimenOptions.Single().SpecimenType);
        Assert.Equal(4, cbc001.TurnaroundHours);

        var second = await LaboratoryClinicalCatalogBootstrap.EnsureFromLabTestCatalogAsync(db, TenantId, env);
        Assert.Equal(0, second.Imported);
        Assert.Equal(3, second.AlreadyExisting);
        Assert.Equal(3, await db.LaboratoryTestDefinitions.CountAsync());
    }

    [Fact]
    public async Task Bootstrap_SkippedOutsideDevelopmentUatTesting()
    {
        await using var db = CreateDb();
        db.LabTestCatalog.Add(Lab("CBC", "CBC001", "Haematology", "Lab", "Blood", 4));
        await db.SaveChangesAsync();

        var report = await LaboratoryClinicalCatalogBootstrap.EnsureFromLabTestCatalogAsync(
            db, TenantId, new FakeHostEnvironment("Production"));
        Assert.Equal(0, report.Imported);
        Assert.Equal(0, await db.LaboratoryTestDefinitions.CountAsync());
    }

    private static LabTestCatalog Lab(
        string name,
        string code,
        string category,
        string testType,
        string? specimen,
        int? tat) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = null,
            TestName = name,
            TestCode = code,
            Category = category,
            TestType = testType,
            SampleType = specimen,
            TurnaroundHours = tat,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

    private static AppDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options, new HttpContextAccessor());

    private sealed class FakeHostEnvironment : IHostEnvironment
    {
        public FakeHostEnvironment(string env) => EnvironmentName = env;
        public string EnvironmentName { get; set; }
        public string ApplicationName { get; set; } = "AuthService.Tests";
        public string ContentRootPath { get; set; } = ".";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
