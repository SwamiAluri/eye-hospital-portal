'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { useBranchContext } from '@/hooks/use-branch-context';
import { useHasPermission } from '@/hooks/use-permissions';
import { LMS_SPECIMENS_PERMISSIONS } from '@/lib/lms/lms-permissions';
import {
  getLmsSpecimen,
  newLmsIdempotencyKey,
  parseLmsSpecimenApiError,
  printLmsSpecimenLabel,
  type LmsSpecimenDetailDto,
  type LmsSpecimenLabelPayloadDto,
} from '@/lib/lms/lms-specimens.api';
import {
  SPECIMEN_LABEL_POPUP_BLOCKED_MESSAGE,
  abandonSpecimenLabelPrintWindow,
  openSpecimenLabelPrintWindow,
  writeSpecimenLabelPrint,
} from '@/lib/lms/specimen-label-print';
import { ReceiveSpecimenDialog } from '@/components/lms/specimens/ReceiveSpecimenDialog';
import { RejectSpecimenDialog } from '@/components/lms/specimens/RejectSpecimenDialog';
import { ReprintSpecimenLabelDialog } from '@/components/lms/specimens/ReprintSpecimenLabelDialog';

type Props = {
  specimenId: string;
};

function formatDob(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function renderCode128Svg(value: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, value, {
    format: 'CODE128',
    width: 1.4,
    height: 48,
    displayValue: false,
    margin: 0,
  });
  return svg.outerHTML;
}

