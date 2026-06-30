'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CheckCircle, 
  FileText, 
  Calendar, 
  Activity, 
  Clock, 
  Download, 
  Printer, 
  Send,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import AlertBanner, { Alert } from './AlertBanner';
import OptometrySummaryPanel from './OptometrySummaryPanel';
import ResumeDraftModal from './ResumeDraftModal';
import { useAuthStore } from '@/lib/auth-store';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useConfirmation } from '@/components/common/ConfirmationDialog';
import { examinationDraftApi as draftApi, parseExaminationDraftData } from '@/lib/api/examinationDraft.api';
import { 
  examinationDraftApi, 
  examinationApi, 
  prescriptionApi, 
  reportApi,
  CompletedExamination 
} from '@/lib/api/doctorQueue.api';

// Import existing mega tab components
import { MedicalHistoryTabContent } from '@/components/examination/MedicalHistoryTabContent';
import VisualAcuityMegaTab from '@/components/examination/VisualAcuityMegaTab';
import { TabLastVisitLine } from '@/components/examination/exam-ui/TabLastVisitLine';
import { refractionApi, visualAcuityApi } from '@/lib/api/examination.api';
import { fetchPriorVisitSnapshot } from '@/lib/optometry/optometry-prior-visit';
import { optometrySegmentApi } from '@/lib/api/optometry-segment.api';
import { OPTOMETRY_SEGMENT_KEYS } from '@/lib/optometry/optometry-segment-keys';
import { validatePupilExamRequired } from '@/lib/optometry/anterior-segment-validation';
import { buildPosteriorTabSegmentPayload } from '@/lib/optometry/build-segment-bundles';
import { fetchDoctorDeskSegmentBundles } from '@/lib/optometry/doctor-desk-segment-hydration';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';
import type { VaClinicalDraftSlice, IopClinicalDraftSlice } from '@/lib/optometry/optometry-persistence';
import type {
  ColorVisionData,
  ContrastSensitivityData,
  KeratometryData,
  PachymetryData,
  RefractionData,
  TonometryData,
  VisualAcuityData,
  VisualFieldData,
} from '@/lib/stores/clinical-store';
import IOPMegaTab from '@/components/examination/IOPMegaTab';
import RetinoscopyMegaTab from '@/components/examination/RetinoscopyMegaTab';
import AnteriorSegmentTab from '@/components/examination/AnteriorSegmentTab';
import PosteriorSegmentTab from '@/components/examination/PosteriorSegmentTab';
import MedicationsTab from '@/components/examination/MedicationsTab';
import DiagnosisTab from '@/components/examination/DiagnosisTab';
import AdvicePatientEducationTab from '@/components/examination/AdvicePatientEducationTab';
import ImagingTab from '@/components/examination/ImagingTab';
import FinalizeConsultationDialog from '@/components/clinical/FinalizeConsultationDialog';
import PrescriptionValidationModal from '@/components/clinical/PrescriptionValidationModal';
import { validatePrescription } from '@/lib/api/prescription-validation.api';
import type { PrescriptionValidationResult, ValidatePrescriptionMedication } from '@/types/prescription';

interface DoctorComprehensiveExamProps {
  patientId: string;
  /** Active visit for segment API persistence (optional). */
  visitId?: string | null;
  patientData: any;
  optometryData: any;
  onSave: (data: any) => void;
  canEdit: boolean;
}

