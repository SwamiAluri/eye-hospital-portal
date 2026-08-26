'use client';

import Link from 'next/link';
import { AlertCircle, IndianRupee, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GroupedBillItems } from '@/components/billing/GroupedBillItems';
import type { ChargeLineItem } from '@/lib/billing/group-bill-items';
import { formatInr } from '@/lib/billing/group-bill-items';
import type { OpdBill, OpdBillPayment } from '@/lib/api/opd-billing.api';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import type { ChargeCompleteness } from '@/lib/api/charge-reconciliation.api';
import { resolveNextBillingAction } from '@/lib/billing/next-billing-action';
import {
  canApplyWorkstationDiscount,
  canMutateWorkstationBill,
  ADD_ITEM_TEST_IDS,
  DISCOUNT_TEST_IDS,
} from '@/lib/billing/workstation-mutations';
import {
  WORKSTATION_TEST_IDS,
  ageSexLabel,
  buildWorkstationContext,
  formatWorkstationInstant,
  summarizeWorkstation,
  type IpFinancialSummarySlice,
} from '@/lib/billing/workstation-model';
import { WorkstationRefunds } from '@/components/billing/WorkstationRefunds';
import { canRequestRefundOnBill, type RefundRecord } from '@/lib/billing/refund-contract';

function paymentReceipt(p: OpdBillPayment): string {
  return p.receiptNumber || p.paymentReference || '—';
}

function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium truncate" title={value}>{value}</dd>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  emphasize,
  testId,
}: {
  label: string;
  value: string;
  emphasize?: 'due' | 'muted';
  testId?: string;
}) {
  return (
    <div className="min-w-[7rem]" data-testid={testId}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          emphasize === 'due'
            ? 'text-lg font-semibold tabular-nums text-red-700'
            : emphasize === 'muted'
              ? 'text-lg font-semibold tabular-nums text-muted-foreground'
              : 'text-lg font-semibold tabular-nums'
        }
      >
        {value}
      </p>
    </div>
  );
}

