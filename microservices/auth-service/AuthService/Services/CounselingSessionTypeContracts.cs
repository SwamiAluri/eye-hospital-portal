using System;
using System.Collections.Generic;

namespace AuthService.Services;

/// <summary>
/// Authoritative counseling_sessions.session_type vocabulary.
/// Mirrors FE counsellor-master-maps SESSION_TYPE_CODE_TO_DB / Postgres CHECK
/// counseling_sessions_session_type_check: Initial | Followup | Recheck | Urgent.
/// Master UI codes (e.g. FOLLOW_UP) must normalize before persistence.
/// </summary>
public static class CounselingSessionTypeContracts
{
    public static readonly string[] AllowedDbValues =
    {
        "Initial",
        "Followup",
        "Recheck",
        "Urgent",
    };

    /// <summary>
    /// Master UI codes → DB CHECK values (parity with FE sessionTypeCodeToDb).
    /// Keys are unique under OrdinalIgnoreCase (do not also list DB passthrough here).
    /// </summary>
    private static readonly Dictionary<string, string> MasterCodeToDb =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["INITIAL"] = "Initial",
            ["FOLLOW_UP"] = "Followup",
            ["PRE_OP"] = "Recheck",
            ["POST_OP"] = "Followup",
            ["PACKAGE"] = "Initial",
            ["URGENT"] = "Urgent",
        };

    /// <summary>
    /// Normalize a writable session type for counseling_sessions.session_type.
    /// Blank → success with null (caller keeps existing DB value).
    /// Unknown → fail closed (do not invent a DB value).
    /// </summary>
    public static bool TryNormalizeWritableSessionType(
        string? input,
        out string? normalizedDbValue,
        out string? error)
    {
        normalizedDbValue = null;
        error = null;

        if (string.IsNullOrWhiteSpace(input))
            return true;

        var trimmed = input.Trim();

        foreach (var allowed in AllowedDbValues)
        {
            if (string.Equals(trimmed, allowed, StringComparison.OrdinalIgnoreCase))
            {
                normalizedDbValue = allowed;
                return true;
            }
        }

        if (MasterCodeToDb.TryGetValue(trimmed, out var mapped))
        {
            normalizedDbValue = mapped;
            return true;
        }

        error =
            $"Session type '{trimmed}' is not valid. Allowed values: {string.Join(", ", AllowedDbValues)} (or master codes INITIAL, FOLLOW_UP, PRE_OP, POST_OP, PACKAGE, URGENT).";
        return false;
    }
}