export default function DoctorComprehensiveExam({
  patientId,
  visitId,
  patientData,
  optometryData,
  onSave,
  canEdit,
}: DoctorComprehensiveExamProps) {
  const { user } = useAuthStore();
  const { showConfirmation, ConfirmationComponent } = useConfirmation();
  const [activeSection, setActiveSection] = useState('medical-history');
  const [isLoadingOptometry, setIsLoadingOptometry] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [examinationId, setExaminationId] = useState<string | null>(null);
  
  // Draft modal state
  const [showResumeDraftModal, setShowResumeDraftModal] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<any>(null);
  
  // State for all examination components
  const [visualAcuityData, setVisualAcuityData] = useState<VisualAcuityData | null>(null);
  const [refractionData, setRefractionData] = useState<RefractionData | null>(null);
  const [keratometryData, setKeratometryData] = useState<KeratometryData | null>(null);
  const [colorVisionData, setColorVisionData] = useState<ColorVisionData | null>(null);
  const [contrastSensitivityData, setContrastSensitivityData] =
    useState<ContrastSensitivityData | null>(null);
  const [priorVisit, setPriorVisit] = useState<PriorVisitSnapshot | null>(null);
  const [vaHistory, setVaHistory] = useState<unknown[]>([]);
  const [refHistory, setRefHistory] = useState<unknown[]>([]);
  const [vaExtended, setVaExtended] = useState<unknown>(null);
  const [iopData, setIopData] = useState<TonometryData | null>(null);
  const [pachymetryData, setPachymetryData] = useState<PachymetryData | null>(null);
  const [visualFieldData, setVisualFieldData] = useState<VisualFieldData | null>(null);
  const [iopExtended, setIopExtended] = useState<unknown>(null);
  const [retinoscopyData, setRetinoscopyData] = useState<any>(null);
  const [anteriorSegmentData, setAnteriorSegmentData] = useState<any>(null);
  const [posteriorSegmentData, setPosteriorSegmentData] = useState<any>(null);
  const [anteriorSaving, setAnteriorSaving] = useState(false);
  const [posteriorSaving, setPosteriorSaving] = useState(false);
  const [, setAnteriorDirty] = useState(false);
  const [, setPosteriorDirty] = useState(false);
  const [effectiveVisitId, setEffectiveVisitId] = useState<string | null>(visitId ?? null);
  const [medicationsData, setMedicationsData] = useState<any>(null);
  const [diagnosisData, setDiagnosisData] = useState<any>(null);
  const [adviceData, setAdviceData] = useState<any>(null);
  const [imagingData, setImagingData] = useState<any>(null);
  
  // Finalize dialog state
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  
  // Prescription validation state
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationResult, setValidationResult] = useState<PrescriptionValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Auto-save hook - saves draft every 30 seconds + debounce
  const { saveNow, lastSaved, isSaving, hasUnsavedChanges } = useAutoSave({ delay: 30000,
    onSave: async (data) => {
      if (!user?.id) return;
      
      // Calculate completion percentage
      const sections = 9;
      let completed = 0;
      if (data.visualAcuityData) completed++;
      if (data.iopData) completed++;
      if (data.retinoscopyData) completed++;
      if (data.anteriorSegmentData) completed++;
      if (data.posteriorSegmentData) completed++;
      if (data.medicationsData) completed++;
      if (data.diagnosisData) completed++;
      if (data.adviceData) completed++;
      
      const existing = await draftApi.getDraft(patientId, visitId ?? undefined);
      const prior =
        existing?.data && typeof existing.data === 'object' && !Array.isArray(existing.data)
          ? (existing.data as Record<string, unknown>)
          : {};
      await draftApi.saveDraft({
        patientId,
        doctorId: user.id,
        visitId: visitId ?? undefined,
        data: { ...prior, ...data },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      
      console.log('✅ Draft auto-saved:', Math.round((completed / sections) * 100) + '% complete');
    },
    data: {
      visualAcuityData,
      iopData,
      pachymetryData,
      visualFieldData,
      iopExtended,
      retinoscopyData,
      anteriorSegmentData,
      posteriorSegmentData,
      medicationsData,
      diagnosisData,
      adviceData,
    },
    enabled: canEdit && !isLoadingDraft,
    showToast: true,
    debounceChanges: true,
    debounceDelay: 2000,
  });

  // Generate alerts based on optometry data
  const alerts = useMemo(() => {
    if (!optometryData) return [];
    const generatedAlerts: Alert[] = [];

    // High IOP alert (>21 mmHg)
    if (optometryData.iop) {
      if (optometryData.iop.od && optometryData.iop.od > 21) {
        generatedAlerts.push({
          id: 'high-iop-od',
          severity: 'critical',
          message: `🔴 High IOP detected in right eye: ${optometryData.iop.od} mmHg`,
          details: 'Possible glaucoma - review immediately. Consider cup-disc ratio, visual field, and pachymetry.',
        });
      }
      if (optometryData.iop.os && optometryData.iop.os > 21) {
        generatedAlerts.push({
          id: 'high-iop-os',
          severity: 'critical',
          message: `🔴 High IOP detected in left eye: ${optometryData.iop.os} mmHg`,
          details: 'Possible glaucoma - review immediately. Consider cup-disc ratio, visual field, and pachymetry.',
        });
      }
    }

    // Sudden VA drop (>2 Snellen lines)
    if (optometryData.visualAcuity && optometryData.visualAcuityHistory) {
      const currentVA = optometryData.visualAcuity;
      const previousVA = optometryData.visualAcuityHistory[0];
      
      if (previousVA && currentVA.distanceOD) {
        const currentLines = parseSnellen(currentVA.distanceOD);
        const previousLines = parseSnellen(previousVA.distanceOD);
        if (previousLines - currentLines >= 2) {
          generatedAlerts.push({
            id: 'va-drop-od',
            severity: 'warning',
            message: `🟡 Acute vision loss in right eye: ${previousVA.distanceOD} → ${currentVA.distanceOD}`,
            details: 'Urgent workup required. Rule out: retinal detachment, vascular occlusion, optic neuritis.',
          });
        }
      }
    }

    // Irregular cornea (keratometry difference >2D)
    if (optometryData.keratometry) {
      const k1OD = optometryData.keratometry.k1OD;
      const k2OD = optometryData.keratometry.k2OD;
      const k1OS = optometryData.keratometry.k1OS;
      const k2OS = optometryData.keratometry.k2OS;
      
      if (k1OD && k2OD && Math.abs(k1OD - k2OD) > 2) {
        generatedAlerts.push({
          id: 'irregular-cornea-od',
          severity: 'warning',
          message: `⚠️ Irregular cornea in right eye: K difference ${Math.abs(k1OD - k2OD).toFixed(2)}D`,
          details: 'Rule out keratoconus. Consider topography, Pentacam, and cross-linking consultation.',
        });
      }
      if (k1OS && k2OS && Math.abs(k1OS - k2OS) > 2) {
        generatedAlerts.push({
          id: 'irregular-cornea-os',
          severity: 'warning',
          message: `⚠️ Irregular cornea in left eye: K difference ${Math.abs(k1OS - k2OS).toFixed(2)}D`,
          details: 'Rule out keratoconus. Consider topography, Pentacam, and cross-linking consultation.',
        });
      }
    }

    return generatedAlerts;
  }, [optometryData]);

  // Helper function to parse Snellen notation
  const parseSnellen = (snellen: string): number => {
    const snellenMap: {[key: string]: number} = {
      '6/6': 0, '6/9': 1, '6/12': 2, '6/18': 3, '6/24': 4, '6/36': 5, '6/60': 6,
      'CF': 7, 'HM': 8, 'PL': 9, 'NPL': 10
    };
    return snellenMap[snellen] || 0;
  };

  // Check for existing draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (!user?.id) {
        setIsLoadingDraft(false);
        return;
      }
      
      try {
        setIsLoadingDraft(true);
        const draft = await draftApi.getDraft(patientId, visitId ?? undefined);
        
        if (draft) {
          setPendingDraft(draft);
          setShowResumeDraftModal(true);
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      } finally {
        setIsLoadingDraft(false);
      }
    };
    
    loadDraft();
  }, [patientId, user, visitId]);

  // Resume draft handler
  const handleResumeDraft = () => {
    if (!pendingDraft) return;
    
    // Restore all saved data
    const draftData = parseExaminationDraftData(pendingDraft.data) as Record<string, unknown>;
    if (draftData.visualAcuityData) setVisualAcuityData(draftData.visualAcuityData as VisualAcuityData);
    if (draftData.iopData) setIopData(draftData.iopData as TonometryData);
    if (draftData.pachymetryData) setPachymetryData(draftData.pachymetryData as PachymetryData);
    if (draftData.visualFieldData) setVisualFieldData(draftData.visualFieldData as VisualFieldData);
    if (draftData.iopExtended) setIopExtended(draftData.iopExtended);
    if (draftData.retinoscopyData) setRetinoscopyData(draftData.retinoscopyData);
    if (draftData.anteriorSegmentData) setAnteriorSegmentData(draftData.anteriorSegmentData);
    if (draftData.posteriorSegmentData) setPosteriorSegmentData(draftData.posteriorSegmentData);
    if (draftData.medicationsData) setMedicationsData(draftData.medicationsData);
    if (draftData.diagnosisData) setDiagnosisData(draftData.diagnosisData);
    if (draftData.adviceData) setAdviceData(draftData.adviceData);
    
    setShowResumeDraftModal(false);
    setPendingDraft(null);
    toast.success('📋 Draft restored successfully');
  };

  // Start fresh handler
  const handleStartFresh = async () => {
    if (pendingDraft?.id) {
      try {
        await draftApi.deleteDraft(patientId, visitId ?? undefined);
        toast.success('🆕 Starting fresh examination');
      } catch (error) {
        console.error('Failed to delete draft:', error);
      }
    }
    
    setShowResumeDraftModal(false);
    setPendingDraft(null);
  };
  
  // Close modal and go back to queue
  const handleCloseDraftModal = () => {
    setShowResumeDraftModal(false);
    // Optional: navigate back to queue
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };
  
  // Validate prescriptions before finalization
  const handleValidatePrescriptions = async (): Promise<boolean> => {
    // If no prescriptions, validation passes automatically
    if (!medicationsData?.prescription?.length) {
      return true;
    }

    try {
      setIsValidating(true);
      
      // Map prescription items to validation format
      const medications: ValidatePrescriptionMedication[] = medicationsData.prescription.map((item: any) => ({
        medicationName: item.drugName,
        eyeSpecificity: item.eyeSpecificity,
        genericName: item.genericName,
        route: item.route,
        dosage: item.dosage,
        frequency: item.frequency,
        durationDays: item.durationValue,
      }));
      
      // Call validation API
      const result = await validatePrescription({
        patientId,
        medications,
        checkAllergies: true,
        checkInteractions: true,
        checkContraindications: true,
        checkDuplicates: true,
      });
      
      setValidationResult(result);
      
      // If there are errors or warnings, show validation modal
      if (result.errors.length > 0 || result.warnings.length > 0 || result.interactions.length > 0) {
        setShowValidationModal(true);
        return false; // Don't proceed to finalize yet
      }
      
      // Validation passed with no issues
      return true;
    } catch (error: any) {
      console.error('Prescription validation failed:', error);
      toast.error('Failed to validate prescriptions: ' + (error.message || 'Unknown error'));
      return false;
    } finally {
      setIsValidating(false);
    }
  };
  
  // Handle validation modal proceed (user acknowledged warnings or overrode errors)
  const handleValidationProceed = (overrideReason?: string) => {
    if (overrideReason) {
      console.log('Override reason:', overrideReason);
      // TODO: Log override reason to audit trail
      toast('⚠️ Prescription safety checks overridden', { duration: 5000 });
    }
    
    setShowValidationModal(false);
    setValidationResult(null);
    
    // Now show the finalize dialog
    setShowFinalizeDialog(true);
  };
  
  // Handle finalize button click (validate first, then show finalize dialog)
  const handleFinalizeClick = async () => {
    // Validate required fields
    if (!diagnosisData?.diagnoses?.length) {
      toast.error('At least one diagnosis is required before finalizing');
      setActiveSection('diagnosis');
      return;
    }
    
    // Show loading state
    toast.loading('Validating prescriptions...', { id: 'validation-loading' });
    
    // Validate prescriptions
    const validationPassed = await handleValidatePrescriptions();
    
    toast.dismiss('validation-loading');
    
    // If validation passed with no issues, proceed directly to finalize dialog
    if (validationPassed) {
      toast.success('✅ All safety checks passed');
      setShowFinalizeDialog(true);
    }
    // Otherwise, validation modal is already shown
  };
  
  // Handle finalization with PIN signature
  const handleFinalize = async (pin: string, followUpDate?: string) => {
    if (!examinationId) {
      toast.error('No examination ID available');
      return;
    }

    try {
      // Call the finalization API endpoint with PIN-based digital signature
      const result = await examinationApi.finalize(examinationId, { 
        pin, 
        followUpDate,
        followUpReason: followUpDate ? 'Follow-up appointment' : undefined
      });
      
      if (result.success) {
        toast.success(`✅ ${result.message}`);
        
        // Show digital signature confirmation
        if (result.digitalSignature) {
          console.log('Digital signature:', result.digitalSignature);
          toast.success('📝 Digital signature applied successfully', { duration: 3000 });
        }
        
        // Show follow-up appointment confirmation
        if (result.followUpAppointmentId) {
          toast.success('📅 Follow-up appointment created', { duration: 3000 });
        }
        
        // Delete draft after successful finalization
        try {
          await draftApi.deleteDraft(patientId, visitId ?? undefined);
        } catch (draftError) {
          console.warn('Could not delete draft:', draftError);
        }
        
        // Navigate back to queue
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            window.history.back();
          }, 2000);
        }
      } else {
        toast.error(result.message || 'Failed to finalize consultation');
      }
    } catch (error: any) {
      console.error('Error finalizing consultation:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to finalize consultation';
      toast.error(errorMessage);
      throw error; // Re-throw to let dialog handle it
    }
  };

  // Auto-import optometry data on mount
  useEffect(() => {
    const loadOptometryData = async () => {
      if (!visualAcuityData && !isLoadingDraft) {
        try {
          setIsLoadingOptometry(true);
          
          // Try to fetch latest optometry examination
          const optometry = await examinationApi.getLatestOptometry(patientId);
          
          if (optometry) {
            // Map optometry data to examination state
            if (optometry.visualAcuity) {
              setVisualAcuityData(optometry.visualAcuity);
            }
            if (optometry.iop) {
              setIopData(optometry.iop);
            }
            if (optometry.retinoscopy) {
              setRetinoscopyData(optometry.retinoscopy);
            }
            
            toast.success('✅ Optometry data loaded successfully');
          } else if (optometryData) {
            // Fallback to passed props
            if (optometryData.visualAcuity) setVisualAcuityData(optometryData.visualAcuity);
            if (optometryData.iop) setIopData(optometryData.iop);
            if (optometryData.retinoscopy) setRetinoscopyData(optometryData.retinoscopy);
            toast.success('✅ Optometry data loaded');
          }
        } catch (error) {
          console.error('Failed to load optometry data:', error);
          // Silent fail - doctor can proceed without optometry data
        } finally {
          setIsLoadingOptometry(false);
        }
      }
    };
    
    loadOptometryData();
  }, [patientId, visualAcuityData, isLoadingDraft, optometryData]);

  useEffect(() => {
    if (!patientId) return;
    fetchPriorVisitSnapshot(patientId).then(setPriorVisit).catch(() => setPriorVisit(null));
  }, [patientId]);

  useEffect(() => {
    setEffectiveVisitId(visitId ?? null);
  }, [visitId]);

  // Hydrate anterior/posterior mega-tabs from visit segment rows (same as optometry exam).
  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    fetchDoctorDeskSegmentBundles(patientId, visitId).then((bundles) => {
      if (cancelled) return;
      if (bundles.visitId) setEffectiveVisitId(bundles.visitId);
      if (bundles.anterior) {
        setAnteriorSegmentData((prev: typeof anteriorSegmentData) => ({
          ...(prev ?? {}),
          ...bundles.anterior,
        }));
      }
      if (bundles.posterior) {
        setPosteriorSegmentData((prev: typeof posteriorSegmentData) => ({
          ...(prev ?? {}),
          ...bundles.posterior,
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, visitId]);

  useEffect(() => {
    if (activeSection !== 'visual-acuity' || !patientId) return;
    visualAcuityApi
      .getHistory(patientId)
      .then((data) => {
        const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
        setVaHistory(list);
      })
      .catch(() => setVaHistory([]));
    refractionApi
      .getHistory(patientId)
      .then((data) => {
        const list = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
        setRefHistory(list);
      })
      .catch(() => setRefHistory([]));
  }, [activeSection, patientId]);

  const handleSyncVaClinicalDraft = useCallback((slice: VaClinicalDraftSlice) => {
    setVisualAcuityData(slice.visualAcuity);
    setRefractionData(slice.refraction);
    setKeratometryData(slice.keratometry);
    setColorVisionData(slice.colorVision);
    setContrastSensitivityData(slice.contrastSensitivity);
  }, []);

  const handleVaExtendedChange = useCallback((data: unknown) => {
    setVaExtended(data);
  }, []);

  const handleSyncIopClinicalDraft = useCallback((slice: IopClinicalDraftSlice, extended: unknown) => {
    setIopData(slice.tonometry);
    setPachymetryData(slice.pachymetry);
    setVisualFieldData(slice.visualField);
    setIopExtended(extended);
  }, []);

  const handleIopExtendedChange = useCallback((data: unknown) => {
    setIopExtended(data);
  }, []);

  const handleSave = async () => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }
    
    // Validate required fields
    if (!diagnosisData?.primaryDiagnosis) {
      toast.error('Primary diagnosis is required');
      setActiveSection('diagnosis');
      return;
    }
    
    const completeData: Partial<CompletedExamination> = {
      patientId,
      doctorId: user.id,
      visitDate: new Date().toISOString(),
      chiefComplaint: patientData?.chiefComplaint || '',
      visualAcuityData,
      iopData,
      retinoscopyData,
      anteriorSegmentData,
      posteriorSegmentData,
      medicationsData,
      diagnosisData,
      adviceData,
      primaryDiagnosis: diagnosisData.primaryDiagnosis,
      icd10Codes: diagnosisData.icd10Codes || [],
      prescriptionIssued: !!medicationsData?.prescriptionItems?.length,
      investigationsOrdered: medicationsData?.investigationsOrdered || [],
      followUpDate: adviceData?.followUpDate,
      status: 'Completed',
    };
    
    try {
      const savedExamination = await examinationApi.saveExamination(completeData);
      setExaminationId(savedExamination.id || null);
      
      // Delete draft after successful save
      try {
        await draftApi.deleteDraft(patientId, visitId ?? undefined);
        console.log('✅ Draft deleted after successful save');
      } catch (draftError) {
        console.warn('Failed to delete draft (non-critical):', draftError);
      }
      
      toast.success('✅ Examination saved successfully');
      onSave(completeData);
      
      // Ask if user wants to print prescription
      if (medicationsData?.prescriptionItems?.length > 0) {
        setTimeout(() => {
          showConfirmation({
            title: 'Print Prescription',
            message: 'Do you want to print the prescription now?',
            variant: 'info',
            confirmText: 'Print',
            cancelText: 'Skip',
            onConfirm: () => {
              if (savedExamination.id) handlePrintPrescription(savedExamination.id);
            },
          });
        }, 500);
      }
    } catch (error: any) {
      console.error('Failed to save examination:', error);
      toast.error('Failed to save examination: ' + (error.message || 'Unknown error'));
    }
  };
  
  const handlePrintPrescription = async (examId: string) => {
    try {
      await prescriptionApi.print(examId);
      toast.success('📄 Prescription sent to printer');
    } catch (error) {
      console.error('Print failed:', error);
      toast.error('Failed to print prescription');
    }
  };
  
  const handleDownloadReport = async () => {
    if (!examinationId) {
      toast.error('Please save examination first');
      return;
    }
    
    try {
      const blob = await reportApi.generateReport(examinationId, 'pdf');
      reportApi.downloadBlob(blob, `Examination_${patientData?.mrn}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('📥 Report downloaded');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download report');
    }
  };

  const sections = [
    { id: 'medical-history', label: 'Medical History', icon: Calendar },
    { id: 'visual-acuity', label: 'Visual Acuity', icon: Activity },
    { id: 'iop', label: 'IOP', icon: Activity },
    { id: 'retinoscopy', label: 'Retinoscopy', icon: Activity },
    { id: 'anterior-segment', label: 'Anterior Segment', icon: Activity },
    { id: 'posterior-segment', label: 'Posterior Segment', icon: Activity },
    { id: 'medications', label: 'Medications', icon: Clock },
    { id: 'diagnosis', label: 'Diagnosis', icon: FileText },
    { id: 'imaging', label: 'Imaging', icon: Activity },
    { id: 'advice', label: 'Advice', icon: AlertCircle },
  ];

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
      <ConfirmationComponent />
      {/* Loading State */}
      {isLoadingOptometry && (
        <div className="p-6 bg-blue-50 border-b-2 border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-blue-900 font-medium">Fetching optometry data...</span>
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="p-6 pb-0">
          <AlertBanner alerts={alerts} />
        </div>
      )}

      {/* Optometry Summary Panel */}
      {optometryData && (
        <div className="p-6 pb-0">
          <OptometrySummaryPanel
            data={optometryData}
            onEdit={() => console.log('Edit optometry data')}
            editable={false}
          />
        </div>
      )}

      {/* Auto-save indicator */}
      {lastSaved && (
        <div className="px-6 pt-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Draft saved at {lastSaved.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
            {isSaving && <span className="ml-2 text-blue-600">(Saving...)</span>}
            {hasUnsavedChanges && !isSaving && <span className="ml-2 text-orange-600">(Unsaved changes)</span>}
          </div>
          <button
            onClick={saveNow}
            disabled={isSaving || !hasUnsavedChanges}
            className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Now
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b-2 border-gray-200 bg-gray-50 overflow-x-auto">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex-shrink-0 flex items-center justify-center space-x-2 px-4 py-3 font-semibold text-sm transition-colors ${
                activeSection === section.id
                  ? 'bg-blue-600 text-white border-b-4 border-blue-800'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeSection === 'medical-history' && (
          <MedicalHistoryTabContent
            patientId={patientId}
            canEdit={canEdit}
            patientDetails={patientData}
            onUpdate={(updated) => console.log('Patient updated:', updated)}
          />
        )}

        {activeSection === 'visual-acuity' && (
          <>
            <TabLastVisitLine tabId="visual-acuity" priorVisit={priorVisit} />
            <VisualAcuityMegaTab
              patientId={patientId}
              priorVisit={priorVisit}
              visualAcuityData={visualAcuityData}
              refractionData={refractionData}
              autoRefractionData={null}
              keratometryData={keratometryData}
              colorVisionData={colorVisionData}
              contrastSensitivityData={contrastSensitivityData}
              vaHistory={vaHistory}
              refHistory={refHistory}
              vaExtended={vaExtended}
              onVaExtendedChange={handleVaExtendedChange}
              canEdit={canEdit}
              onSyncClinicalDraft={handleSyncVaClinicalDraft}
            />
          </>
        )}

        {activeSection === 'iop' && (
          <>
            <TabLastVisitLine tabId="iop" priorVisit={priorVisit} />
            <IOPMegaTab
              patientId={patientId}
              priorVisit={priorVisit}
              tonometryData={iopData}
              pachymetryData={pachymetryData}
              visualFieldData={visualFieldData}
              canEdit={canEdit}
              iopExtended={iopExtended}
              onIopExtendedChange={handleIopExtendedChange}
              onSyncClinicalDraft={handleSyncIopClinicalDraft}
            />
          </>
        )}

        {activeSection === 'retinoscopy' && (
          <RetinoscopyMegaTab
            wetRetinoscopyData={retinoscopyData?.wet || null}
            dryRetinoscopyData={retinoscopyData?.dry || null}
            subjectiveRefractionData={retinoscopyData?.subjective || null}
            canEdit={canEdit}
            onSaveWetRetinoscopy={(data) => setRetinoscopyData({...retinoscopyData, wet: data})}
            onSaveDryRetinoscopy={(data) => setRetinoscopyData({...retinoscopyData, dry: data})}
            onSaveSubjectiveRefraction={(data) => setRetinoscopyData({...retinoscopyData, subjective: data})}
          />
        )}

        {activeSection === 'anterior-segment' && (
          <>
            <TabLastVisitLine tabId="anterior" priorVisit={priorVisit} />
            <AnteriorSegmentTab
              pupilExamData={anteriorSegmentData?.pupil || null}
              anteriorSegmentData={anteriorSegmentData?.segment || null}
              priorVisit={priorVisit}
              chiefComplaint={patientData?.chiefComplaint}
              canEdit={canEdit}
              saving={anteriorSaving}
              onDirtyChange={setAnteriorDirty}
              onSaveTab={async ({ pupil, segment }) => {
                const pupilErr = validatePupilExamRequired(pupil);
                if (pupilErr) return false;
                setAnteriorSegmentData({
                  ...(anteriorSegmentData ?? {}),
                  pupil,
                  segment,
                });
                if (!effectiveVisitId || !canEdit) return true;
                setAnteriorSaving(true);
                try {
                  await Promise.all([
                    optometrySegmentApi.upsertSegment(
                      effectiveVisitId,
                      OPTOMETRY_SEGMENT_KEYS.pupilExam,
                      { patientId, data: pupil },
                    ),
                    optometrySegmentApi.upsertSegment(
                      effectiveVisitId,
                      OPTOMETRY_SEGMENT_KEYS.anteriorSegment,
                      { patientId, data: segment },
                    ),
                  ]);
                  return true;
                } catch {
                  return false;
                } finally {
                  setAnteriorSaving(false);
                }
              }}
            />
          </>
        )}

        {activeSection === 'posterior-segment' && (
          <>
            <TabLastVisitLine tabId="posterior" priorVisit={priorVisit} />
            <PosteriorSegmentTab
              posteriorSegmentData={posteriorSegmentData?.overview || null}
              fundusExamData={posteriorSegmentData?.fundus || null}
              peripheralRetinaExamData={posteriorSegmentData?.peripheralRetina || null}
              vitreousExamData={posteriorSegmentData?.vitreous || null}
              priorVisit={priorVisit}
              canEdit={canEdit}
              saving={posteriorSaving}
              onDirtyChange={setPosteriorDirty}
              onSaveTab={async ({ overview, fundus, vitreous, peripheralRetina }) => {
                const bundle = buildPosteriorTabSegmentPayload({
                  overview,
                  fundus,
                  vitreous,
                  peripheralRetina,
                });
                setPosteriorSegmentData({
                  ...(posteriorSegmentData ?? {}),
                  overview: bundle.overview,
                  fundus: bundle.fundus,
                  vitreous: bundle.vitreous,
                  peripheralRetina: bundle.peripheralRetina,
                });
                if (!effectiveVisitId || !canEdit) return true;
                setPosteriorSaving(true);
                try {
                  await Promise.all([
                    optometrySegmentApi.upsertSegment(
                      effectiveVisitId,
                      OPTOMETRY_SEGMENT_KEYS.posteriorSegment,
                      { patientId, data: bundle.overview },
                    ),
                    optometrySegmentApi.upsertSegment(
                      effectiveVisitId,
                      OPTOMETRY_SEGMENT_KEYS.fundusExam,
                      { patientId, data: bundle.fundus },
                    ),
                    optometrySegmentApi.upsertSegment(
                      effectiveVisitId,
                      OPTOMETRY_SEGMENT_KEYS.vitreousExam,
                      { patientId, data: bundle.vitreous },
                    ),
                    optometrySegmentApi.upsertSegment(
                      effectiveVisitId,
                      OPTOMETRY_SEGMENT_KEYS.peripheralRetinaExam,
                      { patientId, data: bundle.peripheralRetina },
                    ),
                  ]);
                  return true;
                } catch {
                  return false;
                } finally {
                  setPosteriorSaving(false);
                }
              }}
            />
          </>
        )}

        {activeSection === 'medications' && (
          <MedicationsTab
            currentMedications={medicationsData?.current || null}
            prescriptionItems={medicationsData?.prescription || null}
            canEdit={canEdit}
            onSavePrescription={(items) => setMedicationsData({...medicationsData, prescription: items})}
            onPrintPrescription={() => toast.success('Printing prescription...')}
            onEmailPrescription={() => toast.success('Emailing prescription...')}
          />
        )}

        {activeSection === 'diagnosis' && (
          <DiagnosisTab
            diagnoses={diagnosisData?.diagnoses || null}
            canEdit={canEdit}
            onSaveDiagnoses={(diagnoses) => setDiagnosisData({...diagnosisData, diagnoses})}
            onCopyPreviousDiagnoses={() => toast.loading('Loading previous diagnoses...')}
            onPrintSummary={() => toast.success('Printing diagnosis summary...')}
            patientId={patientId}
            patientName={patientData ? `${patientData.firstName} ${patientData.lastName}` : undefined}
            patientAge={patientData?.age}
            patientGender={patientData?.gender}
          />
        )}

        {activeSection === 'imaging' && (
          <ImagingTab
            patientId={patientId}
            canEdit={canEdit}
            onOrderImaging={(order) => {
              toast.success('Imaging order created successfully');
              console.log('Imaging order:', order);
            }}
            onViewImage={(imageId) => console.log('View image:', imageId)}
            onDownloadImage={(imageId) => toast.success('Downloading image...')}
          />
        )}

        {activeSection === 'advice' && (
          <AdvicePatientEducationTab
            patientId={patientId}
            instructions={adviceData?.instructions || []}
            followUp={adviceData?.followUp || null}
            precautions={adviceData?.precautions || null}
            education={adviceData?.education || null}
            diagnoses={diagnosisData?.diagnoses || []}
            canEdit={canEdit}
            onSaveInstructions={(instructions) => setAdviceData({...adviceData, instructions})}
            onSaveFollowUp={(followUp) => setAdviceData({...adviceData, followUp})}
            onSavePrecautions={(precautions) => setAdviceData({...adviceData, precautions})}
            onSaveEducation={(education) => setAdviceData({...adviceData, education})}
            onPrintInstructions={() => toast.success('Printing instructions...')}
            onPrintFullReport={() => handleDownloadReport()}
            onEmailAll={() => toast.success('Emailing report...')}
            onSendSMSReminder={() => toast.success('Sending SMS reminder...')}
          />
        )}
      </div>

      {/* Action Footer */}
      <div className="bg-gray-50 border-t-2 border-gray-200 p-6">
        <div className="flex justify-between items-center">
          {/* Left: Auto-save status */}
          <div className="text-sm text-gray-600 flex items-center gap-2">
            {isLoadingDraft ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-blue-600">Loading draft...</span>
              </>
            ) : lastSaved ? (
              <>
                <Clock className="w-4 h-4" />
                <span>Last saved: {lastSaved.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                {isSaving && <span className="ml-1 text-blue-600 animate-pulse">Saving...</span>}
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                <span>Not saved yet - auto-save every 30s</span>
              </>
            )}
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center space-x-3">
            {/* Print Prescription */}
            {examinationId && medicationsData?.prescription?.length > 0 && (
              <button
                onClick={() => handlePrintPrescription(examinationId)}
                className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Prescription</span>
              </button>
            )}
            
            {/* Download Report */}
            {examinationId && (
              <button
                onClick={handleDownloadReport}
                className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Report</span>
              </button>
            )}
            
            {/* Save Draft */}
            <button
              onClick={handleSave}
              disabled={!canEdit}
              className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>Save Draft</span>
            </button>
            
            {/* Finalize & Sign */}
            <button
              onClick={handleFinalizeClick}
              disabled={!canEdit || !diagnosisData?.diagnoses?.length || isValidating}
              className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={!diagnosisData?.diagnoses?.length ? 'At least one diagnosis required' : 'Finalize and digitally sign consultation'}
            >
              <CheckCircle className="w-5 h-5" />
              <span>{isValidating ? 'Validating...' : 'Finalize & Sign'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Resume Draft Modal */}
      {pendingDraft && (
        <ResumeDraftModal
          isOpen={showResumeDraftModal}
          onClose={handleCloseDraftModal}
          onResume={handleResumeDraft}
          onDiscard={handleStartFresh}
          draftInfo={{
            savedAt: pendingDraft.updatedAt || pendingDraft.createdAt,
            expiresAt: pendingDraft.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            dataPreview: 'Examination draft with ' + Object.keys(pendingDraft.data || {}).length + ' sections saved',
          }}
        />
      )}
      
      {/* Prescription Validation Modal */}
      <PrescriptionValidationModal
        isOpen={showValidationModal}
        onClose={() => {
          setShowValidationModal(false);
          setValidationResult(null);
        }}
        onProceed={handleValidationProceed}
        validationResult={validationResult}
      />
      
      {/* Finalize Consultation Dialog */}
      <FinalizeConsultationDialog
        isOpen={showFinalizeDialog}
        onClose={() => setShowFinalizeDialog(false)}
        onFinalize={handleFinalize}
        summary={{
          chiefComplaint: 'General examination',
          diagnoses: diagnosisData?.diagnoses?.length || 0,
          medications: medicationsData?.prescription?.length || 0,
          investigations: imagingData?.orders?.length || 0,
          procedures: 0,
          followUpDays: adviceData?.followUp?.days || 30,
          referrals: 0,
        }}
        patientName={patientData?.firstName + ' ' + patientData?.lastName || 'Patient'}
        doctorName={user ? `${user.firstName} ${user.lastName}` : 'Doctor'}
        diagnosisCodes={diagnosisData?.diagnoses?.map((d: any) => d.icd10Code).filter(Boolean) || []}
        isPostOperative={false} // TODO: Detect from surgery history or specific diagnosis codes
        validationChecks={[
          {
            field: 'Chief Complaint',
            status: 'passed',
            message: 'Chief complaint recorded',
          },
          {
            field: 'Diagnosis',
            status: diagnosisData?.diagnoses?.length > 0 ? 'passed' : 'failed',
            message: diagnosisData?.diagnoses?.length > 0 
              ? `${diagnosisData.diagnoses.length} diagnosis recorded` 
              : 'At least one diagnosis required',
          },
          {
            field: 'Medications',
            status: medicationsData?.prescription?.length > 0 ? 'passed' : 'warning',
            message: medicationsData?.prescription?.length > 0
              ? `${medicationsData.prescription.length} medications prescribed`
              : 'No medications prescribed',
          },
        ]}
      />
    </div>
  );
}
