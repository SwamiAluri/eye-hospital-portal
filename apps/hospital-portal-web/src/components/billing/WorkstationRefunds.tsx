'use client';

import { Loader2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatInr } from '@/lib/billing/group-bill-items';
import { formatWorkstationInstant } from '@/lib/billing/workstation-model';
import {
  REFUND_TEST_IDS,
  findRefundLedgerLine,
  type RefundRecord,
} from '@/lib/billing/refund-contract';
import type { OpdBillPayment } from '@/lib/api/opd-billing.api';

function statusLabel(status: RefundRecord['status']): string {
  if (status === 'pending') return 'Pending authorization';
  if (status === 'approved') return 'Approved — complete payout';
  if (status === 'rejected') return 'Rejected';
  return 'Completed';
}

export function WorkstationRefunds({
  refunds,
  payments,
  loading,
  error,
  canRequest,
  canAuthorize,
  canComplete,
  onRequest,
  onApprove,
  onReject,
  onComplete,
}: {
  refunds: RefundRecord[];
  payments: OpdBillPayment[];
  loading: boolean;
  error?: string | null;
  canRequest: boolean;
  canAuthorize: boolean;
  canComplete: boolean;
  onRequest?: () => void;
  onApprove?: (refund: RefundRecord) => void;
  onReject?: (refund: RefundRecord) => void;
  onComplete?: (refund: RefundRecord) => void;
}) {
  const rows = [...refunds].sort((a, b) => {
    const ta = new Date(a.requestedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.requestedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });

  return (
    <section aria-labelledby="ip-billing-refunds-heading" data-testid={REFUND_TEST_IDS.section}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 id="ip-billing-refunds-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Refunds
        </h3>
        {canRequest && onRequest ? (
          <Button
            size="sm"
            variant="outline"
            className="bill-print-hide border-red-300 text-red-700 hover:bg-red-50"
            data-testid={REFUND_TEST_IDS.trigger}
            onClick={onRequest}
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Request refund
          </Button>
        ) : null}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2 px-1 py-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading refunds…
        </p>
      ) : error ? (
        <p className="text-sm text-red-800 px-1 py-2">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1 py-2">
          No refund requests on this bill. Request does not move money until a refund is authorized and completed.
        </p>
      ) : (
        <div className="rounded-md border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead className="bill-print-hide">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((refund) => {
                const line = findRefundLedgerLine(payments, refund.id);
                return (
                  <TableRow key={refund.id} data-testid={REFUND_TEST_IDS.row} data-refund-status={refund.status}>
                    <TableCell className="whitespace-nowrap">
                      {formatWorkstationInstant(refund.requestedAt || refund.createdAt)}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatInr(refund.refundAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={refund.status === 'completed' ? 'default' : 'outline'}>
                        {statusLabel(refund.status)}
                      </Badge>
                      {refund.refundReason ? (
                        <p className="text-xs text-muted-foreground mt-1 max-w-[18rem] truncate" title={refund.refundReason}>
                          {refund.refundReason}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {line?.receiptNumber || line?.paymentReference || (refund.status === 'completed' ? 'Posted' : '—')}
                    </TableCell>
                    <TableCell className="bill-print-hide">
                      <div className="flex flex-wrap gap-2">
                        {refund.status === 'pending' && canAuthorize ? (
                          <>
                            <Button
                              size="sm"
                              data-testid={REFUND_TEST_IDS.authorize}
                              onClick={() => onApprove?.(refund)}
                            >
                              Authorize
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={REFUND_TEST_IDS.reject}
                              onClick={() => onReject?.(refund)}
                            >
                              Reject
                            </Button>
                          </>
                        ) : null}
                        {refund.status === 'approved' && canComplete ? (
                          <Button
                            size="sm"
                            data-testid={REFUND_TEST_IDS.complete}
                            onClick={() => onComplete?.(refund)}
                          >
                            Complete payout
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
