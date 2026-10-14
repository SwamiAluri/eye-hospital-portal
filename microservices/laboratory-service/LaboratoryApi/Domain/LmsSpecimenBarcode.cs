namespace LaboratoryApi.Domain;

/// <summary>L-COL-01E active specimen barcode. Immutable after issuance. One active per specimen.</summary>
public class LmsSpecimenBarcode
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SpecimenId { get; set; }
    public string BarcodeValue { get; set; } = string.Empty;
    public Guid ConfigurationId { get; set; }
    public string FormatCode { get; set; } = SpecimenBarcodeFormats.SpcYyyyMmDdNnnnnn;
    public string Symbology { get; set; } = SpecimenBarcodeFormats.SymbologyCode128;
    public DateTime IssuedAtUtc { get; set; }
    public Guid IssuedByUserId { get; set; }
    public bool IsActive { get; set; } = true;
    public int RowVersion { get; set; }
}

/// <summary>Append-only label print/reprint event. Not barcode identity.</summary>
public class LmsSpecimenLabelPrintEvent
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid SpecimenId { get; set; }
    public Guid BarcodeId { get; set; }
    public string PrintType { get; set; } = SpecimenLabelPrintTypes.Print;
    public Guid PrintedByUserId { get; set; }
    public DateTime PrintedAtUtc { get; set; }
    public string? Reason { get; set; }
    public string? CorrelationId { get; set; }
}

/// <summary>Per-tenant UTC-day barcode sequence (SPC-YYYYMMDD-NNNNNN).</summary>
public class LmsBarcodeNumberSequence
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public DateOnly SequenceDate { get; set; }
    public int LastValue { get; set; }
}

/// <summary>
/// LMS-owned barcode configuration artifact (CONFIG-BAR-01).
/// Effective at the next UTC day boundary; does not rewrite historical barcodes.
/// </summary>
public class LmsSpecimenBarcodeConfiguration
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string FormatCode { get; set; } = SpecimenBarcodeFormats.SpcYyyyMmDdNnnnnn;
    public string Prefix { get; set; } = SpecimenBarcodeFormats.Prefix;
    public string Separator { get; set; } = SpecimenBarcodeFormats.Separator;
    public string DateSegment { get; set; } = SpecimenBarcodeFormats.DateSegmentYyyyMmDd;
    public string DateTimezone { get; set; } = SpecimenBarcodeFormats.DateTimezoneUtc;
    public int SequenceWidth { get; set; } = SpecimenBarcodeFormats.SequenceWidth;
    public string SequencePeriod { get; set; } = SpecimenBarcodeFormats.SequencePeriodUtcDay;
    public string CheckDigitPolicy { get; set; } = SpecimenBarcodeFormats.CheckDigitNone;
    public string Charset { get; set; } = SpecimenBarcodeFormats.Charset;
    public int MaxLength { get; set; } = SpecimenBarcodeFormats.MaxLength;
    public string Symbology { get; set; } = SpecimenBarcodeFormats.SymbologyCode128;
    public string Scope { get; set; } = SpecimenBarcodeFormats.ScopeTenant;
    public string UniquenessPolicy { get; set; } = SpecimenBarcodeFormats.UniquenessTenantWide;
    public DateTime EffectiveFromUtc { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}
