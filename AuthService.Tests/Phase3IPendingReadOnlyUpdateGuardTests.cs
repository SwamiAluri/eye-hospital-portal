using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 5 UAT gap — PD-PENDING-READONLY-01.
/// Counselling-content UpdateSession rejected until StartSession → InProgress.
/// </summary>
public class Phase3IPendingReadOnlyUpdateGuardTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _svc;
    private readonly Mock<IAuditService> _audit = new();

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _branch = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _owner = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");
    private readonly Guid _doctor = Guid.Parse("e1000001-0000-0000-0000-000000000001");

    public Phase3IPendingReadOnlyUpdateGuardTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        _svc = CreateWorkflowService(_db, _audit.Object);
        Seed();
    }

    public void Dispose() => _db.Dispose();

    private static CounselingWorkflowService CreateWorkflowService(AppDbContext db, IAuditService audit)
    {
        var logger = new Mock<ILogger<CounselingWorkflowService>>();
        var blob = new Mock<IBlobStorageService>();
        var http = new Mock<System.Net.Http.IHttpClientFactory>();
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        var notifier = new Mock<IQueueDisplayNotifier>();
        return new CounselingWorkflowService(
            db, logger.Object, blob.Object, http.Object, config.Object, notifier.Object,
            new FollowupBranchAccessService(db),
            audit);
    }

    private void Seed()
    {
        _db.Users.Add(new AppUser
        {
            Id = _owner,
            TenantId = _tenant,
            UserName = "amelia@test",
            NormalizedUserName = "AMELIA@TEST",
            Email = "amelia@test",
            NormalizedEmail = "AMELIA@TEST",
            FirstName = "Amelia",
            LastName = "Owner",
            BranchId = _branch,
            UserType = "Counsellor",
            Designation = "Counsellor",
        });
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            BranchId = _branch,
            FirstName = "Pat",
            LastName = "Ent",
            MedicalRecordNumber = "MRN-PEND-RO",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
        });
        _db.SaveChanges();
    }

    private async Task<Guid> CreateOwnedScheduledSessionAsync()
    {
        var result = await _svc.CreateSessionAsync(new CreateCounselingSessionRequest
        {
            TenantId = _tenant,
            BranchId = _branch,
            PatientId = _patient,
            ReferredByDoctorId = _doctor,
            PatientType = "Cash",
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            AddToQueue = true,
        }, _owner);
        Assert.True(result.Success);
        var id = result.SessionId!.Value;
        var row = await _db.CounselingSession.FirstAsync(s => s.Id == id);
        // Ensure owned Scheduled (Pending) — Create may self-own when counsellor; stamp if needed.
        if (row.CounselorId != _owner)
        {
            row.CounselorId = _owner;
            await _db.SaveChangesAsync();
        }
        Assert.Equal(_owner, row.CounselorId);
        Assert.Equal("Scheduled", row.Status);
        return id;
    }

    private int HistoryCount(Guid sessionId) =>
        _db.CounselingSessionAuditLog.Count(a => a.SessionId == sessionId);

    [Fact]
    public async Task Update_Scheduled_Owner_CounsellingContent_Rejected()
    {
        var id = await CreateOwnedScheduledSessionAsync();
        var beforeHistory = HistoryCount(id);
        // Create may Stage OwnershipEstablishedOnCreate — clear so we assert Update does not audit.
        _audit.Invocations.Clear();

        var result = await _svc.UpdateSessionAsync(_tenant, id, new UpdateCounselingSessionRequest
        {
            ClinicalSummary = "pre-start edit",
            RecommendedSurgery = "Phaco",
            FieldChanges =
            [
                new FieldChangeItem
                {
                    FieldName = "ClinicalSummary",
                    OldValue = "",
                    NewValue = "pre-start edit",
                },
            ],
        }, _owner);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.BadRequest, result.FailureKind);
        Assert.Contains("started", result.Message, StringComparison.OrdinalIgnoreCase);

        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Equal("Scheduled", row.Status);
        Assert.Equal(_owner, row.CounselorId);
        Assert.Null(row.ClinicalSummary);
        Assert.Null(row.RecommendedSurgery);
        Assert.Equal(beforeHistory, HistoryCount(id));
        _audit.Verify(
            a => a.StageAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(),
                It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<string?>()),
            Times.Never);
    }

    [Fact]
    public async Task Update_AfterStart_InProgress_Owner_Succeeds_CounselorIdUnchanged()
    {
        var id = await CreateOwnedScheduledSessionAsync();
        Assert.True((await _svc.StartSessionAsync(_tenant, id, _owner)).Success);

        var result = await _svc.UpdateSessionAsync(_tenant, id, new UpdateCounselingSessionRequest
        {
            ClinicalSummary = "post-start draft",
        }, _owner);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Equal("InProgress", row.Status);
        Assert.Equal(_owner, row.CounselorId);
        Assert.Equal("post-start draft", row.ClinicalSummary);
    }

    [Fact]
    public async Task StartSession_DoesNotChangeCounselorId()
    {
        var id = await CreateOwnedScheduledSessionAsync();

        var result = await _svc.StartSessionAsync(_tenant, id, _owner);

        Assert.True(result.Success);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.Equal(_owner, row.CounselorId);
        Assert.Equal("InProgress", row.Status);
        Assert.Equal(0, _db.CounselingSessionAuditLog.Count(a =>
            a.SessionId == id &&
            (a.ChangeType == "OwnershipAssigned" || a.ChangeType == "OwnershipClaimed")));
    }

    [Fact]
    public async Task AdvanceStage_Scheduled_Rejected()
    {
        var id = await CreateOwnedScheduledSessionAsync();

        var result = await _svc.UpdateSessionAsync(_tenant, id, new UpdateCounselingSessionRequest
        {
            CurrentStage = "2",
        }, _owner);

        Assert.False(result.Success);
        Assert.Equal(SessionOperationFailureKind.BadRequest, result.FailureKind);
        var row = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == id);
        Assert.NotEqual("2", row.CurrentStage);
    }
}
