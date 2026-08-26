using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using AuthService.Models.Domain;

namespace AuthService.Services
{
    /// <summary>
    /// Service interface for refund management
    /// </summary>
    public interface IRefundService
    {
        /// <summary>
        /// Request a refund for an OPD bill
        /// </summary>
        Task<Refund> RequestRefundAsync(
            Guid billId,
            decimal amount,
            string reason,
            Guid requestedBy,
            string? refundMode = null,
            string? notes = null);

        /// <summary>
        /// Get refund by ID
        /// </summary>
        Task<Refund?> GetRefundByIdAsync(Guid refundId);

        /// <summary>
        /// Get all refunds for a bill
        /// </summary>
        Task<List<Refund>> GetRefundsByBillIdAsync(Guid billId);

        /// <summary>
        /// Get all refunds for a patient
        /// </summary>
        Task<List<Refund>> GetRefundsByPatientIdAsync(Guid patientId);

        /// <summary>
        /// Get pending refunds (for authorization)
        /// </summary>
        Task<List<Refund>> GetPendingRefundsAsync(Guid tenantId);

        /// <summary>
        /// Authorize a refund request
        /// </summary>
        Task<Refund> AuthorizeRefundAsync(Guid refundId, bool approved, Guid authorizedBy, string? notes = null);

        /// <summary>
        /// Complete refund processing
        /// </summary>
        Task<Refund> CompleteRefundAsync(Guid refundId, string refundMode, string? notes = null);

        /// <summary>
        /// Reject a refund request
        /// </summary>
        Task<Refund> RejectRefundAsync(Guid refundId, Guid rejectedBy, string reason);

        /// <summary>
        /// Get refund statistics for tenant
        /// </summary>
        Task<RefundStatistics> GetRefundStatisticsAsync(Guid tenantId, DateTime? fromDate = null, DateTime? toDate = null);
    }

    public class RefundStatistics
    {
        public int TotalRequests { get; set; }
        public int PendingRequests { get; set; }
        public int ApprovedRequests { get; set; }
        public int CompletedRequests { get; set; }
        public int RejectedRequests { get; set; }
        public decimal TotalRefundAmount { get; set; }
        public decimal CompletedRefundAmount { get; set; }
    }
}
