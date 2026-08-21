using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Services;

namespace IpManagementService.Tests;

/// <summary>Shared in-memory DB + DI wiring for ward pre-op P0 unit tests.</summary>
internal sealed class WardPreOpTestContext : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IServiceScope _scope;

    public IpManagementDbContext Db { get; }
    public WardInvestigationChecklistService Investigation { get; }
    public CounsellorChecklistService Counsellor { get; }
    public PacAssessmentService Pac { get; }
    public ChecklistIntegrationService Integration { get; }

    private WardPreOpTestContext(ServiceProvider provider, IServiceScope scope)
    {
        _provider = provider;
        _scope    = scope;
        Db            = scope.ServiceProvider.GetRequiredService<IpManagementDbContext>();
        Investigation = scope.ServiceProvider.GetRequiredService<WardInvestigationChecklistService>();
        Counsellor    = scope.ServiceProvider.GetRequiredService<CounsellorChecklistService>();
        Pac           = scope.ServiceProvider.GetRequiredService<PacAssessmentService>();
        Integration   = scope.ServiceProvider.GetRequiredService<ChecklistIntegrationService>();
    }

    public static WardPreOpTestContext Create(string? databaseName = null)
    {
        databaseName ??= Guid.NewGuid().ToString("N");

        var services = new ServiceCollection();
        services.AddDbContext<IpManagementDbContext>(o => o.UseInMemoryDatabase(databaseName));
        services.AddScoped<ChecklistPhaseStatusService>();
        services.AddScoped<CounsellorChecklistService>();
        services.AddScoped<WardChecklistAutoSyncService>();
        services.AddSingleton<IAzureBlobStorageService, NoOpAzureBlobStorageService>();
        services.AddScoped<IPreOpNotificationClient, NoOpPreOpNotificationClient>();
        services.AddScoped<ICcmsAdmissionClient, NoOpCcmsAdmissionClient>();
        services.AddScoped<JourneyMutationGuardService>();
        services.AddScoped<JourneySchedulingGuardService>();
        services.AddScoped<PreOpClearanceService>();
        services.AddScoped<WardChecklistService>();
        services.AddScoped<WardInvestigationChecklistService>();
        services.AddScoped<PacAssessmentService>();
        services.AddScoped<ChecklistIntegrationService>();

        var provider = services.BuildServiceProvider();
        var scope    = provider.CreateScope();
        return new WardPreOpTestContext(provider, scope);
    }

    public void Dispose()
    {
        _scope.Dispose();
        _provider.Dispose();
    }
}

internal sealed record WardPreOpSeed(
    Guid TenantId,
    Guid UserId,
    Guid JourneyId,
    Guid ClearanceId,
    Guid CounselingSessionId,
    Guid BloodSugarItemId,
    Guid CreatinineItemId);

internal static class WardPreOpSeedData
{
    public static async Task<WardPreOpSeed> SeedInvestigationJourneyAsync(IpManagementDbContext db)
    {
        var tenantId   = Guid.NewGuid();
        var userId     = Guid.NewGuid();
        var journeyId  = Guid.NewGuid();
        var clearanceId = Guid.NewGuid();
        var sessionId  = Guid.NewGuid();
        var branchId   = Guid.NewGuid();
        var now        = DateTime.UtcNow;

        var bloodSugarItemId  = Guid.NewGuid();
        var creatinineItemId  = Guid.NewGuid();

        db.PatientJourneys.Add(new PatientJourney
        {
            Id                  = journeyId,
            TenantId            = tenantId,
            BranchId            = branchId,
            PatientId           = Guid.NewGuid(),
            CounselingSessionId = sessionId,
            ClinicalState       = ClinicalState.Admitted,
            ProcedureName       = "Phacoemulsification",
            CreatedAt           = now,
            UpdatedAt           = now,
        });

        db.PreOpClearances.Add(new PreOpClearance
        {
            Id        = clearanceId,
            TenantId  = tenantId,
            JourneyId = journeyId,
            CreatedAt = now,
            UpdatedAt = now,
        });

        AddInvestigationItem(db, bloodSugarItemId, "blood_sugar", "Blood Sugar", isCritical: false, now);
        AddInvestigationItem(db, creatinineItemId, "serum_creatinine", "Serum Creatinine", isCritical: true, now);

        foreach (var itemId in new[] { bloodSugarItemId, creatinineItemId })
        {
            db.PreOpCompletions.Add(new PreOpCompletion
            {
                Id              = Guid.NewGuid(),
                TenantId        = tenantId,
                ClearanceId     = clearanceId,
                ItemId          = itemId,
                EntryStatus     = "draft",
                Source          = "ward_investigation",
                CreatedByUserId = userId,
                UpdatedByUserId = userId,
                CreatedAt       = now,
                UpdatedAt       = now,
            });
        }

        await db.SaveChangesAsync();

        return new WardPreOpSeed(
            tenantId,
            userId,
            journeyId,
            clearanceId,
            sessionId,
            bloodSugarItemId,
            creatinineItemId);
    }

