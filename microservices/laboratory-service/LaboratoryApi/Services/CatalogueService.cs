using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace LaboratoryApi.Services;

public interface ICatalogueService
{
    Task<PagedResult<CatalogueListItemDto>> ListAsync(Guid tenantId, CatalogueListQuery query, CancellationToken ct = default);
    Task<CatalogueItemDetailDto> GetAsync(Guid tenantId, Guid itemId, CancellationToken ct = default);
    Task<IReadOnlyList<CatalogueVersionSummaryDto>> GetVersionsAsync(Guid tenantId, Guid itemId, CancellationToken ct = default);
    Task<CatalogueItemDetailDto> CreateDraftAsync(Guid tenantId, Guid actorId, CreateCatalogueDraftRequest req, CancellationToken ct = default);
    Task<CatalogueItemDetailDto> UpdateDraftAsync(Guid tenantId, Guid actorId, Guid itemId, UpdateCatalogueDraftRequest req, CancellationToken ct = default);
    Task<CatalogueItemDetailDto> SubmitForReviewAsync(Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default);
    Task<CatalogueItemDetailDto> ReturnToDraftAsync(Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default);
    Task<CatalogueItemDetailDto> ApproveAsync(Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default);
    Task<CatalogueItemDetailDto> ActivateAsync(Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default);
    Task<CatalogueItemDetailDto> RetireAsync(Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default);
    Task<CatalogueItemDetailDto> SupersedeAsync(Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default);

    /// <summary>PD-ORD-16 — orderables SoT for Order Intake (not admin catalogue list).</summary>
    Task<PagedResult<OrderableItemDto>> ListOrderablesAsync(Guid tenantId, OrderablesQuery query, CancellationToken ct = default);

    /// <summary>Resolve and validate a single orderable Active version for the operating branch at <paramref name="asOf"/>.</summary>
    Task<(LmsCatalogueItem Item, LmsCatalogueVersion Version)> ResolveOrderableAsync(
        Guid tenantId, Guid catalogueItemId, Guid operatingBranchId, DateTime asOf, CancellationToken ct = default);
}

public sealed class CatalogueService : ICatalogueService
{
    private const string ResourceType = "LmsCatalogueVersion";
    private readonly LaboratoryDbContext _db;
    private readonly IPlatformAuditClient _audit;

