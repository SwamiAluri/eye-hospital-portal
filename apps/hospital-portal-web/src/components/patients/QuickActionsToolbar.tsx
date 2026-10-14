'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogIn,
  AlertTriangle,
  Calendar,
  ChevronDown,
  Clock,
  XCircle,
  RotateCcw,
  UserX,
  MessageSquare,
  FileText,
  Upload,
  Download,
  MessageCircle,
  DollarSign,
  CreditCard,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHasPermission } from '@/hooks/use-permissions';
import {
  buildCounsellorHandoffHref,
  buildFrontDeskCheckInHref,
} from '@/lib/patients/patient-handoff';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { patientPrintSummaryUrl } from '@/lib/patients/patient-routes';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

interface QuickActionsToolbarProps {
  patientId: string;
  patientName: string;
  variant?: 'panel' | 'compact';
  onExportPdf?: () => void;
  onOpenScheduling?: () => void;
  onOpenBilling?: () => void;
  onOpenCounseling?: () => void;
  onOpenInsurance?: () => void;
  onActionComplete?: (action: string) => void;
}

export const QuickActionsToolbar: React.FC<QuickActionsToolbarProps> = ({
  patientId,
  patientName,
  variant = 'panel',
  onExportPdf,
  onOpenScheduling,
  onOpenBilling,
  onOpenCounseling,
  onOpenInsurance,
  onActionComplete,
}) => {
  const router = useRouter();
  const [showActionModal, setShowActionModal] = useState<string | null>(null);
  const canBookAppointment = useHasPermission('appointment.view');

  const runAction = (actionType: string, run: () => void) => {
    run();
    onActionComplete?.(actionType);
  };

  const goTo = (path: string, actionType: string) => {
    runAction(actionType, () => router.push(path));
  };

  const openScheduling = (actionType: string) => {
    if (onOpenScheduling) {
      runAction(actionType, onOpenScheduling);
    } else {
      goTo(`/dashboard/appointments/schedule?patientId=${patientId}`, actionType);
    }
  };

  const primaryActions: QuickAction[] = [
    {
      id: 'check-in',
      label: 'Check-in',
      icon: LogIn,
      onClick: () =>
        goTo(buildFrontDeskCheckInHref(patientId), 'check-in'),
    },
    {
      id: 'emergency-check-in',
      label: 'Emergency',
      icon: AlertTriangle,
      onClick: () =>
        goTo(
          `${buildFrontDeskCheckInHref(patientId)}&emergency=1`,
          'emergency-check-in',
        ),
    },
    ...(canBookAppointment
      ? ([
          {
            id: 'book-appointment',
            label: 'Book appt',
            icon: Calendar,
            onClick: () => openScheduling('book-appointment'),
          },
        ] as QuickAction[])
      : []),
  ];

  const moreActions: QuickAction[] = [
    {
      id: 'send-to-counselor',
      label: 'Counselor',
      icon: MessageCircle,
      onClick: () => {
        if (onOpenCounseling) {
          runAction('send-to-counselor', onOpenCounseling);
        } else {
          goTo(buildCounsellorHandoffHref(patientId), 'send-to-counselor');
        }
      },
    },
    {
      id: 'pre-auth',
      label: 'Pre-auth',
      icon: ShieldCheck,
      onClick: () => {
        if (onOpenInsurance) {
          runAction('pre-auth', onOpenInsurance);
        } else {
          goTo(`/dashboard/patients/${patientId}?tab=insurance`, 'pre-auth');
        }
      },
    },
    {
      id: 'view-queue',
      label: 'Queue status',
      icon: Clock,
      onClick: () => goTo('/dashboard/frontdesk/queue', 'view-queue'),
    },
    {
      id: 'reschedule',
      label: 'Reschedule',
      icon: RotateCcw,
      onClick: () => openScheduling('reschedule'),
    },
    {
      id: 'cancel-appointment',
      label: 'Cancel appt',
      icon: XCircle,
      onClick: () => {
        if (onOpenScheduling) {
          runAction('cancel-appointment', onOpenScheduling);
        } else {
          goTo(`/dashboard/appointments?patientId=${patientId}`, 'cancel-appointment');
        }
      },
    },
    {
      id: 'mark-no-show',
      label: 'No-show',
      icon: UserX,
      onClick: () => setShowActionModal('mark-no-show'),
    },
    {
      id: 'send-sms',
      label: 'Send SMS',
      icon: MessageSquare,
      onClick: () => setShowActionModal('send-sms'),
    },
    {
      id: 'call-patient',
      label: 'Call',
      icon: Phone,
      onClick: () => setShowActionModal('call-patient'),
    },
    {
      id: 'upload-document',
      label: 'Upload doc',
      icon: Upload,
      onClick: () => goTo(`/dashboard/patients/${patientId}?tab=documents`, 'upload-document'),
    },
    {
      id: 'export-summary',
      label: 'Export PDF',
      icon: Download,
      onClick: () => {
        if (onExportPdf) {
          runAction('export-summary', onExportPdf);
        } else {
          runAction('export-summary', () =>
            window.open(patientPrintSummaryUrl(patientId), '_blank'),
          );
        }
      },
    },
    {
      id: 'view-billing',
      label: 'Billing',
      icon: DollarSign,
      onClick: () => {
        if (onOpenBilling) {
          runAction('view-billing', onOpenBilling);
        } else {
          goTo(`/dashboard/billing/opd?patientId=${patientId}`, 'view-billing');
        }
      },
    },
    {
      id: 'print-card',
      label: 'Print card',
      icon: CreditCard,
      onClick: () =>
        runAction('print-card', () =>
          window.open(patientPrintSummaryUrl(patientId), '_blank'),
        ),
    },
    {
      id: 'medical-summary',
      label: 'Print summary',
      icon: FileText,
      onClick: () =>
        runAction('medical-summary', () =>
          window.open(patientPrintSummaryUrl(patientId), '_blank'),
        ),
    },
  ];

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {primaryActions.map((action) => {
        const isEmergency = action.id === 'emergency-check-in';
        const isCheckIn = action.id === 'check-in';
        return (
          <Button
            key={action.id}
            variant={isEmergency ? 'destructive' : isCheckIn ? 'default' : 'outline'}
            size="sm"
            onClick={action.onClick}
            className={
              isCheckIn
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : isEmergency
                  ? undefined
                  : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50'
            }
            data-testid={`patient-quick-action-${action.id}`}
          >
            <action.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{action.label}</span>
          </Button>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-200 text-gray-700"
            data-testid={patientLookupTestIds.recordQuickActionsMore}
          >
            More actions
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {moreActions.map((action, index) => (
            <React.Fragment key={action.id}>
              {index === 2 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={action.onClick}
                data-testid={`patient-quick-action-${action.id}`}
              >
                <action.icon className="mr-2 h-4 w-4 text-gray-500" />
                {action.label}
              </DropdownMenuItem>
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      {variant === 'compact' ? (
        toolbar
      ) : (
        <div className="border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-gray-700">Quick actions</h3>
            {toolbar}
          </div>
        </div>
      )}

      {showActionModal === 'send-sms' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Send SMS reminder</h3>
              <button
                onClick={() => setShowActionModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-gray-600">
              SMS reminders for <strong>{patientName}</strong> will open from the communications
              workflow once connected.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowActionModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {showActionModal && !['send-sms'].includes(showActionModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {showActionModal
                  .split('-')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
              </h3>
              <button
                onClick={() => setShowActionModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-gray-600">
              This action is coming soon. Use scheduling or front desk check-in for now.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowActionModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
