using AuthService.Context;
using AuthService.Models;
using AuthService.Models.Domain;
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
        SeedSession(db, tenantId, patientId, sessionId, iol: "+21.00 D", eye: "RE", surgery: "Phaco + IOL");
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
        }, tenantId, Guid.NewGuid());

        var row = await db.OtFinalizeSchedules.FindAsync(result.Id);
        Assert.Equal("+21.00 D", row!.IolPower);
        Assert.Equal("RE", row.Eye);
        Assert.Equal("Phaco + IOL", row.SurgeryName);
    }

    [Fact]
    public async Task SecondUpsert_DoesNotBlankIolWhenRequestOmitsPower()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        SeedSession(db, tenantId, patientId, sessionId, iol: "+21.00 D", eye: "RE", surgery: "Phaco + IOL");
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
        }, tenantId, Guid.NewGuid());

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
        }, tenantId, Guid.NewGuid());

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
        SeedSession(db, tenantId, patientId, sessionId, iol: null, eye: "RE", surgery: "Phaco + IOL");
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
            StartTime = DateTime.UtcNow.Date.AddDays(3).AddHours(9),
        }, tenantId, Guid.NewGuid());

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
        SeedSession(db, tenantId, patientId, sessionId, iol: "+21.00 D", eye: "RE", surgery: "Phaco + IOL",
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
        var actorId = Guid.NewGuid();
        SeedSession(db, tenantId, patientId, sessionId, iol: null, eye: "RE", surgery: "Phaco + IOL");

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
        SeedSession(db, tenantId, patientId, sessionId, iol: null, eye: "RE", surgery: "Phaco + IOL",
            clinicalSummary: """{"diagnosis":"Immature cataract OD"}""");
        var schedule = new OtFinalizeSchedule
        {
            TenantId = tenantId,
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

        var detail = await CreateService(db).GetByIdAsync(schedule.Id, tenantId);
        Assert.Equal("Immature cataract OD", detail.Diagnosis);
        Assert.NotEqual("Phaco + IOL", detail.Diagnosis);
    }

    [Fact]
    public async Task GetById_SetsBiometryMissingWhenNoRecordForEye()
    {
        await using var db = TestDbContextFactory.CreateInMemory();
        var tenantId = Guid.NewGuid();
        var patientId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        SeedSession(db, tenantId, patientId, sessionId, iol: null, eye: "RE", surgery: "Phaco + IOL");
        var schedule = new OtFinalizeSchedule
        {
            TenantId = tenantId,
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

        var detail = await CreateService(db).GetByIdAsync(schedule.Id, tenantId);
        Assert.True(detail.BiometryMissingForEye);
        Assert.Null(detail.IolPower);
    }

    private static void SeedSession(
        AppDbContext db, Guid tenantId, Guid patientId, Guid sessionId,
        string? iol, string eye, string surgery, string? clinicalSummary = null)
    {
        db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = tenantId,
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
        return new OtFinalizeService(db, httpFactory.Object, config, NullLogger<OtFinalizeService>.Instance);
    }
}
