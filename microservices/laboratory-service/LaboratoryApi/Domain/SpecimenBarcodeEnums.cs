namespace LaboratoryApi.Domain;

/// <summary>CONFIG-BAR-01 approved barcode payload constants. Do not alter.</summary>
public static class SpecimenBarcodeFormats
{
    public const string SpcYyyyMmDdNnnnnn = "SPC-YYYYMMDD-NNNNNN";
    public const string Prefix = "SPC";
    public const string Separator = "-";
    public const string DateSegmentYyyyMmDd = "YYYYMMDD";
    public const string DateTimezoneUtc = "UTC";
    public const int SequenceWidth = 6;
    public const int SequenceMax = 999999;
    public const string SequencePeriodUtcDay = "UTC_DAY";
    public const string CheckDigitNone = "NONE";
    public const string Charset = "A-Z0-9-";
    public const int MaxLength = 19;
    public const string SymbologyCode128 = "CODE128";
    public const string ScopeTenant = "TENANT";
    public const string UniquenessTenantWide = "TENANT_WIDE";
}

public static class SpecimenLabelPrintTypes
{
    public const string Print = "Print";
    public const string Reprint = "Reprint";
}

public static class SpecimenBarcodeAuditActions
{
    public const string CreateSpecimenBarcode = "CREATE_SPECIMEN_BARCODE";
    public const string PrintSpecimenLabel = "PRINT_SPECIMEN_LABEL";
    public const string ReprintSpecimenLabel = "REPRINT_SPECIMEN_LABEL";
}

public static class SpecimenBarcodeIdempotencyOps
{
    public const string AssignBarcode = "assign_barcode";
    public const string PrintLabel = "print_label";
    public const string ReprintLabel = "reprint_label";
}
