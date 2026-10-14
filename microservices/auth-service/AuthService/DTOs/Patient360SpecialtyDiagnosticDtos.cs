namespace AuthService.DTOs;

/// <summary>
/// Patient 360 biometry context. Measurement fields already stored on the biometry record.
/// Storage paths, examiner ids, formula worksheets, and notes are omitted.
/// </summary>
public class Patient360BiometryRecordDto
{
    public Guid Id { get; set; }
    public DateTime ExaminationDate { get; set; }
    public string Eye { get; set; } = "";
    public string Status { get; set; } = "";
    public string Device { get; set; } = "";
    public string? DeviceModel { get; set; }
    public decimal AxialLength { get; set; }
    public decimal K1 { get; set; }
    public decimal K2 { get; set; }
    public int K1Axis { get; set; }
    public decimal Acd { get; set; }
    public decimal? LensThickness { get; set; }
    public decimal? WhiteToWhite { get; set; }
    public decimal? Snr { get; set; }
    public decimal TargetRefraction { get; set; }
    public decimal? CalculatedIol { get; set; }
    public string? SelectedFormula { get; set; }
}

public class Patient360BiometryPageDto
{
    public List<Patient360BiometryRecordDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
}

/// <summary>
/// Patient 360 retinopathy screening context. Grade and finding fields already stored on the screening.
/// Image paths, AI grades, treatment text, and follow-up intervals are omitted.
/// </summary>
public class Patient360RetinopathyScreeningDto
{
    public Guid Id { get; set; }
    public DateTime ScreeningDate { get; set; }
    public string Eye { get; set; } = "";
    public string Status { get; set; } = "";
    public string? Device { get; set; }
    public string? DeviceModel { get; set; }
    public string DrGrade { get; set; } = "";
    public string? MacularEdema { get; set; }
    public int? HemorrhagesCount { get; set; }
    public int? MicroaneurysmsCount { get; set; }
    public bool HardExudates { get; set; }
    public bool SoftExudates { get; set; }
    public bool Neovascularization { get; set; }
    public bool VenousBeading { get; set; }
    public bool Irma { get; set; }
    public bool ReferralRequired { get; set; }
}

public class Patient360RetinopathyPageDto
{
    public List<Patient360RetinopathyScreeningDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
}
