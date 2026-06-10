using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AuthService.Models.MasterData
{
    // ─── Request DTOs ────────────────────────────────────────────────────────

    public class CreateMasterValueRequest
    {
        [Required]
        [MaxLength(150)]
        public string Code { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string Label { get; set; } = string.Empty;

        public string? Description { get; set; }

        /// <summary>JSON string for extra metadata (optional).</summary>
        public string? Metadata { get; set; }

        public int SortOrder { get; set; } = 0;
    }

    public class UpdateMasterValueRequest
    {
        [Required]
        [MaxLength(500)]
        public string Label { get; set; } = string.Empty;

        public string? Description { get; set; }
        public string? Metadata { get; set; }
        public int SortOrder { get; set; } = 0;
    }

    // ─── Response DTOs ───────────────────────────────────────────────────────

    public class DisableMasterValueRequest
    {
        [MaxLength(500)]
        public string? Reason { get; set; }
    }

    public class MasterValueDto
    {
        public Guid Id { get; set; }
        public string EntityType { get; set; } = string.Empty;
        public string GroupKey { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string? Description { get; set; }
        public object? Metadata { get; set; }
        public int SortOrder { get; set; }
        public bool IsActive { get; set; }
        public bool IsSystemLocked { get; set; }
        public DateTime? DisabledAt { get; set; }
        public string? DisabledReason { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class MasterGroupDto
    {
        public string GroupKey { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public List<EntityTypeDto> EntityTypes { get; set; } = new();
    }

    public class EntityTypeDto
    {
        public string EntityType { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string? TabLabel { get; set; }
        public int SortOrder { get; set; }
        public int TotalCount { get; set; }
        public int ActiveCount { get; set; }
    }

    public class MasterValueListResponse
    {
        public string EntityType { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public int Total { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 50;
        public int TotalPages { get; set; }
        public List<MasterValueDto> Items { get; set; } = new();
    }

    // Stats for the UI summary cards
    public class MasterEntityTypeStatsDto
    {
        public string EntityType { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public int Total { get; set; }
        public int Active { get; set; }
        public int Disabled { get; set; }
        public int SystemLocked { get; set; }
    }

    /// <summary>Lightweight option for module dropdowns (lookup API).</summary>
    public class MasterLookupOptionDto
    {
        public string Code { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public object? Metadata { get; set; }
        public int SortOrder { get; set; }
    }

    public class MasterLookupResponse
    {
        public string EntityType { get; set; } = string.Empty;
        public List<MasterLookupOptionDto> Items { get; set; } = new();
    }
}
