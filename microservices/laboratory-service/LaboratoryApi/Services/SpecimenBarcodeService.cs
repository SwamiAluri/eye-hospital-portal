using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LaboratoryApi.Data;
using LaboratoryApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace LaboratoryApi.Services;

public interface ISpecimenBarcodeService
{
    Task<SpecimenBarcodeDto?> GetBarcodeAsync(Guid tenantId, Guid specimenId, CancellationToken ct = default);
    Task<SpecimenBarcodeDto> AssignBarcodeAsync(
        Guid tenantId, Guid actorId, Guid specimenId, AssignBarcodeRequest req, CancellationToken ct = default);
    Task<SpecimenLabelPayloadDto> PrintLabelAsync(
        Guid tenantId, Guid actorId, Guid specimenId, PrintSpecimenLabelRequest req, CancellationToken ct = default);
    Task<SpecimenLabelPayloadDto> ReprintLabelAsync(
        Guid tenantId, Guid actorId, Guid specimenId, ReprintSpecimenLabelRequest req, CancellationToken ct = default);
}

/// <summary>L-COL-01E barcode allocation + label print/reprint. Does not alter Receive/Reject/Complete Collection.</summary>
public sealed class SpecimenBarcodeService : ISpecimenBarcodeService
{
    private readonly LaboratoryDbContext _db;
    private readonly IPlatformAuditClient _audit;
    private readonly IPlatformReferenceClient _platform;
    private static readonly JsonSerializerOptions JsonOpts = HttpRequestDataExtensions.JsonOpts;
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> SequenceGates = new();

    public SpecimenBarcodeService(
        LaboratoryDbContext db, IPlatformAuditClient audit, IPlatformReferenceClient platform)
    {
        _db = db;
        _audit = audit;
        _platform = platform;
    }

    public async Task<SpecimenBarcodeDto?> GetBarcodeAsync(
        Guid tenantId, Guid specimenId, CancellationToken ct = default)
    {
        await EnsureSpecimenAsync(tenantId, specimenId, ct);
        var barcode = await ActiveBarcodeAsync(tenantId, specimenId, ct);
        if (barcode is null) return null;
        var specimen = await _db.Specimens.AsNoTracking()
            .FirstAsync(s => s.Id == specimenId && s.TenantId == tenantId, ct);
        return MapBarcode(barcode, specimen.RowVersion);
    }

    public async Task<SpecimenBarcodeDto> AssignBarcodeAsync(
        Guid tenantId, Guid actorId, Guid specimenId, AssignBarcodeRequest req, CancellationToken ct = default)
    {
        var hash = HashRequest(new
        {
            specimenId,
            req.ExpectedRowVersion,
            req.OperatingBranchId,
        });
        var idem = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, SpecimenBarcodeIdempotencyOps.AssignBarcode, hash, ct);
        if (idem.ReplayJson is not null)
            return DeserializeRequired<SpecimenBarcodeDto>(idem.ReplayJson);

