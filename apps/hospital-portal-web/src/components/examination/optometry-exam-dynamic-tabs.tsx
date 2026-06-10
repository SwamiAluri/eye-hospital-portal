'use client';

import dynamic from 'next/dynamic';
import { ExamTabPanelSkeleton } from './optometry-exam-tab-loaders';

const tabLoading = () => <ExamTabPanelSkeleton />;

export const VisualAcuityMegaTab = dynamic(
  () => import('@/components/examination/VisualAcuityMegaTab'),
  { loading: tabLoading, ssr: false },
);

export const IOPMegaTab = dynamic(
  () => import('@/components/examination/IOPMegaTab'),
  { loading: tabLoading, ssr: false },
);

export const RetinoscopyMegaTab = dynamic(
  () => import('@/components/examination/RetinoscopyMegaTab'),
  { loading: tabLoading, ssr: false },
);

export const AnteriorSegmentTab = dynamic(
  () => import('@/components/examination/AnteriorSegmentTab'),
  { loading: tabLoading, ssr: false },
);

export const PosteriorSegmentTab = dynamic(
  () => import('@/components/examination/PosteriorSegmentTab'),
  { loading: tabLoading, ssr: false },
);

export const MedicationsTab = dynamic(
  () => import('@/components/examination/MedicationsTab'),
  { loading: tabLoading, ssr: false },
);

export const ContactLensTab = dynamic(
  () => import('@/components/examination/ContactLensTab'),
  { loading: tabLoading, ssr: false },
);

export const ReferralOrdersTab = dynamic(
  () => import('@/components/examination/ReferralOrdersTab'),
  { loading: tabLoading, ssr: false },
);

export const DiagnosisTab = dynamic(
  () => import('@/components/examination/DiagnosisTab'),
  { loading: tabLoading, ssr: false },
);

export const AdvicePatientEducationTab = dynamic(
  () => import('@/components/examination/AdvicePatientEducationTab'),
  { loading: tabLoading, ssr: false },
);

export const MedicalHistoryTabContent = dynamic(
  () =>
    import('@/components/examination/MedicalHistoryTabContent').then((m) => ({
      default: m.MedicalHistoryTabContent,
    })),
  { loading: tabLoading, ssr: false },
);
