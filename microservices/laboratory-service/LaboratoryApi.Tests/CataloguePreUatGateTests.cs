using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

/// <summary>L-CAT-01B pre-UAT gate: lifecycle negatives, isolation, fail-closed audit, versioning.</summary>
public class CataloguePreUatGateTests
{
    private readonly Guid _tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _otherTenant = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _actor = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    private static (LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, CatalogueService Svc) Create(
        bool auditFails = false)
    {
        var db = new LaboratoryDbContext(new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options);
        var audit = new Mock<IPlatformAuditClient>();
        if (auditFails)
        {
            audit.Setup(a => a.WriteAsync(
                    It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                    It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new CatalogueDomainException(
                    "Catalogue mutation aborted: platform audit write failed.",
                    statusCode: 503,
                    code: "audit_unavailable"));
        }
        else
        {
            audit.Setup(a => a.WriteAsync(
                    It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                    It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
        }

        return (db, audit, new CatalogueService(db, audit.Object));
    }

    private CreateCatalogueDraftRequest Req(string code) =>
        new("TEST", code, "UAT Gate Item", "CLINICAL_CHEMISTRY", ChangeReason: "gate");

    private async Task<CatalogueItemDetailDto> ToStatusAsync(
        CatalogueService svc, string code, string target)
    {
        var d = await svc.CreateDraftAsync(_tenant, _actor, Req(code));
        if (target == CatalogueStatuses.Draft) return d;
        d = await svc.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        if (target == CatalogueStatuses.Review) return d;
        d = await svc.ApproveAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        if (target == CatalogueStatuses.Approved) return d;
        d = await svc.ActivateAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        if (target == CatalogueStatuses.Active) return d;
        if (target == CatalogueStatuses.Retired)
            return await svc.RetireAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(Reason: "retire"));
        if (target == CatalogueStatuses.Superseded)
            return await svc.SupersedeAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(Reason: "sup"));
        return d;
    }

    // ─── lifecycle negatives ─────────────────────────────────────────────────

    [Theory]
    [InlineData("Draft", "Approve")]
    [InlineData("Draft", "Activate")]
    [InlineData("Review", "Activate")]
    [InlineData("Active", "Return")]
    [InlineData("Retired", "Activate")]
    [InlineData("Superseded", "Activate")]
    public async Task Invalid_Transitions_Rejected(string from, string op)
    {
        var (_, _, svc) = Create();
        var d = from switch
        {
            "Draft" => await ToStatusAsync(svc, $"NEG-{from}-{op}", CatalogueStatuses.Draft),
            "Review" => await ToStatusAsync(svc, $"NEG-{from}-{op}", CatalogueStatuses.Review),
            "Active" => await ToStatusAsync(svc, $"NEG-{from}-{op}", CatalogueStatuses.Active),
            "Retired" => await ToStatusAsync(svc, $"NEG-{from}-{op}", CatalogueStatuses.Retired),
            "Superseded" => await ToStatusAsync(svc, $"NEG-{from}-{op}", CatalogueStatuses.Superseded),
            _ => throw new InvalidOperationException(),
        };

        // After supersede, latest is Draft — activate path uses latest; use history Active? 
        // Superseded latest is Draft, so Activate from Superseded item means latest Draft → Activate rejected.
        Func<Task> act = op switch
        {
            "Approve" => () => svc.ApproveAsync(_tenant, _actor, d.Id, new LifecycleActionRequest()),
            "Activate" => () => svc.ActivateAsync(_tenant, _actor, d.Id, new LifecycleActionRequest()),
            "Return" => () => svc.ReturnToDraftAsync(_tenant, _actor, d.Id, new LifecycleActionRequest()),
            _ => throw new InvalidOperationException(),
        };

        await Assert.ThrowsAsync<CatalogueDomainException>(act);
    }

    [Fact]
    public async Task Retired_And_Superseded_Versions_Not_Editable()
    {
        var (db, _, svc) = Create();
        var active = await ToStatusAsync(svc, "NEG-EDIT-1", CatalogueStatuses.Active);
        var retired = await svc.RetireAsync(_tenant, _actor, active.Id, new LifecycleActionRequest(Reason: "r"));
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.UpdateDraftAsync(_tenant, _actor, retired.Id, new UpdateCatalogueDraftRequest(DisplayName: "x")));

        var active2 = await ToStatusAsync(svc, "NEG-EDIT-2", CatalogueStatuses.Active);
        await svc.SupersedeAsync(_tenant, _actor, active2.Id, new LifecycleActionRequest());
        // Historical superseded version remains in DB and must not be mutated via draft update (latest is Draft).
        var superseded = await db.CatalogueVersions.SingleAsync(v =>
            v.CatalogueItemId == active2.Id && v.Status == CatalogueStatuses.Superseded);
        Assert.Equal(CatalogueStatuses.Superseded, superseded.Status);
        // Editing Draft is allowed; ensure historical superseded row is unchanged after draft edit.
        var detail = await svc.GetAsync(_tenant, active2.Id);
        await svc.UpdateDraftAsync(_tenant, _actor, active2.Id, new UpdateCatalogueDraftRequest(
            DisplayName: "Edited draft",
            ExpectedRowVersion: detail.CurrentVersion!.RowVersion));
        var hist = await db.CatalogueVersions.AsNoTracking().SingleAsync(v => v.Id == superseded.Id);
        Assert.Equal("UAT Gate Item", hist.DisplayName);
        Assert.Equal(CatalogueStatuses.Superseded, hist.Status);
    }

