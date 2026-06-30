import { getApi } from '@/lib/api';

export interface HpiTemplateCategory {
  category: string;
  label: string;
  pills: string[];
}

export interface MedicationSuggestion {
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  source: 'recent' | 'common';
}

/** Used when /api/clinical/hpi-templates is unavailable (e.g. AuthService not restarted). */
export const HPI_TEMPLATE_FALLBACK: HpiTemplateCategory[] = [
  {
    category: 'onset',
    label: 'Onset',
    pills: ['Sudden', 'Gradual', 'Since childhood', 'Since yesterday', 'Since weeks', 'Since months'],
  },
  {
    category: 'duration',
    label: 'Duration',
    pills: ['Hours', 'Days', 'Weeks', 'Months', 'Years', 'Intermittent'],
  },
  {
    category: 'quality',
    label: 'Quality',
    pills: ['Blurring', 'Pain', 'Redness', 'Discharge', 'Floaters', 'Flashes', 'Diplopia'],
  },
  {
    category: 'severity',
    label: 'Severity',
    pills: ['Mild', 'Moderate', 'Severe', 'Worse in morning', 'Worse in evening'],
  },
  {
    category: 'timing',
    label: 'Timing',
    pills: ['Constant', 'Intermittent', 'Progressive', 'Stable', 'Improving'],
  },
  {
    category: 'context',
    label: 'Context',
    pills: ['After trauma', 'Post-surgery', 'After screen use', 'After injury', 'No trigger'],
  },
  {
    category: 'modifiers',
    label: 'Modifying factors',
    pills: ['Better with rest', 'Worse with reading', 'Relieved by drops', 'Not relieved by OTC'],
  },
  {
    category: 'associated',
    label: 'Associated symptoms',
    pills: ['Headache', 'Nausea', 'Photophobia', 'Lacrimation', 'Halos', 'Night blindness'],
  },
];

const COMMON_MEDICATIONS: MedicationSuggestion[] = [
  { name: 'Timolol 0.5%', dosage: '1 drop', frequency: 'BD', source: 'common' },
  { name: 'Latanoprost 0.005%', dosage: '1 drop', frequency: 'HS', source: 'common' },
  { name: 'Moxifloxacin 0.5%', dosage: '1 drop', frequency: 'TDS', source: 'common' },
  { name: 'Prednisolone acetate 1%', dosage: '1 drop', frequency: 'QID taper', source: 'common' },
  { name: 'Artificial tears', dosage: '1 drop', frequency: 'QID', source: 'common' },
  { name: 'Atropine 1%', dosage: '1 drop', frequency: 'OD/BID', source: 'common' },
];

export const clinicalApi = {
  async getHpiTemplates(): Promise<HpiTemplateCategory[]> {
    try {
      const { data } = await getApi().get<HpiTemplateCategory[]>('/clinical/hpi-templates');
      return data?.length ? data : HPI_TEMPLATE_FALLBACK;
    } catch {
      return HPI_TEMPLATE_FALLBACK;
    }
  },

  async getMedicationSuggestions(
    patientId: string,
    diagnosis?: string,
  ): Promise<MedicationSuggestion[]> {
    try {
      const { data } = await getApi().get<MedicationSuggestion[]>('/clinical/medication-suggestions', {
        params: { patientId, diagnosis: diagnosis || undefined },
      });
      return data?.length ? data : COMMON_MEDICATIONS;
    } catch {
      return COMMON_MEDICATIONS;
    }
  },
};
