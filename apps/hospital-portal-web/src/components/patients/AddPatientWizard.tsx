'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { resolveCreatedPatientNavigation, sanitizeAddPatientReturnTo } from '@/lib/patients/canonical-add-patient';
import {
  formatDuplicateCandidateDob,
  parseDuplicateHardBlockError,
} from '@/lib/patients/duplicate-hard-block';
import type { DuplicateHardBlockCandidate } from '@/lib/patients/duplicate-hard-block';
import {
  parseRegistrationDuplicateCheckResult,
  registrationIdentityFingerprint,
  hasExactNameDobMatch,
  shouldShowSoftDuplicateReview,
  toSoftMatchCandidates,
  type SoftMatchRegistrationDraft,
} from '@/lib/patients/registration-duplicate-check';
import {
  formatPatientCreateError,
  parseCreatePatientResponse,
} from '@/lib/patients/create-patient-response';
import { regLife } from '@/lib/patients/registration-lifecycle-telemetry';
import toast from 'react-hot-toast';
import {
  getApplicableRegistrationSteps,
  getNextStepId,
  getPreviousStepId,
  getStepDisplayNumber,
  getStepperLayoutMode,
  isStepReached,
  type RegistrationStepId,
} from '@/lib/patients/registration-wizard-steps';
import {
  duplicateEvidenceForField,
  formatDuplicateReviewCandidateLabel,
  isHardDuplicateReviewBlocking,
  resolveDuplicateReviewSeverity,
  type DuplicateReviewContext,
  type DuplicateReviewEvidenceKind,
  type DuplicateReviewFieldKey,
} from '@/lib/patients/registration-duplicate-review-context';
import { patientApi } from '@/lib/api/patients.api';
import RegistrationCardPreview from '@/components/patients/RegistrationCardPreview';
import { DuplicatePatientHardBlockDialog } from '@/components/patients/DuplicatePatientHardBlockDialog';
import { DuplicatePatientSoftMatchDialog } from '@/components/patients/DuplicatePatientSoftMatchDialog';
import { AlertCircle, Calendar as CalendarIcon, Check } from 'lucide-react';
import { useMasterValues } from '@/hooks/use-master-values';
import { MasterValuesSelect } from '@/components/master-data/MasterValuesSelect';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** ISO yyyy-MM-dd (form/API SoT) → DD-MM-YYYY display. */
function isoDateToDdMmYyyy(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Parse DD-MM-YYYY (or digits) into ISO yyyy-MM-dd when valid; otherwise null. */
function ddMmYyyyToIsoDate(display: string): string | null {
  const trimmed = display.trim();
  if (!trimmed) return null;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1800 || year > 2100) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function maskDdMmYyyyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}


interface PatientFormData {
  // Phase 6: Extended Demographics
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  occupation: string;
  maritalStatus: string;
  religion: string;
  languagePreference: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  bloodGroup: string;
  allergies: string;
  medicalHistory: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  emergencyContactEmail: string;
  emergencyContactAddress: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  insuranceGroupNumber: string;
  insuranceValidFrom: string;
  insuranceValidTo: string;
  // Phase 2: Identity Documents
  healthId: string;
  aadhaarNumber: string;
  nationalId: string;
  passportNumber: string;
  drivingLicense: string;
  idProofType: string;
  // Phase 3: Guardian Information
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianAddress: string;
  guardianIdProof: string;
  // Phase 4: Enhanced Medical History
  chronicConditions: string;
  currentMedications: string;
  pastSurgeries: string;
  familyMedicalHistory: string;
  knownAllergiesDetails: string;
  immunizationRecords: string;
  disabilityStatus: string;
  specialNeeds: string;
  // Phase 8: Additional Medical/Lifestyle Fields
  exerciseHabits: string;
  dietType: string;
  smokingStatus: string;
  alcoholUse: string;
  lifestyleNotes: string;
  // Phase 7: Patient Photo
  photoFile: File | null;
  photoPreview: string | null;
  // Phase 5: Structured Address
  addressLine1: string;
  addressLine2: string;
  country: string;
  district: string;
  landmark: string;
  pinCode: string;
}

export type HostedSoftMatchUi = {
  open: boolean;
  candidates: DuplicateHardBlockCandidate[];
  registrationDraft: SoftMatchRegistrationDraft;
  continuing: boolean;
};

export type HostedHardBlockUi = {
  open: boolean;
  message: string;
  duplicates: DuplicateHardBlockCandidate[];
};

export type AddPatientDuplicateActions = {
  reviewSoft: (candidate: DuplicateHardBlockCandidate) => void;
  continueSoft: () => void;
  dismissSoft: () => void;
  reviewHard: (candidate: DuplicateHardBlockCandidate) => void;
  dismissHard: () => void;
};

interface AddPatientWizardProps {
  /** Page keeps the canonical route. Dialog hosts the same wizard from Directory. */
  presentation?: 'page' | 'dialog';
  onCreated?: (patientId: string) => void;
  /**
   * Dialog host: registration transaction complete — lift success/card outside wizard shell.
   * Page host may ignore (page keeps in-wizard success for non-Directory entry).
   */
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
  onRequestClose?: () => void;
  /**
   * Dialog host: registration shell closes before standalone duplicate modal opens.
   * Page host may ignore this (duplicate dialogs still portal as standalone).
   */
  onDuplicatePhaseChange?: (phase: 'registration' | 'duplicate-review') => void;
  /**
   * When true, soft/hard Dialogs are owned by AddPatientDialog (sibling roots).
   * Prevents nested-Dialog regression when registration Dialog open=false.
   */
  hostDuplicateDialogsExternally?: boolean;
  onHostedSoftMatchUiChange?: (ui: HostedSoftMatchUi) => void;
  onHostedHardBlockUiChange?: (ui: HostedHardBlockUi) => void;
  onRegisterDuplicateActions?: (actions: AddPatientDuplicateActions) => void;
}

type ReviewFieldStatus = 'complete' | 'attention' | 'neutral';

function reviewText(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  return trimmed || 'Not provided';
}

function reviewGenderLabel(gender?: string | null) {
  const value = gender?.trim();
  if (!value) return 'Not provided';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function fieldStatus(value: string | null | undefined, options?: {
  required?: boolean;
  invalid?: boolean;
}): ReviewFieldStatus {
  if (options?.invalid) return 'attention';
  const filled = Boolean(value?.trim());
  if (filled) return 'complete';
  if (options?.required) return 'attention';
  return 'neutral';
}

function ReviewFieldState({ status }: { status: ReviewFieldStatus }) {
  if (status === 'complete') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-700">
        <Check className="h-3.5 w-3.5 text-green-600" aria-hidden />
        Complete
      </span>
    );
  }
  if (status === 'attention') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-red-700">
        <AlertCircle className="h-3.5 w-3.5 text-red-600" aria-hidden />
        Needs attention
      </span>
    );
  }
  return (
    <span className="sr-only">Not provided</span>
  );
}

