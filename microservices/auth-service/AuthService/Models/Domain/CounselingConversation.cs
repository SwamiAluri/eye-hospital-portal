using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

/// <summary>
/// One counselling interaction under a reused <see cref="CounselingSession"/>.
/// Repeat, Re-evaluate, and a later start after ReQueue use a new row.
/// The session id remains the operational episode id.
/// </summary>
[Table("counseling_conversations")]
public class CounselingConversation
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("branch_id")]
    public Guid? BranchId { get; set; }

    [Column("session_id")]
    public Guid SessionId { get; set; }

    [Column("sequence_number")]
    public int SequenceNumber { get; set; }

    /// <summary>Session start time this conversation is bound to.</summary>
    [Column("started_at")]
    public DateTime StartedAt { get; set; }

    [Column("ended_at")]
    public DateTime? EndedAt { get; set; }

    /// <summary>Active while the interaction is open. Ended when a later interaction supersedes it.</summary>
    [Column("status")]
    [MaxLength(20)]
    public string Status { get; set; } = CounselingConversationStatus.Active;

    [ConcurrencyCheck]
    [Column("version")]
    public int Version { get; set; } = 1;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("created_by_user_id")]
    public Guid CreatedByUserId { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    public virtual CounselingSession? Session { get; set; }
}

public static class CounselingConversationStatus
{
    public const string Active = "Active";
    public const string Ended = "Ended";
}
