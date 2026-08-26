using IpManagementService.Data;
using IpManagementService.Models.Domain;
using IpManagementService.Models.Dtos;
using Microsoft.EntityFrameworkCore;

namespace IpManagementService.Services;

public class ImplantUsageService
{
    private readonly IpManagementDbContext _db;
    private readonly IIntegrationOutboxService _outbox;
    private readonly JourneyCommandAuthContext _commandAuth;

    public ImplantUsageService(
        IpManagementDbContext db,
        IIntegrationOutboxService outbox,
        JourneyCommandAuthContext? commandAuth = null)
    {
        _db = db;
        _outbox = outbox;
        _commandAuth = commandAuth ?? new JourneyCommandAuthContext();
    }

    public async Task<IReadOnlyList<ImplantUsageDto>> ListAsync(Guid journeyId, Guid tenantId)
    {
        await RequireJourneyAsync(journeyId, tenantId);
        var rows = await _db.JourneyImplantUsages
            .AsNoTracking()
            .Where(u => u.JourneyId == journeyId && u.TenantId == tenantId && u.DeletedAt == null)
            .OrderBy(u => u.ScannedAt)
            .ToListAsync();
        return rows.Select(u => Map(u)).ToList();
    }

    public async Task<ImplantUsageDto> RecordAsync(
        Guid journeyId, Guid tenantId, Guid userId, RecordImplantRequest req)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);
        EnsureRecordableState(journey.ClinicalState);

        var status = NormalizeUsageStatus(req.UsageStatus, allowReversed: false);
        var eye = RequireMatchingEye(req.Eye, journey.EyeOperated);
        RequireReasonUnlessImplanted(status, req.WastageReason);
        if (status == ImplantUsageStatus.Implanted
            && string.IsNullOrWhiteSpace(req.SerialNumber)
            && string.IsNullOrWhiteSpace(req.UdiBarcode))
            throw new ArgumentException("Serial number or UDI barcode is required when status is Implanted.");

        var parsedUdi = Gs1BarcodeParser.Parse(req.UdiBarcode);
        var catalog = await ResolveCatalogAsync(tenantId, req.ItemId, req.CatalogRef);
        if (catalog is null && parsedUdi.Gtin is not null)
            catalog = await ResolveCatalogAsync(tenantId, null, parsedUdi.Gtin);
        if (catalog is null)
            throw new ArgumentException("Catalog is not resolvable. Provide itemId or catalogRef matching the IOL catalog.");

        var (warning, mismatchOverridden) = await EvaluatePlannedLensAsync(journey, tenantId, catalog, status, req);

        var serial = TrimToNull(req.SerialNumber) ?? TrimToNull(parsedUdi.Serial);
        if (status == ImplantUsageStatus.Implanted)
            await EnsureSerialAvailableAsync(tenantId, serial, excludeUsageId: null);

        var now = DateTime.UtcNow;
        var usageId = Guid.NewGuid();
        var chargeStatus = status == ImplantUsageStatus.Implanted
            ? ImplantChargeStatus.Pending
            : ImplantChargeStatus.Suppressed;

        var row = new JourneyImplantUsage
        {
            Id = usageId,
            TenantId = tenantId,
            JourneyId = journeyId,
            PatientId = journey.PatientId,
            Eye = eye,
            ItemId = catalog.Id,
            CatalogRef = TrimToNull(catalog.ProductCode) ?? catalog.Id.ToString("N"),
            Brand = catalog.Brand,
            Model = catalog.ModelName,
            Power = IolDiopter.Round2(req.Power),
            SerialNumber = serial,
            BatchNumber = TrimToNull(req.BatchNumber) ?? TrimToNull(parsedUdi.Lot),
            UdiBarcode = TrimToNull(req.UdiBarcode),
            UsageStatus = status,
            SurgeonUserId = req.SurgeonUserId ?? userId,
            ScannedAt = now,
            ScannedByUserId = userId,
            ChargeStatus = chargeStatus,
            WastageReason = status == ImplantUsageStatus.Implanted ? null : req.WastageReason!.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId,
            UpdatedByUserId = userId,
            Status = "active",
        };
        _db.JourneyImplantUsages.Add(row);

        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.ImplantUsed,
            journeyId,
            ImplantPayload(row, tenantId, mismatchOverridden),
            correlationId: usageId,
            idempotencyKey: $"{IntegrationEventTypes.ImplantUsed}:{usageId:N}");

        AddAudit(journey, userId, "ImplantRecorded", null, status, usageId,
            $"serial={serial ?? "none"}; udi={row.UdiBarcode ?? "none"}; eye={eye}");
        if (mismatchOverridden)
        {
            AddAudit(journey, userId, JourneyClinicalAudit.ImplantMismatchOverridden,
                Truncate(journey.IolPower) ?? Truncate(journey.IolBarcode),
                Truncate(catalog.ModelName),
                usageId,
                req.MismatchReason!.Trim());
        }

        await _db.SaveChangesAsync();
        return Map(row, warning);
    }

    public async Task<ImplantUsageDto> UpdateAsync(
        Guid journeyId, Guid tenantId, Guid userId, Guid usageId, UpdateImplantRequest req)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);
        EnsureCorrectableState(journey.ClinicalState);

        var row = await _db.JourneyImplantUsages.FirstOrDefaultAsync(u =>
            u.Id == usageId && u.JourneyId == journeyId && u.TenantId == tenantId && u.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Implant usage {usageId} not found.");

        var next = NormalizeUsageStatus(req.UsageStatus, allowReversed: true);
        if (next == ImplantUsageStatus.Implanted)
            throw new ArgumentException("Cannot change status back to Implanted. Record a new implant instead.");
        if (row.UsageStatus is ImplantUsageStatus.Reversed or ImplantUsageStatus.Returned
            && next != row.UsageStatus)
            throw new InvalidOperationException($"Usage {row.UsageStatus} cannot transition to {next}.");

        if (string.IsNullOrWhiteSpace(req.Reason) || req.Reason.Trim().Length < 3)
            throw new ArgumentException("Reason is required when correcting implant usage.");

        var previous = row.UsageStatus;
        var now = DateTime.UtcNow;
        row.UsageStatus = next;
        row.WastageReason = req.Reason.Trim();
        row.UpdatedAt = now;
        row.UpdatedByUserId = userId;

        var wasImplanted = previous == ImplantUsageStatus.Implanted;
        var writeOffReturned = ImplantUsageStatus.IsWriteOff(previous)
                               && next == ImplantUsageStatus.Returned;
        if (wasImplanted)
        {
            if (row.ChargeStatus is ImplantChargeStatus.Posted or ImplantChargeStatus.Pending
                or ImplantChargeStatus.Exception or ImplantChargeStatus.CreditPending)
                row.ChargeStatus = ImplantChargeStatus.CreditPending;
        }

        if (wasImplanted || writeOffReturned)
        {
            _outbox.Enqueue(
                tenantId,
                IntegrationEventTypes.ImplantUsageReversed,
                journeyId,
                ImplantPayload(row, tenantId),
                correlationId: row.Id,
                idempotencyKey: $"{IntegrationEventTypes.ImplantUsageReversed}:{row.Id:N}");
        }

        AddAudit(journey, userId, "ImplantUsageUpdated", previous, next, row.Id, req.Reason.Trim());
        await _db.SaveChangesAsync();
        return Map(row);
    }

    /// <summary>
    /// S-08 / OT-020: post-op IOL return writes the implant registry (and outbox),
    /// not only the legacy <c>iol_returns</c> table. Matching Implanted / write-off
    /// rows are corrected in place so stock restore and credit lines fire.
    /// </summary>
    public async Task<ImplantUsageDto> RecordReturnAsync(
        Guid journeyId, Guid tenantId, Guid userId, RecordIolReturnRequest req)
    {
        var journey = await RequireJourneyAsync(journeyId, tenantId);
        EnsureCorrectableState(journey.ClinicalState);
        var reason = (req.Reason ?? "").Trim();
        if (reason.Length < 3)
            throw new ArgumentException("Reason is required when recording an IOL return.");

        var match = await FindReturnMatchAsync(journeyId, tenantId, req);
        if (match is not null)
        {
            return await UpdateAsync(journeyId, tenantId, userId, match.Id, new UpdateImplantRequest
            {
                UsageStatus = ImplantUsageStatus.Returned,
                Reason = reason,
            });
        }

        var barcode = TrimToNull(req.IolBarcode);
        var batch = TrimToNull(req.IolBatch);
        decimal? power = decimal.TryParse(req.IolPower, out var parsed) ? parsed : null;
        var catalog = await ResolveCatalogAsync(tenantId, null, barcode);
        var now = DateTime.UtcNow;
        var usageId = Guid.NewGuid();
        var row = new JourneyImplantUsage
        {
            Id = usageId,
            TenantId = tenantId,
            JourneyId = journeyId,
            PatientId = journey.PatientId,
            Eye = NormalizeEye(journey.EyeOperated) is { Length: > 0 } eye ? eye : "OU",
            ItemId = catalog?.Id,
            CatalogRef = catalog is null ? null : TrimToNull(catalog.ProductCode) ?? catalog.Id.ToString("N"),
            Brand = catalog?.Brand,
            Model = catalog?.ModelName,
            Power = power,
            SerialNumber = barcode,
            BatchNumber = batch,
            UdiBarcode = barcode,
            UsageStatus = ImplantUsageStatus.Returned,
            SurgeonUserId = userId,
            ScannedAt = now,
            ScannedByUserId = userId,
            ChargeStatus = ImplantChargeStatus.Suppressed,
            WastageReason = reason,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedByUserId = userId,
            UpdatedByUserId = userId,
            Status = "active",
        };
        _db.JourneyImplantUsages.Add(row);
        _outbox.Enqueue(
            tenantId,
            IntegrationEventTypes.ImplantUsed,
            journeyId,
            ImplantPayload(row, tenantId),
            correlationId: usageId,
            idempotencyKey: $"{IntegrationEventTypes.ImplantUsed}:{usageId:N}");
        AddAudit(journey, userId, "ImplantRecorded", null, ImplantUsageStatus.Returned, usageId,
            $"return; serial={barcode ?? "none"}; batch={batch ?? "none"}");
        await _db.SaveChangesAsync();
        return Map(row);
    }

    /// <summary>
    /// Backward-compatible verify: resolve IOL catalog and refresh identity on an existing
    /// registry row. Does not insert Implanted or emit ImplantUsed — Record is the charge trigger.
    /// </summary>
    public async Task<VerifyIolBarcodeResponse> ResolveBarcodeAsync(
        Guid journeyId, Guid tenantId, Guid userId, string barcode, VerifyIolBarcodeResponse flags)
    {
        var parsed = Gs1BarcodeParser.Parse(barcode);
        if (!flags.IsValid)
        {
            return flags with
            {
                Gtin = flags.Gtin ?? parsed.Gtin,
                Serial = flags.Serial ?? parsed.Serial,
                Lot = flags.Lot ?? parsed.Lot,
                Expiry = flags.Expiry ?? parsed.ExpiryIso,
                Symbology = flags.Symbology ?? parsed.Symbology,
                Message = flags.Message ?? Gs1BarcodeParser.UnreadableMessage,
            };
        }

        var trimmed = barcode.Trim();
        var catalog = await ResolveCatalogFromScanAsync(tenantId, trimmed, parsed);

        var existing = await _db.JourneyImplantUsages
            .Where(u => u.JourneyId == journeyId && u.TenantId == tenantId && u.DeletedAt == null
                        && (u.UdiBarcode == trimmed
                            || (parsed.Serial != null && u.SerialNumber == parsed.Serial)))
            .OrderByDescending(u => u.ScannedAt)
            .FirstOrDefaultAsync();

        if (existing is not null && catalog is not null)
        {
            existing.ItemId = catalog.Id;
            existing.CatalogRef = TrimToNull(catalog.ProductCode) ?? catalog.Id.ToString("N");
            existing.Brand = catalog.Brand;
            existing.Model = catalog.ModelName;
            existing.UpdatedAt = DateTime.UtcNow;
            existing.UpdatedByUserId = userId;
            await _db.SaveChangesAsync();
        }

        var label = catalog is null
            ? flags.CatalogEntry
            : $"{catalog.Brand} {catalog.ModelName}".Trim();
        var message = catalog is null
            ? (flags.Message ?? "Barcode format valid. Confirm catalog on Record implant.")
            : $"Resolved {label}.";

        return new VerifyIolBarcodeResponse(
            IsValid: true,
            CatalogEntry: label,
            Message: message,
            CatalogId: catalog?.Id,
            Brand: catalog?.Brand,
            Model: catalog?.ModelName,
            ProductCode: catalog?.ProductCode,
            ExistingUsageId: existing?.Id,
            Gtin: parsed.Gtin ?? flags.Gtin,
            Serial: parsed.Serial ?? flags.Serial,
            Lot: parsed.Lot ?? flags.Lot,
            Expiry: parsed.ExpiryIso ?? flags.Expiry,
            Symbology: parsed.Parsed ? parsed.Symbology : (flags.Symbology ?? "raw"));
    }

    internal static string NormalizeEye(string? value)
    {
        var raw = (value ?? "").Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(raw)) return string.Empty;
        if (raw is "OD" or "OS" or "OU") return raw;
        if (raw is "RE" || raw.Contains("RIGHT", StringComparison.Ordinal)) return "OD";
        if (raw is "LE" || raw.Contains("LEFT", StringComparison.Ordinal)) return "OS";
        if (raw is "BOTH" || raw.Contains("BILAT", StringComparison.Ordinal)) return "OU";
        return raw;
    }

    private async Task<PatientJourney> RequireJourneyAsync(Guid journeyId, Guid tenantId)
        => await _db.PatientJourneys.FirstOrDefaultAsync(j =>
               j.Id == journeyId && j.TenantId == tenantId && j.DeletedAt == null)
           ?? throw new KeyNotFoundException($"PatientJourney {journeyId} not found.");

    private static void EnsureRecordableState(string? clinicalState)
    {
        if (clinicalState is ClinicalState.InOT or ClinicalState.SurgeryCompleted)
            return;
        throw new ArgumentException("Implants can only be recorded while the journey is InOT or SurgeryCompleted.");
    }

    private static void EnsureCorrectableState(string? clinicalState)
    {
        if (clinicalState is ClinicalState.InOT
            or ClinicalState.SurgeryCompleted
            or ClinicalState.PostOp
            or ClinicalState.ReadyForDischarge)
            return;
        throw new ArgumentException(
            "Implant returns and corrections are only allowed while the journey is In OT, surgery completed, post-op, or ready for discharge.");
    }

    private async Task<JourneyImplantUsage?> FindReturnMatchAsync(
        Guid journeyId, Guid tenantId, RecordIolReturnRequest req)
    {
        var open = _db.JourneyImplantUsages.Where(u =>
            u.JourneyId == journeyId && u.TenantId == tenantId && u.DeletedAt == null
            && u.UsageStatus != ImplantUsageStatus.Returned
            && u.UsageStatus != ImplantUsageStatus.Reversed);

        var barcode = TrimToNull(req.IolBarcode);
        if (barcode is not null)
        {
            var byCode = await open
                .Where(u => u.UdiBarcode == barcode || u.SerialNumber == barcode)
                .OrderByDescending(u => u.ScannedAt)
                .FirstOrDefaultAsync();
            if (byCode is not null) return byCode;
        }

        var batch = TrimToNull(req.IolBatch);
        if (batch is not null)
        {
            var byBatch = await open
                .Where(u => u.BatchNumber == batch)
                .OrderByDescending(u => u.ScannedAt)
                .FirstOrDefaultAsync();
            if (byBatch is not null) return byBatch;
        }

        var candidates = await open
            .Where(u => u.UsageStatus == ImplantUsageStatus.Implanted
                        || u.UsageStatus == ImplantUsageStatus.OpenedUnused)
            .OrderByDescending(u => u.ScannedAt)
            .ToListAsync();
        return candidates.Count == 1 ? candidates[0] : null;
    }

    private static string RequireMatchingEye(string? requestEye, string? journeyEye)
    {
        var eye = NormalizeEye(requestEye);
        if (string.IsNullOrEmpty(eye))
            throw new ArgumentException("Eye is required.");
        var scheduled = NormalizeEye(journeyEye);
        if (string.IsNullOrEmpty(scheduled) || scheduled == "OU")
            return eye;
        if (!string.Equals(eye, scheduled, StringComparison.Ordinal))
            throw new ArgumentException(
                $"This implant is marked {eye}, the operating eye is {scheduled}. Recording is blocked.");
        return eye;
    }

    /// <summary>
    /// W-07 A2. Eye already hard-blocked. Power/model compare is Implanted-only.
    /// Empty planned power warns and allows. Catalog 0.50 D step is not a tolerance.
    /// </summary>
    private async Task<(string? Warning, bool MismatchOverridden)> EvaluatePlannedLensAsync(
        PatientJourney journey, Guid tenantId, IolCatalogMaster catalog, string status, RecordImplantRequest req)
    {
        if (status != ImplantUsageStatus.Implanted)
            return (null, false);

        var plannedPower = IolDiopter.Parse(journey.IolPower);
        var scannedPower = IolDiopter.Round2(req.Power);
        string? warning = null;
        var parts = new List<string>();

        if (plannedPower is null)
        {
            warning = scannedPower is decimal shown
                ? $"No planned IOL power is on this journey. Confirm {IolDiopter.Format(shown)} with the surgeon."
                : "No planned IOL power is on this journey. Confirm the lens power with the surgeon.";
        }
        else if (scannedPower is null)
        {
            throw new ArgumentException("Power is required.");
        }
        else if (IolDiopter.Differs(scannedPower.Value, plannedPower.Value))
        {
            parts.Add($"This lens is {IolDiopter.Format(scannedPower.Value)}. The planned power is {IolDiopter.Format(plannedPower.Value)}.");
        }

        var plannedCatalog = await ResolvePlannedCatalogAsync(tenantId, journey);
        if (plannedCatalog is not null && !SameLensModel(plannedCatalog, catalog))
        {
            parts.Add($"This lens is {catalog.ModelName}. The planned model is {plannedCatalog.ModelName}.");
        }

        if (parts.Count == 0)
            return (warning, false);

        if (!req.AcknowledgeMismatch)
            throw new InvalidOperationException(string.Join(" ", parts));

        var reason = (req.MismatchReason ?? "").Trim();
        if (reason.Length < 10)
            throw new ArgumentException("Override reason is required (minimum 10 characters).");

        _commandAuth.RequireImplantMismatchOverride();
        return (warning, true);
    }

    private async Task<IolCatalogMaster?> ResolvePlannedCatalogAsync(Guid tenantId, PatientJourney journey)
    {
        var raw = TrimToNull(journey.IolBarcode);
        if (raw is null) return null;
        var byRef = await ResolveCatalogAsync(tenantId, null, raw);
        if (byRef is not null) return byRef;

        var needle = IolDiopter.NormalizeModel(raw);
        var rows = await _db.IolCatalogMaster.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && c.IsActive)
            .ToListAsync();
        return rows.FirstOrDefault(c =>
            string.Equals(IolDiopter.NormalizeModel(c.ModelName), needle, StringComparison.OrdinalIgnoreCase)
            || string.Equals(IolDiopter.NormalizeModel(c.ProductCode), needle, StringComparison.OrdinalIgnoreCase));
    }

    private static bool SameLensModel(IolCatalogMaster planned, IolCatalogMaster scanned)
    {
        if (planned.Id == scanned.Id) return true;
        var a = IolDiopter.NormalizeModel(planned.ModelName);
        var b = IolDiopter.NormalizeModel(scanned.ModelName);
        if (a.Length > 0 && string.Equals(a, b, StringComparison.OrdinalIgnoreCase))
            return true;
        var pa = IolDiopter.NormalizeModel(planned.ProductCode);
        var pb = IolDiopter.NormalizeModel(scanned.ProductCode);
        return pa.Length > 0 && string.Equals(pa, pb, StringComparison.OrdinalIgnoreCase);
    }

    private static void RequireReasonUnlessImplanted(string status, string? reason)
    {
        if (status == ImplantUsageStatus.Implanted)
            return;
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 3)
            throw new ArgumentException("Wastage reason is required unless status is Implanted.");
    }

    private static string NormalizeUsageStatus(string? raw, bool allowReversed)
    {
        var v = (raw ?? "").Trim();
        if (string.Equals(v, "OpenedUnused", StringComparison.OrdinalIgnoreCase)
            || string.Equals(v, "Opened, not used", StringComparison.OrdinalIgnoreCase)
            || string.Equals(v, "Opened_Unused", StringComparison.OrdinalIgnoreCase))
            return ImplantUsageStatus.OpenedUnused;
        if (ImplantUsageStatus.All.Contains(v))
        {
            if (v == ImplantUsageStatus.Reversed && !allowReversed)
                throw new ArgumentException("Reversed is only valid as a correction of an existing Implanted row.");
            return v;
        }
        throw new ArgumentException($"Unknown usage status '{raw}'.");
    }

    private async Task EnsureSerialAvailableAsync(Guid tenantId, string? serial, Guid? excludeUsageId)
    {
        if (string.IsNullOrWhiteSpace(serial))
            return;
        var taken = await _db.JourneyImplantUsages.AnyAsync(u =>
            u.TenantId == tenantId
            && u.SerialNumber == serial
            && u.UsageStatus == ImplantUsageStatus.Implanted
            && u.DeletedAt == null
            && (excludeUsageId == null || u.Id != excludeUsageId));
        if (taken)
            throw new InvalidOperationException($"Serial {serial} is already recorded as implanted.");
    }

    private async Task<IolCatalogMaster?> ResolveCatalogAsync(Guid tenantId, Guid? itemId, string? catalogRef)
    {
        var q = _db.IolCatalogMaster.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.DeletedAt == null && c.IsActive);
        if (itemId is Guid id && id != Guid.Empty)
            return await q.FirstOrDefaultAsync(c => c.Id == id);

        var raw = catalogRef?.Trim();
        if (string.IsNullOrWhiteSpace(raw))
            return null;
        if (Guid.TryParse(raw, out var asGuid))
            return await q.FirstOrDefaultAsync(c => c.Id == asGuid);
        return await q.FirstOrDefaultAsync(c => c.ProductCode == raw);
    }

    private async Task<IolCatalogMaster?> ResolveCatalogFromScanAsync(
        Guid tenantId, string raw, Gs1BarcodeParser.Result parsed)
    {
        var keys = new List<string>();
        if (!string.IsNullOrEmpty(parsed.Gtin))
        {
            keys.Add(parsed.Gtin);
            if (parsed.Gtin.Length == 14 && parsed.Gtin.StartsWith('0'))
                keys.Add(parsed.Gtin[1..]);
        }
        keys.Add(raw);
        foreach (var key in keys.Distinct(StringComparer.Ordinal))
        {
            var hit = await ResolveCatalogAsync(tenantId, null, key);
            if (hit is not null) return hit;
        }
        return null;
    }

    private void AddAudit(
        PatientJourney journey, Guid userId, string action, string? oldValue, string? newValue, Guid usageId, string notes)
    {
        _db.JourneyAuditLogs.Add(new JourneyAuditLog
        {
            TenantId = journey.TenantId,
            PatientJourneyId = journey.Id,
            Action = action,
            StateType = "Implant",
            OldValue = Truncate(oldValue),
            NewValue = Truncate(newValue),
            Notes = notes.Length > 2000 ? notes[..2000] : notes,
            CorrelationId = usageId,
            PerformedByUserId = userId,
            PerformedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Status = "active",
        });
    }

    private static object ImplantPayload(JourneyImplantUsage row, Guid tenantId, bool mismatchOverridden = false) => new
    {
        tenantId,
        journeyId = row.JourneyId,
        implantUsageId = row.Id,
        itemId = row.ItemId,
        catalogRef = row.CatalogRef,
        serialNumber = row.SerialNumber,
        batchNumber = row.BatchNumber,
        udiBarcode = row.UdiBarcode,
        power = row.Power,
        eye = row.Eye,
        usageStatus = row.UsageStatus,
        chargeStatus = row.ChargeStatus,
        actorUserId = row.UpdatedByUserId ?? row.ScannedByUserId,
        mismatchOverridden,
    };

    private static ImplantUsageDto Map(JourneyImplantUsage u, string? warning = null) => new(
        u.Id, u.JourneyId, u.PatientId, u.Eye, u.ItemId, u.CatalogRef, u.Brand, u.Model,
        u.Power, u.SerialNumber, u.BatchNumber, u.UdiBarcode, u.UsageStatus,
        u.SurgeonUserId, u.ScannedAt, u.ScannedByUserId, u.ChargeItemId, u.ChargeStatus, u.WastageReason,
        warning);

    private static string? TrimToNull(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? Truncate(string? value)
        => value is null || value.Length <= 50 ? value : value[..50];
}