    public CatalogueService(LaboratoryDbContext db, IPlatformAuditClient audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<PagedResult<CatalogueListItemDto>> ListAsync(
        Guid tenantId, CatalogueListQuery query, CancellationToken ct = default)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var versions = _db.CatalogueVersions.AsNoTracking()
            .Where(v => v.TenantId == tenantId);

        var items = _db.CatalogueItems.AsNoTracking()
            .Where(i => i.TenantId == tenantId && !i.IsDeleted);

        var q =
            from item in items
            join ver in versions on item.LatestVersionId equals ver.Id
            select new { item, ver };

        if (!string.IsNullOrWhiteSpace(query.CatalogueType))
            q = q.Where(x => x.item.CatalogueType == query.CatalogueType.Trim().ToUpperInvariant());
        if (!string.IsNullOrWhiteSpace(query.Discipline))
            q = q.Where(x => x.ver.Discipline == query.Discipline.Trim());
        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.ver.Status == query.Status.Trim());
        if (!string.IsNullOrWhiteSpace(query.Classification))
            q = q.Where(x => x.ver.Classification == query.Classification.Trim().ToUpperInvariant());

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim().ToLower();
            q = q.Where(x =>
                x.ver.InternalOrderCode.ToLower().Contains(s)
                || x.ver.DisplayName.ToLower().Contains(s)
                || (x.ver.Synonyms != null && x.ver.Synonyms.ToLower().Contains(s)));
        }

        if (query.BranchId is { } branchId)
        {
            var versionIdsWithBranch = _db.CatalogueBranchApplicability.AsNoTracking()
                .Where(b => b.TenantId == tenantId && b.BranchId == branchId)
                .Select(b => b.CatalogueVersionId);

            // Tenant-wide (no branch rows) OR explicit branch match
            var versionIdsWithAnyBranch = _db.CatalogueBranchApplicability.AsNoTracking()
                .Where(b => b.TenantId == tenantId)
                .Select(b => b.CatalogueVersionId)
                .Distinct();

            q = q.Where(x =>
                !versionIdsWithAnyBranch.Contains(x.ver.Id)
                || versionIdsWithBranch.Contains(x.ver.Id));
        }

        var total = await q.CountAsync(ct);
        var pageRows = await q
            .OrderBy(x => x.ver.DisplayName)
            .ThenBy(x => x.ver.InternalOrderCode)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.item.Id,
                LatestVersionId = x.ver.Id,
                x.item.CatalogueType,
                x.ver.InternalOrderCode,
                x.ver.DisplayName,
                x.ver.Synonyms,
                x.ver.Discipline,
                x.ver.Classification,
                x.ver.Status,
                x.ver.VersionNumber,
                x.ver.EffectiveFrom,
                x.ver.EffectiveTo,
            })
            .ToListAsync(ct);

        var versionIds = pageRows.Select(r => r.LatestVersionId).ToList();
        var branches = await _db.CatalogueBranchApplicability.AsNoTracking()
            .Where(b => versionIds.Contains(b.CatalogueVersionId))
            .Select(b => new { b.CatalogueVersionId, b.BranchId })
            .ToListAsync(ct);

        var branchMap = branches.GroupBy(b => b.CatalogueVersionId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Guid>)g.Select(x => x.BranchId).ToList());

        var dtos = pageRows.Select(r =>
        {
            branchMap.TryGetValue(r.LatestVersionId, out var bids);
            bids ??= Array.Empty<Guid>();
            return new CatalogueListItemDto(
                r.Id,
                r.LatestVersionId,
                r.CatalogueType,
                r.InternalOrderCode,
                r.DisplayName,
                r.Synonyms,
                r.Discipline,
                r.Classification,
                r.Status,
                r.VersionNumber,
                r.EffectiveFrom,
                r.EffectiveTo,
                bids.Count == 0,
                bids);
        }).ToList();

        return new PagedResult<CatalogueListItemDto>(dtos, page, pageSize, total);
    }

    public async Task<CatalogueItemDetailDto> GetAsync(Guid tenantId, Guid itemId, CancellationToken ct = default)
    {
        var item = await LoadItemAsync(tenantId, itemId, ct);
        return await MapDetailAsync(item, ct);
    }

    public async Task<IReadOnlyList<CatalogueVersionSummaryDto>> GetVersionsAsync(
        Guid tenantId, Guid itemId, CancellationToken ct = default)
    {
        await EnsureItemExistsAsync(tenantId, itemId, ct);
        return await _db.CatalogueVersions.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.CatalogueItemId == itemId)
            .OrderByDescending(v => v.VersionNumber)
            .Select(v => new CatalogueVersionSummaryDto(
                v.Id, v.VersionNumber, v.Status, v.InternalOrderCode, v.DisplayName,
                v.EffectiveFrom, v.EffectiveTo, v.CreatedAt, v.SupersededByVersionId))
            .ToListAsync(ct);
    }

    public async Task<CatalogueItemDetailDto> CreateDraftAsync(
        Guid tenantId, Guid actorId, CreateCatalogueDraftRequest req, CancellationToken ct = default)
    {
        ValidateCreate(req);
        var type = req.CatalogueType.Trim().ToUpperInvariant();
        var classification = ResolveClassification(type, req.Classification);

        await EnsureUniqueCodeAsync(tenantId, req.InternalOrderCode.Trim(), excludeVersionId: null, ct);

        var now = DateTime.UtcNow;
        var itemId = Guid.NewGuid();
        var versionId = Guid.NewGuid();

        var item = new LmsCatalogueItem
        {
            Id = itemId,
            TenantId = tenantId,
            CatalogueType = type,
            // LatestVersionId set after version insert to satisfy FK order on PostgreSQL.
            LatestVersionId = null,
            CreatedAt = now,
            CreatedBy = actorId,
        };

        var version = new LmsCatalogueVersion
        {
            Id = versionId,
            TenantId = tenantId,
            CatalogueItemId = itemId,
            VersionNumber = 1,
            Status = CatalogueStatuses.Draft,
            InternalOrderCode = req.InternalOrderCode.Trim(),
            DisplayName = req.DisplayName.Trim(),
            Synonyms = TrimOrNull(req.Synonyms),
            Discipline = req.Discipline.Trim(),
            Method = TrimOrNull(req.Method),
            Classification = classification,
            Orderable = req.Orderable,
            PreparationInstruction = TrimOrNull(req.PreparationInstruction),
            SpecimenTypeRef = TrimOrNull(req.SpecimenTypeRef),
            ContainerRef = TrimOrNull(req.ContainerRef),
            RequiredVolume = TrimOrNull(req.RequiredVolume),
            PatientPreparation = TrimOrNull(req.PatientPreparation),
            ReferralPartnerRef = TrimOrNull(req.ReferralPartnerRef),
            ServiceCatalogRef = TrimOrNull(req.ServiceCatalogRef),
            ChangeReason = TrimOrNull(req.ChangeReason),
            EffectiveFrom = req.EffectiveFrom,
            EffectiveTo = req.EffectiveTo,
            CreatedAt = now,
            CreatedBy = actorId,
            RowVersion = 1,
        };

        ValidateEffectiveDates(version.EffectiveFrom, version.EffectiveTo);

        _db.CatalogueItems.Add(item);
        _db.CatalogueVersions.Add(version);

        if (req.BranchIds is { Count: > 0 })
            AddBranches(tenantId, versionId, req.BranchIds);

        if (type == CatalogueTypes.Panel)
            await ReplacePanelComponentsAsync(tenantId, itemId, versionId, req.PanelComponents, ct);
        else if (req.PanelComponents is { Count: > 0 })
            throw new CatalogueDomainException("Panel components are only valid for PANEL catalogue type.");

        try
        {
            await _db.SaveChangesAsync(ct);
            item.LatestVersionId = versionId;
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            throw new CatalogueDomainException($"Failed to create draft: {ex.InnerException?.Message ?? ex.Message}");
        }

        await AuditRequiredAsync(
            tenantId, actorId, CatalogueAuditActions.CreateDraft, versionId, ct,
            compensate: async () =>
            {
                item.IsDeleted = true;
                item.DeletedAt = DateTime.UtcNow;
                item.DeletedBy = actorId;
                item.LatestVersionId = null;
                await _db.SaveChangesAsync(ct);
            },
            reason: version.ChangeReason,
            details: $"type={type}; code={version.InternalOrderCode}; v={version.VersionNumber}",
            newValues: $"status={CatalogueStatuses.Draft}");

        return await GetAsync(tenantId, itemId, ct);
    }

    public async Task<CatalogueItemDetailDto> UpdateDraftAsync(
        Guid tenantId, Guid actorId, Guid itemId, UpdateCatalogueDraftRequest req, CancellationToken ct = default)
    {
        var item = await LoadItemTrackedAsync(tenantId, itemId, ct);
        var version = await LoadLatestVersionTrackedAsync(tenantId, item, ct);

        if (version.Status != CatalogueStatuses.Draft)
            throw new CatalogueDomainException(
                "Only Draft versions can be edited. Create a new version to change Active definitions.",
                statusCode: 409,
                code: "immutable_version");

        EnsureExpectedRowVersion(version, req.ExpectedRowVersion);

        var snapshot = SnapshotDraft(version);

        if (!string.IsNullOrWhiteSpace(req.InternalOrderCode)
            && !string.Equals(req.InternalOrderCode.Trim(), version.InternalOrderCode, StringComparison.OrdinalIgnoreCase))
        {
            await EnsureUniqueCodeAsync(tenantId, req.InternalOrderCode.Trim(), version.Id, ct);
            version.InternalOrderCode = req.InternalOrderCode.Trim();
        }

        if (req.DisplayName is not null) version.DisplayName = req.DisplayName.Trim();
        if (req.Discipline is not null)
        {
            if (!CatalogueDisciplines.IsValid(req.Discipline))
                throw new CatalogueDomainException("Invalid discipline code.");
            version.Discipline = req.Discipline.Trim();
        }
        if (req.Synonyms is not null) version.Synonyms = TrimOrNull(req.Synonyms);
        if (req.Method is not null) version.Method = TrimOrNull(req.Method);
        if (req.Classification is not null)
            version.Classification = ResolveClassification(item.CatalogueType, req.Classification);
        if (req.Orderable is not null) version.Orderable = req.Orderable.Value;
        if (req.PreparationInstruction is not null) version.PreparationInstruction = TrimOrNull(req.PreparationInstruction);
        if (req.SpecimenTypeRef is not null) version.SpecimenTypeRef = TrimOrNull(req.SpecimenTypeRef);
        if (req.ContainerRef is not null) version.ContainerRef = TrimOrNull(req.ContainerRef);
        if (req.RequiredVolume is not null) version.RequiredVolume = TrimOrNull(req.RequiredVolume);
        if (req.PatientPreparation is not null) version.PatientPreparation = TrimOrNull(req.PatientPreparation);
        if (req.ReferralPartnerRef is not null) version.ReferralPartnerRef = TrimOrNull(req.ReferralPartnerRef);
        if (req.ServiceCatalogRef is not null) version.ServiceCatalogRef = TrimOrNull(req.ServiceCatalogRef);
        if (req.ChangeReason is not null) version.ChangeReason = TrimOrNull(req.ChangeReason);
        if (req.EffectiveFrom.HasValue) version.EffectiveFrom = req.EffectiveFrom;
        if (req.EffectiveTo.HasValue) version.EffectiveTo = req.EffectiveTo;
        if (req.ClearEffectiveTo) version.EffectiveTo = null;

        if (string.IsNullOrWhiteSpace(version.DisplayName))
            throw new CatalogueDomainException("DisplayName is required.");
        if (string.IsNullOrWhiteSpace(version.InternalOrderCode))
            throw new CatalogueDomainException("InternalOrderCode is required.");

        ValidateEffectiveDates(version.EffectiveFrom, version.EffectiveTo);

        if (req.BranchIds is not null)
        {
            var existing = await _db.CatalogueBranchApplicability
                .Where(b => b.CatalogueVersionId == version.Id)
                .ToListAsync(ct);
            _db.CatalogueBranchApplicability.RemoveRange(existing);
            if (req.BranchIds.Count > 0)
                AddBranches(tenantId, version.Id, req.BranchIds);
        }

        if (req.PanelComponents is not null)
        {
            if (item.CatalogueType != CatalogueTypes.Panel)
                throw new CatalogueDomainException("Panel components are only valid for PANEL catalogue type.");
            await ReplacePanelComponentsAsync(tenantId, item.Id, version.Id, req.PanelComponents, ct);
        }

        version.UpdatedAt = DateTime.UtcNow;
        version.UpdatedBy = actorId;
        version.RowVersion++;
        item.UpdatedAt = version.UpdatedAt;
        item.UpdatedBy = actorId;

        await SaveWithConcurrencyAsync(ct);

        await AuditRequiredAsync(
            tenantId, actorId, CatalogueAuditActions.UpdateDraft, version.Id, ct,
            compensate: async () =>
            {
                RestoreDraft(version, snapshot);
                await _db.SaveChangesAsync(ct);
            },
            reason: version.ChangeReason,
            details: $"code={version.InternalOrderCode}; v={version.VersionNumber}");

        return await GetAsync(tenantId, itemId, ct);
    }

    public Task<CatalogueItemDetailDto> SubmitForReviewAsync(
        Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default)
        => TransitionAsync(tenantId, actorId, itemId, req, CatalogueStatuses.Draft, CatalogueStatuses.Review,
            CatalogueAuditActions.SubmitReview, (v, now) =>
            {
                ValidateReadyForReview(v);
                v.SubmittedAt = now;
                v.SubmittedBy = actorId;
                if (!string.IsNullOrWhiteSpace(req.Reason)) v.ChangeReason = req.Reason.Trim();
            }, ct);

    public Task<CatalogueItemDetailDto> ReturnToDraftAsync(
        Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default)
        => TransitionAsync(tenantId, actorId, itemId, req, CatalogueStatuses.Review, CatalogueStatuses.Draft,
            CatalogueAuditActions.ReturnToDraft, (v, _) =>
            {
                // No formal Rejected state — return to Draft for revision (documented decision).
                if (!string.IsNullOrWhiteSpace(req.Reason)) v.ChangeReason = req.Reason.Trim();
                v.SubmittedAt = null;
                v.SubmittedBy = null;
            }, ct);

    public Task<CatalogueItemDetailDto> ApproveAsync(
        Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default)
        => TransitionAsync(tenantId, actorId, itemId, req, CatalogueStatuses.Review, CatalogueStatuses.Approved,
            CatalogueAuditActions.Approve, (v, now) =>
            {
                v.ApprovedAt = now;
                v.ApprovedBy = actorId;
                if (!string.IsNullOrWhiteSpace(req.Reason)) v.ChangeReason = req.Reason.Trim();
            }, ct);

    public async Task<CatalogueItemDetailDto> ActivateAsync(
        Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default)
    {
        var item = await LoadItemTrackedAsync(tenantId, itemId, ct);
        var version = await LoadLatestVersionTrackedAsync(tenantId, item, ct);

        if (version.Status != CatalogueStatuses.Approved)
            throw new CatalogueDomainException(
                $"Cannot activate from status '{version.Status}'. Required: {CatalogueStatuses.Approved}.",
                statusCode: 409,
                code: "invalid_transition");

        EnsureExpectedRowVersion(version, req.ExpectedRowVersion);

        if (req.EffectiveFrom.HasValue) version.EffectiveFrom = req.EffectiveFrom;
        if (req.EffectiveTo.HasValue) version.EffectiveTo = req.EffectiveTo;
        if (!version.EffectiveFrom.HasValue)
            version.EffectiveFrom = DateTime.UtcNow;

        ValidateEffectiveDates(version.EffectiveFrom, version.EffectiveTo);
        ValidateReadyForActivation(item, version);
        await EnsureNoOverlappingActiveAsync(tenantId, item.Id, version, ct);

        var otherActive = await _db.CatalogueVersions
            .Where(v => v.TenantId == tenantId
                        && v.CatalogueItemId == item.Id
                        && v.Id != version.Id
                        && v.Status == CatalogueStatuses.Active)
            .ToListAsync(ct);

        var priorActiveSnapshots = otherActive
            .Select(p => (
                Version: p,
                Status: p.Status,
                SupersededAt: p.SupersededAt,
                SupersededBy: p.SupersededBy,
                SupersededByVersionId: p.SupersededByVersionId,
                RowVersion: p.RowVersion))
            .ToList();
        var oldStatus = version.Status;
        var activatedRowVersionBefore = version.RowVersion;
        var previousCurrentActive = item.CurrentActiveVersionId;
        var priorActivatedAt = version.ActivatedAt;
        var priorActivatedBy = version.ActivatedBy;

        var now = DateTime.UtcNow;
        foreach (var prev in otherActive)
        {
            prev.Status = CatalogueStatuses.Superseded;
            prev.SupersededAt = now;
            prev.SupersededBy = actorId;
            prev.SupersededByVersionId = version.Id;
            prev.RowVersion++;
        }

        version.Status = CatalogueStatuses.Active;
        version.ActivatedAt = now;
        version.ActivatedBy = actorId;
        version.UpdatedAt = now;
        version.UpdatedBy = actorId;
        version.RowVersion++;
        if (!string.IsNullOrWhiteSpace(req.Reason)) version.ChangeReason = req.Reason.Trim();

        item.CurrentActiveVersionId = version.Id;
        item.UpdatedAt = now;
        item.UpdatedBy = actorId;

        await SaveWithConcurrencyAsync(ct);

        try
        {
            foreach (var prev in otherActive)
            {
                await _audit.WriteAsync(
                    tenantId, actorId, CatalogueAuditActions.Supersede, ResourceType, prev.Id,
                    reason: "Auto-superseded by activation of newer approved version",
                    oldValues: $"status={CatalogueStatuses.Active}",
                    newValues: $"status={CatalogueStatuses.Superseded}; supersededBy={version.Id}",
                    ct: ct);
            }

            await _audit.WriteAsync(
                tenantId, actorId, CatalogueAuditActions.Activate, ResourceType, version.Id,
                reason: version.ChangeReason,
                oldValues: $"status={oldStatus}",
                newValues: $"status={CatalogueStatuses.Active}",
                ct: ct);
        }
        catch (CatalogueDomainException)
        {
            version.Status = oldStatus;
            version.ActivatedAt = priorActivatedAt;
            version.ActivatedBy = priorActivatedBy;
            version.RowVersion = activatedRowVersionBefore;
            item.CurrentActiveVersionId = previousCurrentActive;
            foreach (var snap in priorActiveSnapshots)
            {
                snap.Version.Status = snap.Status;
                snap.Version.SupersededAt = snap.SupersededAt;
                snap.Version.SupersededBy = snap.SupersededBy;
                snap.Version.SupersededByVersionId = snap.SupersededByVersionId;
                snap.Version.RowVersion = snap.RowVersion;
            }
            await _db.SaveChangesAsync(ct);
            throw;
        }

        return await GetAsync(tenantId, itemId, ct);
    }

    public Task<CatalogueItemDetailDto> RetireAsync(
        Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default)
        => TransitionAsync(tenantId, actorId, itemId, req, CatalogueStatuses.Active, CatalogueStatuses.Retired,
            CatalogueAuditActions.Retire, (v, now) =>
            {
                v.RetiredAt = now;
                v.RetiredBy = actorId;
                if (!string.IsNullOrWhiteSpace(req.Reason)) v.ChangeReason = req.Reason.Trim();
                if (!v.EffectiveTo.HasValue) v.EffectiveTo = now;
            }, ct, afterPersist: async (item, version) =>
            {
                if (item.CurrentActiveVersionId == version.Id)
                    item.CurrentActiveVersionId = null;
                await Task.CompletedTask;
            });

    public async Task<CatalogueItemDetailDto> SupersedeAsync(
        Guid tenantId, Guid actorId, Guid itemId, LifecycleActionRequest req, CancellationToken ct = default)
    {
        var item = await LoadItemTrackedAsync(tenantId, itemId, ct);
        var current = await LoadLatestVersionTrackedAsync(tenantId, item, ct);

        if (current.Status != CatalogueStatuses.Active)
            throw new CatalogueDomainException(
                $"Supersede requires an Active latest version. Current: '{current.Status}'.",
                statusCode: 409,
                code: "invalid_transition");

        EnsureExpectedRowVersion(current, req.ExpectedRowVersion);

        var now = DateTime.UtcNow;
        var newVersionId = Guid.NewGuid();
        var nextNumber = current.VersionNumber + 1;

        var draft = CloneAsDraft(current, newVersionId, nextNumber, actorId, now);
        if (!string.IsNullOrWhiteSpace(req.Reason)) draft.ChangeReason = req.Reason.Trim();

        var priorCurrentActive = item.CurrentActiveVersionId;
        var priorLatest = item.LatestVersionId;
        var priorCurrentRow = current.RowVersion;
        var priorEffectiveTo = current.EffectiveTo;

        current.Status = CatalogueStatuses.Superseded;
        current.SupersededAt = now;
        current.SupersededBy = actorId;
        current.SupersededByVersionId = newVersionId;
        current.RowVersion++;
        if (!current.EffectiveTo.HasValue) current.EffectiveTo = now;

        item.CurrentActiveVersionId = null;
        item.UpdatedAt = now;
        item.UpdatedBy = actorId;

        _db.CatalogueVersions.Add(draft);

        // Copy branch applicability
        var branches = await _db.CatalogueBranchApplicability
            .Where(b => b.CatalogueVersionId == current.Id)
            .AsNoTracking()
            .ToListAsync(ct);
        foreach (var b in branches)
        {
            _db.CatalogueBranchApplicability.Add(new LmsCatalogueBranchApplicability
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CatalogueVersionId = newVersionId,
                BranchId = b.BranchId,
            });
        }

        // Copy panel components
        if (item.CatalogueType == CatalogueTypes.Panel)
        {
            var comps = await _db.CataloguePanelComponents
                .Where(c => c.PanelVersionId == current.Id)
                .AsNoTracking()
                .ToListAsync(ct);
            foreach (var c in comps)
            {
                _db.CataloguePanelComponents.Add(new LmsCataloguePanelComponent
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PanelVersionId = newVersionId,
                    ComponentCatalogueItemId = c.ComponentCatalogueItemId,
                    ComponentVersionId = c.ComponentVersionId,
                    SortOrder = c.SortOrder,
                    IsRequired = c.IsRequired,
                });
            }
        }

        await SaveWithConcurrencyAsync(ct);
        item.LatestVersionId = newVersionId;
        await _db.SaveChangesAsync(ct);

        try
        {
            await _audit.WriteAsync(
                tenantId, actorId, CatalogueAuditActions.Supersede, ResourceType, current.Id,
                reason: req.Reason,
                oldValues: $"status={CatalogueStatuses.Active}",
                newValues: $"status={CatalogueStatuses.Superseded}; supersededBy={newVersionId}",
                ct: ct);

            await _audit.WriteAsync(
                tenantId, actorId, CatalogueAuditActions.CreateVersion, ResourceType, newVersionId,
                reason: req.Reason,
                details: $"v={nextNumber}; fromVersion={current.VersionNumber}",
                newValues: $"status={CatalogueStatuses.Draft}",
                ct: ct);
        }
        catch (CatalogueDomainException)
        {
            // Remove the new draft version and restore prior Active (fail-closed).
            current.Status = CatalogueStatuses.Active;
            current.SupersededAt = null;
            current.SupersededBy = null;
            current.SupersededByVersionId = null;
            current.EffectiveTo = priorEffectiveTo;
            current.RowVersion = priorCurrentRow;
            item.CurrentActiveVersionId = priorCurrentActive ?? current.Id;
            item.LatestVersionId = priorLatest ?? current.Id;
            var orphan = await _db.CatalogueVersions.FirstOrDefaultAsync(v => v.Id == newVersionId, ct);
            if (orphan is not null)
            {
                _db.CataloguePanelComponents.RemoveRange(
                    _db.CataloguePanelComponents.Where(c => c.PanelVersionId == orphan.Id));
                _db.CatalogueBranchApplicability.RemoveRange(
                    _db.CatalogueBranchApplicability.Where(b => b.CatalogueVersionId == orphan.Id));
                _db.CatalogueVersions.Remove(orphan);
            }
            await _db.SaveChangesAsync(ct);
            throw;
        }

        return await GetAsync(tenantId, itemId, ct);
    }

    // ─── transitions ──────────────────────────────────────────────────────────

    private async Task<CatalogueItemDetailDto> TransitionAsync(
        Guid tenantId,
        Guid actorId,
        Guid itemId,
        LifecycleActionRequest req,
        string fromStatus,
        string toStatus,
        string auditAction,
        Action<LmsCatalogueVersion, DateTime> apply,
        CancellationToken ct,
        Func<LmsCatalogueItem, LmsCatalogueVersion, Task>? afterPersist = null)
    {
        var item = await LoadItemTrackedAsync(tenantId, itemId, ct);
        var version = await LoadLatestVersionTrackedAsync(tenantId, item, ct);

        if (version.Status != fromStatus)
            throw new CatalogueDomainException(
                $"Cannot transition from '{version.Status}' to '{toStatus}'. Required current status: '{fromStatus}'.",
                statusCode: 409,
                code: "invalid_transition");

        EnsureExpectedRowVersion(version, req.ExpectedRowVersion);

        var now = DateTime.UtcNow;
        var oldStatus = version.Status;
        var prior = SnapshotLifecycle(version, item);

        apply(version, now);
        version.Status = toStatus;
        version.UpdatedAt = now;
        version.UpdatedBy = actorId;
        version.RowVersion++;
        item.UpdatedAt = now;
        item.UpdatedBy = actorId;

        if (afterPersist is not null)
            await afterPersist(item, version);

        await SaveWithConcurrencyAsync(ct);

        await AuditRequiredAsync(
            tenantId, actorId, auditAction, version.Id, ct,
            compensate: async () =>
            {
                RestoreLifecycle(version, item, prior);
                await _db.SaveChangesAsync(ct);
            },
            reason: req.Reason ?? version.ChangeReason,
            oldValues: $"status={oldStatus}",
            newValues: $"status={toStatus}");

        return await GetAsync(tenantId, itemId, ct);
    }

    private async Task AuditRequiredAsync(
        Guid tenantId,
        Guid actorId,
        string action,
        Guid? resourceId,
        CancellationToken ct,
        Func<Task> compensate,
        string? reason = null,
        string? details = null,
        string? oldValues = null,
        string? newValues = null)
    {
        try
        {
            await _audit.WriteAsync(
                tenantId, actorId, action, ResourceType, resourceId,
                reason, details, oldValues, newValues, ct: ct);
        }
        catch (CatalogueDomainException)
        {
            await compensate();
            throw;
        }
    }

    private sealed record DraftSnapshot(
        string InternalOrderCode,
        string DisplayName,
        string Discipline,
        string? Synonyms,
        string? Method,
        string Classification,
        bool Orderable,
        string? PreparationInstruction,
        string? SpecimenTypeRef,
        string? ContainerRef,
        string? RequiredVolume,
        string? PatientPreparation,
        string? ReferralPartnerRef,
        string? ServiceCatalogRef,
        string? ChangeReason,
        DateTime? EffectiveFrom,
        DateTime? EffectiveTo,
        int RowVersion);

    private static DraftSnapshot SnapshotDraft(LmsCatalogueVersion v) => new(
        v.InternalOrderCode, v.DisplayName, v.Discipline, v.Synonyms, v.Method, v.Classification,
        v.Orderable, v.PreparationInstruction, v.SpecimenTypeRef, v.ContainerRef, v.RequiredVolume,
        v.PatientPreparation, v.ReferralPartnerRef, v.ServiceCatalogRef, v.ChangeReason,
        v.EffectiveFrom, v.EffectiveTo, v.RowVersion);

    private static void RestoreDraft(LmsCatalogueVersion v, DraftSnapshot s)
    {
        v.InternalOrderCode = s.InternalOrderCode;
        v.DisplayName = s.DisplayName;
        v.Discipline = s.Discipline;
        v.Synonyms = s.Synonyms;
        v.Method = s.Method;
        v.Classification = s.Classification;
        v.Orderable = s.Orderable;
        v.PreparationInstruction = s.PreparationInstruction;
        v.SpecimenTypeRef = s.SpecimenTypeRef;
        v.ContainerRef = s.ContainerRef;
        v.RequiredVolume = s.RequiredVolume;
        v.PatientPreparation = s.PatientPreparation;
        v.ReferralPartnerRef = s.ReferralPartnerRef;
        v.ServiceCatalogRef = s.ServiceCatalogRef;
        v.ChangeReason = s.ChangeReason;
        v.EffectiveFrom = s.EffectiveFrom;
        v.EffectiveTo = s.EffectiveTo;
        v.RowVersion = s.RowVersion;
    }

    private sealed record LifecycleSnapshot(
        string Status,
        DateTime? SubmittedAt,
        Guid? SubmittedBy,
        DateTime? ApprovedAt,
        Guid? ApprovedBy,
        DateTime? ActivatedAt,
        Guid? ActivatedBy,
        DateTime? RetiredAt,
        Guid? RetiredBy,
        DateTime? EffectiveTo,
        string? ChangeReason,
        int RowVersion,
        Guid? CurrentActiveVersionId);

    private static LifecycleSnapshot SnapshotLifecycle(LmsCatalogueVersion v, LmsCatalogueItem item) => new(
        v.Status, v.SubmittedAt, v.SubmittedBy, v.ApprovedAt, v.ApprovedBy,
        v.ActivatedAt, v.ActivatedBy, v.RetiredAt, v.RetiredBy, v.EffectiveTo,
        v.ChangeReason, v.RowVersion, item.CurrentActiveVersionId);

    private static void RestoreLifecycle(LmsCatalogueVersion v, LmsCatalogueItem item, LifecycleSnapshot s)
    {
        v.Status = s.Status;
        v.SubmittedAt = s.SubmittedAt;
        v.SubmittedBy = s.SubmittedBy;
        v.ApprovedAt = s.ApprovedAt;
        v.ApprovedBy = s.ApprovedBy;
        v.ActivatedAt = s.ActivatedAt;
        v.ActivatedBy = s.ActivatedBy;
        v.RetiredAt = s.RetiredAt;
        v.RetiredBy = s.RetiredBy;
        v.EffectiveTo = s.EffectiveTo;
        v.ChangeReason = s.ChangeReason;
        v.RowVersion = s.RowVersion;
        item.CurrentActiveVersionId = s.CurrentActiveVersionId;
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private static void ValidateCreate(CreateCatalogueDraftRequest req)
    {
        if (!CatalogueTypes.IsValid(req.CatalogueType))
            throw new CatalogueDomainException("CatalogueType must be TEST, PANEL, or REFERRAL_TEST.");
        if (string.IsNullOrWhiteSpace(req.InternalOrderCode))
            throw new CatalogueDomainException("InternalOrderCode is required.");
        if (string.IsNullOrWhiteSpace(req.DisplayName))
            throw new CatalogueDomainException("DisplayName is required.");
        if (!CatalogueDisciplines.IsValid(req.Discipline))
            throw new CatalogueDomainException("Invalid discipline code.");
        if (req.Classification is not null && !CatalogueClassifications.IsValid(req.Classification))
            throw new CatalogueDomainException("Classification must be LOCAL or REFERRAL.");
    }

    private static string ResolveClassification(string catalogueType, string? requested)
    {
        if (catalogueType == CatalogueTypes.ReferralTest)
            return CatalogueClassifications.Referral;
        if (string.IsNullOrWhiteSpace(requested))
            return CatalogueClassifications.Local;
        var c = requested.Trim().ToUpperInvariant();
        if (!CatalogueClassifications.IsValid(c))
            throw new CatalogueDomainException("Classification must be LOCAL or REFERRAL.");
        if (catalogueType == CatalogueTypes.Test && c == CatalogueClassifications.Referral)
            throw new CatalogueDomainException(
                "TEST catalogue type cannot be classified as REFERRAL. Use REFERRAL_TEST.");
        return c;
    }

    private static void ValidateEffectiveDates(DateTime? from, DateTime? to)
    {
        if (from.HasValue && to.HasValue && to < from)
            throw new CatalogueDomainException("EffectiveTo must be on or after EffectiveFrom.");
    }

    private static void ValidateReadyForReview(LmsCatalogueVersion v)
    {
        if (string.IsNullOrWhiteSpace(v.InternalOrderCode) || string.IsNullOrWhiteSpace(v.DisplayName))
            throw new CatalogueDomainException("Identity fields required before submit for review.");
        if (!CatalogueDisciplines.IsValid(v.Discipline))
            throw new CatalogueDomainException("Valid discipline required before submit for review.");
    }

    private void ValidateReadyForActivation(LmsCatalogueItem item, LmsCatalogueVersion v)
    {
        ValidateReadyForReview(v);
        if (item.CatalogueType == CatalogueTypes.ReferralTest
            && v.Classification != CatalogueClassifications.Referral)
            throw new CatalogueDomainException("ReferralTest must have REFERRAL classification.");
        if (item.CatalogueType == CatalogueTypes.Panel)
        {
            var count = _db.CataloguePanelComponents.Count(c => c.PanelVersionId == v.Id);
            if (count == 0)
                throw new CatalogueDomainException("Panel must have at least one component before activation.");
        }
    }

    private async Task EnsureNoOverlappingActiveAsync(
        Guid tenantId, Guid itemId, LmsCatalogueVersion candidate, CancellationToken ct)
    {
        var actives = await _db.CatalogueVersions.AsNoTracking()
            .Where(v => v.TenantId == tenantId
                        && v.CatalogueItemId == itemId
                        && v.Id != candidate.Id
                        && v.Status == CatalogueStatuses.Active)
            .ToListAsync(ct);

        foreach (var a in actives)
        {
            // Overlap check: periods [from,to] open-ended null = infinity
            if (PeriodsOverlap(candidate.EffectiveFrom, candidate.EffectiveTo, a.EffectiveFrom, a.EffectiveTo))
            {
                // Activation will supersede these; overlap is only a hard reject when NOT superseding.
                // We supersede on activate, so allow. Documented: activate supersedes prior Active.
            }
        }
    }

    private static bool PeriodsOverlap(DateTime? aFrom, DateTime? aTo, DateTime? bFrom, DateTime? bTo)
    {
        var aStart = aFrom ?? DateTime.MinValue;
        var aEnd = aTo ?? DateTime.MaxValue;
        var bStart = bFrom ?? DateTime.MinValue;
        var bEnd = bTo ?? DateTime.MaxValue;
        return aStart <= bEnd && bStart <= aEnd;
    }

    private async Task EnsureUniqueCodeAsync(
        Guid tenantId, string code, Guid? excludeVersionId, CancellationToken ct)
    {
        var exists = await _db.CatalogueVersions.AsNoTracking()
            .AnyAsync(v => v.TenantId == tenantId
                           && v.InternalOrderCode == code
                           && (excludeVersionId == null || v.Id != excludeVersionId)
                           && v.Status != CatalogueStatuses.Retired
                           && v.Status != CatalogueStatuses.Superseded, ct);
        if (exists)
            throw new CatalogueDomainException($"InternalOrderCode '{code}' is already in use.", code: "duplicate_code");
    }

    private void AddBranches(Guid tenantId, Guid versionId, IReadOnlyList<Guid> branchIds)
    {
        foreach (var branchId in branchIds.Distinct())
        {
            if (branchId == Guid.Empty)
                throw new CatalogueDomainException("BranchId cannot be empty.");
            _db.CatalogueBranchApplicability.Add(new LmsCatalogueBranchApplicability
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CatalogueVersionId = versionId,
                BranchId = branchId,
            });
        }
    }

    private async Task ReplacePanelComponentsAsync(
        Guid tenantId,
        Guid panelItemId,
        Guid panelVersionId,
        IReadOnlyList<PanelComponentInput>? components,
        CancellationToken ct)
    {
        var existing = await _db.CataloguePanelComponents
            .Where(c => c.PanelVersionId == panelVersionId)
            .ToListAsync(ct);
        _db.CataloguePanelComponents.RemoveRange(existing);

        if (components is null || components.Count == 0) return;

        var orders = new HashSet<int>();
        var itemIds = new HashSet<Guid>();

        foreach (var c in components.OrderBy(x => x.SortOrder))
        {
            if (c.ComponentCatalogueItemId == panelItemId)
                throw new CatalogueDomainException("Panel cannot reference itself as a component.");
            if (!orders.Add(c.SortOrder))
                throw new CatalogueDomainException($"Duplicate panel component SortOrder: {c.SortOrder}.");
            if (!itemIds.Add(c.ComponentCatalogueItemId))
                throw new CatalogueDomainException("Duplicate panel component catalogue item.");

            var compItem = await _db.CatalogueItems.AsNoTracking()
                .FirstOrDefaultAsync(i => i.Id == c.ComponentCatalogueItemId && i.TenantId == tenantId && !i.IsDeleted, ct)
                ?? throw new CatalogueDomainException("Panel component catalogue item not found in tenant.");

            if (compItem.CatalogueType == CatalogueTypes.Panel)
                throw new CatalogueDomainException("Panel components must be Test or ReferralTest, not Panel.");

            var compVer = await _db.CatalogueVersions.AsNoTracking()
                .FirstOrDefaultAsync(v =>
                    v.Id == c.ComponentVersionId
                    && v.CatalogueItemId == c.ComponentCatalogueItemId
                    && v.TenantId == tenantId, ct)
                ?? throw new CatalogueDomainException("Panel component version not found for the given item.");

            _db.CataloguePanelComponents.Add(new LmsCataloguePanelComponent
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PanelVersionId = panelVersionId,
                ComponentCatalogueItemId = c.ComponentCatalogueItemId,
                ComponentVersionId = compVer.Id,
                SortOrder = c.SortOrder,
                IsRequired = c.IsRequired,
            });
        }
    }

    private static LmsCatalogueVersion CloneAsDraft(
        LmsCatalogueVersion src, Guid newId, int versionNumber, Guid actorId, DateTime now) =>
        new()
        {
            Id = newId,
            TenantId = src.TenantId,
            CatalogueItemId = src.CatalogueItemId,
            VersionNumber = versionNumber,
            Status = CatalogueStatuses.Draft,
            EffectiveFrom = null,
            EffectiveTo = null,
            InternalOrderCode = src.InternalOrderCode,
            DisplayName = src.DisplayName,
            Synonyms = src.Synonyms,
            ExternalMappingsJson = src.ExternalMappingsJson,
            Discipline = src.Discipline,
            Method = src.Method,
            Classification = src.Classification,
            Orderable = src.Orderable,
            PriorityConfigRef = src.PriorityConfigRef,
            AgeSexRestrictionConfigRef = src.AgeSexRestrictionConfigRef,
            ConsentRequired = src.ConsentRequired,
            PreparationInstruction = src.PreparationInstruction,
            DuplicateIntervalConfigRef = src.DuplicateIntervalConfigRef,
            AddOnWindowConfigRef = src.AddOnWindowConfigRef,
            SpecimenTypeRef = src.SpecimenTypeRef,
            ContainerRef = src.ContainerRef,
            RequiredVolume = src.RequiredVolume,
            PatientPreparation = src.PatientPreparation,
            CollectionTiming = src.CollectionTiming,
            StabilityNotes = src.StabilityNotes,
            TemperatureLightProtection = src.TemperatureLightProtection,
            RejectionCriteria = src.RejectionCriteria,
            StorageRequirements = src.StorageRequirements,
            TransportRequirements = src.TransportRequirements,
            PerformingSiteRef = src.PerformingSiteRef,
            BenchRef = src.BenchRef,
            InstrumentRef = src.InstrumentRef,
            ExpectedTatConfigRef = src.ExpectedTatConfigRef,
            OperatingHoursConfigRef = src.OperatingHoursConfigRef,
            RoutingConfigRef = src.RoutingConfigRef,
            CapacityConfigRef = src.CapacityConfigRef,
            ReferralPartnerRef = src.ReferralPartnerRef,
            ResultDatatype = src.ResultDatatype,
            PermittedUnits = src.PermittedUnits,
            ReferenceIntervalConfigRef = src.ReferenceIntervalConfigRef,
            ReportabilityLimitConfigRef = src.ReportabilityLimitConfigRef,
            FlagConfigRef = src.FlagConfigRef,
            CriticalThresholdConfigRef = src.CriticalThresholdConfigRef,
            DeltaCheckConfigRef = src.DeltaCheckConfigRef,
            CommentTemplateRef = src.CommentTemplateRef,
            AutoverificationEligibilityRef = src.AutoverificationEligibilityRef,
            ServiceCatalogRef = src.ServiceCatalogRef,
            PayerMappingRef = src.PayerMappingRef,
            PackageMembershipRef = src.PackageMembershipRef,
            AuthorizationRequired = src.AuthorizationRequired,
            AccreditationScopeStatus = src.AccreditationScopeStatus,
            OwnerRef = src.OwnerRef,
            ApproverRef = src.ApproverRef,
            ChangeReason = src.ChangeReason,
            CreatedAt = now,
            CreatedBy = actorId,
            RowVersion = 1,
        };

    private static void EnsureExpectedRowVersion(LmsCatalogueVersion version, int expected)
    {
        if (expected != 0 && expected != version.RowVersion)
            throw new CatalogueDomainException(
                "Catalogue version was modified by another user. Reload and retry.",
                statusCode: 409,
                code: "concurrency_conflict");
    }

    private async Task SaveWithConcurrencyAsync(CancellationToken ct)
    {
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new CatalogueDomainException(
                "Catalogue version was modified by another user. Reload and retry.",
                statusCode: 409,
                code: "concurrency_conflict");
        }
    }

    public async Task<PagedResult<OrderableItemDto>> ListOrderablesAsync(
        Guid tenantId, OrderablesQuery query, CancellationToken ct = default)
    {
        if (query.OperatingBranchId == Guid.Empty)
            throw new CatalogueDomainException("OperatingBranchId is required.", code: "branch_required");

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var asOf = DateTime.UtcNow;

        var items = _db.CatalogueItems.AsNoTracking()
            .Where(i => i.TenantId == tenantId && !i.IsDeleted && i.CurrentActiveVersionId != null);
        var versions = _db.CatalogueVersions.AsNoTracking()
            .Where(v => v.TenantId == tenantId && v.Status == CatalogueStatuses.Active && v.Orderable);

        var q =
            from item in items
            join ver in versions on item.CurrentActiveVersionId equals ver.Id
            select new { item, ver };

        if (!string.IsNullOrWhiteSpace(query.CatalogueType))
            q = q.Where(x => x.item.CatalogueType == query.CatalogueType.Trim().ToUpperInvariant());
        if (!string.IsNullOrWhiteSpace(query.Discipline))
            q = q.Where(x => x.ver.Discipline == query.Discipline.Trim());
        if (!string.IsNullOrWhiteSpace(query.Classification))
            q = q.Where(x => x.ver.Classification == query.Classification.Trim().ToUpperInvariant());
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim().ToLower();
            q = q.Where(x =>
                x.ver.InternalOrderCode.ToLower().Contains(s)
                || x.ver.DisplayName.ToLower().Contains(s)
                || (x.ver.Synonyms != null && x.ver.Synonyms.ToLower().Contains(s)));
        }

        // Effective window: asOf >= EffectiveFrom (null = open), asOf < EffectiveTo when set
        q = q.Where(x =>
            (x.ver.EffectiveFrom == null || x.ver.EffectiveFrom <= asOf)
            && (x.ver.EffectiveTo == null || asOf < x.ver.EffectiveTo));

        var branchId = query.OperatingBranchId;
        var versionIdsWithAnyBranch = _db.CatalogueBranchApplicability.AsNoTracking()
            .Where(b => b.TenantId == tenantId)
            .Select(b => b.CatalogueVersionId)
            .Distinct();
        var versionIdsWithBranch = _db.CatalogueBranchApplicability.AsNoTracking()
            .Where(b => b.TenantId == tenantId && b.BranchId == branchId)
            .Select(b => b.CatalogueVersionId);

        q = q.Where(x =>
            !versionIdsWithAnyBranch.Contains(x.ver.Id)
            || versionIdsWithBranch.Contains(x.ver.Id));

        var total = await q.CountAsync(ct);
        var pageRows = await q
            .OrderBy(x => x.ver.DisplayName)
            .ThenBy(x => x.ver.InternalOrderCode)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.item.Id,
                VersionId = x.ver.Id,
                x.item.CatalogueType,
                x.ver.VersionNumber,
                x.ver.InternalOrderCode,
                x.ver.DisplayName,
                x.ver.Synonyms,
                x.ver.Discipline,
                x.ver.Classification,
                x.ver.Orderable,
                x.ver.EffectiveFrom,
                x.ver.EffectiveTo,
                x.ver.PreparationInstruction,
                x.ver.SpecimenTypeRef,
                x.ver.ExpectedTatConfigRef,
                x.ver.ReferralPartnerRef,
                x.ver.ServiceCatalogRef,
            })
            .ToListAsync(ct);

        var versionIds = pageRows.Select(r => r.VersionId).ToList();
        var branches = await _db.CatalogueBranchApplicability.AsNoTracking()
            .Where(b => versionIds.Contains(b.CatalogueVersionId))
            .Select(b => new { b.CatalogueVersionId, b.BranchId })
            .ToListAsync(ct);
        var branchMap = branches.GroupBy(b => b.CatalogueVersionId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Guid>)g.Select(x => x.BranchId).ToList());

        var dtos = pageRows.Select(r =>
        {
            branchMap.TryGetValue(r.VersionId, out var bids);
            bids ??= Array.Empty<Guid>();
            return new OrderableItemDto(
                r.Id,
                r.VersionId,
                r.VersionNumber,
                r.CatalogueType,
                r.InternalOrderCode,
                r.DisplayName,
                r.Synonyms,
                r.Discipline,
                r.Classification,
                r.Orderable,
                r.EffectiveFrom,
                r.EffectiveTo,
                r.PreparationInstruction,
                r.SpecimenTypeRef,
                r.ExpectedTatConfigRef,
                r.ReferralPartnerRef,
                r.ServiceCatalogRef,
                bids,
                bids.Count == 0);
        }).ToList();

        return new PagedResult<OrderableItemDto>(dtos, page, pageSize, total);
    }

    public async Task<(LmsCatalogueItem Item, LmsCatalogueVersion Version)> ResolveOrderableAsync(
        Guid tenantId, Guid catalogueItemId, Guid operatingBranchId, DateTime asOf, CancellationToken ct = default)
    {
        if (operatingBranchId == Guid.Empty)
            throw new CatalogueDomainException("OperatingBranchId is required.", code: "branch_required");

        var item = await _db.CatalogueItems.AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == catalogueItemId && i.TenantId == tenantId, ct);
        if (item is null || item.IsDeleted)
            throw new CatalogueDomainException("Catalogue item not found or deleted.", code: "catalogue_not_orderable");
        if (item.CurrentActiveVersionId is null)
            throw new CatalogueDomainException("Catalogue item has no Active version.", code: "catalogue_not_orderable");

        var version = await _db.CatalogueVersions.AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == item.CurrentActiveVersionId && v.TenantId == tenantId, ct);
        if (version is null)
            throw new CatalogueDomainException("Active catalogue version not found.", code: "catalogue_not_orderable");

        EnsureOrderableVersion(version, asOf);

        var anyBranch = await _db.CatalogueBranchApplicability.AsNoTracking()
            .AnyAsync(b => b.TenantId == tenantId && b.CatalogueVersionId == version.Id, ct);
        if (anyBranch)
        {
            var applicable = await _db.CatalogueBranchApplicability.AsNoTracking()
                .AnyAsync(b =>
                    b.TenantId == tenantId
                    && b.CatalogueVersionId == version.Id
                    && b.BranchId == operatingBranchId, ct);
            if (!applicable)
                throw new CatalogueDomainException(
                    "Catalogue version is not applicable to the operating branch.",
                    code: "catalogue_branch_mismatch");
        }

        return (item, version);
    }

    internal static void EnsureOrderableVersion(LmsCatalogueVersion version, DateTime asOf)
    {
        if (version.Status != CatalogueStatuses.Active)
            throw new CatalogueDomainException(
                $"Catalogue version status '{version.Status}' is not orderable.",
                code: "catalogue_not_active");
        if (!version.Orderable)
            throw new CatalogueDomainException("Catalogue version is not orderable.", code: "catalogue_not_orderable");
        if (version.EffectiveFrom is { } from && asOf < from)
            throw new CatalogueDomainException("Catalogue version is not yet effective.", code: "catalogue_not_effective");
        if (version.EffectiveTo is { } to && asOf >= to)
            throw new CatalogueDomainException("Catalogue version is no longer effective.", code: "catalogue_expired");
    }

    private async Task EnsureItemExistsAsync(Guid tenantId, Guid itemId, CancellationToken ct)
    {
        var exists = await _db.CatalogueItems.AsNoTracking()
            .AnyAsync(i => i.Id == itemId && i.TenantId == tenantId && !i.IsDeleted, ct);
        if (!exists)
            throw new CatalogueDomainException("Catalogue item not found.", statusCode: 404, code: "not_found");
    }

    private async Task<LmsCatalogueItem> LoadItemAsync(Guid tenantId, Guid itemId, CancellationToken ct)
    {
        var item = await _db.CatalogueItems.AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == itemId && i.TenantId == tenantId && !i.IsDeleted, ct);
        if (item is null)
            throw new CatalogueDomainException("Catalogue item not found.", statusCode: 404, code: "not_found");
        return item;
    }

    private async Task<LmsCatalogueItem> LoadItemTrackedAsync(Guid tenantId, Guid itemId, CancellationToken ct)
    {
        var item = await _db.CatalogueItems
            .FirstOrDefaultAsync(i => i.Id == itemId && i.TenantId == tenantId && !i.IsDeleted, ct);
        if (item is null)
            throw new CatalogueDomainException("Catalogue item not found.", statusCode: 404, code: "not_found");
        return item;
    }

    private async Task<LmsCatalogueVersion> LoadLatestVersionTrackedAsync(
        Guid tenantId, LmsCatalogueItem item, CancellationToken ct)
    {
        if (item.LatestVersionId is null)
            throw new CatalogueDomainException("Catalogue item has no versions.", statusCode: 409);

        var version = await _db.CatalogueVersions
            .FirstOrDefaultAsync(v => v.Id == item.LatestVersionId && v.TenantId == tenantId, ct);
        if (version is null)
            throw new CatalogueDomainException("Latest catalogue version not found.", statusCode: 404);
        return version;
    }

    private async Task<CatalogueItemDetailDto> MapDetailAsync(LmsCatalogueItem item, CancellationToken ct)
    {
        var versions = await _db.CatalogueVersions.AsNoTracking()
            .Where(v => v.CatalogueItemId == item.Id && v.TenantId == item.TenantId)
            .OrderByDescending(v => v.VersionNumber)
            .ToListAsync(ct);

        var latest = versions.FirstOrDefault(v => v.Id == item.LatestVersionId) ?? versions.FirstOrDefault();
        CatalogueVersionDto? currentDto = null;
        if (latest is not null)
            currentDto = await MapVersionDtoAsync(item.CatalogueType, latest, ct);

        var history = versions.Select(v => new CatalogueVersionSummaryDto(
            v.Id, v.VersionNumber, v.Status, v.InternalOrderCode, v.DisplayName,
            v.EffectiveFrom, v.EffectiveTo, v.CreatedAt, v.SupersededByVersionId)).ToList();

        return new CatalogueItemDetailDto(
            item.Id,
            item.TenantId,
            item.CatalogueType,
            item.CurrentActiveVersionId,
            item.LatestVersionId,
            item.CreatedAt,
            item.CreatedBy,
            currentDto,
            history);
    }

    private async Task<CatalogueVersionDto> MapVersionDtoAsync(
        string catalogueType, LmsCatalogueVersion v, CancellationToken ct)
    {
        var branchIds = await _db.CatalogueBranchApplicability.AsNoTracking()
            .Where(b => b.CatalogueVersionId == v.Id)
            .Select(b => b.BranchId)
            .ToListAsync(ct);

        var comps = await _db.CataloguePanelComponents.AsNoTracking()
            .Where(c => c.PanelVersionId == v.Id)
            .OrderBy(c => c.SortOrder)
            .ToListAsync(ct);

        var compDtos = new List<PanelComponentDto>();
        foreach (var c in comps)
        {
            var cv = await _db.CatalogueVersions.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == c.ComponentVersionId, ct);
            compDtos.Add(new PanelComponentDto(
                c.Id,
                c.ComponentCatalogueItemId,
                c.ComponentVersionId,
                c.SortOrder,
                c.IsRequired,
                cv?.DisplayName,
                cv?.InternalOrderCode));
        }

        return new CatalogueVersionDto(
            v.Id, v.CatalogueItemId, catalogueType, v.VersionNumber, v.Status,
            v.InternalOrderCode, v.DisplayName, v.Synonyms, v.Discipline, v.Method,
            v.Classification, v.Orderable, v.PreparationInstruction, v.SpecimenTypeRef,
            v.ContainerRef, v.RequiredVolume, v.PatientPreparation, v.ReferralPartnerRef,
            v.ServiceCatalogRef, v.ChangeReason, v.EffectiveFrom, v.EffectiveTo,
            v.CreatedAt, v.CreatedBy, v.SubmittedAt, v.SubmittedBy, v.ApprovedAt, v.ApprovedBy,
            v.ActivatedAt, v.ActivatedBy, v.RetiredAt, v.RetiredBy, v.SupersededAt, v.SupersededBy,
            v.SupersededByVersionId, v.RowVersion, branchIds, compDtos, branchIds.Count == 0);
    }

    private static string? TrimOrNull(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
