namespace IpManagementService.Models.Dtos;

public record IolStickerChecksDto(
    bool BarcodeScan,
    bool StickerInFile,
    bool InventoryMatch
);

public record WardPostOpItemDto(
    Guid     ItemId,
    string   ItemKey,
    string   ItemLabel,
    string?  Description,
    string?  FormCode,
    int      DisplayOrder,
    bool     IsCompleted,
    bool     IsBypassed,
    string?  Notes,
    DateTime? CompletedAt,
    bool     IsBlockingEffective = false
);

public record WardPostOpChecklistDto(
    Guid     JourneyId,
    int      TotalItems,
    int      CompletedItems,
    DateTime? SentToOtAt,
    DateTime? ReceivedFromOtAt,
    DateTime? WardCheckoutAt,
    IolStickerChecksDto IolStickerChecks,
    List<WardPostOpItemDto> Items
);

public record SaveWardPostOpCompletionRequest(
    bool    IsCompleted,
    bool?   IsBypassed,
    string? BypassReason,
    string? Notes
);

public record SaveIolStickerChecksRequest(
    bool BarcodeScan,
    bool StickerInFile,
    bool InventoryMatch
);