export function SpecimenDetailView({ specimenId }: Props) {
  const { branches, branchId: contextBranchId } = useBranchContext();
  const canReceive = useHasPermission(LMS_SPECIMENS_PERMISSIONS.receive);
  const canBarcodeView = useHasPermission(LMS_SPECIMENS_PERMISSIONS.barcodeView);
  const canPrint = useHasPermission(LMS_SPECIMENS_PERMISSIONS.labelPrint);
  const canReprint = useHasPermission(LMS_SPECIMENS_PERMISSIONS.labelReprint);
  const [detail, setDetail] = useState<LmsSpecimenDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reprintOpen, setReprintOpen] = useState(false);
  const previewRef = useRef<SVGSVGElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await getLmsSpecimen(specimenId));
    } catch (e) {
      setError(parseLmsSpecimenApiError(e, 'Failed to load specimen.').message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [specimenId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!previewRef.current || !detail?.barcodeValue || !canBarcodeView) return;
    try {
      JsBarcode(previewRef.current, detail.barcodeValue, {
        format: 'CODE128',
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 12,
        margin: 4,
      });
    } catch {
      // Preview is optional when value cannot render.
    }
  }, [detail?.barcodeValue, canBarcodeView]);

  const operatingBranchId = contextBranchId || detail?.collectionBranchId || '';

  const applyLabelState = (label: LmsSpecimenLabelPayloadDto) => {
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            barcodeValue: label.barcodeValue,
            barcodeId: label.barcodeId,
            rowVersion: label.specimenRowVersion,
          }
        : prev,
    );
  };

  const renderLabelIntoPrintWindow = (win: Window, label: LmsSpecimenLabelPayloadDto) => {
    try {
      const svg = renderCode128Svg(label.barcodeValue);
      writeSpecimenLabelPrint(win, label, svg);
      toast.success(
        label.printType === 'Reprint' ? 'Label reprint sent to printer.' : 'Label sent to printer.',
      );
    } catch {
      abandonSpecimenLabelPrintWindow(win);
      toast.error('Label data saved but barcode rendering failed.');
    }
  };

  const onPrint = async () => {
    if (!detail || !operatingBranchId) {
      setActionError('Select an operating branch before printing.');
      return;
    }
    // Open while still in the user-gesture stack — before any await.
    const printWindow = openSpecimenLabelPrintWindow();
    if (!printWindow) {
      setActionError(SPECIMEN_LABEL_POPUP_BLOCKED_MESSAGE);
      toast.error(SPECIMEN_LABEL_POPUP_BLOCKED_MESSAGE);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const label = await printLmsSpecimenLabel(detail.id, {
        expectedRowVersion: detail.rowVersion,
        operatingBranchId,
        idempotencyKey: newLmsIdempotencyKey(),
      });
      applyLabelState(label);
      renderLabelIntoPrintWindow(printWindow, label);
    } catch (e) {
      abandonSpecimenLabelPrintWindow(printWindow);
      const err = parseLmsSpecimenApiError(e, 'Print failed.');
      setActionError(err.message);
      if (err.isConcurrencyConflict) toast.error('Specimen changed. Reloading…');
      if (err.isConfigurationFailure) toast.error('Barcode configuration unavailable.');
      if (err.isPermissionDenied) toast.error('You do not have permission to print labels.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading specimen…</p>;
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive" data-testid="specimen-detail-error">
          {error}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!detail) return null;

  const eligible = detail.status === 'Collected';
  const hasBarcode = Boolean(detail.barcodeValue);
  const branchName = (id?: string | null) =>
    id ? branches.find((b) => b.branchId === id)?.branchName ?? id : '—';

  return (
    <div className="space-y-4 text-sm" data-testid="specimen-detail">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold font-mono text-xs" data-testid="specimen-id">
          {detail.id}
        </span>
        <span
          className="rounded border px-2 py-0.5 text-xs font-medium"
          data-testid="specimen-status"
        >
          {detail.status}
        </span>
        {canReceive && eligible ? (
          <>
            <Button
              type="button"
              size="sm"
              data-testid="specimen-detail-receive"
              onClick={() => setReceiveOpen(true)}
            >
              Receive
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="specimen-detail-reject"
              onClick={() => setRejectOpen(true)}
            >
              Reject
            </Button>
          </>
        ) : null}
        {canPrint && (detail.status !== 'Rejected' || hasBarcode) ? (
          <Button
            type="button"
            size="sm"
            variant={hasBarcode ? 'outline' : 'default'}
            data-testid="specimen-print-label"
            disabled={busy || !operatingBranchId || (detail.status === 'Rejected' && !hasBarcode)}
            onClick={() => void onPrint()}
          >
            {hasBarcode ? 'Print Label' : 'Generate / Print Label'}
          </Button>
        ) : null}
        {canReprint && hasBarcode ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="specimen-reprint-label"
            disabled={busy || !operatingBranchId}
            onClick={() => setReprintOpen(true)}
          >
            Reprint
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p className="text-sm text-destructive" data-testid="specimen-label-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">MRN</dt>
        <dd data-testid="specimen-mrn">{detail.patientMrnSnapshot ?? '—'}</dd>
        <dt className="text-muted-foreground">Patient</dt>
        <dd data-testid="specimen-patient-name">{detail.patientNameSnapshot ?? '—'}</dd>
        <dt className="text-muted-foreground">DOB</dt>
        <dd data-testid="specimen-dob">{formatDob(detail.patientDateOfBirthSnapshot)}</dd>
        <dt className="text-muted-foreground">Order</dt>
        <dd>{detail.orderNumber}</dd>
        <dt className="text-muted-foreground">Collection task</dt>
        <dd>{detail.collectionTaskNumber ?? detail.collectionTaskId}</dd>
        <dt className="text-muted-foreground">Collection branch</dt>
        <dd data-testid="specimen-branch">{branchName(detail.collectionBranchId)}</dd>
        <dt className="text-muted-foreground">Collection location</dt>
        <dd>{detail.locationText ?? '—'}</dd>
        <dt className="text-muted-foreground">Collector</dt>
        <dd className="font-mono text-xs" data-testid="specimen-collector">
          {detail.collectedByUserId}
        </dd>
        <dt className="text-muted-foreground">Collected at (UTC)</dt>
        <dd data-testid="specimen-collected-at">
          {new Date(detail.collectedAt).toISOString()}
        </dd>

        {(canBarcodeView || hasBarcode) && hasBarcode ? (
          <>
            <dt className="text-muted-foreground">Barcode</dt>
            <dd className="font-mono" data-testid="specimen-barcode">
              {detail.barcodeValue}
            </dd>
          </>
        ) : null}

        {detail.status === 'Received' ? (
          <>
            <dt className="text-muted-foreground">Accession</dt>
            <dd className="font-mono" data-testid="specimen-accession">
              {detail.accession}
            </dd>
            <dt className="text-muted-foreground">Receiving branch</dt>
            <dd data-testid="specimen-receiving-branch">
              {branchName(detail.receivingBranchId)}
            </dd>
            <dt className="text-muted-foreground">Receiving location</dt>
            <dd>{detail.receivingLocationText ?? '—'}</dd>
            <dt className="text-muted-foreground">Received by</dt>
            <dd className="font-mono text-xs" data-testid="specimen-received-by">
              {detail.receivedByUserId}
            </dd>
            <dt className="text-muted-foreground">Received at (UTC)</dt>
            <dd data-testid="specimen-received-at">
              {detail.receivedAtUtc ? new Date(detail.receivedAtUtc).toISOString() : '—'}
            </dd>
          </>
        ) : null}

        {detail.status === 'Rejected' ? (
          <>
            <dt className="text-muted-foreground">Rejection reason</dt>
            <dd data-testid="specimen-rejection-reason">
              {detail.rejectionReasonLabelSnapshot ?? detail.rejectionReasonCode ?? '—'}
              {detail.rejectionReasonCode ? (
                <span className="ml-1 font-mono text-xs text-muted-foreground">
                  ({detail.rejectionReasonCode})
                </span>
              ) : null}
            </dd>
            <dt className="text-muted-foreground">Rejected by</dt>
            <dd className="font-mono text-xs" data-testid="specimen-rejected-by">
              {detail.rejectedByUserId}
            </dd>
            <dt className="text-muted-foreground">Rejected at (UTC)</dt>
            <dd data-testid="specimen-rejected-at">
              {detail.rejectedAtUtc ? new Date(detail.rejectedAtUtc).toISOString() : '—'}
            </dd>
          </>
        ) : null}
      </dl>

      {canBarcodeView && hasBarcode ? (
        <div className="rounded border p-2" data-testid="specimen-barcode-preview">
          <svg ref={previewRef} role="img" aria-label={`Barcode ${detail.barcodeValue}`} />
        </div>
      ) : null}

      <div>
        <div className="mb-1 font-medium">Linked OrderTests</div>
        <ul className="space-y-1 rounded border p-2" data-testid="specimen-order-tests">
          {detail.orderTests.map((t) => (
            <li key={t.id}>
              {t.displayNameSnapshot ?? t.orderTestId}
              {t.internalOrderCodeSnapshot ? (
                <span className="text-muted-foreground"> ({t.internalOrderCodeSnapshot})</span>
              ) : null}
              {t.orderTestStatus ? (
                <span className="text-muted-foreground"> · {t.orderTestStatus}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {receiveOpen ? (
        <ReceiveSpecimenDialog
          specimenId={detail.id}
          open={receiveOpen}
          onOpenChange={setReceiveOpen}
          onSuccess={(d) => {
            setDetail(d);
            setReceiveOpen(false);
          }}
        />
      ) : null}
      {rejectOpen ? (
        <RejectSpecimenDialog
          specimenId={detail.id}
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          onSuccess={(d) => {
            setDetail(d);
            setRejectOpen(false);
          }}
        />
      ) : null}
      {reprintOpen ? (
        <ReprintSpecimenLabelDialog
          specimenId={detail.id}
          rowVersion={detail.rowVersion}
          operatingBranchId={operatingBranchId}
          open={reprintOpen}
          onOpenChange={setReprintOpen}
          onSuccess={(label, printWindow) => {
            applyLabelState(label);
            renderLabelIntoPrintWindow(printWindow, label);
          }}
        />
      ) : null}
    </div>
  );
}
