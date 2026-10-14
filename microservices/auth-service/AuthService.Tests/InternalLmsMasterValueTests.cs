using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.MasterData;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>L-COL-01D — internal MasterValue validate/list for LMS rejection reasons.</summary>
public class InternalLmsMasterValueTests
{
    private const string Key = "hp-internal-svc-key-change-in-production-2026";
    private static readonly Guid Tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private const string EntityType = "lms.specimen_rejection_reason";

    private static (InternalLmsReferenceController Ctl, AppDbContext Db) Create()
    {
        var db = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
                .Options,
            new HttpContextAccessor());

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["InternalApi:Key"] = Key,
            })
            .Build();

        var ctl = new InternalLmsReferenceController(
            db,
            config,
            new Mock<IPermissionService>().Object,
            new FollowupBranchAccessService(db),
            NullLogger<InternalLmsReferenceController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext(),
            },
        };
        ctl.ControllerContext.HttpContext.Request.Headers["X-Internal-Key"] = Key;
        ctl.ControllerContext.HttpContext.Request.Headers["X-Tenant-ID"] = Tenant.ToString("D");
        return (ctl, db);
    }

    private static async Task SeedReasonAsync(
        AppDbContext db, string code, string label, bool active = true, int sort = 1)
    {
        db.EntityTypeRegistries.Add(new EntityTypeRegistry
        {
            EntityType = EntityType,
            GroupKey = "lab_diagnostics",
            DisplayName = "LMS Specimen Rejection Reasons",
            TabLabel = "Rejection Reasons",
            SortOrder = 4,
        });
        db.MasterValues.Add(new MasterValue
        {
            Id = Guid.NewGuid(),
            TenantId = Tenant,
            GroupKey = "lab_diagnostics",
            EntityType = EntityType,
            Code = code,
            Label = label,
            Metadata = "{}",
            SortOrder = sort,
            IsActive = active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task ValidateMasterValue_Allows_Active_Reason()
    {
        var (ctl, db) = Create();
        await SeedReasonAsync(db, "INSUFFICIENT_SPECIMEN", "Insufficient specimen");

        var result = await ctl.ValidateMasterValue(
            new InternalLmsReferenceController.MasterValueValidateRequest(
                EntityType, "INSUFFICIENT_SPECIMEN"),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<InternalLmsReferenceController.MasterValueValidateResponse>(ok.Value);
        Assert.Equal("INSUFFICIENT_SPECIMEN", body.Code);
        Assert.Equal("Insufficient specimen", body.Label);
        Assert.True(body.IsActive);
    }

    [Fact]
    public async Task ValidateMasterValue_Rejects_Inactive_Reason()
    {
        var (ctl, db) = Create();
        await SeedReasonAsync(db, "WRONG_CONTAINER", "Incorrect specimen container", active: false);

        var result = await ctl.ValidateMasterValue(
            new InternalLmsReferenceController.MasterValueValidateRequest(EntityType, "WRONG_CONTAINER"),
            CancellationToken.None);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("inactive", bad.Value?.ToString() ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ValidateMasterValue_Rejects_Unknown_Reason()
    {
        var (ctl, db) = Create();
        await SeedReasonAsync(db, "LABELING_ERROR", "Specimen labeling error");

        var result = await ctl.ValidateMasterValue(
            new InternalLmsReferenceController.MasterValueValidateRequest(EntityType, "NOT_A_REASON"),
            CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task ListMasterValues_Returns_Active_Only_By_Default()
    {
        var (ctl, db) = Create();
        db.EntityTypeRegistries.Add(new EntityTypeRegistry
        {
            EntityType = EntityType,
            GroupKey = "lab_diagnostics",
            DisplayName = "LMS Specimen Rejection Reasons",
            SortOrder = 4,
        });
        db.MasterValues.AddRange(
            new MasterValue
            {
                Id = Guid.NewGuid(),
                TenantId = Tenant,
                GroupKey = "lab_diagnostics",
                EntityType = EntityType,
                Code = "ACTIVE_ONE",
                Label = "Active",
                Metadata = "{}",
                SortOrder = 1,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            },
            new MasterValue
            {
                Id = Guid.NewGuid(),
                TenantId = Tenant,
                GroupKey = "lab_diagnostics",
                EntityType = EntityType,
                Code = "INACTIVE_ONE",
                Label = "Inactive",
                Metadata = "{}",
                SortOrder = 2,
                IsActive = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        await db.SaveChangesAsync();

        var result = await ctl.ListMasterValues(EntityType, activeOnly: true, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result);
        var list = Assert.IsAssignableFrom<IEnumerable<InternalLmsReferenceController.MasterValueValidateResponse>>(ok.Value);
        var codes = list.Select(x => x.Code).ToList();
        Assert.Contains("ACTIVE_ONE", codes);
        Assert.DoesNotContain("INACTIVE_ONE", codes);
    }
}
