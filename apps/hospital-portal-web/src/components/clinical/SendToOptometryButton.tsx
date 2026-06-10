'use client';

import { useEffect, useState } from 'react';
import { Eye, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { visitsApi } from '@/lib/api/visits.api';
import { useRoutingReasonsQuery } from '@/hooks/use-optometry-queue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SendToOptometryButtonProps {
  patientId: string;
  visitId?: string;
  defaultReasonCode?: string;
  className?: string;
  variant?: 'default' | 'outline';
}

export default function SendToOptometryButton({
  patientId,
  visitId: visitIdProp,
  defaultReasonCode = 'DOCTOR_REQUESTED',
  className,
  variant = 'outline',
}: SendToOptometryButtonProps) {
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState(defaultReasonCode);
  const [notes, setNotes] = useState('');
  const [visitId, setVisitId] = useState(visitIdProp ?? '');
  const [resolvingVisit, setResolvingVisit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: reasons = [], isLoading: reasonsLoading } = useRoutingReasonsQuery();

  useEffect(() => {
    if (visitIdProp) {
      setVisitId(visitIdProp);
    }
  }, [visitIdProp]);

  useEffect(() => {
    if (!open || visitIdProp || visitId) return;

    let cancelled = false;
    setResolvingVisit(true);
    visitsApi
      .getPatientVisits(patientId)
      .then((visits) => {
        if (cancelled) return;
        const active = visits.find(
          (v) =>
            v.status !== 'completed' &&
            v.status !== 'cancelled' &&
            v.status !== 'no_show',
        );
        if (active) {
          setVisitId(active.id);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not resolve today\'s visit for this patient');
      })
      .finally(() => {
        if (!cancelled) setResolvingVisit(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, patientId, visitId, visitIdProp]);

  const handleSend = async () => {
    if (!visitId) {
      toast.error('No active visit found for this patient today');
      return;
    }

    setSubmitting(true);
    try {
      await visitsApi.sendTo({
        visitId,
        station: 'optometrist',
        reasonCode,
        notes: notes.trim() || undefined,
      });
      toast.success('Patient sent to optometry queue');
      setOpen(false);
      setNotes('');
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to send patient to optometry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Eye className="w-4 h-4 mr-2" />
        Send to Optometry
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send to Optometry</DialogTitle>
            <DialogDescription>
              Route this patient to the shared optometry queue with a reason for the visit pass.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!visitIdProp && (
              <p className="text-sm text-muted-foreground">
                {resolvingVisit
                  ? 'Looking up today\'s visit…'
                  : visitId
                    ? `Visit: ${visitId.slice(0, 8)}…`
                    : 'No active visit found for today.'}
              </p>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Routing reason
              </label>
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                disabled={reasonsLoading || reasons.length === 0}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {(reasons.length > 0 ? reasons : [{ code: defaultReasonCode, label: 'Doctor requested' }]).map(
                  (r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Additional context for the optometrist…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={submitting || !visitId || resolvingVisit}
            >
              <Send className="w-4 h-4 mr-2" />
              {submitting ? 'Sending…' : 'Send to Queue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