    public static async Task<(Guid CounsellorItemId, Guid WardCompletionId)> SeedCounsellorInvestigationCopyAsync(
        IpManagementDbContext db,
        WardPreOpSeed seed)
    {
        var now = DateTime.UtcNow;
        var counsellorItemId = Guid.NewGuid();

        db.PreOpSectionItems.Add(new PreOpSectionItem
        {
            Id          = counsellorItemId,
            ItemKey     = "couns_preop_blood_sugar",
            ItemLabel   = "Blood Sugar (counsellor)",
            Category    = "Counsellor Investigation",
            FormCode    = CounsellorChecklistService.InvestigationFormCode,
            FormContext = CounsellorChecklistService.InvestigationFormContext,
            IsActive    = true,
            Status      = "active",
            CreatedAt   = now,
            UpdatedAt   = now,
        });

        db.CounsellorChecklistCompletions.Add(new CounsellorChecklistCompletion
        {
            Id                  = Guid.NewGuid(),
            TenantId            = seed.TenantId,
            CounselingSessionId = seed.CounselingSessionId,
            ItemId              = counsellorItemId,
            ResultValue         = "105",
            ResultUnit          = "mg/dL",
            EntryStatus         = "draft",
            IsCompleted         = true,
            CompletedByUserId   = seed.UserId,
            CompletedAt         = now,
            CreatedByUserId     = seed.UserId,
            UpdatedByUserId     = seed.UserId,
            CreatedAt           = now,
            UpdatedAt           = now,
        });

        await db.SaveChangesAsync();

        var wardCompletionId = await db.PreOpCompletions
            .Where(c => c.ClearanceId == seed.ClearanceId && c.ItemId == seed.BloodSugarItemId)
            .Select(c => c.Id)
            .FirstAsync();

        return (counsellorItemId, wardCompletionId);
    }

    public static async Task SeedCompletePacAssessmentAsync(
        IpManagementDbContext db,
        WardPreOpSeed seed)
    {
        var now = DateTime.UtcNow;
        db.PacAssessments.Add(new PacAssessment
        {
            Id               = Guid.NewGuid(),
            TenantId         = seed.TenantId,
            PatientJourneyId = seed.JourneyId,
            Bp               = "120/80",
            Hr               = 72,
            PhysicalStatusAsa = 2,
            AnaesthesiaPlan  = "Local",
            ConsentType      = "Written",
            AssessmentStatus = "Draft",
            CreatedAt        = now,
            UpdatedAt        = now,
        });

        var creatinine = await db.PreOpCompletions
            .FirstAsync(c => c.ClearanceId == seed.ClearanceId && c.ItemId == seed.CreatinineItemId);

        creatinine.ResultValue       = "1.4";
        creatinine.ResultUnit        = "mg/dL";
        creatinine.EntryStatus       = "entered";
        creatinine.ResultSource      = "manual_ward";
        creatinine.IsCompleted       = true;
        creatinine.EnteredByUserId   = seed.UserId;
        creatinine.EnteredAt         = now;
        creatinine.CompletedByUserId = seed.UserId;
        creatinine.CompletedAt       = now;
        creatinine.UpdatedAt         = now;

        await db.SaveChangesAsync();
    }

    private static void AddInvestigationItem(
        IpManagementDbContext db,
        Guid id,
        string itemKey,
        string label,
        bool isCritical,
        DateTime now)
    {
        db.PreOpSectionItems.Add(new PreOpSectionItem
        {
            Id          = id,
            ItemKey     = itemKey,
            ItemLabel   = label,
            Category    = "Ward Investigation",
            FormCode    = WardInvestigationChecklistService.InvestigationFormCode,
            FormContext = WardInvestigationChecklistService.InvestigationFormContext,
            IsActive    = true,
            Status      = "active",
            ItemConfig  = isCritical ? """{"isCritical":true}""" : """{"isCritical":false}""",
            CreatedAt   = now,
            UpdatedAt   = now,
        });
    }
}
