namespace IpManagementService.Models.Domain;

/// <summary>
/// Represents the pre_op_section_items table.
/// Global defaults have tenant_id = NULL.
/// Tenant-specific items have a non-null tenant_id.
/// </summary>
public class PreOpSectionItem
{
    public Guid     Id                    { get; set; }

    /// <summary>NULL for global defaults; non-null for tenant-specific items.</summary>
    public Guid?    TenantId              { get; set; }

    /// <summary>
    /// Category: Compliance|Investigations|Vitals|Consent|Evaluation|Anaesthesia|Financial|Documents
    /// </summary>
    public string   Category              { get; set; } = string.Empty;

    /// <summary>Unique machine-readable key per item (e.g. "fasting_confirmed").</summary>
    public string   ItemKey               { get; set; } = string.Empty;

    public string   ItemLabel             { get; set; } = string.Empty;
    public string?  Description           { get; set; }
    public string?  DepartmentOwner       { get; set; }
    public bool     IsMandatory           { get; set; } = true;

    /// <summary>If true, "Admit Patient" is blocked until this item is completed.</summary>
    public bool     IsBlocking            { get; set; } = false;

    /// <summary>If true, staff must upload a document file to complete this item.</summary>
    public bool     RequiresDocument      { get; set; } = false;

    /// <summary>Null = apply to all; else "Cash"|"Insurance"|"CGHS"|"ESI"|"Camp" etc.</summary>
    public string?  PatientTypeFilter     { get; set; }

    /// <summary>Reserved for future surgery-type-specific items.</summary>
    public string?  SurgeryTypeFilter     { get; set; }

    public int      DisplayOrder          { get; set; } = 0;
    public bool     IsActive              { get; set; } = true;

    /// <summary>e.g. OUTPATIENT_SAFETY, WARD_CHECKLIST</summary>
    public string?  FormCode              { get; set; }

    /// <summary>e.g. counsellor, ward, ot</summary>
    public string?  FormContext           { get; set; }

    public string?  ResponsibleDepartmentCode { get; set; }

    /// <summary>JSONB — valueType, defaultUnit, isCritical, requiresReport, etc.</summary>
    public string?  ItemConfig              { get; set; }

    public DateTime CreatedAt             { get; set; }
    public DateTime UpdatedAt             { get; set; }
    public DateTime? DeletedAt            { get; set; }
    public string   Status                { get; set; } = "active";
}
