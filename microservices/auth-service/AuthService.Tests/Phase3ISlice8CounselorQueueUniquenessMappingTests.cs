using System;
using AuthService.Context;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 3I Slice 8 — EF model must declare active-only unique SessionId on CounselorQueue.
/// </summary>
public class Phase3ISlice8CounselorQueueUniquenessMappingTests
{
    [Fact]
    public void CounselorQueue_SessionId_UniqueIndex_IsPartialOnDeletedAtNull()
    {
        using var db = TestDbContextFactory.CreateInMemory();
        var index = db.Model.FindEntityType(typeof(CounselorQueueItem))!
            .GetIndexes()
            .Single(i => i.GetDatabaseName() == "ux_counselor_queue_session_id_active");

        Assert.True(index.IsUnique);
        Assert.Equal("deleted_at IS NULL", index.GetFilter());
        Assert.Contains(
            index.Properties,
            p => p.Name == nameof(CounselorQueueItem.SessionId));
    }
}
