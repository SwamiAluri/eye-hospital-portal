namespace IpManagementService.Models.Dtos;

public record MedicationDoseDto(
    Guid     Id,
    int      DoseNumber,
    DateTime? AdministeredAt,
    Guid?    AdministeredByUserId,
    string?  Notes
);

public record MedicationDrugDto(
    string              MedicineName,
    Guid?               MedicationId,
    int                 DisplayOrder,
    List<MedicationDoseDto> Doses
);

public record MedicationLogDto(
    Guid     JourneyId,
    string?  AnaesthesiaType,
    string?  XylocaineSensitivityResult,
    string?  SurgeryNotes,
    DateTime? SentToOtAt,
    DateTime? ReceivedFromOtAt,
    DateTime? WardCheckoutAt,
    List<MedicationDrugDto> Drugs
);

public record SaveMedicationDoseRequest(
    DateTime? AdministeredAt,
    string?   Notes,
    bool      ClearAdministration
);

public record AddMedicationDrugRequest(
    string  MedicineName,
    Guid?   MedicationId,
    int     DoseCount
);

public record UpdateMedicationLogMetaRequest(
    string? AnaesthesiaType,
    string? XylocaineSensitivityResult,
    string? SurgeryNotes
);