        var completed = false;
        Guid? createdBarcodeId = null;
        try
        {
            _db.ChangeTracker.Clear();
            ValidateBranchRequired(req.OperatingBranchId);
            await ValidateBranchAsync(tenantId, actorId, req.OperatingBranchId, ct);

            var specimen = await LoadSpecimenForMutationAsync(tenantId, specimenId, req.ExpectedRowVersion, ct);
            if (await ActiveBarcodeAsync(tenantId, specimenId, ct) is not null)
                throw new SpecimenDomainException(
                    "Specimen already has an active barcode.", statusCode: 409, code: "barcode_already_exists");

            var barcode = await AllocateAndPersistBarcodeAsync(tenantId, actorId, specimen, ct);
            createdBarcodeId = barcode.Id;

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, SpecimenBarcodeAuditActions.CreateSpecimenBarcode,
                    SpecimenAuditResourceTypes.Specimen, specimenId, ct: ct,
                    newValues: $"barcode={barcode.BarcodeValue}; symbology={barcode.Symbology}");
            }
            catch (CatalogueDomainException)
            {
                await RevertBarcodeAsync(tenantId, barcode.Id, ct);
                throw new SpecimenDomainException(
                    "Specimen mutation aborted: platform audit write failed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            var dto = MapBarcode(barcode, specimen.RowVersion);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, specimenId, dto, ct);
            completed = true;
            return dto;
        }
        finally
        {
            if (!completed)
            {
                if (createdBarcodeId is { } bid)
                    await TryDeleteBarcodeAsync(tenantId, bid, ct);
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
            }
        }
    }

    public async Task<SpecimenLabelPayloadDto> PrintLabelAsync(
        Guid tenantId, Guid actorId, Guid specimenId, PrintSpecimenLabelRequest req, CancellationToken ct = default)
    {
        var hash = HashRequest(new
        {
            specimenId,
            req.ExpectedRowVersion,
            req.OperatingBranchId,
        });
        var idem = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, SpecimenBarcodeIdempotencyOps.PrintLabel, hash, ct);
        if (idem.ReplayJson is not null)
            return DeserializeRequired<SpecimenLabelPayloadDto>(idem.ReplayJson);

        var completed = false;
        Guid? createdBarcodeId = null;
        Guid? createdPrintId = null;
        try
        {
            _db.ChangeTracker.Clear();
            ValidateBranchRequired(req.OperatingBranchId);
            await ValidateBranchAsync(tenantId, actorId, req.OperatingBranchId, ct);

            var specimen = await LoadSpecimenForMutationAsync(tenantId, specimenId, req.ExpectedRowVersion, ct);
            var barcode = await ActiveBarcodeAsync(tenantId, specimenId, ct);
            var createdNow = false;
            if (barcode is null)
            {
                barcode = await AllocateAndPersistBarcodeAsync(tenantId, actorId, specimen, ct);
                createdBarcodeId = barcode.Id;
                createdNow = true;
                try
                {
                    await _audit.WriteAsync(
                        tenantId, actorId, SpecimenBarcodeAuditActions.CreateSpecimenBarcode,
                        SpecimenAuditResourceTypes.Specimen, specimenId, ct: ct,
                        newValues: $"barcode={barcode.BarcodeValue}; symbology={barcode.Symbology}; via=print_label");
                }
                catch (CatalogueDomainException)
                {
                    await RevertBarcodeAsync(tenantId, barcode.Id, ct);
                    throw new SpecimenDomainException(
                        "Specimen mutation aborted: platform audit write failed.",
                        statusCode: 503, code: "audit_unavailable");
                }
            }

            var printEvent = await AppendPrintEventAsync(
                tenantId, actorId, specimen, barcode, SpecimenLabelPrintTypes.Print, reason: null, ct);
            createdPrintId = printEvent.Id;

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, SpecimenBarcodeAuditActions.PrintSpecimenLabel,
                    SpecimenAuditResourceTypes.Specimen, specimenId, ct: ct,
                    newValues: $"barcode={barcode.BarcodeValue}; printEventId={printEvent.Id}");
            }
            catch (CatalogueDomainException)
            {
                await RevertPrintEventAsync(tenantId, printEvent.Id, ct);
                if (createdNow && createdBarcodeId is { } bid)
                    await RevertBarcodeAsync(tenantId, bid, ct);
                throw new SpecimenDomainException(
                    "Specimen mutation aborted: platform audit write failed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            var payload = await BuildLabelPayloadAsync(tenantId, specimen, barcode, printEvent, ct);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, specimenId, payload, ct);
            completed = true;
            return payload;
        }
        finally
        {
            if (!completed)
            {
                if (createdPrintId is { } pid)
                    await TryDeletePrintEventAsync(tenantId, pid, ct);
                if (createdBarcodeId is { } bid)
                    await TryDeleteBarcodeAsync(tenantId, bid, ct);
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
            }
        }
    }

    public async Task<SpecimenLabelPayloadDto> ReprintLabelAsync(
        Guid tenantId, Guid actorId, Guid specimenId, ReprintSpecimenLabelRequest req, CancellationToken ct = default)
    {
        var reason = (req.Reason ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(reason))
            throw new SpecimenDomainException("Reprint reason is required.", code: "reprint_reason_required");
        if (reason.Length > 500)
            throw new SpecimenDomainException("Reprint reason is too long.", code: "reprint_reason_invalid");

        var hash = HashRequest(new
        {
            specimenId,
            req.ExpectedRowVersion,
            req.OperatingBranchId,
            Reason = reason,
        });
        var idem = await ClaimIdempotencyAsync(
            tenantId, req.IdempotencyKey, SpecimenBarcodeIdempotencyOps.ReprintLabel, hash, ct);
        if (idem.ReplayJson is not null)
            return DeserializeRequired<SpecimenLabelPayloadDto>(idem.ReplayJson);

        var completed = false;
        Guid? createdPrintId = null;
        try
        {
            _db.ChangeTracker.Clear();
            ValidateBranchRequired(req.OperatingBranchId);
            await ValidateBranchAsync(tenantId, actorId, req.OperatingBranchId, ct);

            var specimen = await LoadSpecimenForMutationAsync(tenantId, specimenId, req.ExpectedRowVersion, ct);
            var barcode = await ActiveBarcodeAsync(tenantId, specimenId, ct)
                ?? throw new SpecimenDomainException(
                    "Specimen has no barcode to reprint.", statusCode: 400, code: "barcode_missing");

            var printEvent = await AppendPrintEventAsync(
                tenantId, actorId, specimen, barcode, SpecimenLabelPrintTypes.Reprint, reason, ct);
            createdPrintId = printEvent.Id;

            try
            {
                await _audit.WriteAsync(
                    tenantId, actorId, SpecimenBarcodeAuditActions.ReprintSpecimenLabel,
                    SpecimenAuditResourceTypes.Specimen, specimenId, reason: reason, ct: ct,
                    newValues: $"barcode={barcode.BarcodeValue}; printEventId={printEvent.Id}");
            }
            catch (CatalogueDomainException)
            {
                await RevertPrintEventAsync(tenantId, printEvent.Id, ct);
                throw new SpecimenDomainException(
                    "Specimen mutation aborted: platform audit write failed.",
                    statusCode: 503, code: "audit_unavailable");
            }

            var payload = await BuildLabelPayloadAsync(tenantId, specimen, barcode, printEvent, ct);
            await CompleteIdempotencyAsync(tenantId, idem.ClaimId, specimenId, payload, ct);
            completed = true;
            return payload;
        }
        finally
        {
            if (!completed)
            {
                if (createdPrintId is { } pid)
                    await TryDeletePrintEventAsync(tenantId, pid, ct);
                await ReleaseIdempotencyClaimAsync(tenantId, idem.ClaimId, ct);
            }
        }
    }

    private async Task<LmsSpecimenBarcode> AllocateAndPersistBarcodeAsync(
        Guid tenantId, Guid actorId, LmsSpecimen specimen, CancellationToken ct)
    {
        var config = await ResolveActiveConfigurationAsync(tenantId, DateTime.UtcNow, ct);
        var (value, _) = await AllocateBarcodeValueAsync(tenantId, DateTime.UtcNow, ct);
        var now = DateTime.UtcNow;
        var barcode = new LmsSpecimenBarcode
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SpecimenId = specimen.Id,
            BarcodeValue = value,
            ConfigurationId = config.Id,
            FormatCode = config.FormatCode,
            Symbology = config.Symbology,
            IssuedAtUtc = now,
            IssuedByUserId = actorId,
            IsActive = true,
            RowVersion = 1,
        };
        _db.SpecimenBarcodes.Add(barcode);
        specimen.UpdatedAt = now;
        specimen.UpdatedBy = actorId;
        specimen.RowVersion++;
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new SpecimenDomainException(
                "Specimen was modified by another user. Reload and retry.",
                statusCode: 409, code: "concurrency_conflict");
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw new SpecimenDomainException(
                "Barcode uniqueness conflict. Retry.",
                statusCode: 409, code: "barcode_conflict");
        }

        return barcode;
    }

    /// <summary>
    /// Production barcode sequence allocation. PostgreSQL path is multi-instance safe and does not use
    /// the InMemory-only SequenceGates semaphore for correctness.
    /// Exposed as internal for PRE-UAT PostgreSQL concurrency evidence.
    /// </summary>
    internal async Task<(string Value, int Sequence)> AllocateBarcodeValueAsync(
        Guid tenantId, DateTime utcNow, CancellationToken ct)
    {
        var date = DateOnly.FromDateTime(utcNow);
        int value;

        if (_db.Database.IsNpgsql())
        {
            // Authoritative concurrency mechanism — safe across LaboratoryApi instances.
            // No process-local lock participates in this branch.
            var seqId = Guid.NewGuid();
            var allocated = await _db.Database
                .SqlQuery<SequenceAllocRow>($"""
                    INSERT INTO lms_barcode_number_sequences (id, tenant_id, sequence_date, last_value)
                    VALUES ({seqId}, {tenantId}, {date}, 1)
                    ON CONFLICT (tenant_id, sequence_date)
                    DO UPDATE SET last_value = lms_barcode_number_sequences.last_value + 1
                    WHERE lms_barcode_number_sequences.last_value < {SpecimenBarcodeFormats.SequenceMax}
                    RETURNING last_value AS "Value"
                    """)
                .ToListAsync(ct);
            if (allocated.Count != 1)
                throw new SpecimenDomainException(
                    "Barcode sequence exhausted for this tenant/UTC day.",
                    statusCode: 409, code: "barcode_sequence_exhausted");
            value = allocated[0].Value;
            if (value < 1 || value > SpecimenBarcodeFormats.SequenceMax)
                throw new SpecimenDomainException(
                    "Barcode sequence exhausted for this tenant/UTC day.",
                    statusCode: 409, code: "barcode_sequence_exhausted");
        }
        else
        {
            var gateKey = $"bc:{tenantId:N}:{date:yyyyMMdd}";
            var gate = SequenceGates.GetOrAdd(gateKey, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync(ct);
            try
            {
                value = 0;
                for (var attempt = 0; attempt < 5; attempt++)
                {
                    try
                    {
                        var seq = await _db.BarcodeNumberSequences
                            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.SequenceDate == date, ct);
                        if (seq is null)
                        {
                            seq = new LmsBarcodeNumberSequence
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenantId,
                                SequenceDate = date,
                                LastValue = 0,
                            };
                            _db.BarcodeNumberSequences.Add(seq);
                        }

                        if (seq.LastValue >= SpecimenBarcodeFormats.SequenceMax)
                            throw new SpecimenDomainException(
                                "Barcode sequence exhausted for this tenant/UTC day.",
                                statusCode: 409, code: "barcode_sequence_exhausted");

                        seq.LastValue++;
                        await _db.SaveChangesAsync(ct);
                        value = seq.LastValue;
                        break;
                    }
                    catch (DbUpdateException ex) when (IsUniqueViolation(ex))
                    {
                        foreach (var entry in _db.ChangeTracker.Entries<LmsBarcodeNumberSequence>().ToList())
                            entry.State = EntityState.Detached;
                    }
                }

                if (value == 0)
                    throw new SpecimenDomainException(
                        "Failed to allocate barcode.", statusCode: 500, code: "barcode_alloc_failure");
            }
            finally
            {
                gate.Release();
            }
        }

        var barcode = $"{SpecimenBarcodeFormats.Prefix}{SpecimenBarcodeFormats.Separator}{date:yyyyMMdd}{SpecimenBarcodeFormats.Separator}{value:D6}";
        if (barcode.Length != SpecimenBarcodeFormats.MaxLength
            || !barcode.StartsWith($"{SpecimenBarcodeFormats.Prefix}{SpecimenBarcodeFormats.Separator}", StringComparison.Ordinal))
            throw new SpecimenDomainException(
                "Barcode format invalid.", statusCode: 500, code: "barcode_format_invalid");
        return (barcode, value);
    }

    private async Task<LmsSpecimenBarcodeConfiguration> ResolveActiveConfigurationAsync(
        Guid tenantId, DateTime utcNow, CancellationToken ct)
    {
        // Configuration becomes effective at the start of its EffectiveFromUtc UTC day (or earlier).
        var dayStart = new DateTime(utcNow.Year, utcNow.Month, utcNow.Day, 0, 0, 0, DateTimeKind.Utc);
        var candidates = await _db.SpecimenBarcodeConfigurations.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.IsActive && c.EffectiveFromUtc <= dayStart)
            .OrderByDescending(c => c.EffectiveFromUtc)
            .ThenByDescending(c => c.CreatedAtUtc)
            .ToListAsync(ct);

        if (candidates.Count == 0)
            throw new SpecimenDomainException(
                "Active barcode configuration is missing.",
                statusCode: 503, code: "barcode_configuration_missing");

        // Ambiguous: two rows with identical effective_from — fail closed.
        if (candidates.Count >= 2
            && candidates[0].EffectiveFromUtc == candidates[1].EffectiveFromUtc)
            throw new SpecimenDomainException(
                "Barcode configuration is ambiguous.",
                statusCode: 503, code: "barcode_configuration_ambiguous");

        var config = candidates[0];
        if (!IsApprovedConfiguration(config))
            throw new SpecimenDomainException(
                "Barcode configuration is malformed or inactive for allocation.",
                statusCode: 503, code: "barcode_configuration_invalid");
        return config;
    }

    internal static bool IsApprovedConfiguration(LmsSpecimenBarcodeConfiguration c) =>
        c.IsActive
        && string.Equals(c.FormatCode, SpecimenBarcodeFormats.SpcYyyyMmDdNnnnnn, StringComparison.Ordinal)
        && string.Equals(c.Prefix, SpecimenBarcodeFormats.Prefix, StringComparison.Ordinal)
        && string.Equals(c.Separator, SpecimenBarcodeFormats.Separator, StringComparison.Ordinal)
        && string.Equals(c.DateSegment, SpecimenBarcodeFormats.DateSegmentYyyyMmDd, StringComparison.Ordinal)
        && string.Equals(c.DateTimezone, SpecimenBarcodeFormats.DateTimezoneUtc, StringComparison.Ordinal)
        && c.SequenceWidth == SpecimenBarcodeFormats.SequenceWidth
        && string.Equals(c.SequencePeriod, SpecimenBarcodeFormats.SequencePeriodUtcDay, StringComparison.Ordinal)
        && string.Equals(c.CheckDigitPolicy, SpecimenBarcodeFormats.CheckDigitNone, StringComparison.Ordinal)
        && c.MaxLength == SpecimenBarcodeFormats.MaxLength
        && string.Equals(c.Symbology, SpecimenBarcodeFormats.SymbologyCode128, StringComparison.Ordinal)
        && string.Equals(c.Scope, SpecimenBarcodeFormats.ScopeTenant, StringComparison.Ordinal)
        && string.Equals(c.UniquenessPolicy, SpecimenBarcodeFormats.UniquenessTenantWide, StringComparison.Ordinal);

    /// <summary>Test/seed helper — inserts approved CONFIG-BAR-01 row effective immediately (past UTC day).</summary>
    public static LmsSpecimenBarcodeConfiguration CreateApprovedConfiguration(
        Guid tenantId, Guid actorId, DateTime? effectiveFromUtc = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            FormatCode = SpecimenBarcodeFormats.SpcYyyyMmDdNnnnnn,
            Prefix = SpecimenBarcodeFormats.Prefix,
            Separator = SpecimenBarcodeFormats.Separator,
            DateSegment = SpecimenBarcodeFormats.DateSegmentYyyyMmDd,
            DateTimezone = SpecimenBarcodeFormats.DateTimezoneUtc,
            SequenceWidth = SpecimenBarcodeFormats.SequenceWidth,
            SequencePeriod = SpecimenBarcodeFormats.SequencePeriodUtcDay,
            CheckDigitPolicy = SpecimenBarcodeFormats.CheckDigitNone,
            Charset = SpecimenBarcodeFormats.Charset,
            MaxLength = SpecimenBarcodeFormats.MaxLength,
            Symbology = SpecimenBarcodeFormats.SymbologyCode128,
            Scope = SpecimenBarcodeFormats.ScopeTenant,
            UniquenessPolicy = SpecimenBarcodeFormats.UniquenessTenantWide,
            EffectiveFromUtc = effectiveFromUtc ?? DateTime.UnixEpoch,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
            CreatedByUserId = actorId,
        };

    private async Task<LmsSpecimenLabelPrintEvent> AppendPrintEventAsync(
        Guid tenantId, Guid actorId, LmsSpecimen specimen, LmsSpecimenBarcode barcode,
        string printType, string? reason, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var ev = new LmsSpecimenLabelPrintEvent
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SpecimenId = specimen.Id,
            BarcodeId = barcode.Id,
            PrintType = printType,
            PrintedByUserId = actorId,
            PrintedAtUtc = now,
            Reason = reason,
        };
        _db.SpecimenLabelPrintEvents.Add(ev);
        specimen.UpdatedAt = now;
        specimen.UpdatedBy = actorId;
        specimen.RowVersion++;
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new SpecimenDomainException(
                "Specimen was modified by another user. Reload and retry.",
                statusCode: 409, code: "concurrency_conflict");
        }

        return ev;
    }

    private async Task<SpecimenLabelPayloadDto> BuildLabelPayloadAsync(
        Guid tenantId, LmsSpecimen specimen, LmsSpecimenBarcode barcode,
        LmsSpecimenLabelPrintEvent printEvent, CancellationToken ct)
    {
        var order = await _db.Orders.AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == specimen.OrderId && o.TenantId == tenantId, ct);
        return new SpecimenLabelPayloadDto(
            specimen.Id,
            barcode.Id,
            barcode.BarcodeValue,
            barcode.Symbology,
            specimen.PatientMrnSnapshot ?? string.Empty,
            specimen.PatientNameSnapshot ?? string.Empty,
            order?.OrderNumber ?? string.Empty,
            specimen.CollectedAt,
            specimen.Accession,
            SpecimenType: null,
            BranchName: null,
            printEvent.Id,
            printEvent.PrintType,
            printEvent.PrintedAtUtc,
            specimen.RowVersion);
    }

    private async Task<LmsSpecimen> LoadSpecimenForMutationAsync(
        Guid tenantId, Guid specimenId, int expectedRowVersion, CancellationToken ct)
    {
        var specimen = await _db.Specimens
            .FirstOrDefaultAsync(s => s.Id == specimenId && s.TenantId == tenantId, ct)
            ?? throw new SpecimenDomainException("Specimen not found.", statusCode: 404, code: "not_found");

        if (expectedRowVersion == 0 || expectedRowVersion != specimen.RowVersion)
            throw new SpecimenDomainException(
                "Specimen was modified by another user. Reload and retry.",
                statusCode: 409, code: "concurrency_conflict");
        return specimen;
    }

    private async Task EnsureSpecimenAsync(Guid tenantId, Guid specimenId, CancellationToken ct)
    {
        var exists = await _db.Specimens.AsNoTracking()
            .AnyAsync(s => s.Id == specimenId && s.TenantId == tenantId, ct);
        if (!exists)
            throw new SpecimenDomainException("Specimen not found.", statusCode: 404, code: "not_found");
    }

    private Task<LmsSpecimenBarcode?> ActiveBarcodeAsync(Guid tenantId, Guid specimenId, CancellationToken ct) =>
        _db.SpecimenBarcodes.FirstOrDefaultAsync(
            b => b.TenantId == tenantId && b.SpecimenId == specimenId && b.IsActive, ct);

    private static SpecimenBarcodeDto MapBarcode(LmsSpecimenBarcode b, int specimenRowVersion) =>
        new(b.Id, b.SpecimenId, b.BarcodeValue, b.FormatCode, b.Symbology, b.IssuedAtUtc, b.IssuedByUserId,
            b.IsActive, specimenRowVersion);

    private async Task ValidateBranchAsync(Guid tenantId, Guid actorId, Guid branchId, CancellationToken ct)
    {
        try
        {
            await _platform.ValidateUserBranchAsync(tenantId, actorId, branchId, ct);
        }
        catch (OrderDomainException ex)
        {
            throw new SpecimenDomainException(
                ex.Message,
                statusCode: ex.StatusCode == 403 ? 403 : ex.StatusCode,
                code: string.IsNullOrWhiteSpace(ex.Code) ? "branch_unauthorized" : ex.Code);
        }
    }

    private static void ValidateBranchRequired(Guid branchId)
    {
        if (branchId == Guid.Empty)
            throw new SpecimenDomainException("Operating branch is required.", code: "branch_required");
    }

    private async Task RevertBarcodeAsync(Guid tenantId, Guid barcodeId, CancellationToken ct)
    {
        _db.ChangeTracker.Clear();
        var b = await _db.SpecimenBarcodes.FirstOrDefaultAsync(x => x.Id == barcodeId && x.TenantId == tenantId, ct);
        if (b is null) return;
        var specimen = await _db.Specimens.FirstOrDefaultAsync(s => s.Id == b.SpecimenId && s.TenantId == tenantId, ct);
        _db.SpecimenBarcodes.Remove(b);
        if (specimen is not null)
        {
            specimen.UpdatedAt = DateTime.UtcNow;
            specimen.RowVersion++;
        }
        await _db.SaveChangesAsync(ct);
    }

    private async Task RevertPrintEventAsync(Guid tenantId, Guid printEventId, CancellationToken ct)
    {
        _db.ChangeTracker.Clear();
        var ev = await _db.SpecimenLabelPrintEvents
            .FirstOrDefaultAsync(x => x.Id == printEventId && x.TenantId == tenantId, ct);
        if (ev is null) return;
        var specimen = await _db.Specimens.FirstOrDefaultAsync(s => s.Id == ev.SpecimenId && s.TenantId == tenantId, ct);
        _db.SpecimenLabelPrintEvents.Remove(ev);
        if (specimen is not null)
        {
            specimen.UpdatedAt = DateTime.UtcNow;
            specimen.RowVersion++;
        }
        await _db.SaveChangesAsync(ct);
    }

    private async Task TryDeleteBarcodeAsync(Guid tenantId, Guid barcodeId, CancellationToken ct)
    {
        try { await RevertBarcodeAsync(tenantId, barcodeId, ct); }
        catch { /* best-effort cleanup */ }
    }

    private async Task TryDeletePrintEventAsync(Guid tenantId, Guid printEventId, CancellationToken ct)
    {
        try { await RevertPrintEventAsync(tenantId, printEventId, ct); }
        catch { /* best-effort cleanup */ }
    }

    private sealed record IdempotencyClaim(Guid? ClaimId, string? ReplayJson);

    private async Task<IdempotencyClaim> ClaimIdempotencyAsync(
        Guid tenantId, string? key, string operation, string requestHash, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key))
            return new IdempotencyClaim(null, null);

        var normalized = key.Trim();
        var existing = await _db.SpecimenIdempotencyRecords.AsNoTracking()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct);
        if (existing is not null)
            return new IdempotencyClaim(null, ResolveReplay(existing, operation, requestHash));

        var claimId = Guid.NewGuid();
        _db.SpecimenIdempotencyRecords.Add(new LmsSpecimenIdempotencyRecord
        {
            Id = claimId,
            TenantId = tenantId,
            IdempotencyKey = normalized,
            Operation = operation,
            RequestHash = requestHash,
            SpecimenId = Guid.Empty,
            ResponseJson = string.Empty,
            CreatedAt = DateTime.UtcNow,
        });

        try
        {
            await _db.SaveChangesAsync(ct);
            return new IdempotencyClaim(claimId, null);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            foreach (var entry in _db.ChangeTracker.Entries<LmsSpecimenIdempotencyRecord>()
                         .Where(e => e.Entity.Id == claimId).ToList())
                entry.State = EntityState.Detached;

            for (var i = 0; i < 20; i++)
            {
                var raced = await _db.SpecimenIdempotencyRecords.AsNoTracking()
                    .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct);
                if (raced is null) break;
                if (!string.IsNullOrEmpty(raced.ResponseJson) && raced.SpecimenId != Guid.Empty)
                    return new IdempotencyClaim(null, ResolveReplay(raced, operation, requestHash));
                await Task.Delay(25, ct);
            }

            var final = await _db.SpecimenIdempotencyRecords.AsNoTracking()
                .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IdempotencyKey == normalized, ct)
                ?? throw new SpecimenDomainException(
                    "Idempotency key conflict.", statusCode: 409, code: "idempotency_conflict");
            if (string.IsNullOrEmpty(final.ResponseJson) || final.SpecimenId == Guid.Empty)
                throw new SpecimenDomainException(
                    "Idempotent request is still in progress. Retry shortly.",
                    statusCode: 409, code: "idempotency_in_progress");
            return new IdempotencyClaim(null, ResolveReplay(final, operation, requestHash));
        }
    }

    private static string ResolveReplay(LmsSpecimenIdempotencyRecord existing, string operation, string requestHash)
    {
        if (!string.Equals(existing.Operation, operation, StringComparison.Ordinal)
            || !string.Equals(existing.RequestHash, requestHash, StringComparison.Ordinal))
            throw new SpecimenDomainException(
                "Idempotency key was reused with a different request.",
                statusCode: 409, code: "idempotency_conflict");
        return existing.ResponseJson;
    }

    private async Task CompleteIdempotencyAsync<T>(
        Guid tenantId, Guid? claimId, Guid specimenId, T payload, CancellationToken ct)
    {
        if (claimId is null) return;
        var record = await _db.SpecimenIdempotencyRecords
            .FirstOrDefaultAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
        if (record is null) return;
        record.SpecimenId = specimenId;
        record.ResponseJson = JsonSerializer.Serialize(payload, JsonOpts);
        await _db.SaveChangesAsync(ct);
    }

    private async Task ReleaseIdempotencyClaimAsync(Guid tenantId, Guid? claimId, CancellationToken ct)
    {
        if (claimId is null) return;
        var record = await _db.SpecimenIdempotencyRecords
            .FirstOrDefaultAsync(r => r.Id == claimId && r.TenantId == tenantId, ct);
        if (record is null) return;
        if (!string.IsNullOrEmpty(record.ResponseJson) && record.SpecimenId != Guid.Empty) return;
        _db.SpecimenIdempotencyRecords.Remove(record);
        await _db.SaveChangesAsync(ct);
    }

    private static T DeserializeRequired<T>(string json) =>
        JsonSerializer.Deserialize<T>(json, JsonOpts)
        ?? throw new SpecimenDomainException(
            "Idempotency replay payload is corrupt.", statusCode: 500, code: "idempotency_corrupt");

    private static string HashRequest(object payload)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        var msg = ex.InnerException?.Message ?? ex.Message;
        return msg.Contains("unique", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("duplicate", StringComparison.OrdinalIgnoreCase)
               || msg.Contains("IX_", StringComparison.OrdinalIgnoreCase);
    }

    private sealed class SequenceAllocRow
    {
        public int Value { get; set; }
    }
}
