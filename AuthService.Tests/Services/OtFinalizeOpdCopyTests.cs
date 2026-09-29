using AuthService.Context;
using AuthService.Models;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Tests;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AuthService.Tests.Services;

public class OtFinalizeOpdCopyTests
{
    [Fact]
    public async Task Upsert_CopiesSessionIolOntoSchedule()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        SeedSession(db, tenantId, patientId, sessionId, branchId, iol: "+21.00 D", eye: "RE", surgery: "Phaco + IOL");
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        var result = await svc.UpsertFromCounsellorAsync(new UpsertOtScheduleRequest
        {
            PatientId = patientId,
            PatientName = "Meena Iyer",
            Uhid = "UAT-002",
            SurgeryName = "",
            Eye = null,
            CounsellingSessionId = sessionId,
            StartTime = DateTime.UtcNow.Date.AddDays(3).AddHours(9),
        }, tenantId, userId);

        var row = await db.OtFinalizeSchedules.FindAsync(result.Id);
        Assert.Equal("+21.00 D", row!.IolPower);
        Assert.Equal("RE", row.Eye);
        Assert.Equal("Phaco + IOL", row.SurgeryName);
        Assert.Equal(branchId, row.BranchId);
    }

    [Fact]
    public async Task SecondUpsert_DoesNotBlankIolWhenRequestOmitsPower()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        SeedSession(db, tenantId, patientId, sessionId, branchId, iol: "+21.00 D", eye: "RE", surgery: "Phaco + IOL");
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        var first = await svc.UpsertFromCounsellorAsync(new UpsertOtScheduleRequest
        {
            PatientId = patientId,
            PatientName = "Meena Iyer",
            Uhid = "UAT-002",
            SurgeryName = "Phaco + IOL",
            Eye = "RE",
            IolPower = "+21.00 D",
            CounsellingSessionId = sessionId,
            StartTime = DateTime.UtcNow.Date.AddDays(3).AddHours(9),
        }, tenantId, userId);

        var second = await svc.UpsertFromCounsellorAsync(new UpsertOtScheduleRequest
        {
            PatientId = patientId,
            PatientName = "Meena Iyer",
            Uhid = "UAT-002",
            SurgeryName = "Phaco + IOL",
            Eye = "RE",
            IolPower = null,
            CounsellingSessionId = sessionId,
            StartTime = DateTime.UtcNow.Date.AddDays(4).AddHours(9),
        }, tenantId, userId);

        Assert.Equal(first.Id, second.Id);
        var row = await db.OtFinalizeSchedules.FindAsync(second.Id);
        Assert.Equal("+21.00 D", row!.IolPower);
    }

    [Fact]
    public async Task Upsert_FillsIolFromLatestBiometryWhenSessionEmpty()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        SeedSession(db, tenantId, patientId, sessionId, branchId, iol: null, eye: "RE", surgery: "Phaco + IOL");
        db.BiometryRecords.Add(new BiometryRecord
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientId = patientId,
            Eye = "OD",
            AxialLength = 23.5m,
            K1 = 43.2m,
            K2 = 44.1m,
            K1Axis = 90,
            Acd = 3.2m,
            Device = "IOLMaster",
            TargetRefraction = -0.25m,
            CalculatedIol = 21.00m,
            ExaminationDate = DateTime.UtcNow.Date.AddDays(-1),
            ExaminerId = Guid.NewGuid(),
            Status = "active",
        });
        await db.SaveChangesAsync();

        var svc = CreateService(db);
        var result = await svc.UpsertFromCounsellorAsync(new UpsertOtScheduleRequest
        {
            PatientId = patientId,
            PatientName = "Meena Iyer",
            Uhid = "UAT-002",
            CounsellingSessionId = sessionId,
            SessionVersion = 1,
            StartTime = DateTime.UtcNow.Date.AddDays(3).AddHours(9),
        }, tenantId, userId);

        var row = await db.OtFinalizeSchedules.FindAsync(result.Id);
        Assert.Equal("+21.00 D", row!.IolPower);
    }

    [Fact]
    public async Task Snapshot_DoesNotTreatRecommendedSurgeryAsDiagnosis()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var (_, branchId) = SeedActor(db, tenantId);
        SeedSession(db, tenantId, patientId, sessionId, branchId, iol: "+21.00 D", eye: "RE", surgery: "Phaco + IOL",
            clinicalSummary: """{"diagnosis":"Immature cataract OD"}""");
        await db.SaveChangesAsync();

        var snap = await CreateService(db).GetOpdClinicalSnapshotAsync(
            tenantId, patientId, sessionId, "RE", preferBiometry: false);

        Assert.Equal("Immature cataract OD", snap.Diagnosis);
        Assert.NotEqual("Phaco + IOL", snap.Diagnosis);
        Assert.Equal("Phaco + IOL", snap.ProcedureName);
    }

    [Fact]
    public async Task Snapshot_CopiesPrimaryThenSecondaryPatientDiagnoses()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var (actorId, branchId) = SeedActor(db, tenantId);
        SeedSession(db, tenantId, patientId, sessionId, branchId, iol: null, eye: "RE", surgery: "Phaco + IOL");

        var cataract = new DiagnosisCode
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = "H25.1",
            Description = "Age-related cataract",
            Category = "Lens",
            Status = "active",
        };
        var glaucoma = new DiagnosisCode
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = "H40.1",
            Description = "Open-angle glaucoma",
            Category = "Glaucoma",
            Status = "active",
        };
        db.DiagnosisCodes.AddRange(cataract, glaucoma);
        db.PatientDiagnoses.AddRange(
            new PatientDiagnosis
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PatientId = patientId,
                DiagnosisCodeId = glaucoma.Id,
                DiagnosisCode = glaucoma,
                DiagnosisType = "secondary",
                EyeSpecificity = "OS",
                DiagnosedByUserId = actorId,
                Status = "active",
                DiagnosedAt = DateTime.UtcNow.AddDays(-2),
            },
            new PatientDiagnosis
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PatientId = patientId,
                DiagnosisCodeId = cataract.Id,
                DiagnosisCode = cataract,
                DiagnosisType = "primary",
                EyeSpecificity = "OD",
                DiagnosedByUserId = actorId,
                Status = "active",
                DiagnosedAt = DateTime.UtcNow.AddDays(-1),
            });
        await db.SaveChangesAsync();

        var snap = await CreateService(db).GetOpdClinicalSnapshotAsync(
            tenantId, patientId, sessionId, "RE", preferBiometry: false);

        Assert.Contains("H25.1", snap.Diagnosis);
        Assert.Contains("H40.1", snap.Diagnosis);
        Assert.StartsWith("H25.1", snap.Diagnosis);
        Assert.DoesNotContain("Phaco", snap.Diagnosis);
        Assert.Contains("H25.1", snap.DiagnosisJson);
        Assert.Contains("H40.1", snap.DiagnosisJson);
    }

    [Fact]
    public async Task GetById_DiagnosisIsNotRecommendedSurgery()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        SeedSession(db, tenantId, patientId, sessionId, branchId, iol: null, eye: "RE", surgery: "Phaco + IOL",
            clinicalSummary: """{"diagnosis":"Immature cataract OD"}""");
        var schedule = new OtFinalizeSchedule
        {
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            PatientName = "Meena Iyer",
            Uhid = "UAT-002",
            SurgeryName = "Phaco + IOL",
            Eye = "RE",
            Status = OtFinalizeStatus.NotConfirmed,
            CounsellingSessionId = sessionId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.OtFinalizeSchedules.Add(schedule);
        await db.SaveChangesAsync();

        var detail = await CreateService(db).GetByIdAsync(schedule.Id, tenantId, userId);
        Assert.Equal("Immature cataract OD", detail.Diagnosis);
        Assert.NotEqual("Phaco + IOL", detail.Diagnosis);
    }

    [Fact]
    public void DetailBiometryLoad_DoesNotRepeatDiagnosisQuery()
    {
        var source = File.ReadAllText(FindRepoFile(
            Path.Combine("microservices", "auth-service", "AuthService", "Services", "OtFinalizeService.cs")));
        var start = source.IndexOf("private async Task ApplyBiometryToDetailAsync", StringComparison.Ordinal);
        var end = source.IndexOf("private async Task<OpdClinicalSnapshotDto> ResolveOpdSnapshotAsync", StringComparison.Ordinal);
        Assert.True(start >= 0 && end > start);
        var method = source[start..end];
        Assert.Contains("loadDiagnosis: false", method, StringComparison.Ordinal);
        Assert.DoesNotContain("ResolveOpdDiagnosisAsync", method, StringComparison.Ordinal);
    }

    private static string FindRepoFile(string relative)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, relative);
            if (File.Exists(candidate)) return candidate;
            dir = dir.Parent;
        }
        throw new FileNotFoundException(relative);
    }

    [Fact]
    public async Task GetById_SetsBiometryMissingWhenNoRecordForEye()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var (userId, branchId) = SeedActor(db, tenantId);
        SeedSession(db, tenantId, patientId, sessionId, branchId, iol: null, eye: "RE", surgery: "Phaco + IOL");
        var schedule = new OtFinalizeSchedule
        {
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            PatientName = "Meena Iyer",
            Uhid = "UAT-002",
            SurgeryName = "Phaco + IOL",
            Eye = "RE",
            Status = OtFinalizeStatus.NotConfirmed,
            CounsellingSessionId = sessionId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.OtFinalizeSchedules.Add(schedule);
        await db.SaveChangesAsync();

        var detail = await CreateService(db).GetByIdAsync(schedule.Id, tenantId, userId);
        Assert.True(detail.BiometryMissingForEye);
        Assert.Null(detail.IolPower);
    }

    private static (Guid UserId, Guid BranchId) SeedActor(AppDbContext db, Guid tenantId, Guid? branchId = null)
    {
        var branch = branchId ?? Guid.NewGuid();
        var userId = Guid.NewGuid();
        db.Users.Add(new AppUser
        {
            Id = userId,
            TenantId = tenantId,
            UserName = $"{userId:N}@test",
            NormalizedUserName = $"{userId:N}@TEST",
            Email = $"{userId:N}@test",
            NormalizedEmail = $"{userId:N}@TEST",
            FirstName = "OT",
            LastName = "Actor",
            BranchId = branch,
            UserType = "Counsellor",
        });
        db.UserBranches.Add(new UserBranch
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            BranchId = branch,
            Status = "active",
            EffectiveFrom = DateTime.UtcNow.AddDays(-30),
        });
        return (userId, branch);
    }

    private static void SeedSession(
        AppDbContext db, Guid tenantId, Guid patientId, Guid sessionId, Guid branchId,
        string? iol, string eye, string surgery, string? clinicalSummary = null)
    {
        db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = tenantId,
            BranchId = branchId,
            PatientId = patientId,
            ReferredByDoctorId = Guid.NewGuid(),
            SessionDate = DateTime.UtcNow.Date,
            PatientType = "Cash",
            IolPower = iol,
            SurgeryTentativeEye = eye,
            RecommendedSurgery = surgery,
            ClinicalSummary = clinicalSummary,
        });
    }

    private static OtFinalizeService CreateService(AppDbContext db)
    {
        var httpFactory = new Mock<IHttpClientFactory>();
        httpFactory.Setup(f => f.CreateClient(It.IsAny<string>())).Returns(new HttpClient());
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
        return new OtFinalizeService(
            db, httpFactory.Object, config, NullLogger<OtFinalizeService>.Instance,
            new FollowupBranchAccessService(db));
    }
}
