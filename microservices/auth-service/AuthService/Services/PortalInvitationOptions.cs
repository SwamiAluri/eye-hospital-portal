using System;
using System.Collections.Generic;
using System.Linq;
using AuthService.Models.Domain;

namespace AuthService.Services;

/// <summary>
/// L-PORTAL-01 S2 — Hospital invitation policy (PD-ID-03-D3 bounds).
/// Fail closed when missing, outside platform bounds, or inconsistent.
/// </summary>
public sealed class PortalInvitationOptions
{
    public const string SectionName = "PortalIdentity:Invitation";

    /// <summary>Platform minimum (hours). PO-approved bound.</summary>
    public const int PlatformMinExpiryHours = 1;

    /// <summary>Platform maximum (hours). PO-approved bound.</summary>
    public const int PlatformMaxExpiryHours = 72;

    /// <summary>Platform default (hours). PO-approved bound.</summary>
    public const int PlatformDefaultExpiryHours = 24;

    public int DefaultExpiryHours { get; set; } = PlatformDefaultExpiryHours;
    public int MinExpiryHours { get; set; } = PlatformMinExpiryHours;
    public int MaxExpiryHours { get; set; } = PlatformMaxExpiryHours;

    /// <summary>Policy-enabled delivery channels. S2 first path: staff_delivered_token only.</summary>
    public List<string> EnabledDeliveryChannels { get; set; } = new()
    {
        PortalInvitationDeliveryChannel.StaffDeliveredToken
    };

    public void ValidateOrThrow()
    {
        if (MinExpiryHours < PlatformMinExpiryHours
            || MaxExpiryHours > PlatformMaxExpiryHours
            || MinExpiryHours > MaxExpiryHours
            || DefaultExpiryHours < MinExpiryHours
            || DefaultExpiryHours > MaxExpiryHours)
        {
            throw new InvalidOperationException(
                "Portal invitation expiry policy is missing, invalid, or outside approved bounds (1–72h, default within range).");
        }

        if (EnabledDeliveryChannels == null
            || EnabledDeliveryChannels.Count == 0
            || EnabledDeliveryChannels.Any(string.IsNullOrWhiteSpace))
        {
            throw new InvalidOperationException(
                "Portal invitation delivery-channel policy is missing or invalid.");
        }
    }

    public int ResolveExpiryHours(int? requestedHours)
    {
        ValidateOrThrow();
        var hours = requestedHours ?? DefaultExpiryHours;
        if (hours < MinExpiryHours || hours > MaxExpiryHours)
        {
            throw new InvalidOperationException(
                $"Requested invitation expiry hours ({hours}) are outside configured policy bounds ({MinExpiryHours}–{MaxExpiryHours}).");
        }

        return hours;
    }

    public bool IsChannelEnabled(string channel)
    {
        ValidateOrThrow();
        return EnabledDeliveryChannels.Any(c =>
            string.Equals(c, channel, StringComparison.OrdinalIgnoreCase));
    }
}
