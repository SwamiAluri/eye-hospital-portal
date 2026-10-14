using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using LaboratoryApi.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

public class CatalogueServiceTests
{
    private readonly Guid _tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _otherTenant = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _actor = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    private static (LaboratoryDbContext Db, Mock<IPlatformAuditClient> Audit, CatalogueService Svc) Create()
    {
        var db = new LaboratoryDbContext(new DbContextOptionsBuilder<LaboratoryDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options);
        var audit = new Mock<IPlatformAuditClient>();
        audit.Setup(a => a.WriteAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        return (db, audit, new CatalogueService(db, audit.Object));
    }

    private CreateCatalogueDraftRequest DraftReq(
        string type = CatalogueTypes.Test,
        string code = "UAT-T01",
        string name = "UAT Controlled Test",
        string? classification = null) =>
        new(
            CatalogueType: type,
            InternalOrderCode: code,
            DisplayName: name,
            Discipline: "CLINICAL_CHEMISTRY",
            Classification: classification,
            ChangeReason: "UAT controlled record");

    // ─── Creation ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_Test_Draft()
    {
        var (db, audit, svc) = Create();
        var detail = await svc.CreateDraftAsync(_tenant, _actor, DraftReq());
        Assert.Equal(CatalogueTypes.Test, detail.CatalogueType);
        Assert.Equal(CatalogueStatuses.Draft, detail.CurrentVersion!.Status);
        Assert.Equal(1, detail.CurrentVersion.VersionNumber);
        Assert.Equal(CatalogueClassifications.Local, detail.CurrentVersion.Classification);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CatalogueAuditActions.CreateDraft, "LmsCatalogueVersion",
            It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        Assert.Single(db.CatalogueItems);
    }

    [Fact]
    public async Task Create_Panel_Draft_With_Components()
    {
        var (_, _, svc) = Create();
        var test = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-COMP-1"));
        // Activate path for component? Components can reference draft versions for catalogue authoring.
        var panel = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(
            type: CatalogueTypes.Panel, code: "UAT-PANEL-1", name: "UAT Panel") with
        {
            PanelComponents = new[]
            {
                new PanelComponentInput(test.Id, test.CurrentVersion!.Id, 1, true),
            },
        });
        Assert.Equal(CatalogueTypes.Panel, panel.CatalogueType);
        Assert.Single(panel.CurrentVersion!.PanelComponents);
        Assert.Equal(1, panel.CurrentVersion.PanelComponents[0].SortOrder);
    }

