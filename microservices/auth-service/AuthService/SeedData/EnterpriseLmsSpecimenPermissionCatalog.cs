namespace AuthService.SeedData;

/// <summary>
/// L-COL-01C/01D/01E: specimen permission definitions only. No role grants.
/// </summary>
public static class EnterpriseLmsSpecimenPermissionCatalog
{
    public const string SpecimensView = "lms.specimens.view";
    public const string SpecimensManage = "lms.specimens.manage";
    public const string SpecimensReceive = "lms.specimens.receive";
    public const string SpecimensBarcodeView = "lms.specimens.barcode.view";
    public const string SpecimensLabelPrint = "lms.specimens.label.print";
    public const string SpecimensLabelReprint = "lms.specimens.label.reprint";

    public static readonly string[] RequiredPermissionCodes =
    {
        SpecimensView,
        SpecimensManage,
        SpecimensReceive,
        SpecimensBarcodeView,
        SpecimensLabelPrint,
        SpecimensLabelReprint,
    };

    public static readonly (string Code, string Name, string Module, string Action, string ResourceType, string Description)[] PermissionDefinitions =
    {
        (
            SpecimensView,
            "View LMS Specimens",
            "lms",
            "view",
            "lms_specimen",
            "Read Enterprise LMS specimen records and detail."
        ),
        (
            SpecimensManage,
            "Manage LMS Specimens",
            "lms",
            "manage",
            "lms_specimen",
            "Perform Specimen-domain mutations including Complete Collection (with lms.collection.collect)."
        ),
        (
            SpecimensReceive,
            "Receive LMS Specimens",
            "lms",
            "receive",
            "lms_specimen",
            "Receive and reject specimens (L-COL-01D)."
        ),
        (
            SpecimensBarcodeView,
            "View LMS Specimen Barcode",
            "lms",
            "view",
            "lms_specimen_barcode",
            "Read specimen barcode identity (L-COL-01E)."
        ),
        (
            SpecimensLabelPrint,
            "Print LMS Specimen Label",
            "lms",
            "print",
            "lms_specimen_label",
            "Generate barcode and print specimen labels (L-COL-01E)."
        ),
        (
            SpecimensLabelReprint,
            "Reprint LMS Specimen Label",
            "lms",
            "reprint",
            "lms_specimen_label",
            "Reprint existing specimen labels with reason (L-COL-01E)."
        ),
    };
}
