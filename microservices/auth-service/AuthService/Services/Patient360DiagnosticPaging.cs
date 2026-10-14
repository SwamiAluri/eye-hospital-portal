namespace AuthService.Services;

/// <summary>
/// Page window for Patient 360 specialty diagnostic reads.
/// Matches the Phase 3C patient-list cap: page size is capped, not rejected.
/// </summary>
public static class Patient360DiagnosticPaging
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public static (int Page, int PageSize) Normalize(int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = DefaultPageSize;
        if (pageSize > MaxPageSize) pageSize = MaxPageSize;
        return (page, pageSize);
    }
}
