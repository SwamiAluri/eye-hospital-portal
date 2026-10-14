using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuthService.Models.Domain;

[Table("canonical_documents")]
public class CanonicalDocument
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("tenant_id")]
    public Guid TenantId { get; set; }

    [Column("patient_id")]
    public Guid PatientId { get; set; }

    [Column("storage_backend")]
    [MaxLength(50)]
    public string StorageBackend { get; set; } = "azure-blob";

    [Column("storage_container")]
    [MaxLength(100)]
    public string StorageContainer { get; set; } = CanonicalDocumentStorage.ContainerName;

    [Column("storage_object_key")]
    [MaxLength(500)]
    public string StorageObjectKey { get; set; } = string.Empty;

    [Column("file_name")]
    [MaxLength(200)]
    public string FileName { get; set; } = string.Empty;

    [Column("mime_type")]
    [MaxLength(100)]
    public string MimeType { get; set; } = string.Empty;

    [Column("size_bytes")]
    public long SizeBytes { get; set; }

    [Column("content_hash")]
    [MaxLength(64)]
    public string? ContentHash { get; set; }

    [Column("classification")]
    [MaxLength(50)]
    public string Classification { get; set; } = "general";

    [Column("status")]
    [MaxLength(20)]
    public string Status { get; set; } = "active";

    [Column("created_by_user_id")]
    public Guid CreatedByUserId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("deleted_at")]
    public DateTime? DeletedAt { get; set; }

    [Column("superseded_by_document_id")]
    public Guid? SupersededByDocumentId { get; set; }

    public ICollection<CanonicalDocumentAssociation> Associations { get; set; } = new List<CanonicalDocumentAssociation>();
}

[Table("canonical_document_associations")]
public class CanonicalDocumentAssociation
{
    [Column("id")]
    public Guid Id { get; set; }

    [Column("document_id")]
    public Guid DocumentId { get; set; }

    [Column("domain")]
    [MaxLength(50)]
    public string Domain { get; set; } = CanonicalDocumentAssociations.MpiDomain;

    [Column("entity_type")]
    [MaxLength(50)]
    public string EntityType { get; set; } = CanonicalDocumentAssociations.PatientEntityType;

    [Column("entity_id")]
    public Guid EntityId { get; set; }

    [Column("category")]
    [MaxLength(50)]
    public string Category { get; set; } = "general";

    [Column("role")]
    [MaxLength(50)]
    public string Role { get; set; } = "primary";

    [Column("created_by_user_id")]
    public Guid CreatedByUserId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    public CanonicalDocument? Document { get; set; }
}

public static class CanonicalDocumentAssociations
{
    public const string MpiDomain = "mpi";
    public const string PatientEntityType = "patient";

    public const string CounsellingDomain = "counselling";
    public const string CounselingSessionDocumentEntityType = "CounselingSessionDocument";
    /// <summary>Patient-level Counselling document (Patient 360). Not session-owned.</summary>
    public const string CounsellingPatientEntityType = "patient";

    /// <summary>CCMS / Insurance source ownership. Physical blob remains in ccms-documents.</summary>
    public const string CcmsDomain = "ccms";
    public const string CcmsDocumentEntityType = "CcmsDocument";

    /// <summary>Laboratory source ownership. LabReport remains clinical SoT; bytes in patient-documents.</summary>
    public const string LabDomain = "lab";
    public const string LabReportEntityType = "LabReport";

    /// <summary>
    /// Enterprise LMS Official PDF (L-REP-03 CUT B). Distinct from Pathology lab/LabReport.
    /// LaboratoryApi remains LMS artifact SoT; CanonicalDocument is downstream byte store.
    /// </summary>
    public const string EnterpriseLmsDomain = "enterprise_lms";
    public const string LmsReportOfficialPdfArtifactEntityType = "LmsReportOfficialPdfArtifact";
}

public static class CanonicalDocumentStorage
{
    public const string ContainerName = "patient-documents";
    public const string BackendAzureBlob = "azure-blob";

    public static string ObjectKey(Guid tenantId, Guid documentId) =>
        $"{tenantId:N}/{documentId:N}";
}

public static class CanonicalDocumentPermissions
{
    public const string Upload = "patient.patient_document.upload";
    public const string Read = "patient.patient_document.read";
    public const string Download = "patient.patient_document.download";
    public const string Delete = "patient.patient_document.delete";
}

public static class CanonicalDocumentStatuses
{
    public const string Active = "active";
    public const string Superseded = "superseded";
}

public static class CanonicalDocumentDuplicateResolutions
{
    public const string KeepBoth = "keepBoth";
    public const string Replace = "replace";
}
