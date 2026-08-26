namespace AuthService.Services;

/// <summary>
/// DB-004. Prefer <c>ward_id</c>; fall back to case-insensitive <c>ward_name</c>
/// only when the FK is still null (unmatched legacy rows).
/// Wave 7 leftover: free-text <c>Wave7</c> attaches to the branch DayCare ward.
/// </summary>
public static class BedWardMatcher
{
    public readonly record struct WardNameRow(
        Guid Id,
        Guid TenantId,
        Guid BranchId,
        string WardName,
        string? WardType = null);

    public static bool Matches(
        Guid? bedWardId,
        string? bedWardName,
        Guid? filterWardId,
        string? filterWardName)
    {
        if (filterWardId is Guid wid)
        {
            if (bedWardId == wid)
                return true;
            return bedWardId is null && NamesEqual(bedWardName, filterWardName);
        }

        if (!string.IsNullOrWhiteSpace(filterWardName))
            return NamesEqual(bedWardName, filterWardName);

        return true;
    }

    public static bool NamesEqual(string? left, string? right)
    {
        if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right))
            return false;
        return string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsWave7Alias(string? wardName)
        => NamesEqual(wardName, "Wave7") || NamesEqual(wardName, "Wave 7");

    public static Guid? ResolveWardId(
        Guid tenantId,
        Guid branchId,
        string? wardName,
        IEnumerable<(Guid Id, Guid TenantId, Guid BranchId, string WardName)> wards)
        => ResolveWardId(
            tenantId,
            branchId,
            wardName,
            wards.Select(w => new WardNameRow(w.Id, w.TenantId, w.BranchId, w.WardName)));

    public static Guid? ResolveWardId(
        Guid tenantId,
        Guid branchId,
        string? wardName,
        IEnumerable<WardNameRow> wards)
    {
        var scoped = wards
            .Where(w => w.TenantId == tenantId && w.BranchId == branchId)
            .ToList();

        if (!string.IsNullOrWhiteSpace(wardName))
        {
            var exact = scoped
                .Where(w => NamesEqual(w.WardName, wardName))
                .Select(w => (Guid?)w.Id)
                .FirstOrDefault();
            if (exact is not null)
                return exact;
        }

        if (!IsWave7Alias(wardName))
            return null;

        var dayCare = scoped
            .Where(w => string.Equals(w.WardType, "DayCare", StringComparison.OrdinalIgnoreCase))
            .Select(w => (Guid?)w.Id)
            .FirstOrDefault();
        if (dayCare is not null)
            return dayCare;

        if (scoped.Count == 1)
            return scoped[0].Id;

        return null;
    }

    public static string? CanonicalWardName(Guid? wardId, IEnumerable<WardNameRow> wards)
    {
        if (wardId is not Guid id)
            return null;
        foreach (var w in wards)
        {
            if (w.Id == id && !string.IsNullOrWhiteSpace(w.WardName))
                return w.WardName;
        }
        return null;
    }
}
