using System.Collections.Concurrent;

namespace IpManagementService.Services.Uat;

/// <summary>In-process failure injection for Development/UAT only. Never persisted.</summary>
public static class UatFailureFlags
{
    private static readonly ConcurrentDictionary<string, bool> Flags = new(StringComparer.OrdinalIgnoreCase);

    public static IReadOnlyDictionary<string, bool> Snapshot() => Flags.ToDictionary(kv => kv.Key, kv => kv.Value);

    public static void Set(string name, bool enabled)
    {
        if (string.IsNullOrWhiteSpace(name)) return;
        Flags[name.Trim()] = enabled;
    }

    public static bool IsOn(string name) => Flags.TryGetValue(name, out var v) && v;

    public static void Clear() => Flags.Clear();
}
