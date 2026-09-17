using System;

namespace AuthService.Services;

/// <summary>
/// Normalizes counsellor communication / callback write values to DB CHECK allowlists
/// (migrations 69–70). Master codes must not be written raw.
/// </summary>
public static class CounselorCommunicationContracts
{
    private static readonly string[] AllowedCallbackTypes =
    {
        "PreSurgery",
        "PostSurgery",
        "General",
        "Financial",
        "FearAnxiety",
        "DelayReason",
        "InsuranceFollowup",
        "DecisionPending",
    };

    private static readonly string[] AllowedCallbackChannels =
    {
        "Phone",
        "WhatsApp",
        "SMS",
        "VideoCall",
    };

    private static readonly string[] AllowedCommOutcomes =
    {
        "Answered",
        "AnsweredInterested",
        "AnsweredNotInterested",
        "AnsweredCallbackNeeded",
        "NoAnswer",
        "Voicemail",
        "Busy",
        "WrongNumber",
        "DeclinedContact",
        "MessageSent",
    };

    /// <summary>
    /// Maps master counsellor.callback_type codes (SCHEDULED, REMINDER, …) onto migration-70 CHECK values.
    /// </summary>
    public static string NormalizeCallbackType(string? callbackType)
    {
        if (string.IsNullOrWhiteSpace(callbackType))
            return "General";

        var raw = callbackType.Trim();
        if (Array.IndexOf(AllowedCallbackTypes, raw) >= 0)
            return raw;

        return raw.ToUpperInvariant() switch
        {
            "SCHEDULED" => "General",
            "REMINDER" => "General",
            "FOLLOW_UP" => "General",
            "FOLLOWUP" => "General",
            "NO_SHOW" => "DelayReason",
            "NOSHOW" => "DelayReason",
            "URGENT" => "General",
            _ => "General",
        };
    }

    /// <summary>Maps to migration-70 callback channel CHECK (Email/InPerson → Phone).</summary>
    public static string NormalizeCallbackChannel(string? channel)
    {
        if (string.IsNullOrWhiteSpace(channel))
            return "Phone";

        var raw = channel.Trim();
        if (Array.IndexOf(AllowedCallbackChannels, raw) >= 0)
            return raw;

        return raw.ToUpperInvariant() switch
        {
            "PHONE" => "Phone",
            "WHATSAPP" => "WhatsApp",
            "SMS" => "SMS",
            "VIDEOCALL" or "VIDEO_CALL" => "VideoCall",
            "EMAIL" => "Phone",
            "INPERSON" or "IN_PERSON" => "Phone",
            _ => "Phone",
        };
    }

    /// <summary>Maps UI shorthand outcomes onto migration-69 CHECK values.</summary>
    public static string NormalizeCommOutcome(string? outcome)
    {
        if (string.IsNullOrWhiteSpace(outcome))
            throw new ArgumentException("Outcome is required.", nameof(outcome));

        var raw = outcome.Trim();
        if (Array.IndexOf(AllowedCommOutcomes, raw) >= 0)
            return raw;

        return raw switch
        {
            "LeftMessage" => "Voicemail",
            "Declined" => "DeclinedContact",
            _ => throw new ArgumentException(
                $"Invalid communication outcome '{raw}'.",
                nameof(outcome)),
        };
    }
}