function ReviewPair({
  label,
  value,
  status = 'neutral',
  duplicateEvidence = null,
  fieldKey,
}: {
  label: string;
  value: string;
  status?: ReviewFieldStatus;
  duplicateEvidence?: DuplicateReviewEvidenceKind | null;
  fieldKey?: DuplicateReviewFieldKey;
}) {
  // Duplicate match is communicated by the red field container only (no Match badge/copy).
  // differentAttributes intentionally keep normal field appearance on Review.
  const isMatched = duplicateEvidence === 'matched';
  return (
    <div
      className={cn(
        'min-w-0 rounded-md border border-transparent px-2.5 py-2',
        isMatched && 'border-red-400 bg-red-50 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.25)]',
      )}
      data-review-status={status}
      data-duplicate-evidence={isMatched ? 'matched' : undefined}
      data-review-field={fieldKey}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-0.5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-3">
          <dt className="text-xs text-counselling-muted-foreground">{label}</dt>
          <dd
            className={`min-w-0 break-words text-sm ${
              status === 'attention' || status === 'complete' || isMatched
                ? 'font-semibold text-counselling-foreground'
                : 'font-medium text-counselling-muted-foreground'
            }`}
          >
            {value}
          </dd>
        </div>
        {!isMatched ? <ReviewFieldState status={status} /> : null}
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-lg border border-counselling-border/60 px-3 py-2.5"
      data-testid={`review-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
          {title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs font-medium text-counselling-primary"
          onClick={onEdit}
          aria-label={`Edit ${editLabel}`}
          data-testid={`review-edit-${editLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        >
          Edit
        </Button>
      </div>
      <dl className="min-w-0">{children}</dl>
    </section>
  );
}

function ReviewConfirmStep({
  formData,
  ageLabel,
  guardianApplies,
  guardianRequiredForMinor,
  onEditStep,
  duplicateReviewContext = null,
}: {
  formData: PatientFormData;
  ageLabel: string;
  guardianApplies: boolean;
  guardianRequiredForMinor: boolean;
  onEditStep: (stepId: RegistrationStepId) => void;
  duplicateReviewContext?: DuplicateReviewContext | null;
}) {
  const evidence = (field: DuplicateReviewFieldKey) =>
    duplicateEvidenceForField(field, duplicateReviewContext);
  const hardBlocked = isHardDuplicateReviewBlocking(duplicateReviewContext);
  const duplicateLabel = duplicateReviewContext
    ? formatDuplicateReviewCandidateLabel(duplicateReviewContext)
    : null;
  const fullName = [formData.title, formData.firstName, formData.middleName, formData.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
  const dobDisplay =
    formatDuplicateCandidateDob(formData.dateOfBirth) ?? reviewText(formData.dateOfBirth);
  const emailInvalid =
    Boolean(formData.email.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const phoneInvalid =
    Boolean(formData.phone.trim()) && !/^\+?[\d\s()-]+$/.test(formData.phone);
  const aadhaarInvalid =
    Boolean(formData.aadhaarNumber.trim()) && !/^\d{12}$/.test(formData.aadhaarNumber);
  const guardianEmailInvalid =
    Boolean(formData.guardianEmail.trim()) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail);
  const emergencyPhoneMissing =
    Boolean(formData.emergencyContactName.trim()) &&
    !formData.emergencyContactPhone.trim();

  return (
    <div className="space-y-3" data-testid="review-confirm-step">
      {hardBlocked ? (
        <div
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-950"
          data-testid="review-hard-duplicate-blocked"
          role="status"
        >
          <p className="font-semibold">New patient creation is blocked</p>
          <p className="mt-1 text-xs leading-4 text-red-900/90">
            An existing patient was identified
            {duplicateLabel ? ` (${duplicateLabel})` : ''}. Edit identity details if this
            registration was entered incorrectly, then try again.
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        <ReviewSection
          title="Patient Information"
          editLabel="Personal Information"
          onEdit={() => onEditStep('PERSONAL')}
        >
          <ReviewPair
            label="Full name"
            value={reviewText(fullName)}
            status={fieldStatus(fullName, {
              required: true,
              invalid: !formData.firstName.trim() || !formData.lastName.trim(),
            })}
          />
          <ReviewPair
            label="First name"
            value={reviewText(formData.firstName)}
            status={fieldStatus(formData.firstName, { required: true })}
            fieldKey="firstName"
            duplicateEvidence={evidence('firstName')}
          />
          <ReviewPair
            label="Middle name"
            value={reviewText(formData.middleName)}
            status={fieldStatus(formData.middleName)}
          />
          <ReviewPair
            label="Last name"
            value={reviewText(formData.lastName)}
            status={fieldStatus(formData.lastName, { required: true })}
            fieldKey="lastName"
            duplicateEvidence={evidence('lastName')}
          />
          <ReviewPair
            label="Date of birth"
            value={dobDisplay}
            status={fieldStatus(formData.dateOfBirth, { required: true })}
            fieldKey="dateOfBirth"
            duplicateEvidence={evidence('dateOfBirth')}
          />
          <ReviewPair
            label="Age"
            value={reviewText(ageLabel)}
            status={fieldStatus(ageLabel, { required: Boolean(formData.dateOfBirth) })}
          />
          <ReviewPair
            label="Gender"
            value={reviewGenderLabel(formData.gender)}
            status={fieldStatus(formData.gender, { required: true })}
          />
          <ReviewPair
            label="Blood group"
            value={reviewText(formData.bloodGroup)}
            status={fieldStatus(formData.bloodGroup)}
          />
          <ReviewPair
            label="Marital status"
            value={reviewText(formData.maritalStatus)}
            status={fieldStatus(formData.maritalStatus)}
          />
          <ReviewPair
            label="Nationality"
            value={reviewText(formData.nationality)}
            status={fieldStatus(formData.nationality)}
          />
          <ReviewPair
            label="Occupation"
            value={reviewText(formData.occupation)}
            status={fieldStatus(formData.occupation)}
          />
          <ReviewPair
            label="Religion"
            value={reviewText(formData.religion)}
            status={fieldStatus(formData.religion)}
          />
          <ReviewPair
            label="Preferred language"
            value={reviewText(formData.languagePreference)}
            status={fieldStatus(formData.languagePreference)}
          />
        </ReviewSection>

        <ReviewSection
          title="Contact Information"
          editLabel="Contact Information"
          onEdit={() => onEditStep('CONTACT')}
        >
          <ReviewPair
            label="Mobile"
            value={reviewText(formData.phone)}
            status={fieldStatus(formData.phone, { invalid: phoneInvalid })}
            fieldKey="phone"
            duplicateEvidence={evidence('phone')}
          />
          <ReviewPair
            label="Email"
            value={reviewText(formData.email)}
            status={fieldStatus(formData.email, { invalid: emailInvalid })}
            fieldKey="email"
            duplicateEvidence={evidence('email')}
          />
          <ReviewPair
            label="Address line 1"
            value={reviewText(formData.addressLine1)}
            status={fieldStatus(formData.addressLine1)}
          />
          <ReviewPair
            label="Address line 2"
            value={reviewText(formData.addressLine2)}
            status={fieldStatus(formData.addressLine2)}
          />
          <ReviewPair
            label="City"
            value={reviewText(formData.city)}
            status={fieldStatus(formData.city)}
          />
          <ReviewPair
            label="District"
            value={reviewText(formData.district)}
            status={fieldStatus(formData.district)}
          />
          <ReviewPair
            label="State"
            value={reviewText(formData.state)}
            status={fieldStatus(formData.state)}
          />
          <ReviewPair
            label="Country"
            value={reviewText(formData.country)}
            status={fieldStatus(formData.country)}
          />
          <ReviewPair
            label="PIN code"
            value={reviewText(formData.pinCode || formData.postalCode)}
            status={fieldStatus(formData.pinCode || formData.postalCode)}
          />
          <ReviewPair
            label="Landmark"
            value={reviewText(formData.landmark)}
            status={fieldStatus(formData.landmark)}
          />
          <ReviewPair
            label="Full address"
            value={reviewText(formData.address)}
            status={fieldStatus(formData.address)}
          />
        </ReviewSection>

        <ReviewSection
          title="Identity Documents"
          editLabel="Identity Documents"
          onEdit={() => onEditStep('IDENTITY')}
        >
          <ReviewPair
            label="ID proof type"
            value={reviewText(formData.idProofType)}
            status={fieldStatus(formData.idProofType)}
          />
          <ReviewPair
            label="Aadhaar"
            value={reviewText(formData.aadhaarNumber)}
            status={fieldStatus(formData.aadhaarNumber, { invalid: aadhaarInvalid })}
          />
          <ReviewPair
            label="National ID"
            value={reviewText(formData.nationalId)}
            status={fieldStatus(formData.nationalId)}
          />
          <ReviewPair
            label="Passport"
            value={reviewText(formData.passportNumber)}
            status={fieldStatus(formData.passportNumber)}
          />
          <ReviewPair
            label="Driving license"
            value={reviewText(formData.drivingLicense)}
            status={fieldStatus(formData.drivingLicense)}
          />
        </ReviewSection>

        {guardianApplies ? (
          <ReviewSection
            title="Guardian Information"
            editLabel="Guardian Information"
            onEdit={() => onEditStep('GUARDIAN')}
          >
            <ReviewPair
              label="Name"
              value={reviewText(formData.guardianName)}
              status={fieldStatus(formData.guardianName, {
                required: guardianRequiredForMinor,
              })}
            />
            <ReviewPair
              label="Relationship"
              value={reviewText(formData.guardianRelationship)}
              status={fieldStatus(formData.guardianRelationship)}
            />
            <ReviewPair
              label="Phone"
              value={reviewText(formData.guardianPhone)}
              status={fieldStatus(formData.guardianPhone, {
                required: guardianRequiredForMinor,
              })}
            />
            <ReviewPair
              label="Email"
              value={reviewText(formData.guardianEmail)}
              status={fieldStatus(formData.guardianEmail, { invalid: guardianEmailInvalid })}
            />
            <ReviewPair
              label="Address"
              value={reviewText(formData.guardianAddress)}
              status={fieldStatus(formData.guardianAddress)}
            />
          </ReviewSection>
        ) : null}

        <ReviewSection
          title="Emergency Contact"
          editLabel="Emergency Contact"
          onEdit={() => onEditStep('EMERGENCY')}
        >
          <ReviewPair
            label="Name"
            value={reviewText(formData.emergencyContactName)}
            status={fieldStatus(formData.emergencyContactName)}
          />
          <ReviewPair
            label="Relationship"
            value={reviewText(formData.emergencyContactRelation)}
            status={fieldStatus(formData.emergencyContactRelation)}
          />
          <ReviewPair
            label="Phone"
            value={reviewText(formData.emergencyContactPhone)}
            status={fieldStatus(formData.emergencyContactPhone, {
              invalid: emergencyPhoneMissing,
              required: emergencyPhoneMissing,
            })}
          />
          <ReviewPair
            label="Email"
            value={reviewText(formData.emergencyContactEmail)}
            status={fieldStatus(formData.emergencyContactEmail)}
          />
          <ReviewPair
            label="Address"
            value={reviewText(formData.emergencyContactAddress)}
            status={fieldStatus(formData.emergencyContactAddress)}
          />
        </ReviewSection>

        <ReviewSection
          title="Insurance Information"
          editLabel="Insurance Information"
          onEdit={() => onEditStep('INSURANCE')}
        >
          <ReviewPair
            label="Provider"
            value={reviewText(formData.insuranceProvider)}
            status={fieldStatus(formData.insuranceProvider)}
          />
          <ReviewPair
            label="Policy number"
            value={reviewText(formData.insurancePolicyNumber)}
            status={fieldStatus(formData.insurancePolicyNumber)}
          />
          <ReviewPair
            label="Group number"
            value={reviewText(formData.insuranceGroupNumber)}
            status={fieldStatus(formData.insuranceGroupNumber)}
          />
          <ReviewPair
            label="Valid from"
            value={reviewText(formData.insuranceValidFrom)}
            status={fieldStatus(formData.insuranceValidFrom)}
          />
          <ReviewPair
            label="Valid to"
            value={reviewText(formData.insuranceValidTo)}
            status={fieldStatus(formData.insuranceValidTo)}
          />
        </ReviewSection>
      </div>
    </div>
  );
}

export function AddPatientWizard({
  presentation = 'page',
  onCreated,
  onRegistrationComplete,
  onRequestClose,
  onDuplicatePhaseChange,
  hostDuplicateDialogsExternally = false,
  onHostedSoftMatchUiChange,
  onHostedHardBlockUiChange,
  onRegisterDuplicateActions,
}: AddPatientWizardProps = {}) {
  const router = useRouter();
  const isDialog = presentation === 'dialog';
  const [isInModal, setIsInModal] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const dobNativeRef = useRef<HTMLInputElement>(null);
  /** Display draft for DD-MM-YYYY typing; formData.dateOfBirth remains ISO SoT. */
  const [dobDisplayText, setDobDisplayText] = useState('');

  useEffect(() => {
    setIsInModal(window.self !== window.top);
    setReturnTo(sanitizeAddPatientReturnTo(new URLSearchParams(window.location.search).get('returnTo')));
  }, []);

  const [formData, setFormData] = useState<PatientFormData>({
    // Phase 6: Extended Demographics
    title: '',
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    occupation: '',
    maritalStatus: '',
    religion: '',
    languagePreference: '',
    gender: 'Male',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    bloodGroup: '',
    allergies: '',
    medicalHistory: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    emergencyContactEmail: '',
    emergencyContactAddress: '',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    insuranceGroupNumber: '',
    insuranceValidFrom: '',
    insuranceValidTo: '',
    // Phase 2: Identity Documents
    healthId: '',
    aadhaarNumber: '',
    nationalId: '',
    passportNumber: '',
    drivingLicense: '',
    idProofType: '',
    // Phase 3: Guardian Information
    guardianName: '',
    guardianRelationship: '',
    guardianPhone: '',
    guardianEmail: '',
    guardianAddress: '',
    guardianIdProof: '',
    // Phase 4: Enhanced Medical History
    chronicConditions: '',
    currentMedications: '',
    pastSurgeries: '',
    familyMedicalHistory: '',
    knownAllergiesDetails: '',
    immunizationRecords: '',
    disabilityStatus: '',
    specialNeeds: '',
    // Phase 8: Additional Medical/Lifestyle Fields
    exerciseHabits: '',
    dietType: '',
    smokingStatus: '',
    alcoholUse: '',
    lifestyleNotes: '',
    // Phase 7: Patient Photo
    photoFile: null,
    photoPreview: null,
    // Phase 5: Structured Address
    addressLine1: '',
    addressLine2: '',
    country: '',
    district: '',
    landmark: '',
    pinCode: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof PatientFormData, string>>>({});
  const clearFieldError = (field: keyof PatientFormData) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<RegistrationStepId>('PERSONAL');
  const [highestStepId, setHighestStepId] = useState<RegistrationStepId>('PERSONAL');
  const [calculatedAge, setCalculatedAge] = useState<string>('');
  const [savedPatient, setSavedPatient] = useState<any>(null);
  const [duplicateHardBlockOpen, setDuplicateHardBlockOpen] = useState(false);
  const [duplicateHardBlockMessage, setDuplicateHardBlockMessage] = useState('');
  const [duplicateHardBlockCandidates, setDuplicateHardBlockCandidates] = useState<
    DuplicateHardBlockCandidate[]
  >([]);
  const [softMatchOpen, setSoftMatchOpen] = useState(false);
  const [softMatchCandidates, setSoftMatchCandidates] = useState<DuplicateHardBlockCandidate[]>(
    [],
  );
  const [softMatchAcknowledgedKey, setSoftMatchAcknowledgedKey] = useState<string | null>(null);
  const [duplicateReviewContext, setDuplicateReviewContext] =
    useState<DuplicateReviewContext | null>(null);
  const [showRegistrationCard, setShowRegistrationCard] = useState(false);

  // ── Master data dropdowns (lookup API — no hardcoded fallbacks) ─────────────
  const { options: titleOptions } = useMasterValues('patient.title');
  const { options: genderOptions } = useMasterValues('patient.gender');
  const { options: occupationOptions } = useMasterValues('patient.occupation');
  const { options: maritalOptions } = useMasterValues('patient.marital_status');
  const { options: religionOptions } = useMasterValues('patient.religion');
  const { options: bloodGroupOptions } = useMasterValues('patient.blood_group');
  const { options: nationalityOptions } = useMasterValues('patient.nationality');

  // Webcam state
  const [showWebcam, setShowWebcam] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    regLife('WIZARD_MOUNT', { currentStepId });
    return () => {
      regLife('WIZARD_UNMOUNT');
    };
    // Mount/unmount only — do not re-fire on step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    regLife('WIZARD_STEP', {
      currentStepId,
      hasFirstName: Boolean(formData.firstName.trim()),
      hasLastName: Boolean(formData.lastName.trim()),
      hasDob: Boolean(formData.dateOfBirth),
      hasPhone: Boolean(formData.phone?.trim()),
    });
  }, [
    currentStepId,
    formData.firstName,
    formData.lastName,
    formData.dateOfBirth,
    formData.phone,
  ]);

  const calculateAge = (dob: string): string => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    
    if (days < 0) {
      months--;
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += lastMonth.getDate();
    }
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    const parts = [];
    if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    
    return parts.join(', ') || '0 days';
  };

  const validateStep = (stepId: RegistrationStepId): boolean => {
    const newErrors: Partial<Record<keyof PatientFormData, string>> = {};

    if (stepId === 'PERSONAL') {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
      if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
      if (!formData.gender) newErrors.gender = 'Gender is required';
    }

    if (stepId === 'CONTACT') {
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Invalid email format';
      }
      if (formData.phone && !/^\+?[\d\s()-]+$/.test(formData.phone)) {
        newErrors.phone = 'Invalid phone format';
      }
    }

    if (stepId === 'IDENTITY') {
      // Validate Aadhaar if provided
      if (formData.aadhaarNumber && !/^\d{12}$/.test(formData.aadhaarNumber)) {
        newErrors.aadhaarNumber = 'Aadhaar must be exactly 12 digits';
      }
    }

    if (stepId === 'GUARDIAN') {
      // Validate guardian information for minors and seniors
      if (formData.dateOfBirth) {
        const age = new Date().getFullYear() - new Date(formData.dateOfBirth).getFullYear();
        const needsGuardian = age < 18 || age >= 65;
        const isMinor = age < 18;

        if (needsGuardian && isMinor) {
          // Mandatory for minors
          if (!formData.guardianName.trim()) {
            newErrors.guardianName = 'Guardian name is required for minors';
          }
          if (!formData.guardianPhone.trim()) {
            newErrors.guardianPhone = 'Guardian phone is required for minors';
          }
        }
      }
      // Validate guardian email if provided
      if (formData.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail)) {
        newErrors.guardianEmail = 'Invalid guardian email format';
      }
    }

    if (stepId === 'INSURANCE') {
      // Existing rule (unchanged): emergency phone required when a name was provided.
      if (formData.emergencyContactName && !formData.emergencyContactPhone) {
        newErrors.emergencyContactPhone = 'Phone required if contact name provided';
      }
    }

    // REVIEW is read-only — create path revalidates existing rules below.

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** Re-apply existing step validation rules before final create from Review & Confirm. */
  const validateForCreate = (): boolean => {
    const newErrors: Partial<Record<keyof PatientFormData, string>> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (formData.phone && !/^\+?[\d\s()-]+$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone format';
    }
    if (formData.aadhaarNumber && !/^\d{12}$/.test(formData.aadhaarNumber)) {
      newErrors.aadhaarNumber = 'Aadhaar must be exactly 12 digits';
    }
    if (formData.dateOfBirth) {
      const age = new Date().getFullYear() - new Date(formData.dateOfBirth).getFullYear();
      if (age < 18) {
        if (!formData.guardianName.trim()) {
          newErrors.guardianName = 'Guardian name is required for minors';
        }
        if (!formData.guardianPhone.trim()) {
          newErrors.guardianPhone = 'Guardian phone is required for minors';
        }
      }
    }
    if (formData.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail)) {
      newErrors.guardianEmail = 'Invalid guardian email format';
    }
    if (formData.emergencyContactName && !formData.emergencyContactPhone) {
      newErrors.emergencyContactPhone = 'Phone required if contact name provided';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const needsGuardianStep = (): boolean => {
    if (!formData.dateOfBirth) return false;
    const age = new Date().getFullYear() - new Date(formData.dateOfBirth).getFullYear();
    return age < 18 || age >= 65;
  };

  const isGuardianRequiredForMinor = (): boolean => {
    if (!formData.dateOfBirth) return false;
    const age = new Date().getFullYear() - new Date(formData.dateOfBirth).getFullYear();
    return age < 18;
  };

  const applicableSteps = getApplicableRegistrationSteps(needsGuardianStep());

  const markStepReached = (stepId: RegistrationStepId) => {
    setHighestStepId((prev) => {
      const steps = getApplicableRegistrationSteps(needsGuardianStep());
      const prevIndex = steps.findIndex((step) => step.id === prev);
      const nextIndex = steps.findIndex((step) => step.id === stepId);
      if (nextIndex < 0) return prev;
      if (prevIndex < 0) return stepId;
      return nextIndex > prevIndex ? stepId : prev;
    });
  };

  const goToStepId = (stepId: RegistrationStepId) => {
    const steps = getApplicableRegistrationSteps(needsGuardianStep());
    if (!steps.some((step) => step.id === stepId)) return;
    setCurrentStepId(stepId);
    markStepReached(stepId);
  };

  const handleNext = () => {
    if (!validateStep(currentStepId)) return;
    const nextId = getNextStepId(currentStepId, applicableSteps);
    if (nextId) goToStepId(nextId);
  };

  const handlePrevious = () => {
    const prevId = getPreviousStepId(currentStepId, applicableSteps);
    if (prevId) setCurrentStepId(prevId);
  };

  /**
   * Navigate to a previously reached step — preserves form state;
   * never bypasses forward validation for unreached steps.
   */
  const goToCompletedStep = (stepId: RegistrationStepId) => {
    if (stepId === currentStepId) return;
    if (!applicableSteps.some((step) => step.id === stepId)) return;
    if (!isStepReached(stepId, highestStepId, applicableSteps)) return;
    setCurrentStepId(stepId);
  };

  /** Edit from Review & Confirm — jump to the matching data-entry step by logical id. */
  const editRegistrationStepFromReview = (stepId: RegistrationStepId) => {
    if (stepId === 'REVIEW') return;
    if (!applicableSteps.some((step) => step.id === stepId)) return;
    setCurrentStepId(stepId);
  };

  const buildCreatePayload = () => {
    const { photoFile: _photoFile, photoPreview: _photoPreview, ...patientData } = formData;
    const cleanPayload = Object.entries(patientData).reduce((acc, [key, value]) => {
      if (key === 'email' || key === 'guardianEmail') {
        acc[key] = typeof value === 'string' ? value.trim() || null : value;
      } else {
        acc[key] = value === '' ? null : value;
      }
      return acc;
    }, {} as Record<string, unknown>);

    const payload = {
      ...cleanPayload,
      contactNumber: cleanPayload.contactNumber || cleanPayload.phone || null,
      status: 'Active',
    };
    delete payload.phone;
    return payload;
  };

  const currentIdentityKey = () =>
    registrationIdentityFingerprint({
      firstName: formData.firstName,
      lastName: formData.lastName,
      dateOfBirth: formData.dateOfBirth,
      phone: formData.phone,
      email: formData.email,
    });

  const createPatientFromWizard = async () => {
    const payload = buildCreatePayload();
    const response = await patientApi.create(payload as any);
    // Success UI is driven only by the create response — never Directory lookup/summary.
    const { id: patientId, medicalRecordNumber } = parseCreatePatientResponse(response.data);
    if (!medicalRecordNumber) {
      // Id is enough to hand off; missing MRN must not leave a blank terminal state.
      toast.error(
        'Patient was created but the medical record number was missing from the response. You can still close and open Preview.',
      );
    }

    let photoUrl = formData.photoPreview;
    if (formData.photoFile && patientId) {
      try {
        const photoFormData = new FormData();
        photoFormData.append('photo', formData.photoFile);
        const photoResponse = await patientApi.uploadPhoto(patientId, photoFormData);
        photoUrl = photoResponse.data?.photoUrl || photoResponse.data?.url || formData.photoPreview;
      } catch {
        toast.error('Patient created, but photo upload failed. You can add a photo later.');
      }
    }

    const createdPatient = {
      id: patientId,
      firstName: formData.firstName,
      lastName: formData.lastName,
      dateOfBirth: formData.dateOfBirth,
      gender: formData.gender,
      contactNumber: formData.phone,
      bloodGroup: formData.bloodGroup,
      emergencyContactName: formData.emergencyContactName,
      emergencyContactPhone: formData.emergencyContactPhone,
      medicalRecordNumber,
      photoUrl: photoUrl,
      address: formData.address,
    };

    if (isDialog) {
      // Directory dialog: terminate registration transaction — success/card live outside wizard.
      if (onCreated) onCreated(patientId);
      onRegistrationComplete?.(createdPatient);
      return;
    }

    setSavedPatient(createdPatient);
    if (onCreated) onCreated(patientId);
  };

  const buildSoftRegistrationDraft = (): SoftMatchRegistrationDraft => ({
    firstName: formData.firstName,
    lastName: formData.lastName,
    dateOfBirth: formData.dateOfBirth,
    gender: formData.gender,
    phone: formData.phone,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    regLife('CONFIRM_SUBMIT_START', {
      currentStepId,
      isSubmitting,
      softOpen: softMatchOpen,
    });

    // Create only from Review & Confirm after re-applying existing validation rules.
    if (currentStepId !== 'REVIEW') {
      regLife('CONFIRM_REJECTED_NOT_REVIEW', { currentStepId });
      return;
    }
    if (!validateForCreate()) {
      regLife('CONFIRM_VALIDATION_FAILED');
      return;
    }
    if (isSubmitting) {
      regLife('CONFIRM_REJECTED_ALREADY_SUBMITTING');
      return;
    }

    // Hard duplicate Review visit is a terminal create block for this identity.
    // Do not re-run check / reopen hard dialog (that caused Review → Confirm → hard loop).
    if (isHardDuplicateReviewBlocking(duplicateReviewContext)) {
      regLife('CONFIRM_REJECTED_HARD_DUPLICATE_CONTEXT', {
        candidateId: duplicateReviewContext?.candidateId ?? null,
        matchType: duplicateReviewContext?.matchType ?? null,
      });
      toast.error(
        'New patient creation is blocked for this identity. Edit the registration details if they were entered incorrectly.',
      );
      return;
    }

    setIsSubmitting(true);
    const identityKey = currentIdentityKey();

    try {
      // DUP-C.3 — soft review acknowledgement is valid only for this identity fingerprint.
      if (softMatchAcknowledgedKey !== identityKey) {
        setIsCheckingDuplicates(true);
        regLife('DUPLICATE_CHECK_START');
        try {
          const checkResponse = await patientApi.checkDuplicatesForRegistration({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            dateOfBirth: formData.dateOfBirth || null,
            contactNumber: formData.phone?.trim() || null,
            email: formData.email?.trim() || null,
          });
          const checkResult = parseRegistrationDuplicateCheckResult(checkResponse.data);
          regLife('DUPLICATE_CHECK_RESPONSE', {
            isDuplicate: checkResult.isDuplicate,
            matchCount: checkResult.matches.length,
            softReview: shouldShowSoftDuplicateReview(checkResult),
            hasExactNameDob: checkResult.matches.some(
              (m) => (m.matchType ?? '').trim() === 'ExactNameDOB',
            ),
          });
          if (shouldShowSoftDuplicateReview(checkResult)) {
            const candidates = toSoftMatchCandidates(checkResult.matches);
            regLife('SOFT_DUPLICATE_BRANCH', { candidateCount: candidates.length });
            setSoftMatchCandidates(candidates);
            setSoftMatchOpen(true);
            // Eager sync before paint so sibling soft dialog opens as registration closes.
            onHostedSoftMatchUiChange?.({
              open: true,
              candidates,
              registrationDraft: buildSoftRegistrationDraft(),
              continuing: false,
            });
            onDuplicatePhaseChange?.('duplicate-review');
            regLife('SOFT_UI_OPENED_RETURN');
            return;
          }
          // ExactNameDOB pre-check: open hard review from registration-check evidence.
          // Create hard-block DTO has no matchedAttributes (MatchType-only → Phone-only for
          // PhoneMatch peers). Registration check preserves DateOfBirth+Phone — use that.
          if (hasExactNameDobMatch(checkResult)) {
            const candidates = toSoftMatchCandidates(checkResult.matches);
            const hardMessage =
              'A patient with very similar details already exists. Please review before creating.';
            regLife('HARD_DUPLICATE_PRECHECK_BRANCH', {
              candidateCount: candidates.length,
            });
            setSavedPatient(null);
            setSoftMatchOpen(false);
            setDuplicateHardBlockMessage(hardMessage);
            setDuplicateHardBlockCandidates(candidates);
            setDuplicateHardBlockOpen(true);
            onHostedSoftMatchUiChange?.({
              open: false,
              candidates: [],
              registrationDraft: buildSoftRegistrationDraft(),
              continuing: false,
            });
            onHostedHardBlockUiChange?.({
              open: true,
              message: hardMessage,
              duplicates: candidates,
            });
            onDuplicatePhaseChange?.('duplicate-review');
            return;
          }
        } catch {
          // Fail-closed: do not silently create when the safety pre-check fails.
          regLife('DUPLICATE_CHECK_ERROR');
          toast.error(
            'Unable to verify possible duplicate patients. Please try again before creating this patient.',
          );
          return;
        } finally {
          setIsCheckingDuplicates(false);
        }
      } else {
        regLife('DUPLICATE_CHECK_SKIPPED_ACKNOWLEDGED');
      }

      regLife('CREATE_START');
      await createPatientFromWizard();
      regLife('CREATE_DONE');
    } catch (err: unknown) {
      const hardBlock = parseDuplicateHardBlockError(err);
      if (hardBlock.isDuplicateHardBlock) {
        regLife('HARD_DUPLICATE_BRANCH', {
          candidateCount: hardBlock.duplicates.length,
        });
        setSavedPatient(null);
        setSoftMatchOpen(false);
        setDuplicateHardBlockMessage(hardBlock.message);
        setDuplicateHardBlockCandidates(hardBlock.duplicates);
        setDuplicateHardBlockOpen(true);
        onHostedSoftMatchUiChange?.({
          open: false,
          candidates: [],
          registrationDraft: buildSoftRegistrationDraft(),
          continuing: false,
        });
        onHostedHardBlockUiChange?.({
          open: true,
          message: hardBlock.message,
          duplicates: hardBlock.duplicates,
        });
        onDuplicatePhaseChange?.('duplicate-review');
        return;
      }
      // Keep registration open; never silent-close on create failure.
      regLife('CREATE_ERROR');
      setSavedPatient(null);
      toast.error(formatPatientCreateError(err));
    } finally {
      setIsCheckingDuplicates(false);
      setIsSubmitting(false);
      regLife('CONFIRM_SUBMIT_FINALLY', { currentStepId });
    }
  };

  const closeDuplicateHardBlock = () => {
    setDuplicateHardBlockOpen(false);
    onHostedHardBlockUiChange?.({
      open: false,
      message: '',
      duplicates: [],
    });
    onDuplicatePhaseChange?.('registration');
  };

  const closeSoftMatchDialog = () => {
    setSoftMatchOpen(false);
    onHostedSoftMatchUiChange?.({
      open: false,
      candidates: softMatchCandidates,
      registrationDraft: buildSoftRegistrationDraft(),
      continuing: false,
    });
    onDuplicatePhaseChange?.('registration');
  };

  const continueRegistrationAfterSoftMatch = async () => {
    const identityKey = currentIdentityKey();
    setSoftMatchAcknowledgedKey(identityKey);
    setSoftMatchOpen(false);
    onHostedSoftMatchUiChange?.({
      open: false,
      candidates: softMatchCandidates,
      registrationDraft: buildSoftRegistrationDraft(),
      continuing: true,
    });
    onDuplicatePhaseChange?.('registration');
    setIsSubmitting(true);
    try {
      await createPatientFromWizard();
    } catch (err: unknown) {
      const hardBlock = parseDuplicateHardBlockError(err);
      if (hardBlock.isDuplicateHardBlock) {
        setSavedPatient(null);
        setDuplicateHardBlockMessage(hardBlock.message);
        setDuplicateHardBlockCandidates(hardBlock.duplicates);
        setDuplicateHardBlockOpen(true);
        onHostedHardBlockUiChange?.({
          open: true,
          message: hardBlock.message,
          duplicates: hardBlock.duplicates,
        });
        onDuplicatePhaseChange?.('duplicate-review');
        return;
      }
      setSavedPatient(null);
      toast.error(formatPatientCreateError(err));
    } finally {
      onHostedSoftMatchUiChange?.({
        open: false,
        candidates: softMatchCandidates,
        registrationDraft: buildSoftRegistrationDraft(),
        continuing: false,
      });
      setIsSubmitting(false);
    }
  };

  // Invalidate soft-review acknowledgement and stale duplicate-review highlights
  // when registration identity fields change.
  useEffect(() => {
    setSoftMatchAcknowledgedKey(null);
    setDuplicateReviewContext(null);
  }, [
    formData.firstName,
    formData.lastName,
    formData.dateOfBirth,
    formData.phone,
    formData.email,
  ]);

  /** Soft/hard "Review matching information" → reopen registration at logical REVIEW. */
  const openDuplicateReviewForCandidate = (
    candidate: DuplicateHardBlockCandidate,
    source: 'hard' | 'soft',
  ) => {
    setSoftMatchOpen(false);
    setDuplicateHardBlockOpen(false);
    setSavedPatient(null);
    setDuplicateReviewContext({
      candidateId: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      medicalRecordNumber: candidate.medicalRecordNumber,
      matchType: candidate.matchType ?? null,
      severity: resolveDuplicateReviewSeverity({
        source,
        matchType: candidate.matchType,
      }),
      matchedAttributes: [...(candidate.matchedAttributes ?? [])],
      differentAttributes: [...(candidate.differentAttributes ?? [])],
    });
    // Logical REVIEW — display number is derived from applicableSteps (6 or 7).
    setCurrentStepId('REVIEW');
    markStepReached('REVIEW');
    onHostedSoftMatchUiChange?.({
      open: false,
      candidates: softMatchCandidates,
      registrationDraft: buildSoftRegistrationDraft(),
      continuing: false,
    });
    onHostedHardBlockUiChange?.({
      open: false,
      message: '',
      duplicates: [],
    });
    onDuplicatePhaseChange?.('registration');
  };

  const applyDateOfBirthIso = (iso: string) => {
    setFormData((prev) => ({ ...prev, dateOfBirth: iso }));
    setDobDisplayText(iso ? isoDateToDdMmYyyy(iso) : '');
    setCalculatedAge(iso ? calculateAge(iso) : '');
    if (iso) {
      clearFieldError('dateOfBirth');
    }
  };

  const softRegistrationDraft = buildSoftRegistrationDraft();
  const onHostedSoftMatchUiChangeRef = useRef(onHostedSoftMatchUiChange);
  onHostedSoftMatchUiChangeRef.current = onHostedSoftMatchUiChange;
  const onHostedHardBlockUiChangeRef = useRef(onHostedHardBlockUiChange);
  onHostedHardBlockUiChangeRef.current = onHostedHardBlockUiChange;
  // Skip first soft sync after mount so a remount cannot overwrite parent softOpen=true.
  const skipInitialSoftSyncRef = useRef(true);

  // Keep hosted soft/hard dialogs (sibling Dialog roots) in sync with wizard state.
  // Callbacks are read from refs — must NOT be effect deps (unstable wrappers → max update depth).
  useEffect(() => {
    if (!hostDuplicateDialogsExternally) return;
    if (skipInitialSoftSyncRef.current) {
      skipInitialSoftSyncRef.current = false;
      // Still publish when remount already holds an open soft match (should be rare).
      if (!softMatchOpen) return;
    }
    onHostedSoftMatchUiChangeRef.current?.({
      open: softMatchOpen,
      candidates: softMatchCandidates,
      registrationDraft: softRegistrationDraft,
      continuing: isSubmitting,
    });
  }, [
    hostDuplicateDialogsExternally,
    softMatchOpen,
    softMatchCandidates,
    isSubmitting,
    formData.firstName,
    formData.lastName,
    formData.dateOfBirth,
    formData.gender,
    formData.phone,
  ]);

  useEffect(() => {
    if (!hostDuplicateDialogsExternally) return;
    onHostedHardBlockUiChangeRef.current?.({
      open: duplicateHardBlockOpen,
      message: duplicateHardBlockMessage,
      duplicates: duplicateHardBlockCandidates,
    });
  }, [
    hostDuplicateDialogsExternally,
    duplicateHardBlockOpen,
    duplicateHardBlockMessage,
    duplicateHardBlockCandidates,
  ]);

  // Sync actions during render so Review matching never hits a stale noop ref.
  if (onRegisterDuplicateActions) {
    onRegisterDuplicateActions({
      reviewSoft: (candidate) => openDuplicateReviewForCandidate(candidate, 'soft'),
      continueSoft: continueRegistrationAfterSoftMatch,
      dismissSoft: closeSoftMatchDialog,
      reviewHard: (candidate) => openDuplicateReviewForCandidate(candidate, 'hard'),
      dismissHard: closeDuplicateHardBlock,
    });
  }

  // Webcam Functions
  const startWebcam = async () => {
    try {
      setShowWebcam(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 } 
      });
      setStream(mediaStream);
      
      // Wait for next tick to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
          });
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing webcam:', error);
      alert('Could not access webcam. Please check permissions.');
      setShowWebcam(false);
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowWebcam(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `webcam-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            const reader = new FileReader();
            reader.onloadend = () => {
              setFormData({
                ...formData,
                photoFile: file,
                photoPreview: reader.result as string
              });
            };
            reader.readAsDataURL(file);
            stopWebcam();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const renderStepControl = (
    stepId: RegistrationStepId,
    displayNumber: number,
    label: string,
    options: { complete: boolean; upcoming: boolean },
  ) => {
    if (options.complete) {
      return (
        <button
          type="button"
          onClick={() => goToCompletedStep(stepId)}
          data-step-state="complete"
          data-step-id={stepId}
          data-testid={`registration-step-${displayNumber}`}
          aria-label={`${label}, completed, activate to return`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-counselling-primary/50 bg-counselling-primary/10 text-xs font-semibold text-counselling-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
        >
          {displayNumber}
        </button>
      );
    }
    return (
      <span
        aria-disabled
        data-step-state="upcoming"
        data-step-id={stepId}
        data-testid={`registration-step-${displayNumber}`}
        aria-label={`${label}, upcoming`}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold border-counselling-border text-counselling-muted-foreground',
          options.upcoming && 'opacity-70',
        )}
      >
        {displayNumber}
      </span>
    );
  };

  const renderStepConnector = (toDisplayNumber: number, active: boolean) => (
    <span
      aria-hidden
      data-testid={`registration-step-connector-${toDisplayNumber}`}
      data-connector-state={active ? 'complete' : 'upcoming'}
      className={cn(
        'mx-1 h-px min-w-2 flex-1',
        active ? 'bg-counselling-primary/60' : 'bg-counselling-border',
      )}
    />
  );

  const renderStepIndicator = () => {
    const steps = applicableSteps;
    const currentIndex = steps.findIndex((step) => step.id === currentStepId);
    const currentMeta = steps[currentIndex] ?? steps[0]!;
    const currentDisplay = currentIndex + 1;
    const leftSteps = steps.slice(0, Math.max(currentIndex, 0));
    const rightSteps = steps.slice(currentIndex + 1);
    const layoutMode = getStepperLayoutMode(currentStepId, steps);

    const stepState = (stepId: RegistrationStepId) => {
      const complete =
        stepId !== currentStepId && isStepReached(stepId, highestStepId, steps);
      const upcoming = stepId !== currentStepId && !complete;
      return { complete, upcoming };
    };

    const renderCurrent = (align: 'start' | 'center' | 'end') => (
      <div
        aria-current="step"
        data-step-state="active"
        data-step-id={currentMeta.id}
        data-testid={`registration-step-${currentDisplay}`}
        data-current-step-label={currentMeta.label}
        data-current-step-id={currentMeta.id}
        className={cn(
          'flex shrink-0 items-center gap-1.5 px-1',
          align === 'start' && 'justify-start',
          align === 'center' && 'justify-center',
          align === 'end' && 'justify-end',
        )}
      >
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-counselling-primary text-xs font-semibold text-white"
        >
          {currentDisplay}
        </span>
        <span className="whitespace-nowrap text-sm font-semibold text-counselling-foreground">
          {currentMeta.label}
        </span>
        <span className="sr-only">, current step</span>
      </div>
    );

    const renderNumberRow = (
      rowSteps: typeof steps,
      side: 'left' | 'right',
    ) => (
      <ol
        className={cn(
          'flex min-w-0 flex-1 items-center',
          side === 'left' ? 'justify-end' : 'justify-start',
        )}
      >
        {rowSteps.map((item, index) => {
          const displayNumber = getStepDisplayNumber(item.id, steps);
          const state = stepState(item.id);
          if (side === 'left') {
            const nextId = rowSteps[index + 1]?.id ?? currentStepId;
            const nextDisplay = getStepDisplayNumber(nextId, steps);
            const connectorActive =
              isStepReached(item.id, highestStepId, steps) ||
              isStepReached(item.id, currentStepId, steps);
            return (
              <li key={item.id} className="flex min-w-0 flex-1 items-center justify-end">
                {renderStepControl(item.id, displayNumber, item.label, state)}
                {renderStepConnector(nextDisplay, connectorActive)}
              </li>
            );
          }
          const prevId = index === 0 ? currentStepId : rowSteps[index - 1]!.id;
          const connectorActive =
            isStepReached(prevId, highestStepId, steps) ||
            isStepReached(prevId, currentStepId, steps);
          return (
            <li key={item.id} className="flex min-w-0 flex-1 items-center justify-start">
              {renderStepConnector(displayNumber, connectorActive)}
              {renderStepControl(item.id, displayNumber, item.label, state)}
            </li>
          );
        })}
      </ol>
    );

    return (
      <nav
        aria-label="Registration steps"
        className="w-full shrink-0 overflow-x-hidden"
        data-testid="registration-stepper"
        data-stepper-layout={layoutMode}
        data-applicable-step-count={steps.length}
        data-guardian-applicable={needsGuardianStep() ? 'true' : 'false'}
      >
        {layoutMode === 'LEFT_CURRENT' ? (
          <div
            className="flex w-full min-w-0 items-center gap-1"
            data-testid="registration-stepper-left-current"
          >
            {renderCurrent('start')}
            {renderNumberRow(rightSteps, 'right')}
          </div>
        ) : null}

        {layoutMode === 'CENTER_CURRENT' ? (
          <div
            className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1"
            data-testid="registration-stepper-center-current"
          >
            {renderNumberRow(leftSteps, 'left')}
            {renderCurrent('center')}
            {renderNumberRow(rightSteps, 'right')}
          </div>
        ) : null}

        {layoutMode === 'RIGHT_CURRENT' ? (
          <div
            className="flex w-full min-w-0 items-center gap-1"
            data-testid="registration-stepper-right-current"
          >
            {renderNumberRow(leftSteps, 'left')}
            {renderCurrent('end')}
          </div>
        ) : null}
      </nav>
    );
  };

  // Stepper current-step label is the only visible step title (no duplicate body heading).

  const shellClass = isDialog
    ? 'counselling-session flex h-full min-h-0 flex-col bg-counselling-card'
    : 'counselling-session flex h-[calc(100dvh-7.5rem)] min-h-0 flex-col overflow-hidden rounded-xl border border-counselling-border/70 bg-counselling-card shadow-sm';

  return (
    <div
      className={shellClass}
      data-testid="add-patient-registration-shell"
      data-current-step-id={currentStepId}
      data-applicable-step-count={applicableSteps.length}
      data-soft-match-open={softMatchOpen ? 'true' : 'false'}
      data-hard-block-open={duplicateHardBlockOpen ? 'true' : 'false'}
    >
      {!isDialog && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-counselling-border/60 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-5 text-counselling-foreground">Register New Patient</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push(returnTo || '/dashboard/patients')}
            className="rounded-md px-2 text-sm font-medium text-counselling-muted-foreground hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
          >
            Cancel
          </button>
        </header>
      )}

      {!savedPatient && (
        <div
          className="w-full shrink-0 border-b border-counselling-border/50 px-4 py-3"
          data-testid="registration-stepper-region"
        >
          {renderStepIndicator()}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="counsellor-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 pt-5">
          {/* Step 1: Personal Information */}
          {currentStepId === 'PERSONAL' && (
            <div className="space-y-4">
              {/* Phase 6: Extended Demographics - Name Section */}
              <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <select
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Title</option>
                    {titleOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="min-[900px]:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, firstName: value });
                      if (value.trim()) clearFieldError('firstName');
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                      errors.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, lastName: value });
                      if (value.trim()) clearFieldError('lastName');
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                      errors.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-3">
                <div>
                  <label
                    htmlFor="add-patient-dob-display"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="add-patient-dob-display"
                      type="text"
                      inputMode="numeric"
                      autoComplete="bday"
                      placeholder="DD-MM-YYYY"
                      value={dobDisplayText}
                      onChange={(e) => {
                        const masked = maskDdMmYyyyInput(e.target.value);
                        setDobDisplayText(masked);
                        if (!masked) {
                          applyDateOfBirthIso('');
                          return;
                        }
                        const iso = ddMmYyyyToIsoDate(masked);
                        if (iso) {
                          applyDateOfBirthIso(iso);
                        }
                      }}
                      onBlur={() => {
                        if (!dobDisplayText) {
                          applyDateOfBirthIso('');
                          return;
                        }
                        const iso = ddMmYyyyToIsoDate(dobDisplayText);
                        if (iso) {
                          applyDateOfBirthIso(iso);
                        } else if (formData.dateOfBirth) {
                          setDobDisplayText(isoDateToDdMmYyyy(formData.dateOfBirth));
                        }
                      }}
                      data-testid="add-patient-dob-display"
                      className={`w-full px-3 py-2 pr-10 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                        errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    <input
                      ref={dobNativeRef}
                      type="date"
                      value={formData.dateOfBirth}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => applyDateOfBirthIso(e.target.value)}
                      tabIndex={-1}
                      aria-hidden
                      data-testid="add-patient-dob-native"
                      className="pointer-events-none absolute h-0 w-0 opacity-0"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const el = dobNativeRef.current;
                        if (!el) return;
                        try {
                          if (typeof el.showPicker === 'function') {
                            el.showPicker();
                          } else {
                            el.focus();
                            el.click();
                          }
                        } catch {
                          el.focus();
                          el.click();
                        }
                      }}
                      className="absolute inset-y-0 right-0 flex items-center px-2.5 text-counselling-muted-foreground hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
                      aria-label="Open calendar"
                      data-testid="add-patient-dob-calendar"
                    >
                      <CalendarIcon className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  {errors.dateOfBirth && (
                    <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Age (calculated)
                  </label>
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-700">
                    {calculatedAge || 'Select DOB'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, gender: value });
                      if (value) clearFieldError('gender');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    {genderOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-center text-sm text-gray-600 my-2">OR</div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enter Age Directly (in years)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="150"
                    placeholder="e.g., 34 or 45"
                    onChange={(e) => {
                      const ageYears = parseInt(e.target.value);
                      if (!isNaN(ageYears) && ageYears > 0) {
                        const today = new Date();
                        const approxDOB = new Date(today.getFullYear() - ageYears, today.getMonth(), today.getDate());
                        const dobString = approxDOB.toISOString().split('T')[0];
                        applyDateOfBirthIso(dobString);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Approximate DOB will be calculated from age
                  </p>
                </div>
              </div>

              {/* Phase 6: Extended Demographics Section */}
              <div className="mt-4 space-y-3 border-t border-counselling-border/60 pt-3">
                <h4 className="text-sm font-semibold text-counselling-foreground">Additional Demographics</h4>
                
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nationality
                    </label>
                    <select
                      value={formData.nationality}
                      onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">{nationalityOptions.length === 0 ? 'No nationalities configured' : 'Select Nationality'}</option>
                      {nationalityOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Occupation
                    </label>
                    <select
                      value={formData.occupation}
                      onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Occupation</option>
                      {occupationOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Marital Status
                    </label>
                    <select
                      value={formData.maritalStatus}
                      onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Status</option>
                      {maritalOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Religion
                    </label>
                    <select
                      value={formData.religion}
                      onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Religion (Optional)</option>
                      {religionOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Language
                  </label>
                  <select
                    value={formData.languagePreference}
                    onChange={(e) => setFormData({ ...formData, languagePreference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Language</option>
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Phase 7: Patient Photo Upload */}
              <div className="space-y-3 border-t border-gray-200 pt-4 mt-6">
                <h4 className="text-sm font-semibold text-gray-700">Patient Photo (Optional)</h4>
                
                <div className="flex items-start space-x-4">
                  {/* Photo Preview */}
                  <div className="flex-shrink-0">
                    {formData.photoPreview ? (
                      <div className="relative">
                        <img
                          src={formData.photoPreview}
                          alt="Patient photo"
                          className="w-32 h-32 rounded-lg object-cover border-2 border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, photoFile: null, photoPreview: null });
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1">
                    <input
                      type="file"
                      id="patientPhoto"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Validate file size (10MB max)
                          if (file.size > 10 * 1024 * 1024) {
                            alert('File size must be less than 10MB');
                            e.target.value = '';
                            return;
                          }
                          
                          // Validate file type
                          const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
                          if (!validTypes.includes(file.type)) {
                            alert('Only JPEG, PNG, and WEBP images are allowed');
                            e.target.value = '';
                            return;
                          }
                          
                          // Create preview
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData({
                              ...formData,
                              photoFile: file,
                              photoPreview: reader.result as string
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="patientPhoto"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Choose Photo
                    </label>
                    
                    {/* Webcam Capture Button */}
                    <button
                      type="button"
                      onClick={startWebcam}
                      className="ml-3 inline-flex items-center px-4 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Capture Photo
                    </button>
                    
                    <p className="mt-2 text-xs text-gray-500">
                      JPEG, PNG, or WEBP • Max 10MB
                    </p>
                    {formData.photoFile && (
                      <p className="mt-1 text-sm text-green-600">
                        ✓ {formData.photoFile.name} ({(formData.photoFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Webcam Modal */}
                {showWebcam && (
                  <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4">
                      <h3 className="text-lg font-semibold mb-4">Capture Patient Photo</h3>
                      <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-auto"
                          style={{ minHeight: '400px', objectFit: 'cover' }}
                        />
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                      <div className="mt-4 flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={stopWebcam}
                          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Capture
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Blood Group</option>
                    {bloodGroupOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Disability Status
                  </label>
                  <select
                    value={formData.disabilityStatus}
                    onChange={(e) => setFormData({ ...formData, disabilityStatus: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Disability Status</option>
                    <option value="None">None</option>
                    <option value="Visual Impairment">Visual Impairment</option>
                    <option value="Hearing Impairment">Hearing Impairment</option>
                    <option value="Mobility Impairment">Mobility Impairment</option>
                    <option value="Cognitive Disability">Cognitive Disability</option>
                    <option value="Speech Impairment">Speech Impairment</option>
                    <option value="Multiple Disabilities">Multiple Disabilities</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Information */}
          {currentStepId === 'CONTACT' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                      errors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                  )}
                </div>
              </div>

              {/* Phase 5: Structured Address Fields */}
              <div className="space-y-4 border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-700">Address Details</h4>
                
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={formData.addressLine1}
                      onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Street address"
                      maxLength={200}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.addressLine2}
                      onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      maxLength={200}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      District
                    </label>
                    <input
                      type="text"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="District/County"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Country</option>
                      <option value="United States">United States</option>
                      <option value="India">India</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      value={formData.pinCode}
                      onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="ZIP/Postal Code"
                      maxLength={20}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code (Legacy)
                    </label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Landmark
                  </label>
                  <input
                    type="text"
                    value={formData.landmark}
                    onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Address (Legacy)
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Identity Documents */}
          {currentStepId === 'IDENTITY' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Provide at least one government-issued ID for verification and insurance claims
              </p>

              {/* Health ID is auto-generated, hidden from user */}
              <input type="hidden" value={formData.healthId} />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Proof Type
                  </label>
                  <MasterValuesSelect
                    entityType="patient.id_proof_type"
                    value={formData.idProofType}
                    onChange={(v) => setFormData({ ...formData, idProofType: v })}
                    placeholder="Select Primary ID Type"
                  />
                </div>

                {/* Conditional ID Number Field */}
                {(formData.idProofType === 'AADHAAR' || formData.idProofType === 'Aadhaar') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Aadhaar Number (India)
                    </label>
                    <input
                      type="text"
                      value={formData.aadhaarNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                        setFormData({ ...formData, aadhaarNumber: value });
                      }}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                        errors.aadhaarNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                      maxLength={12}
                    />
                    {errors.aadhaarNumber && (
                      <p className="mt-1 text-sm text-red-600">{errors.aadhaarNumber}</p>
                    )}
                    {formData.aadhaarNumber && formData.aadhaarNumber.length < 12 && (
                      <p className="mt-1 text-xs text-orange-600">
                        {12 - formData.aadhaarNumber.length} more digits required
                      </p>
                    )}
                  </div>
                )}

                {formData.idProofType &&
                  !['AADHAAR', 'Aadhaar', 'PASSPORT', 'Passport', 'DL', 'DrivingLicense'].includes(
                    formData.idProofType,
                  ) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      National ID Number
                    </label>
                    <input
                      type="text"
                      value={formData.nationalId}
                      onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      maxLength={50}
                    />
                  </div>
                )}

                {(formData.idProofType === 'PASSPORT' || formData.idProofType === 'Passport') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Passport Number
                    </label>
                    <input
                      type="text"
                      value={formData.passportNumber}
                      onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      maxLength={50}
                    />
                  </div>
                )}

                {(formData.idProofType === 'DL' || formData.idProofType === 'DrivingLicense') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Driving License Number
                    </label>
                    <input
                      type="text"
                      value={formData.drivingLicense}
                      onChange={(e) => setFormData({ ...formData, drivingLicense: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      maxLength={50}
                    />
                  </div>
                )}
              </div>

              {/* ID Proof Upload Section */}
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload ID Proof <span className="text-gray-500">(Optional, JPG/PNG/PDF, max 5MB)</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Validate file type
                      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
                      if (!allowedTypes.includes(file.type)) {
                        alert('ID proof must be an image (JPG, PNG) or PDF file');
                        e.target.value = '';
                        return;
                      }
                      
                      // Validate file size (max 5MB)
                      if (file.size > 5 * 1024 * 1024) {
                        alert('ID proof file size must be less than 5MB');
                        e.target.value = '';
                        return;
                      }
                      
                      console.log('ID Proof file selected:', file.name);
                      // You can store this file in state if needed for upload
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Accepted formats: JPG, PNG, PDF. Maximum file size: 5MB
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Guardian Information (for minors and seniors) */}
          {currentStepId === 'GUARDIAN' && (() => {
            const age = formData.dateOfBirth 
              ? new Date().getFullYear() - new Date(formData.dateOfBirth).getFullYear()
              : null;
            const needsGuardian = age !== null && (age < 18 || age >= 65);
            const isMinor = age !== null && age < 18;
            const isSenior = age !== null && age >= 65;

            // Don't render this step at all if guardian not needed
            if (!needsGuardian) {
              return null;
            }

            return (
              <div className="space-y-4">
                {isMinor && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                    <p className="text-sm text-yellow-700">
                      <strong>Required:</strong> Patient is a minor (age {age}). Guardian information is mandatory.
                    </p>
                  </div>
                )}

                {isSenior && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                    <p className="text-sm text-blue-700">
                      <strong>Recommended:</strong> Patient is a senior citizen (age {age}). Guardian information is recommended.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Guardian Name {isMinor && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={formData.guardianName}
                      onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                        errors.guardianName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      maxLength={100}
                    />
                    {errors.guardianName && (
                      <p className="mt-1 text-sm text-red-600">{errors.guardianName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Relationship
                    </label>
                    <MasterValuesSelect
                      entityType="patient.relationship"
                      value={formData.guardianRelationship}
                      onChange={(v) => setFormData({ ...formData, guardianRelationship: v })}
                      placeholder="Select Relationship"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Guardian Phone {isMinor && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="tel"
                      value={formData.guardianPhone}
                      onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                        errors.guardianPhone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      maxLength={20}
                    />
                    {errors.guardianPhone && (
                      <p className="mt-1 text-sm text-red-600">{errors.guardianPhone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Guardian Email
                    </label>
                    <input
                      type="email"
                      value={formData.guardianEmail}
                      onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                        errors.guardianEmail ? 'border-red-500' : 'border-gray-300'
                      }`}
                      maxLength={100}
                    />
                    {errors.guardianEmail && (
                      <p className="mt-1 text-sm text-red-600">{errors.guardianEmail}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guardian Address
                  </label>
                  <textarea
                    value={formData.guardianAddress}
                    onChange={(e) => setFormData({ ...formData, guardianAddress: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Guardian ID Proof Type
                    </label>
                    <select
                      value={formData.guardianIdProof}
                      onChange={(e) => setFormData({ ...formData, guardianIdProof: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select ID Type</option>
                      <option value="Aadhaar">Aadhaar Card</option>
                      <option value="Passport">Passport</option>
                      <option value="DrivingLicense">Driving License</option>
                      <option value="VoterID">Voter ID</option>
                      <option value="NationalID">National ID</option>
                    </select>
                  </div>
                </div>

                {/* Guardian ID Upload - Always Visible When ID Type Selected */}
                {formData.guardianIdProof && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Upload Guardian ID Proof
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
                          if (!allowedTypes.includes(file.type)) {
                            alert('Please upload JPG, PNG, or PDF file');
                            e.target.value = '';
                            return;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            alert('File size must be less than 5MB');
                            e.target.value = '';
                            return;
                          }
                          console.log('Guardian ID Proof uploaded:', file.name);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Step 5: Emergency Contact */}
          {currentStepId === 'EMERGENCY' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                      errors.emergencyContactPhone ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.emergencyContactPhone && (
                    <p className="mt-1 text-sm text-red-600">{errors.emergencyContactPhone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Relationship
                  </label>
                  <MasterValuesSelect
                    entityType="patient.relationship"
                    value={formData.emergencyContactRelation}
                    onChange={(v) => setFormData({ ...formData, emergencyContactRelation: v })}
                    placeholder="Select Relationship"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.emergencyContactEmail}
                  onChange={(e) => setFormData({ ...formData, emergencyContactEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address (Optional)
                </label>
                <textarea
                  value={formData.emergencyContactAddress}
                  onChange={(e) => setFormData({ ...formData, emergencyContactAddress: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 6: Insurance Information */}
          {!savedPatient && currentStepId === 'INSURANCE' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insurance Provider
                </label>
                <input
                  type="text"
                  value={formData.insuranceProvider}
                  onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Number
                </label>
                <input
                  type="text"
                  value={formData.insurancePolicyNumber}
                  onChange={(e) => setFormData({ ...formData, insurancePolicyNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Number (Optional)
                </label>
                <input
                  type="text"
                  value={formData.insuranceGroupNumber}
                  onChange={(e) => setFormData({ ...formData, insuranceGroupNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid From (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.insuranceValidFrom}
                    onChange={(e) => setFormData({ ...formData, insuranceValidFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid To (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.insuranceValidTo}
                    onChange={(e) => setFormData({ ...formData, insuranceValidTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Review & Confirm (read-only) — logical REVIEW; display number from applicableSteps */}
          {!savedPatient && currentStepId === 'REVIEW' && (
            <ReviewConfirmStep
              formData={formData}
              ageLabel={calculatedAge}
              guardianApplies={needsGuardianStep()}
              guardianRequiredForMinor={isGuardianRequiredForMinor()}
              onEditStep={editRegistrationStepFromReview}
              duplicateReviewContext={duplicateReviewContext}
            />
          )}

          {/* Success is canonical create response (savedPatient.id) — never require a secondary lookup. */}
          {savedPatient && !showRegistrationCard && (
            <div
              className="mx-auto flex w-full max-w-md flex-col items-center px-2 py-8 text-center"
              data-testid="patient-registration-success"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <Check className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-3 text-lg font-semibold text-counselling-foreground">
                Patient Registered Successfully
              </h2>
              <p className="mt-4 text-xs font-medium text-counselling-muted-foreground">Medical Record Number</p>
              <p
                className="mt-1 text-2xl font-semibold tracking-wide text-counselling-foreground"
                data-testid="patient-registration-mrn"
              >
                {savedPatient.medicalRecordNumber || 'Unavailable'}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setShowRegistrationCard(true)}
                  data-testid="print-registration-card"
                >
                  Print Registration Card
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="registration-success-close"
                  onClick={() => {
                    const next = resolveCreatedPatientNavigation({
                      returnTo,
                      patientId: savedPatient.id,
                      inIframe: isInModal && !isDialog,
                    });
                    if (isDialog) {
                      onRequestClose?.();
                      return;
                    }
                    if (next.kind === 'iframe') {
                      window.parent.postMessage({ type: 'PATIENT_CREATED', patientId: savedPatient.id }, '*');
                      return;
                    }
                    router.push(next.href);
                  }}
                >
                  {returnTo ? 'Continue' : 'Close'}
                </Button>
              </div>
            </div>
          )}

          {savedPatient && showRegistrationCard && (
            <div className="mx-auto w-full max-w-xl" data-testid="patient-registration-card">
              <h2 className="text-base font-semibold text-counselling-foreground">Registration Card</h2>
              <p className="mt-0.5 text-xs text-counselling-muted-foreground">Patient registration card</p>
              <div className="mt-3 rounded-lg border border-counselling-border/70 bg-white p-4">
                <RegistrationCardPreview patient={savedPatient} />
              </div>
              <div className="mt-3 flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowRegistrationCard(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}

        </div>

          {/* Navigation Buttons - Hide when success state is shown */}
          {!savedPatient && (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-counselling-border/60 bg-counselling-card px-4 py-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentStepId === 'PERSONAL'}
              >
                Back
              </Button>
              {currentStepId !== 'REVIEW' ? (
                <Button type="button" variant="primary" size="sm" onClick={handleNext}>
                  Next
                </Button>
              ) : isHardDuplicateReviewBlocking(duplicateReviewContext) ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled
                  data-testid="confirm-create-patient"
                  data-create-blocked="hard-duplicate"
                  aria-disabled="true"
                >
                  Creation blocked
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleSubmit(e);
                  }}
                  disabled={isSubmitting}
                  data-testid="confirm-create-patient"
                >
                  {isCheckingDuplicates
                    ? 'Checking…'
                    : isSubmitting
                      ? 'Creating…'
                      : 'Confirm & Create Patient'}
                </Button>
              )}
            </div>
          )}
        </form>

      {!hostDuplicateDialogsExternally ? (
        <>
          <DuplicatePatientSoftMatchDialog
            open={softMatchOpen}
            candidates={softMatchCandidates}
            registrationDraft={softRegistrationDraft}
            continuing={isSubmitting}
            onOpenChange={(next) => {
              if (!next) closeSoftMatchDialog();
              else {
                setSoftMatchOpen(true);
                onDuplicatePhaseChange?.('duplicate-review');
              }
            }}
            onReviewMatchingInformation={(candidate) =>
              openDuplicateReviewForCandidate(candidate, 'soft')
            }
            onContinueRegistration={continueRegistrationAfterSoftMatch}
          />

          <DuplicatePatientHardBlockDialog
            open={duplicateHardBlockOpen}
            message={duplicateHardBlockMessage}
            duplicates={duplicateHardBlockCandidates}
            onOpenChange={(next) => {
              if (!next) closeDuplicateHardBlock();
              else {
                setDuplicateHardBlockOpen(true);
                onDuplicatePhaseChange?.('duplicate-review');
              }
            }}
            onBackToRegistration={closeDuplicateHardBlock}
            onReviewMatching={(candidate) =>
              openDuplicateReviewForCandidate(candidate, 'hard')
            }
          />
        </>
      ) : null}
    </div>
  );
}
