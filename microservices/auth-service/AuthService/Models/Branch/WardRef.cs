using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Branch;

/// <summary>
/// Read-only projection of IP <c>ward</c> so Auth can attach <c>bed_inventory.ward_id</c>.
/// Ward master stays owned by IP Management. No Auth migrations.
/// </summary>
[Table("ward")]
public class WardRef
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("branch_id")]
    public Guid BranchId { get; set; }

    [Column("ward_name")]
    [MaxLength(200)]
    public string WardName { get; set; } = string.Empty;

    [Column("ward_type")]
    [MaxLength(30)]
    public string WardType { get; set; } = string.Empty;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }
}
