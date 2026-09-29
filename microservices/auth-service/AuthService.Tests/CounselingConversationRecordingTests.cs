using System.Text;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using AuthService.Services.Interfaces;
using Azure;
using Azure.Storage.Blobs.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace AuthService.Tests;

public class CounselingConversationRecordingTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly CounselingWorkflowService _workflow;
    private readonly CounselingConversationService _conversations;
    private readonly Mock<IBlobStorageService> _blob = new();
    private readonly List<string> _storedKeys = new();
    private readonly List<string> _deletedKeys = new();

    private readonly Guid _tenant = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private readonly Guid _otherTenant = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private readonly Guid _branchA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _branchB = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Guid _amelia = Guid.Parse("c0000001-0000-0000-0000-000000000001");
    private readonly Guid _otherBranch = Guid.Parse("c0000003-0000-0000-0000-000000000003");
    private readonly Guid _admin = Guid.Parse("a0000001-0000-0000-0000-000000000001");
    private readonly Guid _patient = Guid.Parse("f1000001-0000-0000-0000-000000000001");

    public CounselingConversationRecordingTests()
    {
        _db = TestDbContextFactory.CreateInMemory();
        var branchAccess = new FollowupBranchAccessService(_db);
        _workflow = CreateWorkflow(_db, branchAccess);
        _blob.Setup(b => b.UploadExactKeyAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Stream>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, string, Stream, string, CancellationToken>((_, key, _, _, _) => _storedKeys.Add(key))
            .Returns(Task.CompletedTask);
        _blob.Setup(b => b.DeleteExactKeyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, CancellationToken>((_, key, _) => _deletedKeys.Add(key))
            .Returns(Task.CompletedTask);
        _blob.Setup(b => b.OpenReadExactAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string _, string key, CancellationToken _) => new ExactBlobRead
            {
                Content = new MemoryStream(Encoding.UTF8.GetBytes("audio")),
                ContentType = "audio/webm",
                ContentLength = 5,
            });
        _conversations = new CounselingConversationService(
            _db,
            _blob.Object,
            branchAccess,
            Mock.Of<ILogger<CounselingConversationService>>());
        SeedPeople();
    }

    public void Dispose() => _db.Dispose();

    [Fact]
    public void ObjectKey_UsesStableIds_AndDoesNotUseATimestamp()
    {
        var key = SessionAudioObjectKey.Build(
            _tenant,
            Guid.Parse("10000000-0000-0000-0000-000000000001"),
            Guid.Parse("20000000-0000-0000-0000-000000000002"),
            Guid.Parse("30000000-0000-0000-0000-000000000003"),
            ".webm");

        Assert.Equal(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000002/30000000-0000-0000-0000-000000000003.webm",
            key);
        Assert.DoesNotContain(":", key);
    }

    [Fact]
    public void BlobUpload_RefusesOverwrite_AndSetsContentType()
    {
        var options = SessionAudioBlobUpload.CreateNoOverwriteOptions("audio/webm");
        Assert.Equal("audio/webm", options.HttpHeaders.ContentType);
        Assert.Equal("*", options.Conditions.IfNoneMatch.ToString());
    }

    [Fact]
    public async Task Ensure_IsIdempotent_AndDoesNotChangeSessionVersion()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var first = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, 1);
        var second = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, 1);

        Assert.True(first.Success);
        Assert.Equal(first.ConversationId, second.ConversationId);
        Assert.Equal(1, await _db.CounselingConversations.CountAsync(c => c.SessionId == sessionId));
        var session = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Equal(1, session.Version);
        Assert.Equal("InProgress", session.Status);
    }

    [Fact]
    public async Task StaleVersion_UsesTheExistingConflictMessage()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var denied = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, 99);
        Assert.Equal(SessionOperationFailureKind.Conflict, denied.FailureKind);
        Assert.Equal(SessionConcurrency.StaleMessage, denied.Message);
        Assert.Equal(0, await _db.CounselingConversations.CountAsync());
    }

    [Fact]
    public async Task Recording_IsRejectedWhenSessionIsNotInProgress_OrHasNoStartTime()
    {
        var completed = await SeedInProgressAsync(_amelia, sessionStatus: "Completed");
        var denied = await _conversations.UploadRecordingAsync(
            _tenant, completed, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 1, _amelia, 1);
        Assert.False(denied.Success);
        Assert.Equal(0, await _db.CounselingConversations.CountAsync(c => c.SessionId == completed));

        var open = await SeedInProgressAsync(_amelia);
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == open);
        session.SessionStartTime = null;
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
        var noStart = await _conversations.UploadRecordingAsync(
            _tenant, open, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 1, _amelia, 1);
        Assert.False(noStart.Success);
        Assert.Equal(0, await _db.SessionRecordings.CountAsync(r => r.SessionId == open));
    }

    [Fact]
    public async Task StorageFailure_DoesNotLeaveAnUploadedRecording()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        _blob.Setup(b => b.UploadExactKeyAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Stream>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("storage unavailable"));

        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 1, _amelia, 1);

        Assert.False(saved.Success);
        Assert.Equal(CounselingRecordingState.Failed, (await _db.SessionRecordings.SingleAsync()).RecordingState);
        Assert.Equal(0, await _db.CounselingSessionDocuments.CountAsync());
    }

    [Fact]
    public async Task StorageAuthorizationFailure_DoesNotLeaveAnUploadedRecording()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        _blob.Setup(b => b.UploadExactKeyAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Stream>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new RequestFailedException(403, "denied", "AuthorizationPermissionMismatch", null));

        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 1, _amelia, 1);

        Assert.False(saved.Success);
        Assert.Equal(SessionOperationFailureKind.BadRequest, saved.FailureKind);
        Assert.Equal("Recording could not be saved.", saved.Message);
        Assert.Equal(CounselingRecordingState.Failed, (await _db.SessionRecordings.SingleAsync()).RecordingState);
        Assert.NotEqual(CounselingRecordingState.Uploaded, (await _db.SessionRecordings.SingleAsync()).RecordingState);
    }

    [Fact]
    public async Task DuplicateObjectKey_DoesNotReportSuccess()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        _blob.Setup(b => b.UploadExactKeyAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Stream>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new BlobObjectKeyConflictException());

        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 1, _amelia, 1);

        Assert.False(saved.Success);
        Assert.NotEqual(SessionOperationFailureKind.Conflict, saved.FailureKind);
        Assert.Equal(CounselingRecordingState.Failed, (await _db.SessionRecordings.SingleAsync()).RecordingState);
    }

    [Fact]
    public async Task SecondStartDuringTheSameSitting_DoesNotOpenAnotherConversation()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var first = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, 1);
        _db.ChangeTracker.Clear();
        var before = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        var restarted = await _workflow.StartSessionAsync(_tenant, sessionId, _amelia, before.Version);
        Assert.True(restarted.Success, restarted.Message);
        _db.ChangeTracker.Clear();
        var after = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.True(after.SessionStartTime >= before.SessionStartTime);
        Assert.True(!after.SessionEndTime.HasValue || after.SessionStartTime >= after.SessionEndTime);

        var again = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, after.Version);
        Assert.Equal(first.ConversationId, again.ConversationId);
        Assert.Equal(1, await _db.CounselingConversations.CountAsync(c => c.SessionId == sessionId && c.DeletedAt == null));
    }

    [Fact]
    public void AudioRecording_FitsTheDocumentTypeColumn()
    {
        Assert.InRange("AudioRecording".Length, 1, 50);
        var migration = ReadRepoFile(
            "microservices/auth-service/AuthService/Data/Migrations/20260927150000_AddCounselingConversations.sql");
        Assert.Contains("'AudioRecording'", migration, StringComparison.Ordinal);
        Assert.Contains("counseling_session_documents_document_type_check", migration, StringComparison.Ordinal);
        var model = ReadRepoFile("microservices/auth-service/AuthService/Models/Domain/CounselingWorkflow.cs");
        var entityStart = model.IndexOf("class CounselingSessionDocument", StringComparison.Ordinal);
        var entity = model.Substring(entityStart, 700);
        Assert.Contains("[MaxLength(50)]", entity, StringComparison.Ordinal);
        Assert.Contains("document_type", entity, StringComparison.Ordinal);
        Assert.DoesNotContain("HasCheckConstraint", entity, StringComparison.Ordinal);
    }

    [Fact]
    public void LegacyUploadAudio_DoesNotReturnExceptionText()
    {
        var controller = ReadRepoFile("microservices/auth-service/AuthService/Controllers/CounselingController.cs");
        var start = controller.IndexOf("[HttpPost(\"sessions/{sessionId}/upload-audio\")]", StringComparison.Ordinal);
        var end = controller.IndexOf("[HttpPost(\"documents/{id}/verify\")]", start, StringComparison.Ordinal);
        var method = controller[start..end];
        Assert.Contains("session_documents.create", method, StringComparison.Ordinal);
        Assert.DoesNotContain("error = ex.Message", method, StringComparison.Ordinal);
        Assert.DoesNotContain("DenyUnlessSessionOwner", method, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Start_DoesNotCreateAConversation()
    {
        var sessionId = await SeedInProgressAsync(_amelia, sessionStatus: "Scheduled", queueStatus: "Waiting", startTime: null);
        var started = await _workflow.StartSessionAsync(_tenant, sessionId, _amelia, 1);
        Assert.True(started.Success);
        Assert.Equal(0, await _db.CounselingConversations.CountAsync());
    }

    [Fact]
    public async Task Upload_LinksRecordingToConversation_AndDoesNotExposeAUrl()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        await using var audio = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, audio, "audio/webm;codecs=opus", audio.Length, 12, _amelia, 1);

        Assert.True(saved.Success);
        Assert.Equal(CounselingRecordingState.Uploaded, saved.RecordingState);
        Assert.NotEqual(sessionId, saved.RecordingId);
        var recording = await _db.SessionRecordings.SingleAsync();
        Assert.Equal(saved.ConversationId, recording.ConversationId);
        Assert.Equal(sessionId, recording.SessionId);
        Assert.Equal("NotRequested", recording.TranscriptionStatus);
        Assert.False(recording.FileUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(recording.Id.ToString(), recording.FileUrl);
        var document = await _db.CounselingSessionDocuments.SingleAsync();
        Assert.Equal(recording.DocumentId, document.Id);
        Assert.Equal("AudioRecording", document.DocumentType);
        Assert.False(document.IsVerified);
        Assert.Equal(recording.FileUrl, document.FilePath);
        Assert.Equal(SessionAudioObjectKey.ContainerName, _storedKeys[0] is null ? "" : SessionAudioObjectKey.ContainerName);
        Assert.Equal(recording.FileUrl, _storedKeys.Single());
    }

    [Fact]
    public async Task Delete_RemovesBlobDocumentAndHidesTheRecording()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1, 2 }), "audio/webm", 2, 4, _amelia, 1);
        Assert.True(saved.Success);

        var denied = await _conversations.DeleteRecordingsAsync(
            _tenant, sessionId, new[] { saved.RecordingId!.Value }, _admin);
        Assert.Equal(SessionOperationFailureKind.Forbidden, denied.FailureKind);
        Assert.Empty(_deletedKeys);

        var deleted = await _conversations.DeleteRecordingsAsync(
            _tenant, sessionId, new[] { saved.RecordingId!.Value }, _amelia);
        Assert.True(deleted.Success, deleted.Message);
        Assert.Contains(saved.RecordingId.ToString(), _deletedKeys.Single());

        var recording = await _db.SessionRecordings.IgnoreQueryFilters().SingleAsync();
        Assert.NotNull(recording.DeletedAt);
        var document = await _db.CounselingSessionDocuments.IgnoreQueryFilters().SingleAsync();
        Assert.NotNull(document.DeletedAt);
        Assert.Equal(1, await _db.CounselingSessionAuditLog.CountAsync(a => a.ChangeType == "RecordingDeleted"));

        var history = await _conversations.ListConversationsAsync(_tenant, sessionId, _amelia);
        Assert.Empty(history.Conversations.SelectMany(c => c.Recordings));
        var playback = await _conversations.OpenRecordingAsync(_tenant, sessionId, saved.RecordingId.Value, _amelia);
        Assert.Equal(SessionOperationFailureKind.NotFound, playback.FailureKind);
    }

    [Fact]
    public async Task Download_AuthorizesOwnerAndArchivesMultipleRecordingsWithoutABlobUrl()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var first = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 2, _amelia, 1);
        var second = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 2 }), "audio/webm", 1, 3, _amelia, 1);

        var denied = await _conversations.DownloadRecordingsAsync(
            _tenant, sessionId, new[] { first.RecordingId!.Value, second.RecordingId!.Value }, _admin);
        Assert.Equal(SessionOperationFailureKind.Forbidden, denied.FailureKind);

        var one = await _conversations.DownloadRecordingsAsync(
            _tenant, sessionId, new[] { first.RecordingId!.Value }, _amelia);
        Assert.True(one.Success);
        Assert.Equal("audio/webm", one.Content!.ContentType);
        Assert.DoesNotContain("http", one.FileName ?? "", StringComparison.OrdinalIgnoreCase);

        var many = await _conversations.DownloadRecordingsAsync(
            _tenant, sessionId, new[] { first.RecordingId!.Value, second.RecordingId!.Value }, _amelia);
        Assert.True(many.Success, many.Message);
        Assert.Equal("application/zip", many.Content!.ContentType);
        Assert.Equal("Counselling-Conversation-1-Recordings.zip", many.FileName);
        var header = new byte[2];
        Assert.Equal(2, await many.Content.Content.ReadAsync(header));
        Assert.Equal((byte)'P', header[0]);
        Assert.Equal((byte)'K', header[1]);
    }

    [Fact]
    public async Task SecondUpload_UsesANewRecordingId_AndDoesNotOverwriteTheKey()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 1, _amelia, 1);
        await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 2 }), "audio/webm", 1, 1, _amelia, 1);

        Assert.Equal(2, _storedKeys.Distinct().Count());
        Assert.Equal(1, await _db.CounselingConversations.CountAsync());
        Assert.Equal(2, await _db.SessionRecordings.CountAsync());
    }

    [Fact]
    public async Task UnauthorizedCaller_DoesNotCreateOrPlay()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var denied = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _admin, 1);
        Assert.Equal(SessionOperationFailureKind.Forbidden, denied.FailureKind);
        Assert.Equal(0, await _db.CounselingConversations.CountAsync());

        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 1, _amelia, 1);
        var playback = await _conversations.OpenRecordingAsync(_tenant, sessionId, saved.RecordingId!.Value, _admin);
        Assert.Equal(SessionOperationFailureKind.Forbidden, playback.FailureKind);
        _blob.Verify(b => b.OpenReadExactAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task OwnerPlayback_StreamsWithoutReturningAStorageUrl()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1, 2 }), "audio/webm", 2, 3, _amelia, 1);
        var playback = await _conversations.OpenRecordingAsync(_tenant, sessionId, saved.RecordingId!.Value, _amelia);
        Assert.True(playback.Success);
        Assert.Equal("audio/webm", playback.Content!.ContentType);
        Assert.Equal(5, playback.Content.ContentLength);
        var played = new byte[5];
        Assert.Equal(5, await playback.Content.Content.ReadAsync(played));
        Assert.Equal("audio", Encoding.UTF8.GetString(played));
        Assert.Null(saved.Message.Contains("http") ? "leak" : null);
    }

    [Fact]
    public async Task UploadedRecording_MissingFromConfiguredStore_IsNotFound()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 101, _amelia, 1);
        _blob.Setup(b => b.OpenReadExactAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((ExactBlobRead?)null);

        var playback = await _conversations.OpenRecordingAsync(_tenant, sessionId, saved.RecordingId!.Value, _amelia);

        Assert.False(playback.Success);
        Assert.Equal(SessionOperationFailureKind.NotFound, playback.FailureKind);
        Assert.Equal("Recording not found", playback.Message);
    }

    [Fact]
    public async Task MissingRecording_IsNotFound()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var playback = await _conversations.OpenRecordingAsync(_tenant, sessionId, Guid.NewGuid(), _amelia);
        Assert.Equal(SessionOperationFailureKind.NotFound, playback.FailureKind);
    }

    [Fact]
    public async Task InvalidStorageKey_DoesNotOpenTheObject()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 1, _amelia, 1);
        var recording = await _db.SessionRecordings.SingleAsync(r => r.Id == saved.RecordingId);
        recording.FileUrl = "../not-a-key";
        await _db.SaveChangesAsync();
        _blob.Invocations.Clear();

        var playback = await _conversations.OpenRecordingAsync(_tenant, sessionId, saved.RecordingId!.Value, _amelia);

        Assert.Equal(SessionOperationFailureKind.BadRequest, playback.FailureKind);
        Assert.Equal("Recording could not be opened.", playback.Message);
        _blob.Verify(b => b.OpenReadExactAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task WrongTenant_DoesNotOpenPlayback()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 1, _amelia, 1);
        _blob.Invocations.Clear();

        var playback = await _conversations.OpenRecordingAsync(_otherTenant, sessionId, saved.RecordingId!.Value, _amelia);

        Assert.Equal(SessionOperationFailureKind.NotFound, playback.FailureKind);
        _blob.Verify(b => b.OpenReadExactAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task OtherTenant_AndOtherBranch_AreRejected()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var otherTenant = await _conversations.EnsureActiveConversationAsync(_otherTenant, sessionId, _amelia, 1);
        Assert.Equal(SessionOperationFailureKind.NotFound, otherTenant.FailureKind);

        var otherBranchSession = await SeedInProgressAsync(_otherBranch, branchId: _branchA);
        var denied = await _conversations.EnsureActiveConversationAsync(_tenant, otherBranchSession, _otherBranch, 1);
        Assert.Equal(SessionOperationFailureKind.Forbidden, denied.FailureKind);
    }

    [Fact]
    public async Task RepeatStart_OpensANewConversation_AndKeepsThePreviousOne()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var first = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, 1);
        var completed = await _workflow.CompleteSessionAsync(_tenant, sessionId, _amelia, 1);
        Assert.True(completed.Success, completed.Message);
        _db.ChangeTracker.Clear();
        var afterComplete = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        var restarted = await _workflow.StartSessionAsync(_tenant, sessionId, _amelia, afterComplete.Version);
        Assert.True(restarted.Success, restarted.Message);
        _db.ChangeTracker.Clear();
        var afterStart = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.True(afterStart.SessionStartTime >= afterStart.SessionEndTime);

        var second = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, afterStart.Version);

        Assert.NotEqual(first.ConversationId, second.ConversationId);
        var rows = await _db.CounselingConversations.AsNoTracking().OrderBy(c => c.SequenceNumber).ToListAsync();
        Assert.Equal(2, rows.Count);
        Assert.Equal(first.ConversationId, rows[0].Id);
        Assert.NotNull(rows[0].EndedAt);
        Assert.Equal(CounselingConversationStatus.Ended, rows[0].Status);
        Assert.Null(rows[1].EndedAt);
        Assert.Equal(sessionId, rows[0].SessionId);
        Assert.Equal(sessionId, rows[1].SessionId);
    }

    [Fact]
    public async Task ReEvaluate_OpensANewConversation_AndKeepsThePreviousOne()
    {
        var sessionId = await SeedInProgressAsync(_amelia, agreed: true);
        var first = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, 1);
        await _workflow.CompleteSessionAsync(_tenant, sessionId, _amelia, 1);
        _db.ChangeTracker.Clear();
        var session = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        session.PatientAgreedToSurgery = true;
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
        var version = await _db.CounselingSession.AsNoTracking().Where(s => s.Id == sessionId).Select(s => s.Version).FirstAsync();
        var restarted = await _workflow.StartSessionAsync(_tenant, sessionId, _amelia, version);
        Assert.True(restarted.Success, restarted.Message);
        _db.ChangeTracker.Clear();
        version = await _db.CounselingSession.AsNoTracking().Where(s => s.Id == sessionId).Select(s => s.Version).FirstAsync();
        var second = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, version);

        Assert.NotEqual(first.ConversationId, second.ConversationId);
        Assert.Equal(2, await _db.CounselingConversations.CountAsync(c => c.SessionId == sessionId && c.DeletedAt == null));
    }

    [Fact]
    public async Task ReQueue_DoesNotDeleteOrEndTheConversation_NextStartOpensAnother()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var first = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, 1);
        var requeued = await _workflow.ReQueueSessionAsync(
            _tenant, sessionId, 1, _amelia, "Patient will return tomorrow", null, null, null, _admin);
        Assert.True(requeued.Success, requeued.Message);

        _db.ChangeTracker.Clear();
        var preserved = await _db.CounselingConversations.AsNoTracking().SingleAsync();
        Assert.Equal(first.ConversationId, preserved.Id);
        Assert.Null(preserved.EndedAt);
        Assert.Null(preserved.DeletedAt);
        var session = await _db.CounselingSession.AsNoTracking().FirstAsync(s => s.Id == sessionId);
        Assert.Null(session.CounselorId);

        var tracked = await _db.CounselingSession.FirstAsync(s => s.Id == sessionId);
        tracked.CounselorId = _amelia;
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
        var version = await _db.CounselingSession.AsNoTracking().Where(s => s.Id == sessionId).Select(s => s.Version).FirstAsync();
        var restarted = await _workflow.StartSessionAsync(_tenant, sessionId, _amelia, version);
        Assert.True(restarted.Success, restarted.Message);
        _db.ChangeTracker.Clear();
        version = await _db.CounselingSession.AsNoTracking().Where(s => s.Id == sessionId).Select(s => s.Version).FirstAsync();
        var second = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, version);

        Assert.NotEqual(first.ConversationId, second.ConversationId);
        var firstRow = await _db.CounselingConversations.AsNoTracking().FirstAsync(c => c.Id == first.ConversationId);
        Assert.NotNull(firstRow.EndedAt);
        Assert.Null(firstRow.DeletedAt);
    }

    private static CounselingWorkflowService CreateWorkflow(AppDbContext db, IFollowupBranchAccessService branchAccess)
    {
        var config = new Mock<IConfiguration>();
        config.Setup(c => c["CcmsService:BaseUrl"]).Returns("http://localhost:7075/api");
        config.Setup(c => c["InternalApi:Key"]).Returns(string.Empty);
        return new CounselingWorkflowService(
            db,
            Mock.Of<ILogger<CounselingWorkflowService>>(),
            Mock.Of<IBlobStorageService>(),
            Mock.Of<System.Net.Http.IHttpClientFactory>(),
            config.Object,
            Mock.Of<IQueueDisplayNotifier>(),
            branchAccess,
            Mock.Of<IAuditService>());
    }

    private void SeedPeople()
    {
        void AddUser(Guid id, Guid branch, string name, string userType)
        {
            _db.Users.Add(new AppUser
            {
                Id = id,
                TenantId = _tenant,
                UserName = name,
                NormalizedUserName = name.ToUpperInvariant(),
                Email = name + "@test",
                NormalizedEmail = name.ToUpperInvariant() + "@TEST",
                FirstName = name,
                LastName = "User",
                BranchId = branch,
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

    [Fact]
    public async Task History_DoesNotCreateAConversation_AndDoesNotExposeStorage()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var before = await _conversations.ListConversationsAsync(_tenant, sessionId, _amelia);
        Assert.True(before.Success);
        Assert.Empty(before.Conversations);
        Assert.Equal(0, await _db.CounselingConversations.CountAsync());

        var saved = await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1, 2 }), "audio/webm", 2, 4, _amelia, 1);
        var otherSession = await SeedInProgressAsync(_amelia);
        await _conversations.UploadRecordingAsync(
            _tenant, otherSession, new MemoryStream(new byte[] { 9 }), "audio/webm", 1, 1, _amelia, 1);

        var history = await _conversations.ListConversationsAsync(_tenant, sessionId, _amelia);
        Assert.True(history.Success);
        Assert.Single(history.Conversations);
        Assert.Equal(saved.ConversationId, history.Conversations[0].Id);
        Assert.Single(history.Conversations[0].Recordings);
        Assert.Equal(saved.RecordingId, history.Conversations[0].Recordings[0].Id);
        Assert.Equal("amelia User", history.Conversations[0].CounsellorName);
        Assert.Equal("audio/webm", history.Conversations[0].Recordings[0].ContentType);
        Assert.Equal(4, history.Conversations[0].DurationSeconds);
        Assert.Equal(_amelia, history.Conversations[0].Recordings[0].CreatedByUserId);
        var json = System.Text.Json.JsonSerializer.Serialize(history);
        var stored = await _db.SessionRecordings.AsNoTracking().FirstAsync(r => r.Id == saved.RecordingId);
        Assert.DoesNotContain(stored.FileUrl, json);
        Assert.DoesNotContain("http", json, StringComparison.OrdinalIgnoreCase);

        var foreign = await _conversations.ListConversationsAsync(_otherTenant, sessionId, _amelia);
        Assert.Equal(SessionOperationFailureKind.NotFound, foreign.FailureKind);

        var otherBranch = await _conversations.ListConversationsAsync(_tenant, sessionId, _otherBranch);
        Assert.Equal(SessionOperationFailureKind.Forbidden, otherBranch.FailureKind);
        Assert.Empty(otherBranch.Conversations);

        var sameBranchViewer = await _conversations.ListConversationsAsync(_tenant, sessionId, _admin);
        Assert.True(sameBranchViewer.Success);
        Assert.Single(sameBranchViewer.Conversations);
    }

    [Fact]
    public async Task History_SeparatesConversationsAndRecordings_AndOmitsDeleted()
    {
        var sessionId = await SeedInProgressAsync(_amelia);
        var first = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, 1);
        await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 1 }), "audio/webm", 1, 5, _amelia, 1);
        await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 2 }), "audio/webm", 1, 7, _amelia, 1);
        var completed = await _workflow.CompleteSessionAsync(_tenant, sessionId, _amelia, 1);
        Assert.True(completed.Success, completed.Message);
        _db.ChangeTracker.Clear();
        var version = await _db.CounselingSession.AsNoTracking().Where(s => s.Id == sessionId).Select(s => s.Version).FirstAsync();
        var restarted = await _workflow.StartSessionAsync(_tenant, sessionId, _amelia, version);
        Assert.True(restarted.Success, restarted.Message);
        _db.ChangeTracker.Clear();
        version = await _db.CounselingSession.AsNoTracking().Where(s => s.Id == sessionId).Select(s => s.Version).FirstAsync();
        var second = await _conversations.EnsureActiveConversationAsync(_tenant, sessionId, _amelia, version);
        await _conversations.UploadRecordingAsync(
            _tenant, sessionId, new MemoryStream(new byte[] { 3 }), "audio/webm", 1, 9, _amelia, version);

        var deletedRecording = await _db.SessionRecordings.FirstAsync(r => r.ConversationId == first.ConversationId);
        deletedRecording.DeletedAt = DateTime.UtcNow;
        var deletedConversation = new CounselingConversation
        {
            Id = Guid.NewGuid(),
            TenantId = _tenant,
            SessionId = sessionId,
            SequenceNumber = 99,
            Status = CounselingConversationStatus.Ended,
            StartedAt = DateTime.UtcNow.AddHours(-3),
            CreatedAt = DateTime.UtcNow.AddHours(-3),
            CreatedByUserId = _amelia,
            DeletedAt = DateTime.UtcNow,
        };
        _db.CounselingConversations.Add(deletedConversation);
        await _db.SaveChangesAsync();

        var history = await _conversations.ListConversationsAsync(_tenant, sessionId, _amelia);
        Assert.True(history.Success);
        Assert.Equal(2, history.Conversations.Count);
        Assert.Equal(new[] { 1, 2 }, history.Conversations.Select(c => c.SequenceNumber).ToArray());
        Assert.Equal(first.ConversationId, history.Conversations[0].Id);
        Assert.Equal(second.ConversationId, history.Conversations[1].Id);
        Assert.Single(history.Conversations[0].Recordings);
        Assert.Single(history.Conversations[1].Recordings);
        Assert.DoesNotContain(history.Conversations, c => c.Id == deletedConversation.Id);
        Assert.DoesNotContain(history.Conversations.SelectMany(c => c.Recordings), r => r.Id == deletedRecording.Id);
    }

    [Fact]
    public void GetConversations_UsesSessionRead_AndPostEnsureStaysUpdate()
    {
        var src = ReadRepoFile("microservices/auth-service/AuthService/Controllers/CounselingRecordingsController.cs")
            .Replace("\r\n", "\n");
        var get = src.IndexOf("[HttpGet(\"conversations\")]", StringComparison.Ordinal);
        var post = src.IndexOf("[HttpPost(\"conversations\")]", StringComparison.Ordinal);
        Assert.True(get >= 0 && post > get);
        var getBlock = src[get..post];
        Assert.Contains("[RequirePermission(\"counseling_sessions.read\")]", getBlock);
        Assert.DoesNotContain("counseling_sessions.update", getBlock);
        Assert.Contains("[RequirePermission(\"counseling_sessions.update\")]", src[post..]);
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

    private async Task<Guid> SeedInProgressAsync(
        Guid ownerId,
        string sessionStatus = "InProgress",
        string queueStatus = "InProgress",
        DateTime? startTime = null,
        Guid? branchId = null,
        bool agreed = false)
    {
        var sessionId = Guid.NewGuid();
        _db.CounselingSession.Add(new CounselingSession
        {
            Id = sessionId,
            TenantId = _tenant,
            BranchId = branchId ?? _branchA,
            PatientId = _patient,
            CounselorId = ownerId,
            SessionType = "Initial",
            SessionDate = DateTime.UtcNow.Date,
            SessionStartTime = startTime ?? DateTime.UtcNow.AddMinutes(-10),
            PatientType = "Cash",
            PatientAgreedToSurgery = agreed,
            Status = sessionStatus,
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
            BranchId = branchId ?? _branchA,
            SessionId = sessionId,
            PatientId = _patient,
            TokenNumber = "REC-" + sessionId.ToString()[..8],
            QueueType = "Counseling",
            QueuePosition = 1,
            PriorityScore = 50,
            UrgencyLevel = "Normal",
            Status = queueStatus,
            AddedToQueueAt = DateTime.UtcNow.AddMinutes(-10),
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            UpdatedAt = DateTime.UtcNow.AddMinutes(-10),
        });
        await _db.SaveChangesAsync();
        return sessionId;
    }
}
