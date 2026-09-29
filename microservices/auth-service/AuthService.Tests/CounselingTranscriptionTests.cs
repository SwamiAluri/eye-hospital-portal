using System.Text.Json;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Services.Interfaces;
using AuthService.Services.Transcription;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class CounselingTranscriptionTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingConversationService _conversations;
    private readonly TranscriptionService _transcription;
    private readonly FakeTranscriptionProvider _provider = new();

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _otherTenant = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _amelia = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _otherBranch = Guid.Parse("c0000003-0000-0000-0000-000000000003");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");

    public CounselingTranscriptionTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        var branchAccess = new FollowupBranchAccessService(_db);
        var blob = new Mock<IBlobStorageService>();
        blob.Setup(b => b.UploadExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _conversations = new CounselingConversationService(
            _db, blob.Object, branchAccess, Mock.Of<ILogger<CounselingConversationService>>());
        var http = new Mock<IHttpClientFactory>();
        http.Setup(factory => factory.CreateClient(It.IsAny<string>())).Returns(new HttpClient());
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AzureSpeech:StorageAccountName"] = "hpprivate",
            ["AzureSpeech:SupportedLanguages:0"] = "en-US",
            ["AzureSpeech:SupportedLanguages:1"] = "hi-IN",
            ["AzureSpeech:SupportedLanguages:2"] = "te-IN",
        }).Build();
        _transcription = new TranscriptionService(
            _db,
            Mock.Of<ILogger<TranscriptionService>>(),
            config,
            http.Object,
            _conversations,
            _provider);
        SeedPeople();
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task Owner_CanQueue_AndStatusDoesNotCallTheProvider()
    {
        var recordingId = await SaveRecordingAsync();
        var started = await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        Assert.Equal(CounselingTranscriptionStatus.Pending, started.Status);
        Assert.Equal(0, _provider.SubmitCount);
        Assert.Equal(0, _provider.StatusCount);

        var status = await _transcription.GetTranscriptionStatusAsync(_tenant, recordingId, _amelia);
        Assert.Equal(CounselingTranscriptionStatus.Pending, status.Status);
        Assert.Equal(0, _provider.SubmitCount);
        Assert.Equal(0, _provider.StatusCount);
        Assert.Equal(0, _provider.FindCount);
    }

    [Fact]
    public async Task NonOwner_WrongBranch_AndWrongTenant_CannotStartOrRead()
    {
        var recordingId = await SaveRecordingAsync();

        var ownerDenied = await _transcription.StartTranscriptionAsync(_tenant, recordingId, _admin);
        Assert.Equal(SessionOperationFailureKind.Forbidden, ownerDenied.FailureKind);

        var branchDenied = await _transcription.GetTranscriptionStatusAsync(_tenant, recordingId, _otherBranch);
        Assert.Equal(SessionOperationFailureKind.Forbidden, branchDenied.FailureKind);

        var tenantDenied = await _transcription.GetTranscriptionStatusAsync(_otherTenant, recordingId, _amelia);
        Assert.Equal(SessionOperationFailureKind.NotFound, tenantDenied.FailureKind);

        await Assert.ThrowsAsync<TranscriptionAccessException>(() =>
            _transcription.GetTranscriptsAsync(_tenant, recordingId, _admin));
        Assert.Equal(CounselingTranscriptionStatus.NotRequested, await StatusOf(recordingId));
        Assert.Equal(0, _provider.SubmitCount);
    }

    [Fact]
    public async Task Incomplete_AndDeleted_Recordings_CannotStart()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 3, _amelia, 1);
        var created = new SessionRecording
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            SessionId = sessionId,
            ConversationId = saved.ConversationId,
            RecordingType = "Audio",
            RecordingState = CounselingRecordingState.Created,
            FileUrl = "not-uploaded.webm",
            FileName = "recording.webm",
            TranscriptionStatus = CounselingTranscriptionStatus.NotRequested,
            TranslationStatus = "NotRequested",
            Status = "active",
            CreatedAt = DateTime.UtcNow,
        };
        _db.SessionRecordings.Add(created);
        var uploaded = await _db.SessionRecordings.FirstAsync(r => r.Id == saved.RecordingId);
        uploaded.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var incomplete = await _transcription.StartTranscriptionAsync(_tenant, created.Id, _amelia);
        Assert.Equal(SessionOperationFailureKind.BadRequest, incomplete.FailureKind);
        Assert.Equal(CounselingTranscriptionStatus.NotRequested, await StatusOf(created.Id));

        var deleted = await _transcription.StartTranscriptionAsync(_tenant, uploaded.Id, _amelia);
        Assert.Equal(SessionOperationFailureKind.NotFound, deleted.FailureKind);
        Assert.Equal(0, _provider.SubmitCount);
    }

    [Fact]
    public async Task Active_AndCompleted_Requests_DoNotCreateAnotherJob()
    {
        var recordingId = await SaveRecordingAsync();
        var first = await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        var second = await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        Assert.Equal(CounselingTranscriptionStatus.Pending, first.Status);
        Assert.Equal(CounselingTranscriptionStatus.Pending, second.Status);

        await _transcription.ReconcileAsync();
        Assert.Equal(1, _provider.SubmitCount);
        var during = await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        Assert.Equal(CounselingTranscriptionStatus.InProgress, during.Status);
        Assert.Equal(1, _provider.SubmitCount);

        _provider.JobStatus = "Succeeded";
        await _transcription.ReconcileAsync();
        var done = await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        Assert.Equal("AlreadyCompleted", done.Status);
        Assert.Equal(1, _provider.SubmitCount);
        Assert.Equal(1, await _db.SessionTranscripts.CountAsync(t => t.RecordingId == recordingId));
        await _transcription.ReconcileAsync();
        Assert.Equal(1, await _db.SessionTranscripts.CountAsync(t => t.RecordingId == recordingId));
    }

    [Fact]
    public async Task SimultaneousStarts_ProduceOneProviderJob()
    {
        var recordingId = await SaveRecordingAsync();
        var results = await Task.WhenAll(
            _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia),
            _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia));
        Assert.Contains(results, result => result.Status == CounselingTranscriptionStatus.Pending);
        Assert.Equal(CounselingTranscriptionStatus.Pending, await StatusOf(recordingId));
        await _transcription.ReconcileAsync();
        Assert.Equal(1, _provider.SubmitCount);
    }

    [Fact]
    public async Task Failed_CanRetry_ButNotWhileActive()
    {
        var recordingId = await SaveRecordingAsync();
        await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        var row = await _db.SessionRecordings.FirstAsync(r => r.Id == recordingId);
        row.TranscriptionStatus = CounselingTranscriptionStatus.Failed;
        row.TranscriptionError = CounselingTranscriptionErrors.ProviderRejected;
        row.AzureJobId = "old-job";
        await _db.SaveChangesAsync();

        var retried = await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        Assert.Equal(CounselingTranscriptionStatus.Pending, retried.Status);
        var again = await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        Assert.Equal(CounselingTranscriptionStatus.Pending, again.Status);
        Assert.Null((await _db.SessionRecordings.AsNoTracking().FirstAsync(r => r.Id == recordingId)).AzureJobId);
        await _transcription.ReconcileAsync();
        Assert.Equal(1, _provider.SubmitCount);
    }

    [Fact]
    public async Task ProviderSuccess_PersistsJob_Locale_Timestamps_AndDoesNotInventConfidenceOrSpeaker()
    {
        var recordingId = await SaveRecordingAsync();
        await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        _provider.Result = BatchTranscriptMapper.Map(JsonDocument.Parse("""
            {
              "recognizedPhrases": [
                {
                  "offsetInTicks": 7600000,
                  "durationInTicks": 13200000,
                  "locale": "te-IN",
                  "nBest": [{ "display": "Namaskaram", "confidence": 0.5 }]
                }
              ]
            }
            """).RootElement, "en-US");
        _provider.JobStatus = "Succeeded";
        await _transcription.ReconcileAsync();

        var recording = await _db.SessionRecordings.AsNoTracking().FirstAsync(r => r.Id == recordingId);
        Assert.Equal("job-1", recording.AzureJobId);
        Assert.Equal(CounselingTranscriptionStatus.Completed, recording.TranscriptionStatus);
        Assert.NotNull(recording.TranscriptionStartedAt);
        Assert.NotNull(recording.TranscriptionCompletedAt);
        Assert.NotNull(recording.ProcessingDurationMs);
        Assert.DoesNotContain("?", _provider.LastContentUrl);
        Assert.StartsWith("https://hpprivate.blob.core.windows.net/session-audio/", _provider.LastContentUrl);
        Assert.Equal(1, _provider.SubmitCount);

        var transcript = await _db.SessionTranscripts.SingleAsync(t => t.RecordingId == recordingId);
        Assert.Equal("te-IN", transcript.LanguageCode);
        Assert.Equal("Namaskaram", transcript.TranscriptText);
        Assert.Equal(0.5m, transcript.ConfidenceScore);
        Assert.Contains("\"Start\":", transcript.Segments);
        Assert.DoesNotContain("Counsellor", transcript.Segments);
        Assert.DoesNotContain("Patient", transcript.TranscriptText);
    }

    [Fact]
    public async Task MissingConfidence_AndMissingSpeaker_StayAbsent()
    {
        var mapped = BatchTranscriptMapper.Map(JsonDocument.Parse("""
            {
              "recognizedPhrases": [
                { "locale": "hi-IN", "nBest": [{ "display": "Namaste" }] }
              ]
            }
            """).RootElement, "en-US");
        Assert.Equal("hi-IN", mapped.LanguageCode);
        Assert.Null(mapped.ConfidenceScore);
        Assert.Null(mapped.Segments[0].Confidence);
        Assert.Null(mapped.Segments[0].Speaker);
        Assert.Null(mapped.Segments[0].Start);
    }

    [Fact]
    public void SpeakerNumber_IsStored_WithoutARoleName()
    {
        var mapped = BatchTranscriptMapper.Map(JsonDocument.Parse("""
            {
              "recognizedPhrases": [
                { "speaker": 2, "locale": "en-US", "nBest": [{ "display": "Hello", "confidence": 0.2 }] }
              ]
            }
            """).RootElement, "en-US");
        Assert.Equal("speaker_2", mapped.Segments[0].Speaker);
        Assert.DoesNotContain("Counsellor", mapped.Segments[0].Text);
    }

    [Fact]
    public async Task Restart_AdoptsTheExistingJob_AndDoesNotSubmitAgain()
    {
        var recordingId = await SaveRecordingAsync();
        var row = await _db.SessionRecordings.FirstAsync(r => r.Id == recordingId);
        row.TranscriptionStatus = CounselingTranscriptionStatus.InProgress;
        row.AzureJobId = "local-submit:" + recordingId.ToString("N");
        row.TranscriptionStartedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        _provider.ExistingJobId = "job-kept";

        await _transcription.ReconcileAsync();
        Assert.Equal(0, _provider.SubmitCount);
        Assert.Equal("job-kept", (await _db.SessionRecordings.AsNoTracking().FirstAsync(r => r.Id == recordingId)).AzureJobId);

        _provider.JobStatus = "Succeeded";
        await _transcription.ReconcileAsync();
        await _transcription.ReconcileAsync();
        Assert.Equal(0, _provider.SubmitCount);
        Assert.Equal(1, await _db.SessionTranscripts.CountAsync(t => t.RecordingId == recordingId));
    }

    [Fact]
    public async Task ProviderFailure_StoresASafeCategory()
    {
        var recordingId = await SaveRecordingAsync();
        await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        _provider.FailSubmit = true;
        await _transcription.ReconcileAsync();
        var recording = await _db.SessionRecordings.AsNoTracking().FirstAsync(r => r.Id == recordingId);
        Assert.Equal(CounselingTranscriptionStatus.Failed, recording.TranscriptionStatus);
        Assert.Equal(CounselingTranscriptionErrors.ProviderRejected, recording.TranscriptionError);
        Assert.DoesNotContain("Exception", recording.TranscriptionError);

        var status = await _transcription.GetTranscriptionStatusAsync(_tenant, recordingId, _amelia);
        Assert.Equal(CounselingTranscriptionErrors.SafeClientMessage, status.Message);
        Assert.Equal(CounselingTranscriptionErrors.ProviderRejected, status.ErrorCategory);
    }

    [Fact]
    public async Task UnconfiguredProvider_DoesNotCallAzure_OrChangeState()
    {
        _provider.IsReady = false;
        var recordingId = await SaveRecordingAsync();
        var started = await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        Assert.Equal(CounselingTranscriptionStatus.Failed, started.Status);
        Assert.Equal(CounselingTranscriptionErrors.ConfigurationMissing, started.ErrorCategory);
        Assert.Equal(CounselingTranscriptionStatus.Failed, await StatusOf(recordingId));
        Assert.Equal(0, _provider.SubmitCount);
        Assert.Null(_provider.LastContentUrl);
    }

    [Fact]
    public async Task DeletedRecording_DoesNotReturnOrRecreateATranscript()
    {
        var recordingId = await SaveRecordingAsync();
        await _transcription.StartTranscriptionAsync(_tenant, recordingId, _amelia);
        _provider.JobStatus = "Succeeded";
        await _transcription.ReconcileAsync();
        var row = await _db.SessionRecordings.FirstAsync(r => r.Id == recordingId);
        row.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var denied = await Assert.ThrowsAsync<TranscriptionAccessException>(() =>
            _transcription.GetTranscriptsAsync(_tenant, recordingId, _amelia));
        Assert.Equal(SessionOperationFailureKind.NotFound, denied.Kind);
        await _transcription.ReconcileAsync();
        Assert.Equal(1, await _db.SessionTranscripts.CountAsync(t => t.RecordingId == recordingId));
        Assert.Equal(1, _provider.SubmitCount);
    }

    [Fact]
    public void SpeechClient_UsesCurrentBatchApi_AndDoesNotOpenTheContainer()
    {
        var src = ReadRepoFile("microservices/auth-service/AuthService/Services/Transcription/AzureSpeechBatchTranscriptionProvider.cs");
        Assert.Contains("2025-10-15", src);
        Assert.Contains("transcriptions:submit", src);
        Assert.Contains("timeToLiveHours", src);
        Assert.Contains("MinimumTimeToLiveHours", src);
        Assert.DoesNotContain("v3.0", src);
        Assert.DoesNotContain("PublicAccessType", src);
        Assert.DoesNotContain("BlobSas", src);
        Assert.DoesNotContain("GenerateSas", src);

        var controller = ReadRepoFile("microservices/auth-service/AuthService/Controllers/TranscriptionController.cs");
        Assert.Contains("[RequirePermission(\"transcription.start\")]", controller);
        Assert.Contains("[RequirePermission(\"transcription.view\")]", controller);
        Assert.DoesNotContain("error = ex.Message", controller);
        Assert.Contains("SafeClientMessage", controller);
        Assert.DoesNotContain("speechtotext/v3.0", controller);

        var status = ReadRepoFile("microservices/auth-service/AuthService/Services/TranscriptionService.cs");
        var method = status[status.IndexOf("GetTranscriptionStatusAsync", StringComparison.Ordinal)..status.IndexOf("public async Task ReconcileAsync", StringComparison.Ordinal)];
        Assert.DoesNotContain("_provider", method);
        Assert.DoesNotContain("cognitive.microsoft", method);
    }

    private async Task<Guid> SaveRecordingAsync()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1, 2 }), "audio/webm", 2, 4, _amelia, 1);
        Assert.True(saved.Success, saved.Message);
        return saved.RecordingId!.Value;
    }

    private async Task<string> StatusOf(Guid recordingId) =>
        (await _db.SessionRecordings.AsNoTracking().FirstAsync(r => r.Id == recordingId)).TranscriptionStatus;

    private void SeedPeople()
    {
        void AddUser(Guid id, Guid branch, string name, string userType)
        {
            _db.Users.Add(new AppUser
            {
                Id = id,
                TenantId = _tenant,
                BranchId = branch,
                UserName = name,
                NormalizedUserName = name.ToUpperInvariant(),
                Email = name + "@test",
                NormalizedEmail = name.ToUpperInvariant() + "@TEST",
                FirstName = name,
                LastName = "User",
                UserType = userType,
            });
            _db.UserBranches.Add(new UserBranch
            {
                Id = Guid.NewGuid(),
                TenantId = _tenant,
                UserId = id,
                BranchId = branch,
                Status = "active",
                EffectiveFrom = DateTime.UtcNow.AddDays(-30),
            });
        }

        AddUser(_amelia, _branchA, "amelia", "Counsellor");
        AddUser(_otherBranch, _branchB, "other", "Counsellor");
        AddUser(_admin, _branchA, "admin", "Admin");
        _db.Patients.Add(new Patient
        {
            Id = _patient,
            TenantId = _tenant,
            BranchId = _branchA,
            FirstName = "Pat",
            LastName = "Ent",
            MedicalRecordNumber = "MRN-REC",
            DateOfBirth = new DateTime(1990, 1, 1),
            Gender = "Female",
            Status = "Active",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        _db.SaveChanges();
    }

    private async Task<Guid> SeedInProgressAsync(Guid ownerId)
    {
        var sessionId = Guid.NewGuid();
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = _branchA,
            PatientId = _patient,
            CounselorId = ownerId,
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            SessionStartTime = DateTime.UtcNow.AddMinutes(-10),
            PatientType = "Cash",
            Status = "InProgress",
            Version = 1,
            CreatedAt = DateTime.UtcNow.AddMinutes(-30),
            UpdatedAt = DateTime.UtcNow.AddMinutes(-10),
            CreatedByUserId = ownerId,
            UpdatedByUserId = ownerId,
        });
        _db.CounselorQueue.Add(new CounselorQueueItem
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            BranchId = _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = "TR-" + sessionId.ToString()[..8],
            QueueType = "Counseling",
            QueuePosition = 1,
            PriorityScore = 50,
            UrgencyLevel = "Normal",
            Status = "InProgress",
            AddedToQueueAt = DateTime.UtcNow.AddMinutes(-10),
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            UpdatedAt = DateTime.UtcNow.AddMinutes(-10),
        });
        await _db.SaveChangesAsync();
        return sessionId;
    }

    private static string ReadRepoFile(string relativePath)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, relativePath);
            if (File.Exists(candidate))
                return File.ReadAllText(candidate);
            dir = dir.Parent;
        }
        throw new FileNotFoundException(relativePath);
    }

    private sealed class FakeTranscriptionProvider : ITranscriptionProvider
    {
        public bool IsReady { get; set; } = true;
        public int SubmitCount { get; private set; }
        public int StatusCount { get; private set; }
        public int FindCount { get; private set; }
        public string? LastContentUrl { get; private set; }
        public string? ExistingJobId { get; set; }
        public string JobStatus { get; set; } = "Running";
        public bool FailSubmit { get; set; }
        public MappedTranscript? Result { get; set; }
        private string? _jobId;

        public Task<TranscriptionJobLookup> FindJobAsync(Guid recordingId, CancellationToken cancellationToken = default)
        {
            FindCount++;
            if (ExistingJobId == null && _jobId == null)
                return Task.FromResult(new TranscriptionJobLookup());
            return Task.FromResult(new TranscriptionJobLookup
            {
                Job = new TranscriptionProviderJob { JobId = ExistingJobId ?? _jobId!, ProviderStatus = JobStatus },
            });
        }

        public Task<TranscriptionProviderJob> SubmitAsync(TranscriptionSubmitRequest request, CancellationToken cancellationToken = default)
        {
            SubmitCount++;
            LastContentUrl = request.PrivateContentUrl;
            if (FailSubmit)
            {
                return Task.FromResult(new TranscriptionProviderJob
                {
                    ProviderStatus = "Failed",
                    ErrorCategory = CounselingTranscriptionErrors.ProviderRejected,
                });
            }
            _jobId = "job-1";
            return Task.FromResult(new TranscriptionProviderJob { JobId = _jobId, ProviderStatus = JobStatus });
        }

        public Task<TranscriptionProviderJob> GetJobAsync(string jobId, CancellationToken cancellationToken = default)
        {
            StatusCount++;
            return Task.FromResult(new TranscriptionProviderJob { JobId = jobId, ProviderStatus = JobStatus });
        }

        public Task<MappedTranscript> DownloadResultAsync(string jobId, string submittedLocale, CancellationToken cancellationToken = default) =>
            Task.FromResult(Result ?? new MappedTranscript
            {
                LanguageCode = "te-IN",
                LanguageName = "Telugu",
                Text = "Saved line",
                WordCount = 2,
                CharacterCount = 10,
                Segments = new List<TranscriptSegment> { new() { Text = "Saved line" } },
            });
    }
}
