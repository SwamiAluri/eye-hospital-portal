using System;
using System.Collections.Generic;

namespace AuthService.Models.Counselor
{
    public static class CounselingRecordingState
    {
        public const string Created = "Created";
        public const string Uploaded = "Uploaded";
        public const string Processing = "Processing";
        public const string Completed = "Completed";
        public const string Failed = "Failed";
    }

    // =====================================================
    // SESSION RECORDING MODELS
    // =====================================================

    public class SessionRecording
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid SessionId { get; set; }
        public Guid? ConversationId { get; set; }
        public Guid? DocumentId { get; set; }

        /// <summary>
        /// Upload lifecycle for a future transcription worker.
        /// Created, Uploaded, Processing, Completed, Failed.
        /// TranscriptionStatus stays separate and is not set by upload.
        /// </summary>
        public string RecordingState { get; set; } = CounselingRecordingState.Created;

        // Recording Details
        public string RecordingType { get; set; } = "Audio";
        public string FileUrl { get; set; } = null!;
        public string FileName { get; set; } = null!;
        public long? FileSizeBytes { get; set; }
        public int? DurationSeconds { get; set; }
        public string? MimeType { get; set; }

        // Transcription Status
        public string TranscriptionStatus { get; set; } = "Pending";
        public DateTime? TranscriptionStartedAt { get; set; }
        public DateTime? TranscriptionCompletedAt { get; set; }
        public string? TranscriptionError { get; set; }

        // Translation Status
        public string TranslationStatus { get; set; } = "Pending";
        public DateTime? TranslationStartedAt { get; set; }
        public DateTime? TranslationCompletedAt { get; set; }
        public string? TranslationError { get; set; }

        // Processing Metadata
        public string? AzureJobId { get; set; }
        public int? ProcessingDurationMs { get; set; }

        // Status
        public string Status { get; set; } = "active";

        // Audit
        public DateTime CreatedAt { get; set; }
        public Guid? CreatedByUserId { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public Guid? UpdatedByUserId { get; set; }
        public DateTime? DeletedAt { get; set; }
    }

    public class SessionTranscript
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid RecordingId { get; set; }
        public Guid SessionId { get; set; }

        // Transcript Content
        public string LanguageCode { get; set; } = null!; // en-US, hi-IN, te-IN
        public string? LanguageName { get; set; } // English, Hindi, Telugu
        public bool IsOriginalLanguage { get; set; } = true;
        public string TranscriptText { get; set; } = null!;

        // Subtitle Files
        public string? VttFileUrl { get; set; }
        public string? SrtFileUrl { get; set; }

        // Quality Metrics
        public decimal? ConfidenceScore { get; set; }
        public int? WordCount { get; set; }
        public int? CharacterCount { get; set; }

        // Timestamps (JSON segments)
        public string? Segments { get; set; } // JSON string

        // Status
        public string Status { get; set; } = "active";

        // Audit
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
    }

    public class TranscriptEdit
    {
        public Guid Id { get; set; }
        public Guid TenantId { get; set; }
        public Guid TranscriptId { get; set; }

        // Edit Details
        public int SegmentIndex { get; set; }
        public string OriginalText { get; set; } = null!;
        public string EditedText { get; set; } = null!;
        public string? EditReason { get; set; }

        // Audit
        public DateTime CreatedAt { get; set; }
        public Guid CreatedByUserId { get; set; }
    }

    // =====================================================
    // DTOs
    // =====================================================

    public class SessionRecordingDto
    {
        public Guid Id { get; set; }
        public Guid SessionId { get; set; }
        public string RecordingType { get; set; } = null!;
        public string FileUrl { get; set; } = null!;
        public string FileName { get; set; } = null!;
        public long? FileSizeBytes { get; set; }
        public int? DurationSeconds { get; set; }
        public string? MimeType { get; set; }
        public string TranscriptionStatus { get; set; } = null!;
        public string TranslationStatus { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public List<SessionTranscriptDto>? Transcripts { get; set; }
    }

    public class SessionTranscriptDto
    {
        public Guid Id { get; set; }
        public Guid RecordingId { get; set; }
        public string LanguageCode { get; set; } = null!;
        public string? LanguageName { get; set; }
        public bool IsOriginalLanguage { get; set; }
        public string TranscriptText { get; set; } = null!;
        public decimal? ConfidenceScore { get; set; }
        public int? WordCount { get; set; }
        public List<TranscriptSegment>? Segments { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class TranscriptSegment
    {
        public double? Start { get; set; }
        public double? End { get; set; }
        public string Text { get; set; } = null!;
        public double? Confidence { get; set; }
        /// <summary>Provider speaker id such as speaker_1. Never a role name.</summary>
        public string? Speaker { get; set; }
    }

    public static class CounselingTranscriptionStatus
    {
        public const string NotRequested = "NotRequested";
        public const string Pending = "Pending";
        public const string InProgress = "InProgress";
        public const string Completed = "Completed";
        public const string Failed = "Failed";
    }

    public static class CounselingTranscriptionErrors
    {
        public const string ProviderUnavailable = "ProviderUnavailable";
        public const string ProviderRejected = "ProviderRejected";
        public const string StorageAccessDenied = "StorageAccessDenied";
        public const string InvalidRecording = "InvalidRecording";
        public const string AuthorizationFailed = "AuthorizationFailed";
        public const string ConfigurationMissing = "ConfigurationMissing";
        public const string ProcessingFailed = "ProcessingFailed";

        public const string SafeClientMessage = "Transcription could not be completed.";
    }

    public class TranscriptEditDto
    {
        public Guid Id { get; set; }
        public Guid TranscriptId { get; set; }
        public int SegmentIndex { get; set; }
        public string OriginalText { get; set; } = null!;
        public string EditedText { get; set; } = null!;
        public string? EditReason { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedByUserName { get; set; } = null!;
    }

    // =====================================================
    // REQUEST MODELS
    // =====================================================

    public class StartTranscriptionRequest
    {
        public Guid RecordingId { get; set; }
        public string SourceLanguage { get; set; } = "en-US"; // en-US, hi-IN, te-IN
    }

    public class StartTranslationRequest
    {
        public Guid RecordingId { get; set; }
        public Guid SourceTranscriptId { get; set; }
        public List<string> TargetLanguages { get; set; } = new(); // List of language codes
    }

    public class EditTranscriptRequest
    {
        public Guid TranscriptId { get; set; }
        public int SegmentIndex { get; set; }
        public string EditedText { get; set; } = null!;
        public string? EditReason { get; set; }
    }

    // =====================================================
    // RESPONSE MODELS
    // =====================================================

    public class TranscriptionJobResponse
    {
        public Guid RecordingId { get; set; }
        public string Status { get; set; } = null!;
        public string? Message { get; set; }
        public string? ErrorCategory { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        public string? JobId { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        public SessionOperationFailureKind? FailureKind { get; set; }
    }

    public class TranslationJobResponse
    {
        public Guid RecordingId { get; set; }
        public List<string> TargetLanguages { get; set; } = new();
        public string Status { get; set; } = null!;
        public string? Message { get; set; }
    }
}