export function IpBillingWorkstation({
  bill,
  journey,
  journeyLoading,
  ipSummary,
  completeness,
  items,
  itemsLoading,
  itemsError,
  canCollect,
  canUpdateBill,
  asOf,
  onCollect,
  onFinalize,
  onAddItem,
  onDiscount,
  onPrint,
  onRetryItems,
  refunds,
  refundsLoading,
  refundsError,
  canRefund,
  canAuthorizeRefund,
  onRequestRefund,
  onApproveRefund,
  onRejectRefund,
  onCompleteRefund,
}: {
  bill: OpdBill;
  journey?: PatientJourneyRowDto | null;
  journeyLoading?: boolean;
  ipSummary?: IpFinancialSummarySlice;
  completeness?: ChargeCompleteness | null;
  items: ChargeLineItem[];
  itemsLoading: boolean;
  itemsError?: string | null;
  canCollect: boolean;
  canUpdateBill?: boolean;
  asOf?: string | null;
  onCollect: () => void;
  onFinalize?: () => void;
  onAddItem?: () => void;
  onDiscount?: () => void;
  onPrint: () => void;
  onRetryItems?: () => void;
  refunds?: RefundRecord[];
  refundsLoading?: boolean;
  refundsError?: string | null;
  canRefund?: boolean;
  canAuthorizeRefund?: boolean;
  onRequestRefund?: () => void;
  onApproveRefund?: (refund: RefundRecord) => void;
  onRejectRefund?: (refund: RefundRecord) => void;
  onCompleteRefund?: (refund: RefundRecord) => void;
}) {
  const context = buildWorkstationContext({ bill, journey });
  const summary = summarizeWorkstation(bill, {
    packageAmount: context.packageAmount,
    ipSummary,
  });
  const next = resolveNextBillingAction({ bill, canCollect });
  const allowMutate = canMutateWorkstationBill(bill, Boolean(canUpdateBill));
  const allowDiscount = canApplyWorkstationDiscount(bill, Boolean(canUpdateBill));
  const completenessIssues = Boolean(
    completeness?.warnings?.length
    || (completeness?.implantsMissingCharge ?? 0) > 0
    || (completeness?.consumablesPending ?? 0) > 0
    || (completeness?.exceptionsOpen ?? 0) > 0,
  );
  const payments = [...(bill.payments ?? [])].sort(
    (a, b) => new Date(b.paymentDate || b.createdAt).getTime() - new Date(a.paymentDate || a.createdAt).getTime(),
  );
  const financialLabel = context.financialState || bill.status;

  return (
    <Card className="border-blue-300 bg-blue-50/40 bill-print-root" data-testid={WORKSTATION_TEST_IDS.root}>
      <CardContent className="p-4 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">IP Billing</p>
            <h2 className="text-lg font-semibold font-mono truncate">
              {bill.billNumber}
            </h2>
            <p className="text-sm text-muted-foreground">
              {context.encounterKind === 'ip' ? 'In-patient encounter' : 'OPD bill'}
              {asOf ? (
                <span data-testid={WORKSTATION_TEST_IDS.asOf}> · As of {formatWorkstationInstant(asOf)}</span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 bill-print-hide" data-testid={WORKSTATION_TEST_IDS.actions}>
            <Badge variant={bill.balanceDue > 0 ? 'outline' : 'default'}>{financialLabel}</Badge>
            {allowMutate && onAddItem ? (
              <Button variant="outline" data-testid={ADD_ITEM_TEST_IDS.trigger} onClick={onAddItem}>
                Add item
              </Button>
            ) : null}
            {allowDiscount && onDiscount ? (
              <Button variant="outline" data-testid={DISCOUNT_TEST_IDS.trigger} onClick={onDiscount}>
                Discount
              </Button>
            ) : null}
            {next.kind === 'collect' && (
              <Button data-testid="billing-opd-collect" onClick={onCollect}>
                <IndianRupee className="h-4 w-4 mr-2" />
                {next.label}
              </Button>
            )}
            {next.kind === 'finalize' && onFinalize && (
              <Button data-testid="billing-opd-finalize" onClick={onFinalize}>
                {next.label}
              </Button>
            )}
            <Button variant="outline" onClick={onPrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        <section aria-labelledby="ip-billing-context-heading" data-testid={WORKSTATION_TEST_IDS.context}>
          <h3 id="ip-billing-context-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Patient context
          </h3>
          {journeyLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading encounter…
            </p>
          ) : (
            <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-3">
              <ContextField label="Patient" value={context.patientName} />
              <ContextField label="UHID" value={context.uhid || '—'} />
              <ContextField label="Age / Sex" value={ageSexLabel(context.age, context.sex)} />
              <ContextField label="IP encounter" value={context.journeyId || 'OPD only'} />
              <ContextField label="Admission" value={formatWorkstationInstant(context.admittedAt)} />
              <ContextField label="Procedure" value={context.procedureName || '—'} />
              <ContextField label="Laterality" value={context.laterality || '—'} />
              <ContextField label="Surgeon" value={context.surgeonName || '—'} />
              <ContextField label="Payer / mode" value={context.payerMode || '—'} />
              <ContextField
                label="Package"
                value={context.packageAmount != null ? formatInr(context.packageAmount) : '—'}
              />
              <ContextField label="Financial state" value={context.financialState || '—'} />
            </dl>
          )}
        </section>

        <section aria-labelledby="ip-billing-summary-heading" data-testid={WORKSTATION_TEST_IDS.summary}>
          <h3 id="ip-billing-summary-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Financial summary
          </h3>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 rounded-md border bg-white p-3"
            aria-live="polite"
          >
            <SummaryCell label="Charges" value={formatInr(summary.charges)} testId="ip-billing-charges" />
            <SummaryCell
              label="Package"
              value={summary.packageAmount != null ? formatInr(summary.packageAmount) : '—'}
              emphasize="muted"
              testId="ip-billing-package"
            />
            <SummaryCell label="Adjustments" value={formatInr(summary.adjustments)} testId="ip-billing-adjustments" />
            <SummaryCell
              label="Advance"
              value={summary.advance != null ? formatInr(summary.advance) : '—'}
              testId="ip-billing-advance"
            />
            <SummaryCell label="Paid" value={formatInr(summary.paid)} testId="ip-billing-paid" />
            <SummaryCell
              label="Due"
              value={formatInr(summary.due)}
              emphasize={summary.due > 0 ? 'due' : undefined}
              testId="ip-billing-due"
            />
            {summary.payerShare != null ? (
              <SummaryCell
                label="Payer share"
                value={formatInr(summary.payerShare)}
                emphasize="muted"
                testId={WORKSTATION_TEST_IDS.payerShare}
              />
            ) : null}
            {summary.patientShare != null ? (
              <SummaryCell
                label="Patient share"
                value={formatInr(summary.patientShare)}
                emphasize="muted"
                testId={WORKSTATION_TEST_IDS.patientShare}
              />
            ) : null}
          </div>
        </section>

        <section aria-labelledby="ip-billing-charges-heading" data-testid={WORKSTATION_TEST_IDS.charges}>
          <h3 id="ip-billing-charges-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Bill / charge detail
          </h3>
          {itemsLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2 px-1 py-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading charge lines…
            </p>
          ) : itemsError ? (
            <div className="flex items-start gap-2 text-sm text-red-800 px-1 py-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p>{itemsError}</p>
                {onRetryItems ? (
                  <Button variant="outline" size="sm" className="mt-2" onClick={onRetryItems}>
                    Retry
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <GroupedBillItems items={items} layout="detail" />
          )}
        </section>

        <section aria-labelledby="ip-billing-payments-heading" data-testid={WORKSTATION_TEST_IDS.payments}>
          <h3 id="ip-billing-payments-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Payment history
          </h3>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1 py-2">No payments recorded on this bill yet.</p>
          ) : (
            <div className="rounded-md border bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Payment mode</TableHead>
                    <TableHead>Payment kind</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatWorkstationInstant(p.paymentDate || p.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{paymentReceipt(p)}</TableCell>
                      <TableCell className="uppercase">{p.paymentMode || '—'}</TableCell>
                      <TableCell>{p.paymentKind || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInr(Number(p.amount) || 0)}</TableCell>
                      <TableCell>{p.status || 'completed'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <WorkstationRefunds
          refunds={refunds ?? []}
          payments={payments}
          loading={Boolean(refundsLoading)}
          error={refundsError}
          canRequest={canRequestRefundOnBill(bill, Boolean(canRefund))}
          canAuthorize={Boolean(canAuthorizeRefund)}
          canComplete={Boolean(canRefund)}
          onRequest={onRequestRefund}
          onApprove={onApproveRefund}
          onReject={onRejectRefund}
          onComplete={onCompleteRefund}
        />

        <section aria-labelledby="ip-billing-status-heading" data-testid={WORKSTATION_TEST_IDS.status}>
          <h3 id="ip-billing-status-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Financial status
          </h3>
          <div className="rounded-md border bg-white p-3 space-y-2">
            <p className="text-sm">
              <span className="font-medium">Current state: </span>
              {financialLabel}
              {bill.isFinalized ? ' (finalized)' : ''}
            </p>
            <p className="text-sm" aria-live="polite">
              <span className="font-medium">Outstanding: </span>
              {summary.due > 0
                ? `${formatInr(summary.due)} still due on this bill.`
                : 'Nothing is due. Clearance on this bill is complete.'}
            </p>
            <p className="text-sm" data-testid={WORKSTATION_TEST_IDS.nextAction}>
              <span className="font-medium">Next permitted action: </span>
              {next.label}. {next.reason}
            </p>
            {completenessIssues ? (
              <div className="text-sm text-amber-900 space-y-2" data-testid={WORKSTATION_TEST_IDS.completeness}>
                {completeness?.warnings?.length ? (
                  <ul className="list-disc pl-5">
                    {completeness.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Charge completeness is incomplete for this bill.</p>
                )}
                <p>
                  Resolve unmapped or missing charges in{' '}
                  <Link href="/dashboard/admin/charge-mapping" className="underline font-medium">
                    Charge mapping
                  </Link>
                  {' '}or review{' '}
                  <Link href="/dashboard/admin/charge-reconciliation" className="underline font-medium">
                    Charge reconciliation
                  </Link>
                  . Those pages own catalog mapping — this desk does not post OT usage.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
