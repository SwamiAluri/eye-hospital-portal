'use client';

import { useMemo } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';

const FALLBACK_EMPLOYMENT_TYPES = [
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'PART_TIME', label: 'Part-Time' },
  { value: 'CONSULTANT', label: 'Consultant' },
  { value: 'INTERN', label: 'Intern' },
] as const;

const FALLBACK_LEAVE_TYPES = [
  { value: 'CASUAL', label: 'Casual Leave' },
  { value: 'SICK', label: 'Sick Leave' },
  { value: 'EARNED', label: 'Earned Leave' },
  { value: 'MATERNITY', label: 'Maternity Leave' },
  { value: 'LWP', label: 'Leave Without Pay' },
] as const;

/** B6 — employment types from hr.employment_type */
export function useEmploymentTypes() {
  const { options, loading, error } = useMasterValues('hr.employment_type');
  const types = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_EMPLOYMENT_TYPES];
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);
  return { types, options, loading, error };
}

/** B6 — leave types from hr.leave_type */
export function useLeaveTypes() {
  const { options, loading, error } = useMasterValues('hr.leave_type');
  const types = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_LEAVE_TYPES];
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);
  return { types, options, loading, error };
}

const FALLBACK_QUALIFICATION_TYPES = [
  { value: 'MBBS', label: 'MBBS' },
  { value: 'MD', label: 'MD' },
  { value: 'MS', label: 'MS' },
  { value: 'DNB', label: 'DNB' },
  { value: 'DO', label: 'DO (Ophthalmology)' },
  { value: 'BOPTOM', label: 'BOptom' },
] as const;

const FALLBACK_SHIFT_TYPES = [
  { value: 'MORNING', label: 'Morning Shift' },
  { value: 'AFTERNOON', label: 'Afternoon Shift' },
  { value: 'NIGHT', label: 'Night Shift' },
  { value: 'GENERAL', label: 'General Shift' },
] as const;

const FALLBACK_PERFORMANCE_RATINGS = [
  { value: 'EXCELLENT', label: 'Excellent (5)', score: 5 },
  { value: 'GOOD', label: 'Good (4)', score: 4 },
  { value: 'SATISFACTORY', label: 'Satisfactory (3)', score: 3 },
  { value: 'NEEDS_IMPROV', label: 'Needs Improvement (2)', score: 2 },
  { value: 'POOR', label: 'Poor (1)', score: 1 },
] as const;

const FALLBACK_CREDENTIAL_TYPES = [
  { value: 'MEDICAL_LICENSE', label: 'Medical License' },
  { value: 'BOARD_CERT', label: 'Board Certification' },
  { value: 'CPR', label: 'CPR Certification' },
  { value: 'HOSPITAL_PRIV', label: 'Hospital Privileges' },
  { value: 'OTHER', label: 'Other' },
] as const;

/** B6 — qualification types from hr.qualification_type */
export function useQualificationTypes() {
  const { options, loading, error } = useMasterValues('hr.qualification_type');
  const types = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_QUALIFICATION_TYPES];
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);
  return { types, options, loading, error };
}

/** B6 — shift types from hr.shift_type */
export function useShiftTypes() {
  const { options, loading, error } = useMasterValues('hr.shift_type');
  const types = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_SHIFT_TYPES];
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);
  return { types, options, loading, error };
}

/** B6 — performance ratings from hr.performance_rating */
export function usePerformanceRatings() {
  const { options, loading, error } = useMasterValues('hr.performance_rating');
  const ratings = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_PERFORMANCE_RATINGS];
    return options.map((o, i) => ({
      value: o.value,
      label: o.label,
      score: FALLBACK_PERFORMANCE_RATINGS[i]?.score ?? Math.max(1, 5 - i),
    }));
  }, [options]);
  return { ratings, options, loading, error };
}

/** B6 — credential / license types from hr.credential_type */
export function useCredentialTypes() {
  const { options, loading, error } = useMasterValues('hr.credential_type');
  const types = useMemo(() => {
    if (options.length === 0) return [...FALLBACK_CREDENTIAL_TYPES];
    return options.map((o) => ({ value: o.value, label: o.label }));
  }, [options]);
  return { types, options, loading, error };
}
