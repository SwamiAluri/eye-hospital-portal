'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AddPatientWizard,
  type HostedHardBlockUi,
  type HostedSoftMatchUi,
} from '@/components/patients/AddPatientWizard';
import { DuplicatePatientSoftMatchDialog } from '@/components/patients/DuplicatePatientSoftMatchDialog';
import { DuplicatePatientHardBlockDialog } from '@/components/patients/DuplicatePatientHardBlockDialog';
import type { DuplicateHardBlockCandidate } from '@/lib/patients/duplicate-hard-block';
import {
  applyRegistrationShellDismissAttempt,
  isDuplicateReviewActive,
  isRegistrationShellVisible,
  resolveRegistrationSessionRootOpen,
  shouldMountRegistrationWizard,
} from '@/lib/patients/registration-dialog-lifecycle';
import {
  REGISTRATION_RUNTIME_MARKER,
  regLife,
} from '@/lib/patients/registration-lifecycle-telemetry';
import { cn } from '@/lib/utils';

type DuplicateActions = {
  reviewSoft: (candidate: DuplicateHardBlockCandidate) => void;
  continueSoft: () => void;
  dismissSoft: () => void;
  reviewHard: (candidate: DuplicateHardBlockCandidate) => void;
  dismissHard: () => void;
};

export type AddPatientRegistrationPhase = 'registration' | 'duplicate-review' | 'closed';

/**
 * Owns soft/hard hosted UI while PatientHubPage owns session open.
 *
 * SESSION vs SHELL:
 * - Dialog Root `open={open}` follows the parent session for the whole transaction.
 * - Soft/hard review only hides the registration chrome (shell). It must never set
 *   session open=false — that unmounts AddPatientWizard and resets to empty PERSONAL.
 * - Soft/hard dialogs are sibling roots over the still-mounted wizard.
 *
 * Hosted soft/hard change handlers MUST be referentially stable — the wizard sync
 * effect lists them as deps; an inline wrapper causes maximum update depth.
 */
