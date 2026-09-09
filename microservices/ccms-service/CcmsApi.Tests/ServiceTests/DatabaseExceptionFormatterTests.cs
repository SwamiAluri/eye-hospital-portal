using CcmsApi.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public sealed class DatabaseExceptionFormatterTests
{
    [Fact]
    public void ToClientMessage_UsesInnerProviderMessage_ForDbUpdateException()
    {
        var inner = new InvalidOperationException("column \"document_category\" of relation \"ccms_documents\" does not exist");
        var outer = new DbUpdateException("An error occurred while saving the entity changes. See the inner exception for details.", inner);

        DatabaseExceptionFormatter.ToClientMessage(outer)
            .Should().Be("column \"document_category\" of relation \"ccms_documents\" does not exist");
    }
}