    [Fact]
    public async Task Create_ReferralTest_Draft()
    {
        var (_, _, svc) = Create();
        var detail = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(
            type: CatalogueTypes.ReferralTest, code: "UAT-REF-1", name: "UAT Referral"));
        Assert.Equal(CatalogueTypes.ReferralTest, detail.CatalogueType);
        Assert.Equal(CatalogueClassifications.Referral, detail.CurrentVersion!.Classification);
    }

    [Fact]
    public async Task Create_Requires_Identity_Fields()
    {
        var (_, _, svc) = Create();
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.CreateDraftAsync(_tenant, _actor, DraftReq() with { DisplayName = "  " }));
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.CreateDraftAsync(_tenant, _actor, DraftReq() with { Discipline = "NOT_A_DISCIPLINE" }));
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    private async Task<CatalogueItemDetailDto> ToActiveAsync(CatalogueService svc, string code = "UAT-LIFE")
    {
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: code));
        d = await svc.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await svc.ApproveAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await svc.ActivateAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(
            EffectiveFrom: DateTime.UtcNow.Date));
        return d;
    }

    [Fact]
    public async Task Lifecycle_Draft_Review_Approved_Active_Retired()
    {
        var (_, audit, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-LC-1"));
        d = await svc.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        Assert.Equal(CatalogueStatuses.Review, d.CurrentVersion!.Status);
        d = await svc.ApproveAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        Assert.Equal(CatalogueStatuses.Approved, d.CurrentVersion!.Status);
        d = await svc.ActivateAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        Assert.Equal(CatalogueStatuses.Active, d.CurrentVersion!.Status);
        Assert.Equal(d.CurrentVersion.Id, d.CurrentActiveVersionId);
        d = await svc.RetireAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(Reason: "UAT retire"));
        Assert.Equal(CatalogueStatuses.Retired, d.CurrentVersion!.Status);
        Assert.Null(d.CurrentActiveVersionId);

        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CatalogueAuditActions.SubmitReview, It.IsAny<string>(), It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CatalogueAuditActions.Approve, It.IsAny<string>(), It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CatalogueAuditActions.Activate, It.IsAny<string>(), It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CatalogueAuditActions.Retire, It.IsAny<string>(), It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Lifecycle_Supersede_Creates_New_Draft_Version()
    {
        var (_, audit, svc) = Create();
        var d = await ToActiveAsync(svc, "UAT-SUP-1");
        var oldVersionId = d.CurrentVersion!.Id;
        d = await svc.SupersedeAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(Reason: "change"));
        Assert.Equal(CatalogueStatuses.Draft, d.CurrentVersion!.Status);
        Assert.Equal(2, d.CurrentVersion.VersionNumber);
        Assert.Equal(2, d.VersionHistory.Count);
        Assert.Contains(d.VersionHistory, v => v.Id == oldVersionId && v.Status == CatalogueStatuses.Superseded);
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CatalogueAuditActions.CreateVersion, It.IsAny<string>(), It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Invalid_Lifecycle_Draft_To_Active_Rejected()
    {
        var (_, _, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-BAD-1"));
        var ex = await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.ActivateAsync(_tenant, _actor, d.Id, new LifecycleActionRequest()));
        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task Invalid_Lifecycle_Draft_To_Approved_Rejected()
    {
        var (_, _, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-BAD-2"));
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.ApproveAsync(_tenant, _actor, d.Id, new LifecycleActionRequest()));
    }

    [Fact]
    public async Task Invalid_Lifecycle_Review_To_Active_Rejected()
    {
        var (_, _, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-BAD-3"));
        d = await svc.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.ActivateAsync(_tenant, _actor, d.Id, new LifecycleActionRequest()));
    }

    [Fact]
    public async Task Invalid_Lifecycle_Active_To_Draft_Rejected()
    {
        var (_, _, svc) = Create();
        var d = await ToActiveAsync(svc, "UAT-BAD-4");
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.ReturnToDraftAsync(_tenant, _actor, d.Id, new LifecycleActionRequest()));
    }

    [Fact]
    public async Task Wrong_Tenant_Rejected()
    {
        var (_, _, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-TEN-1"));
        var ex = await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.GetAsync(_otherTenant, d.Id));
        Assert.Equal(404, ex.StatusCode);
    }

    // ─── Versioning / immutability ────────────────────────────────────────────

    [Fact]
    public async Task Active_Version_Immutable()
    {
        var (_, _, svc) = Create();
        var d = await ToActiveAsync(svc, "UAT-IMM-1");
        var ex = await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.UpdateDraftAsync(_tenant, _actor, d.Id, new UpdateCatalogueDraftRequest(DisplayName: "x")));
        Assert.Equal("immutable_version", ex.Code);
    }

    [Fact]
    public async Task New_Version_Preserves_Old()
    {
        var (db, _, svc) = Create();
        var d = await ToActiveAsync(svc, "UAT-VER-1");
        var oldId = d.CurrentVersion!.Id;
        d = await svc.SupersedeAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        var old = await db.CatalogueVersions.AsNoTracking().SingleAsync(v => v.Id == oldId);
        Assert.Equal(CatalogueStatuses.Superseded, old.Status);
        Assert.Equal("UAT Controlled Test", old.DisplayName);
        Assert.Equal(2, await db.CatalogueVersions.CountAsync(v => v.CatalogueItemId == d.Id));
    }

    [Fact]
    public async Task Version_History_Retrievable()
    {
        var (_, _, svc) = Create();
        var d = await ToActiveAsync(svc, "UAT-HIST-1");
        await svc.SupersedeAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        var hist = await svc.GetVersionsAsync(_tenant, d.Id);
        Assert.Equal(2, hist.Count);
        Assert.Equal(2, hist[0].VersionNumber);
    }

    [Fact]
    public async Task Effective_Dates_Validated()
    {
        var (_, _, svc) = Create();
        var from = DateTime.UtcNow.Date;
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-EFF-1") with
            {
                EffectiveFrom = from,
                EffectiveTo = from.AddDays(-1),
            }));
    }

    // ─── Panel ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Panel_Self_Reference_Rejected()
    {
        var (_, _, svc) = Create();
        // Create empty panel then try update with self — create with self needs id first
        var panel = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(
            type: CatalogueTypes.Panel, code: "UAT-P-SELF", name: "Self Panel"));
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.UpdateDraftAsync(_tenant, _actor, panel.Id, new UpdateCatalogueDraftRequest(
                PanelComponents: new[]
                {
                    new PanelComponentInput(panel.Id, panel.CurrentVersion!.Id, 1),
                },
                ExpectedRowVersion: panel.CurrentVersion.RowVersion)));
    }

    [Fact]
    public async Task Panel_Invalid_Component_Rejected()
    {
        var (_, _, svc) = Create();
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.CreateDraftAsync(_tenant, _actor, DraftReq(
                type: CatalogueTypes.Panel, code: "UAT-P-BAD", name: "Bad Panel") with
            {
                PanelComponents = new[]
                {
                    new PanelComponentInput(Guid.NewGuid(), Guid.NewGuid(), 1),
                },
            }));
    }

    // ─── Referral ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Referral_Classification_Forced()
    {
        var (_, _, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(
            type: CatalogueTypes.ReferralTest, code: "UAT-REF-2",
            classification: CatalogueClassifications.Local));
        Assert.Equal(CatalogueClassifications.Referral, d.CurrentVersion!.Classification);
    }

    [Fact]
    public async Task Test_Cannot_Be_Referral_Classification()
    {
        var (_, _, svc) = Create();
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.CreateDraftAsync(_tenant, _actor, DraftReq(
                classification: CatalogueClassifications.Referral)));
    }

    // ─── Branch ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Tenant_Wide_When_No_Branch_Applicability()
    {
        var (_, _, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-BR-1"));
        Assert.True(d.CurrentVersion!.IsTenantWide);
        Assert.Empty(d.CurrentVersion.BranchIds);
    }

    [Fact]
    public async Task Branch_Applicability_Stored()
    {
        var branch = Guid.NewGuid();
        var (_, _, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-BR-2") with
        {
            BranchIds = new[] { branch },
        });
        Assert.False(d.CurrentVersion!.IsTenantWide);
        Assert.Equal(branch, Assert.Single(d.CurrentVersion.BranchIds));

        var list = await svc.ListAsync(_tenant, new CatalogueListQuery(BranchId: branch));
        Assert.Contains(list.Items, i => i.Id == d.Id);
    }

    // ─── Concurrency ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Conflicting_Lifecycle_RowVersion_Rejected()
    {
        var (_, _, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-CONC-1"));
        await Assert.ThrowsAsync<CatalogueDomainException>(() =>
            svc.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(ExpectedRowVersion: 999)));
    }

    [Fact]
    public async Task Update_Draft_Audited()
    {
        var (_, audit, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-UPD-1"));
        await svc.UpdateDraftAsync(_tenant, _actor, d.Id, new UpdateCatalogueDraftRequest(
            DisplayName: "Updated Name",
            ExpectedRowVersion: d.CurrentVersion!.RowVersion));
        audit.Verify(a => a.WriteAsync(
            _tenant, _actor, CatalogueAuditActions.UpdateDraft, It.IsAny<string>(), It.IsAny<Guid?>(),
            It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>(),
            It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task List_Search_By_Code_And_Name()
    {
        var (_, _, svc) = Create();
        await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "SEARCH-AAA", name: "Alpha Marker"));
        await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "SEARCH-BBB", name: "Beta Marker"));
        var page = await svc.ListAsync(_tenant, new CatalogueListQuery(Search: "Alpha"));
        Assert.Single(page.Items);
        Assert.Equal("SEARCH-AAA", page.Items[0].InternalOrderCode);
    }

    [Fact]
    public async Task Return_To_Draft_From_Review()
    {
        var (_, _, svc) = Create();
        var d = await svc.CreateDraftAsync(_tenant, _actor, DraftReq(code: "UAT-RET-1"));
        d = await svc.SubmitForReviewAsync(_tenant, _actor, d.Id, new LifecycleActionRequest());
        d = await svc.ReturnToDraftAsync(_tenant, _actor, d.Id, new LifecycleActionRequest(Reason: "needs edits"));
        Assert.Equal(CatalogueStatuses.Draft, d.CurrentVersion!.Status);
    }
}
