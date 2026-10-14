using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface ILabReportCanonicalDocumentService
{
    Task PopulateCanonicalAsync(
        Guid tenantId,
        IReadOnlyList<LabReport> reports,
        CancellationToken cancellationToken = default);

    Task<LabReport> AttachReportAsync(
        Guid tenantId,
        Guid labReportId,
        IFormFile file,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<CanonicalDocumentContent?> OpenContentAsync(
        Guid tenantId,
        Guid labReportId,
        CancellationToken cancellationToken = default);
}

public sealed class LabReportAttachmentConflictException : Exception
{
    public LabReportAttachmentConflictException(Guid existingCanonicalDocumentId)
        : base("This laboratory report already has an attached document.")
    {
        ExistingCanonicalDocumentId = existingCanonicalDocumentId;
    }

    public Guid ExistingCanonicalDocumentId { get; }
}

/// <summary>
/// Lab report file attachment via shared canonical identity. Does not change clinical Status/ReportUrl/results.
/// </summary>
public sealed class LabReportCanonicalDocumentService : ILabReportCanonicalDocumentService
{
    public const string Classification = "LabReport";

    private readonly AppDbContext _db;
    private readonly IBlobStorageService _blob;
    private readonly ICanonicalDocumentIdentityService _identity;

    public LabReportCanonicalDocumentService(
        AppDbContext db,
        IBlobStorageService blob,
        ICanonicalDocumentIdentityService identity)
    {
        _db = db;
        _blob = blob;
        _identity = identity;
    }

    public async Task PopulateCanonicalAsync(
        Guid tenantId,
        IReadOnlyList<LabReport> reports,
        CancellationToken cancellationToken = default)
    {
        if (reports.Count == 0)
            return;

        var ids = reports.Select(r => r.Id).ToList();
        var links = await (
            from association in _db.CanonicalDocumentAssociations.AsNoTracking()
            join document in _db.CanonicalDocuments.AsNoTracking()
                on association.DocumentId equals document.Id
            where association.Domain == CanonicalDocumentAssociations.LabDomain
               && association.EntityType == CanonicalDocumentAssociations.LabReportEntityType
               && ids.Contains(association.EntityId)
               && document.TenantId == tenantId
               && document.DeletedAt == null
               && document.Status == CanonicalDocumentStatuses.Active
            select new
            {
                association.EntityId,
                document.Id,
                document.FileName,
                document.MimeType,
            }).ToListAsync(cancellationToken);

        var byLab = links
            .GroupBy(x => x.EntityId)
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var report in reports)
        {
            if (!byLab.TryGetValue(report.Id, out var link))
                continue;
            report.CanonicalDocumentId = link.Id;
            report.CanonicalFileName = link.FileName;
            report.CanonicalMimeType = link.MimeType;
        }
    }

    public async Task<LabReport> AttachReportAsync(
        Guid tenantId,
        Guid labReportId,
        IFormFile file,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        if (file is null || file.Length <= 0)
            throw new ArgumentException("No file provided.");
        if (file.Length > CanonicalDocumentFileRules.MaxBytes)
            throw new ArgumentException("File exceeds the 20 MB maximum.");

        var report = await _db.LabReports
            .FirstOrDefaultAsync(l => l.Id == labReportId && l.TenantId == tenantId, cancellationToken);
        if (report is null)
            throw new KeyNotFoundException("Lab report not found.");

        var existingLink = await FindActiveAssociationAsync(tenantId, labReportId, cancellationToken);

        await using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();
        var displayName = CanonicalDocumentFileRules.SanitizeDisplayName(file.FileName);
        if (!CanonicalDocumentFileRules.TryDetectMime(bytes, displayName, file.ContentType, out var mime, out var mimeError))
            throw new ArgumentException(mimeError);

        var hash = _identity.ComputeContentHash(bytes);

        if (existingLink is not null)
        {
            if (string.Equals(existingLink.ContentHash, hash, StringComparison.OrdinalIgnoreCase))
            {
                report.CanonicalDocumentId = existingLink.DocumentId;
                report.CanonicalFileName = existingLink.FileName;
                report.CanonicalMimeType = existingLink.MimeType;
                return report;
            }

            throw new LabReportAttachmentConflictException(existingLink.DocumentId);
        }

        var resolved = await _identity.ResolveOrCreateAsync(
            tenantId,
            report.PatientId,
            userId,
            bytes,
            displayName,
            mime,
            Classification,
            cancellationToken);

        await _identity.EnsureAssociationAsync(
            resolved.Document.Id,
            CanonicalDocumentAssociations.LabDomain,
            CanonicalDocumentAssociations.LabReportEntityType,
            report.Id,
            Classification,
            userId,
            cancellationToken: cancellationToken);

        report.CanonicalDocumentId = resolved.Document.Id;
        report.CanonicalFileName = resolved.Document.FileName;
        report.CanonicalMimeType = resolved.Document.MimeType;
        return report;
    }

    public async Task<CanonicalDocumentContent?> OpenContentAsync(
        Guid tenantId,
        Guid labReportId,
        CancellationToken cancellationToken = default)
    {
        var report = await _db.LabReports.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == labReportId && l.TenantId == tenantId, cancellationToken);
        if (report is null)
            return null;

        var resolved = await (
            from association in _db.CanonicalDocumentAssociations.AsNoTracking()
            join document in _db.CanonicalDocuments.AsNoTracking()
                on association.DocumentId equals document.Id
            where association.Domain == CanonicalDocumentAssociations.LabDomain
               && association.EntityType == CanonicalDocumentAssociations.LabReportEntityType
               && association.EntityId == labReportId
               && document.TenantId == tenantId
               && document.PatientId == report.PatientId
               && document.DeletedAt == null
               && (document.Status == CanonicalDocumentStatuses.Active
                   || document.Status == CanonicalDocumentStatuses.Superseded)
            select document).FirstOrDefaultAsync(cancellationToken);

        if (resolved is null)
            return null;

        if (!string.Equals(resolved.StorageContainer, CanonicalDocumentStorage.ContainerName, StringComparison.Ordinal))
            return null;

        var read = await _blob.OpenReadExactAsync(
            resolved.StorageContainer,
            resolved.StorageObjectKey,
            cancellationToken);
        if (read is null)
            return null;

        return new CanonicalDocumentContent(read.Content, resolved.MimeType, resolved.FileName, read.ContentLength);
    }

    private async Task<ExistingLabAttachment?> FindActiveAssociationAsync(
        Guid tenantId,
        Guid labReportId,
        CancellationToken cancellationToken)
    {
        return await (
            from association in _db.CanonicalDocumentAssociations.AsNoTracking()
            join document in _db.CanonicalDocuments.AsNoTracking()
                on association.DocumentId equals document.Id
            where association.Domain == CanonicalDocumentAssociations.LabDomain
               && association.EntityType == CanonicalDocumentAssociations.LabReportEntityType
               && association.EntityId == labReportId
               && document.TenantId == tenantId
               && document.DeletedAt == null
               && document.Status == CanonicalDocumentStatuses.Active
            select new ExistingLabAttachment(
                document.Id,
                document.ContentHash,
                document.FileName,
                document.MimeType)).FirstOrDefaultAsync(cancellationToken);
    }

    private sealed record ExistingLabAttachment(
        Guid DocumentId,
        string ContentHash,
        string FileName,
        string MimeType);
}
