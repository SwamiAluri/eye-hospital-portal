using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Branch
{
    /// <summary>
    /// Tracks individual bed inventory by type (General, ICU, Emergency)
    /// Migration 08: Phase 2 - Branch Capacity Tracking
    /// </summary>
    [Table("bed_inventory")]
    public class BedInventory
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        [Required]
        [Column("tenant_id")]
        public Guid TenantId { get; set; }

        [Required]
        [Column("branch_id")]
        public Guid BranchId { get; set; }

        [Required]
        [Column("bed_number")]
        [MaxLength(50)]
        public string BedNumber { get; set; } = string.Empty;

        [Required]
        [Column("bed_type")]
        [MaxLength(50)]
        public string BedType { get; set; } = "General"; // General, ICU, Emergency, Recliner, DayCareChair

        [Required]
        [Column("bed_status")]
        [MaxLength(50)]
        public string BedStatus { get; set; } = "Available"; // Available, Occupied, Under_Maintenance, Reserved

        [Column("floor_number")]
        public int? FloorNumber { get; set; }

        [Column("room_number")]
        [MaxLength(50)]
        public string? RoomNumber { get; set; }

        [Column("ward_name")]
        [MaxLength(100)]
        public string? WardName { get; set; }

        /// <summary>DB-004. FK to ward.id. Nullable for unmatched legacy rows; ward_name stays.</summary>
        [Column("ward_id")]
        public Guid? WardId { get; set; }

        [Column("patient_id")]
        public Guid? PatientId { get; set; }

        [Column("assigned_at")]
        public DateTime? AssignedAt { get; set; }

        [Column("expected_discharge_at")]
        public DateTime? ExpectedDischargeAt { get; set; }

        [Column("equipment_available")]
        [MaxLength(500)]
        public string? EquipmentAvailable { get; set; }

        [Column("is_isolation_bed")]
        public bool IsIsolationBed { get; set; } = false;

        /// <summary>Denormalized occupancy flag used by the branch capacity trigger.</summary>
        [Column("is_occupied")]
        public bool IsOccupied { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [Column("created_by_user_id")]
        public Guid? CreatedByUserId { get; set; }

        [Column("updated_by_user_id")]
        public Guid? UpdatedByUserId { get; set; }

        [Column("deleted_at")]
        public DateTime? DeletedAt { get; set; }

        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "active";

        // Navigation properties
        [ForeignKey("BranchId")]
        public virtual Domain.Branch? Branch { get; set; }

        [ForeignKey("PatientId")]
        public virtual Domain.Patient? Patient { get; set; }
    }

    /// <summary>
    /// Time-series snapshots of branch capacity for trend analysis
    /// Migration 08: Phase 2 - Branch Capacity Tracking
    /// </summary>
    [Table("branch_capacity_history")]
    public class BranchCapacityHistory
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        [Required]
        [Column("tenant_id")]
        public Guid TenantId { get; set; }

        [Required]
        [Column("branch_id")]
        public Guid BranchId { get; set; }

        [Required]
        [Column("snapshot_time")]
        public DateTime SnapshotTime { get; set; } = DateTime.UtcNow;

        [Required]
        [Column("total_beds")]
        public int TotalBeds { get; set; }

        [Column("general_beds_occupied")]
        public int GeneralBedsOccupied { get; set; }

        [Column("icu_beds_occupied")]
        public int IcuBedsOccupied { get; set; }

        [Column("emergency_beds_occupied")]
        public int EmergencyBedsOccupied { get; set; }

        [Column("available_beds")]
        public int AvailableBeds { get; set; }

        [Column("occupancy_percentage")]
        public decimal OccupancyPercentage { get; set; }

        [Column("capacity_alert_level")]
        [MaxLength(50)]
        public string CapacityAlertLevel { get; set; } = "normal"; // normal, warning, critical

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("BranchId")]
        public virtual Domain.Branch? Branch { get; set; }
    }

    /// <summary>
    /// Inter-branch patient transfer requests
    /// Migration 08: Phase 2 - Branch Capacity Tracking
    /// </summary>
    [Table("patient_transfer_request")]
    public class PatientTransferRequest
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        [Required]
        [Column("tenant_id")]
        public Guid TenantId { get; set; }

        [Required]
        [Column("patient_id")]
        public Guid PatientId { get; set; }

        [Required]
        [Column("from_branch_id")]
        public Guid FromBranchId { get; set; }

        [Required]
        [Column("to_branch_id")]
        public Guid ToBranchId { get; set; }

        [Required]
        [Column("requested_by_user_id")]
        public Guid RequestedByUserId { get; set; }

        [Required]
        [Column("request_date")]
        public DateTime RequestDate { get; set; } = DateTime.UtcNow;

        [Required]
        [Column("transfer_reason")]
        [MaxLength(500)]
        public string TransferReason { get; set; } = string.Empty;

        [Column("required_bed_type")]
        [MaxLength(50)]
        public string? RequiredBedType { get; set; }

        [Required]
        [Column("transfer_status")]
        [MaxLength(50)]
        public string TransferStatus { get; set; } = "pending"; // pending, approved, rejected, completed, cancelled

        [Column("approved_by_user_id")]
        public Guid? ApprovedByUserId { get; set; }

        [Column("approved_at")]
        public DateTime? ApprovedAt { get; set; }

        [Column("rejected_reason")]
        [MaxLength(500)]
        public string? RejectedReason { get; set; }

        [Column("transferred_at")]
        public DateTime? TransferredAt { get; set; }

        [Column("assigned_bed_id")]
        public Guid? AssignedBedId { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [Column("created_by_user_id")]
        public Guid? CreatedByUserId { get; set; }

        [Column("updated_by_user_id")]
        public Guid? UpdatedByUserId { get; set; }

        [Column("deleted_at")]
        public DateTime? DeletedAt { get; set; }

        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "active";

        // Navigation properties
        [ForeignKey("PatientId")]
        public virtual Domain.Patient? Patient { get; set; }

        [ForeignKey("FromBranchId")]
        public virtual Domain.Branch? FromBranch { get; set; }

        [ForeignKey("ToBranchId")]
        public virtual Domain.Branch? ToBranch { get; set; }

        [ForeignKey("AssignedBedId")]
        public virtual BedInventory? AssignedBed { get; set; }
    }

    // DTOs for API responses

    /// <summary>
    /// Real-time capacity summary for dashboard
    /// </summary>
    public class BranchCapacitySummaryDto
    {
        public Guid BranchId { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public int TotalBeds { get; set; }
        public int AvailableBeds { get; set; }
        public int OccupiedBeds { get; set; }
        public decimal OccupancyPercentage { get; set; }
        public string CapacityAlertLevel { get; set; } = "normal";
        
        // By bed type
        public BedTypeCapacity GeneralBeds { get; set; } = new();
        public BedTypeCapacity IcuBeds { get; set; } = new();
        public BedTypeCapacity EmergencyBeds { get; set; } = new();
        public BedTypeCapacity ReclinerBeds { get; set; } = new();
        public BedTypeCapacity DayCareChairBeds { get; set; } = new();
        
        public DateTime LastUpdated { get; set; }
    }

    public class BedTypeCapacity
    {
        public int Total { get; set; }
        public int Available { get; set; }
        public int Occupied { get; set; }
        public int UnderMaintenance { get; set; }
        public int Reserved { get; set; }
    }

    /// <summary>
    /// Detailed bed information
    /// </summary>
    public class BedInventoryDto
    {
        public Guid Id { get; set; }
        public string BedNumber { get; set; } = string.Empty;
        public string BedType { get; set; } = string.Empty;
        public string BedStatus { get; set; } = string.Empty;
        public int? FloorNumber { get; set; }
        public string? RoomNumber { get; set; }
        public string? WardName { get; set; }
        public Guid? WardId { get; set; }
        public Guid? PatientId { get; set; }
        public string? PatientName { get; set; }
        public DateTime? AssignedAt { get; set; }
        public DateTime? ExpectedDischargeAt { get; set; }
        public string? EquipmentAvailable { get; set; }
        public bool IsIsolationBed { get; set; }
    }

    /// <summary>
    /// Request to create a transfer
    /// </summary>
    public class CreateTransferRequestDto
    {
        [Required]
        public Guid PatientId { get; set; }

        [Required]
        public Guid FromBranchId { get; set; }

        [Required]
        public Guid ToBranchId { get; set; }

        [Required]
        [MaxLength(500)]
        public string TransferReason { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? RequiredBedType { get; set; }
    }

    /// <summary>
    /// Request to update bed status
    /// </summary>
    public class UpdateBedStatusDto
    {
        [Required]
        public Guid BedId { get; set; }

        [Required]
        [MaxLength(50)]
        public string BedStatus { get; set; } = string.Empty;

        public Guid? PatientId { get; set; }
        public DateTime? ExpectedDischargeAt { get; set; }
    }
}
