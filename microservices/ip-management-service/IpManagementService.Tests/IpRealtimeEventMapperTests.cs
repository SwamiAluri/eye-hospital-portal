using IpManagementService.Models.Domain;
using IpManagementService.Services;
using Xunit;

namespace IpManagementService.Tests;

public class IpRealtimeEventMapperTests
{
    [Theory]
    [InlineData(ClinicalState.Admitted, IpRealtimeEventMapper.PatientAdmitted)]
    [InlineData(ClinicalState.SentToOT, IpRealtimeEventMapper.PatientSentToOT)]
    [InlineData(ClinicalState.InOT, IpRealtimeEventMapper.SurgeryStarted)]
    [InlineData(ClinicalState.SurgeryCompleted, IpRealtimeEventMapper.SurgeryCompleted)]
    [InlineData(ClinicalState.PostOp, IpRealtimeEventMapper.PostOpUpdated)]
    [InlineData(ClinicalState.ReadyForDischarge, IpRealtimeEventMapper.PatientReadyForDischarge)]
    [InlineData(ClinicalState.Discharged, IpRealtimeEventMapper.PatientDischarged)]
    [InlineData(ClinicalState.CancelledSurgery, IpRealtimeEventMapper.PatientCancelled)]
    [InlineData(ClinicalState.AdmissionCancelled, IpRealtimeEventMapper.PatientCancelled)]
    [InlineData(IpRealtimeEventMapper.BedChanged, IpRealtimeEventMapper.BedChanged)]
    [InlineData(IpRealtimeEventMapper.PatientAcceptedInOT, IpRealtimeEventMapper.PatientAcceptedInOT)]
    public void Maps_clinical_or_direct_events(string input, string expected)
    {
        Assert.Equal(expected, IpRealtimeEventMapper.ToHubType(input));
    }

    [Theory]
    [InlineData(IpRealtimeEventMapper.PatientAdmitted)]
    [InlineData(IpRealtimeEventMapper.BedChanged)]
    [InlineData(IpRealtimeEventMapper.PatientSentToOT)]
    [InlineData(IpRealtimeEventMapper.PatientAcceptedInOT)]
    [InlineData(IpRealtimeEventMapper.SurgeryStarted)]
    [InlineData(IpRealtimeEventMapper.SurgeryCompleted)]
    [InlineData(IpRealtimeEventMapper.PostOpUpdated)]
    [InlineData(IpRealtimeEventMapper.PatientReadyForDischarge)]
    [InlineData(IpRealtimeEventMapper.PatientDischarged)]
    [InlineData(IpRealtimeEventMapper.PatientCancelled)]
    [InlineData(IpRealtimeEventMapper.SlotChanged)]
    public void Spec_ip_dashboard_event_names_are_hub_types(string hubType)
    {
        Assert.Equal(hubType, IpRealtimeEventMapper.ToHubType(hubType));
    }
}