    [Fact]
    public async Task Active_Edit_In_Place_Rejected()
    {
        var (_, _, svc) = Create();
        var d = await ToStatusAsync(svc, "NEG-ACTIVE-EDIT", CatalogueStatuses.Active);
        var ex = await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.UpdateDraftAsync(_tenant, _actor, d.Id, new UpdateCatalogueDraftRequest(DisplayName: "x")));
        Assert.Equal("immutable_version", ex.Code);
    }

    // ─── valid transitions ───────────────────────────────────────────────────

    [Fact]
    public async Task Valid_Transitions_Including_Return_And_Supersede_Gap()
    {
        var (_, _, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, Req("VAL-1"));
        d = await svc.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await svc.ReturnToDraftAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        Assert.Equal(CatalogueStatuses.Draft, d.CurrentVersion!.Status);
        d = await svc.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await svc.ApproveAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await svc.ActivateAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        Assert.Equal(CatalogueStatuses.Active, d.CurrentVersion!.Status);

        d = await svc.SupersedeAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(Reason: "rev"));
        Assert.Equal(CatalogueStatuses.Draft, d.CurrentVersion!.Status);
        Assert.Null(d.CurrentActiveVersionId); // documented product gap: no Active while Draft pending
        Assert.Contains(d.VersionHistory, v => v.Status == CatalogueStatuses.Superseded);
    }

    // ─── versioning / effective dates ────────────────────────────────────────

    [Fact]
    public async Task Activate_AutoSupersedes_Prior_Active_Atomically()
    {
        var (db, audit, svc) = Create();
        // Build v1 Active, then create supersede Draft, approve path to Active v2
        var d = await ToStatusAsync(svc, "EFF-AUTO-1", CatalogueStatuses.Active);
        var v1Id = d.CurrentVersion!.Id;
        d = await svc.SupersedeAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await svc.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await svc.ApproveAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        var future = DateTime.UtcNow.Date.AddDays(30);
        d = await svc.ActivateAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(EffectiveFrom: future));

        Assert.Equal(CatalogueStatuses.Active, d.CurrentVersion!.Status);
        Assert.Equal(future, d.CurrentVersion.EffectiveFrom);
        var v1 = await db.CatalogueVersions.AsNoTracking().SingleAsync(v => v.Id == v1Id);
        Assert.Equal(CatalogueStatuses.Superseded, v1.Status);
        Assert.Equal(d.CurrentVersion.Id, v1.SupersededByVersionId);
        // Status Active with future EffectiveFrom is current behavior (lifecycle Active ≠ calendar effective).
        Assert.Equal(d.CurrentVersion.Id, d.CurrentActiveVersionId);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CatalogueAuditActions.Activate, It.IsAny<string>(), It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.AtLeastOnce);
    }

    [Fact]
    public async Task Explicit_Supersede_Creates_Draft_And_Marks_Prior_Superseded()
    {
        var (_, _, svc) = Create();
        var d = await ToStatusAsync(svc, "EFF-SUP-1", CatalogueStatuses.Active);
        var oldId = d.CurrentVersion!.Id;
        d = await svc.SupersedeAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(Reason: "change"));
        Assert.Equal(2, d.CurrentVersion!.VersionNumber);
        Assert.Equal(CatalogueStatuses.Draft, d.CurrentVersion.Status);
        Assert.Contains(d.VersionHistory, v => v.Id == oldId && v.Status == CatalogueStatuses.Superseded);
    }

    // ─── tenant / branch ─────────────────────────────────────────────────────

    [Fact]
    public async Task Tenant_Isolation_On_List_And_Get()
    {
        var (_, _, svc) = Create();
        var a = await svc.CreateDraftAsync(_tenant, _actor, Req("TEN-A-1"));
        await svc.CreateDraftAsync(_otherTenant, _actor, Req("TEN-B-1"));

        var listA = await svc.ListAsync(_tenant, new CatalogueListQuery());
        Assert.All(listA.Items, i => Assert.Equal(_tenant, a.TenantId));
        Assert.DoesNotContain(listA.Items, i => i.InternalOrderCode == "TEN-B-1");

        await Assert.ThrowsAsync<CatalogueDomainException>(() => svc.GetAsync(_otherTenant, a.Id));
    }

    [Fact]
    public async Task Branch_Filter_Excludes_Other_Branch_Scoped_Items()
    {
        var (_, _, svc) = Create();
        var branchA = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var branchB = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        await svc.CreateDraftAsync(_tenant, _actor, Req("BR-A") with { BranchIds = new[] { branchA } });
        await svc.CreateDraftAsync(_tenant, _actor, Req("BR-B") with { BranchIds = new[] { branchB } });
        await svc.CreateDraftAsync(_tenant, _actor, Req("BR-TENANT")); // tenant-wide

        var forA = await svc.ListAsync(_tenant, new CatalogueListQuery(BranchId: branchA));
        Assert.Contains(forA.Items, i => i.InternalOrderCode == "BR-A");
        Assert.Contains(forA.Items, i => i.InternalOrderCode == "BR-TENANT");
        Assert.DoesNotContain(forA.Items, i => i.InternalOrderCode == "BR-B");
    }

    // ─── audit fail-closed ───────────────────────────────────────────────────

    [Fact]
    public async Task Create_Fails_Closed_When_Audit_Unavailable()
    {
        var (db, _, svc) = Create(auditFails: true);
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.CreateDraftAsync(_tenant, _actor, Req("AUD-FAIL-1")));
        Assert.Empty(await db.CatalogueItems.Where(i => !i.IsDeleted).ToListAsync());
    }

    [Fact]
    public async Task Submit_Fails_Closed_When_Audit_Unavailable()
    {
        var (db, audit, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, Req("AUD-FAIL-2"));
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), CatalogueAuditActions.SubmitReview, It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new CatalogueDomainException("audit down", 503, "audit_unavailable"));

        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest()));

        var ver = await db.CatalogueVersions.SingleAsync(v => v.CatalogueItemId == d.Id);
        Assert.Equal(CatalogueStatuses.Draft, ver.Status);
    }

    [Fact]
    public async Task Return_To_Draft_Is_Audited()
    {
        var (_, audit, svc) = Create();
        var d = await ToStatusAsync(svc, "AUD-RET", CatalogueStatuses.Review);
        await svc.ReturnToDraftAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(Reason: "fix"));
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CatalogueAuditActions.ReturnToDraft, It.IsAny<string>(), It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
