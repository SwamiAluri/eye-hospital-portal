namespace IpManagementService.Services;

/// <summary>
/// Step ⑦ nurse-act keys — mirrors FE <c>bedside-items.ts</c> for readiness parity.
/// </summary>
public static class PreOpBedsideItems
{
    public static readonly HashSet<string> NurseWardKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "ward_check_in_time",
        "preop_medication_given",
        "ward_dilatation_done",
        "preop_slit_lamp_done",
        "toric_iol_icl_marking",
        "informed_surgeon_anaesthesia_ot",
    };

    public static readonly HashSet<string> NurseRehomedKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "contact_lens_removed",
        "valuables_removed",
    };
}