export function AddPatientDialog({
  open,
  onOpenChange,
  onCreated,
  onRegistrationComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (patientId: string) => void;
  onRegistrationComplete?: (patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    contactNumber?: string;
    bloodGroup?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    medicalRecordNumber?: string | null;
    photoUrl?: string;
    address?: string;
  }) => void;
}) {
  const createdId = useRef<string | null>(null);
  const duplicateActionsRef = useRef<DuplicateActions>({
    reviewSoft: () => undefined,
    continueSoft: () => undefined,
    dismissSoft: () => undefined,
    reviewHard: () => undefined,
    dismissHard: () => undefined,
  });
  /** Refs avoid stale onOpenChange closures during soft/hard transitions. */
  const softOpenRef = useRef(false);
  const hardOpenRef = useRef(false);
  const phaseRef = useRef<'registration' | 'duplicate-review'>('registration');
  const openRef = useRef(open);
  openRef.current = open;

  const [phase, setPhase] = useState<'registration' | 'duplicate-review'>('registration');
  const [softUi, setSoftUi] = useState<HostedSoftMatchUi>({
    open: false,
    candidates: [],
    registrationDraft: {},
    continuing: false,
  });
  const [hardUi, setHardUi] = useState<HostedHardBlockUi>({
    open: false,
    message: '',
    duplicates: [],
  });

  const softOpen = softUi.open;
  const hardOpen = hardUi.open && !softUi.open;
  softOpenRef.current = softOpen;
  hardOpenRef.current = hardOpen;
  phaseRef.current = phase;

  useEffect(() => {
    if (!open) {
      regLife('DIALOG_SESSION_CLOSED_EFFECT', { phase: phaseRef.current });
      setPhase('registration');
      setSoftUi({
        open: false,
        candidates: [],
        registrationDraft: {},
        continuing: false,
      });
      setHardUi({ open: false, message: '', duplicates: [] });
      createdId.current = null;
    } else {
      regLife('DIALOG_SESSION_OPEN_EFFECT');
    }
  }, [open]);

  useEffect(() => {
    regLife('DIALOG_MOUNT');
    return () => {
      regLife('DIALOG_UNMOUNT');
    };
  }, []);

  const close = useCallback(
    (next: boolean) => {
      regLife('DIALOG_CLOSE_CALL', {
        next,
        phase: phaseRef.current,
        softOpen: softOpenRef.current,
        hardOpen: hardOpenRef.current,
        hasCreatedId: Boolean(createdId.current),
      });
      if (!next && createdId.current) {
        const id = createdId.current;
        createdId.current = null;
        onCreated?.(id);
      }
      if (next) createdId.current = null;
      if (!next) setPhase('registration');
      onOpenChange(next);
    },
    [onOpenChange, onCreated],
  );

  const handleHostedSoftMatchUiChange = useCallback((next: HostedSoftMatchUi) => {
    regLife('SOFT_UI_CHANGE', {
      open: next.open,
      candidateCount: next.candidates?.length ?? 0,
      continuing: next.continuing,
    });
    setSoftUi(next);
  }, []);

  const handleHostedHardBlockUiChange = useCallback((next: HostedHardBlockUi) => {
    regLife('HARD_UI_CHANGE', {
      open: next.open,
      candidateCount: next.duplicates?.length ?? 0,
    });
    setHardUi(next);
  }, []);

  const handleDuplicatePhaseChange = useCallback((next: 'registration' | 'duplicate-review') => {
    regLife('PHASE_CHANGE', { next });
    setPhase(next === 'duplicate-review' ? 'duplicate-review' : 'registration');
  }, []);

  const duplicateActive = isDuplicateReviewActive({
    softOpen,
    hardOpen,
    phase,
  });
  const shellVisible = isRegistrationShellVisible({
    sessionOpen: open,
    softOpen,
    hardOpen,
  });
  const sessionRootOpen = resolveRegistrationSessionRootOpen(open);
  const wizardMounted = shouldMountRegistrationWizard(open);

  useEffect(() => {
    regLife('DIALOG_STATE', {
      sessionRootOpen,
      shellVisible,
      softOpen,
      hardOpen,
      phase,
      wizardMounted,
      duplicateActive,
    });
  }, [sessionRootOpen, shellVisible, softOpen, hardOpen, phase, wizardMounted, duplicateActive]);

  return (
    <>
      <Dialog
        open={sessionRootOpen}
        // Keep modal stable for the whole session. Toggling modal with soft/hard
        // remounts DialogContent children → AddPatientWizard resets to empty PERSONAL.
        modal={sessionRootOpen}
        onOpenChange={(next) => {
          const resolved = applyRegistrationShellDismissAttempt({
            sessionOpen: openRef.current,
            softOpen: softOpenRef.current,
            hardOpen: hardOpenRef.current,
            phase: phaseRef.current,
            nextOpen: next,
          });
          regLife('ROOT_ON_OPEN_CHANGE', {
            next,
            resolved,
            ignored: resolved === openRef.current && next !== openRef.current,
            sessionOpen: openRef.current,
            softOpen: softOpenRef.current,
            hardOpen: hardOpenRef.current,
            phase: phaseRef.current,
            shellVisible,
          });
          if (resolved === openRef.current) return;
          close(resolved);
        }}
      >
        <DialogContent
          size="full"
          // Do not toggle hideOverlay structurally — removing Overlay remounts portal content.
          // Soft/hard hide chrome via CSS/aria only (shellVisible).
          hideOverlay={false}
          hideCloseButton={!shellVisible}
          data-registration-phase={phase}
          data-registration-shell={shellVisible ? 'visible' : 'hidden'}
          data-testid="add-patient-registration-dialog"
          data-runtime-marker={REGISTRATION_RUNTIME_MARKER}
          aria-hidden={!shellVisible}
          style={
            !shellVisible
              ? { pointerEvents: 'none', opacity: 0, visibility: 'hidden' }
              : undefined
          }
          onEscapeKeyDown={(event) => {
            if (duplicateActive || !shellVisible) {
              regLife('SHELL_ESCAPE_PREVENTED', { duplicateActive, shellVisible });
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (duplicateActive || !shellVisible) {
              regLife('SHELL_POINTER_OUTSIDE_PREVENTED', { duplicateActive, shellVisible });
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (duplicateActive || !shellVisible) {
              regLife('SHELL_INTERACT_OUTSIDE_PREVENTED', { duplicateActive, shellVisible });
              event.preventDefault();
            }
          }}
          onFocusOutside={(event) => {
            if (duplicateActive || !shellVisible) {
              regLife('SHELL_FOCUS_OUTSIDE_PREVENTED', { duplicateActive, shellVisible });
              event.preventDefault();
            }
          }}
          className={cn(
            'counselling-session !flex !h-[min(88vh,calc(100vh-40px))] !max-h-[calc(100vh-40px)] !w-[min(60vw,56rem)] !max-w-[min(60vw,56rem)] flex-col gap-0 overflow-hidden !p-0 max-sm:!h-[100dvh] max-sm:!max-h-[100dvh] max-sm:!w-full max-sm:!max-w-none max-sm:!rounded-none',
            !shellVisible &&
              '!pointer-events-none !invisible !fixed !left-0 !top-0 !h-0 !w-0 !max-h-0 !max-w-0 !translate-x-0 !translate-y-0 !overflow-hidden !border-0 !p-0 !opacity-0 !shadow-none',
          )}
        >
          <DialogHeader className="shrink-0 space-y-0 border-b border-counselling-border/60 px-4 py-3 pr-10 text-left">
            <DialogTitle className="text-base font-semibold leading-5">Register New Patient</DialogTitle>
            <DialogDescription className="sr-only">Register a new patient</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            {wizardMounted ? (
              <AddPatientWizard
                presentation="dialog"
                hostDuplicateDialogsExternally
                onCreated={(patientId) => {
                  createdId.current = patientId;
                  onCreated?.(patientId);
                }}
                onRegistrationComplete={(patient) => {
                  createdId.current = null;
                  onRegistrationComplete?.(patient);
                  // End registration session — success surface is owned by PatientHubPage.
                  setPhase('registration');
                  onOpenChange(false);
                }}
                onRequestClose={() => {
                  regLife('WIZARD_REQUEST_CLOSE', {
                    duplicateActive,
                    phase: phaseRef.current,
                  });
                  if (
                    isDuplicateReviewActive({
                      softOpen: softOpenRef.current,
                      hardOpen: hardOpenRef.current,
                      phase: phaseRef.current,
                    })
                  ) {
                    return;
                  }
                  close(false);
                }}
                onDuplicatePhaseChange={handleDuplicatePhaseChange}
                onHostedSoftMatchUiChange={handleHostedSoftMatchUiChange}
                onHostedHardBlockUiChange={handleHostedHardBlockUiChange}
                onRegisterDuplicateActions={(actions) => {
                  duplicateActionsRef.current = actions;
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <DuplicatePatientSoftMatchDialog
        open={open && softOpen}
        candidates={softUi.candidates}
        registrationDraft={softUi.registrationDraft}
        continuing={softUi.continuing}
        onOpenChange={(next) => {
          if (!next) duplicateActionsRef.current.dismissSoft();
        }}
        onReviewMatchingInformation={(candidate) =>
          duplicateActionsRef.current.reviewSoft(candidate)
        }
        onContinueRegistration={() => duplicateActionsRef.current.continueSoft()}
      />

      <DuplicatePatientHardBlockDialog
        open={open && hardOpen}
        message={hardUi.message}
        duplicates={hardUi.duplicates}
        onOpenChange={(next) => {
          if (!next) duplicateActionsRef.current.dismissHard();
        }}
        onBackToRegistration={() => duplicateActionsRef.current.dismissHard()}
        onReviewMatching={(candidate) => duplicateActionsRef.current.reviewHard(candidate)}
      />
    </>
  );
}
