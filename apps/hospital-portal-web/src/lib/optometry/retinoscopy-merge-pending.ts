import {
  commitNewReadingForm,
  type RetinoscopyNewReadingForm,
} from './retinoscopy-reading-form';
import type { RetinoscopySectionId } from './retinoscopy-section-constants';
import {
  hasDrySectionContent,
  hasSubjectiveSectionContent,
  hasWetSectionContent,
} from './retinoscopy-section-history';
import { subjectiveSphereSelectValue } from './retinoscopy-form-options';
import type { RetinoscopyEditTarget } from './retinoscopy-section-access';
import type {
  DryRetinoscopyData,
  RetinoscopyReading,
  SubjectiveRefractionData,
  SubjectiveRefractionReading,
  WetRetinoscopyData,
} from './retinoscopy-types';

export function isNewReadingFormStarted(form: RetinoscopyNewReadingForm): boolean {
  return Boolean(
    form.workingDistance.trim() ||
      form.sphere.trim() ||
      form.cylinder.trim() ||
      form.axis.trim(),
  );
}

function appendReading(
  data: WetRetinoscopyData | DryRetinoscopyData,
  eye: 'od' | 'os',
  form: RetinoscopyNewReadingForm,
): { data: WetRetinoscopyData | DryRetinoscopyData; error?: string } {
  if (!isNewReadingFormStarted(form)) return { data };
  const result = commitNewReadingForm(form);
  if ('error' in result) {
    return { data, error: `${eye.toUpperCase()}: ${result.error}` };
  }
  const key = eye === 'od' ? 'odReadings' : 'osReadings';
  return {
    data: {
      ...data,
      [key]: [...data[key], result.reading],
    },
  };
}

export function mergePendingWetReadings(
  wet: WetRetinoscopyData,
  odForm: RetinoscopyNewReadingForm,
  osForm: RetinoscopyNewReadingForm,
): { data: WetRetinoscopyData; errors: string[] } {
  const errors: string[] = [];
  let data = wet;
  const od = appendReading(data, 'od', odForm);
  if (od.error) errors.push(od.error);
  data = od.data as WetRetinoscopyData;
  const os = appendReading(data, 'os', osForm);
  if (os.error) errors.push(os.error);
  data = os.data as WetRetinoscopyData;
  return { data, errors };
}

export function mergePendingDryReadings(
  dry: DryRetinoscopyData,
  odForm: RetinoscopyNewReadingForm,
  osForm: RetinoscopyNewReadingForm,
): { data: DryRetinoscopyData; errors: string[] } {
  const errors: string[] = [];
  let data = dry;
  const od = appendReading(data, 'od', odForm);
  if (od.error) errors.push(od.error);
  data = od.data as DryRetinoscopyData;
  const os = appendReading(data, 'os', osForm);
  if (os.error) errors.push(os.error);
  data = os.data as DryRetinoscopyData;
  return { data, errors };
}

export type SubjectiveNewReadingForm = {
  id: string;
  entryNumber: number;
  odSphere: string;
  odCylinder: string;
  odAxis: string;
  osSphere: string;
  osCylinder: string;
  osAxis: string;
  vaAchievedOD: string;
  vaAchievedOS: string;
  isFinal: boolean;
};

export function isSubjectiveNewFormStarted(form: SubjectiveNewReadingForm): boolean {
  return Boolean(
    form.odSphere.trim() ||
      form.osSphere.trim() ||
      form.odCylinder.trim() ||
      form.osCylinder.trim() ||
      form.odAxis.trim() ||
      form.osAxis.trim() ||
      form.vaAchievedOD.trim() ||
      form.vaAchievedOS.trim(),
  );
}

export function subjectiveReadingToNewForm(
  reading: SubjectiveRefractionReading,
): SubjectiveNewReadingForm {
  return {
    id: reading.id,
    entryNumber: reading.entryNumber,
    odSphere: subjectiveSphereSelectValue(reading.odSphere),
    odCylinder: reading.odCylinder != null ? reading.odCylinder.toFixed(2) : '',
    odAxis: reading.odAxis != null ? String(reading.odAxis) : '',
    osSphere: subjectiveSphereSelectValue(reading.osSphere),
    osCylinder: reading.osCylinder != null ? reading.osCylinder.toFixed(2) : '',
    osAxis: reading.osAxis != null ? String(reading.osAxis) : '',
    vaAchievedOD: reading.vaAchievedOD,
    vaAchievedOS: reading.vaAchievedOS,
    isFinal: reading.isFinal,
  };
}

export function subjectiveFormToReading(
  form: SubjectiveNewReadingForm,
): { reading: SubjectiveRefractionReading } | { error: string } {
  if (!form.odSphere.trim() || !form.osSphere.trim()) {
    return { error: 'Select sphere for both OD and OS before recording.' };
  }
  const odSphere = parseFloat(form.odSphere);
  const osSphere = parseFloat(form.osSphere);
  if (Number.isNaN(odSphere) || Number.isNaN(osSphere)) {
    return { error: 'Invalid sphere values.' };
  }
  const odCylinder = form.odCylinder.trim() ? parseFloat(form.odCylinder) : undefined;
  const osCylinder = form.osCylinder.trim() ? parseFloat(form.osCylinder) : undefined;
  const odAxis =
    odCylinder != null && form.odAxis.trim() ? parseInt(form.odAxis, 10) : undefined;
  const osAxis =
    osCylinder != null && form.osAxis.trim() ? parseInt(form.osAxis, 10) : undefined;
  if (odCylinder != null && odAxis == null) {
    return { error: 'Select OD axis when OD cylinder is entered.' };
  }
  if (osCylinder != null && osAxis == null) {
    return { error: 'Select OS axis when OS cylinder is entered.' };
  }
  return {
    reading: {
      id: form.id,
      entryNumber: form.entryNumber,
      odSphere,
      odCylinder,
      odAxis,
      osSphere,
      osCylinder,
      osAxis,
      vaAchievedOD: form.vaAchievedOD,
      vaAchievedOS: form.vaAchievedOS,
      isFinal: form.isFinal,
    },
  };
}

export function mergePendingSubjectiveReading(
  data: SubjectiveRefractionData,
  form: SubjectiveNewReadingForm,
): { data: SubjectiveRefractionData; errors: string[] } {
  if (!isSubjectiveNewFormStarted(form)) {
    return { data, errors: [] };
  }
  const result = subjectiveFormToReading(form);
  if ('error' in result) {
    return { data, errors: [result.error] };
  }
  return {
    data: { readings: [...data.readings, result.reading] },
    errors: [],
  };
}

export function wetContentAfterMerge(
  wet: WetRetinoscopyData,
  odForm: RetinoscopyNewReadingForm,
  osForm: RetinoscopyNewReadingForm,
): boolean {
  return hasWetSectionContent(mergePendingWetReadings(wet, odForm, osForm).data);
}

export function dryContentAfterMerge(
  dry: DryRetinoscopyData,
  odForm: RetinoscopyNewReadingForm,
  osForm: RetinoscopyNewReadingForm,
): boolean {
  return hasDrySectionContent(mergePendingDryReadings(dry, odForm, osForm).data);
}

export function subjectiveContentAfterMerge(
  data: SubjectiveRefractionData,
  form: SubjectiveNewReadingForm,
): boolean {
  return hasSubjectiveSectionContent(mergePendingSubjectiveReading(data, form).data);
}

function replaceReadingInList(
  readings: RetinoscopyReading[],
  form: RetinoscopyNewReadingForm,
  readingId: string,
): { readings: RetinoscopyReading[]; error?: string } {
  const result = commitNewReadingForm({ ...form, id: readingId });
  if ('error' in result) {
    return { readings, error: result.error };
  }
  const idx = readings.findIndex((r) => r.id === readingId);
  if (idx < 0) {
    return { readings, error: 'Reading not found.' };
  }
  const next = [...readings];
  next[idx] = result.reading;
  return { readings: next };
}

export type SectionSavePayload =
  | { ok: true; wet?: WetRetinoscopyData; dry?: DryRetinoscopyData; subjective?: SubjectiveRefractionData }
  | { ok: false; errors: string[] };

export function buildSectionSavePayload(
  sectionId: RetinoscopySectionId,
  editTarget: RetinoscopyEditTarget | null,
  wet: WetRetinoscopyData,
  dry: DryRetinoscopyData,
  subjective: SubjectiveRefractionData,
  newWetOD: RetinoscopyNewReadingForm,
  newWetOS: RetinoscopyNewReadingForm,
  newDryOD: RetinoscopyNewReadingForm,
  newDryOS: RetinoscopyNewReadingForm,
  newSubj: SubjectiveNewReadingForm,
): SectionSavePayload {
  if (sectionId === 'wet') {
    if (editTarget?.sectionId === 'wet' && editTarget.kind === 'drug') {
      if (!hasWetSectionContent(wet)) {
        return { ok: false, errors: ['Wet retinoscopy requires cycloplegic drug and OD/OS readings.'] };
      }
      return { ok: true, wet };
    }
    if (editTarget?.sectionId === 'wet' && editTarget.kind === 'reading') {
      const errors: string[] = [];
      let data = wet;
      const form = editTarget.eye === 'od' ? newWetOD : newWetOS;
      const key = editTarget.eye === 'od' ? 'odReadings' : 'osReadings';
      const replaced = replaceReadingInList(data[key], form, editTarget.readingId);
      if (replaced.error) errors.push(replaced.error);
      data = { ...data, [key]: replaced.readings };
      if (!hasWetSectionContent(data)) {
        return { ok: false, errors: ['Wet retinoscopy requires cycloplegic drug and OD/OS readings.'] };
      }
      if (errors.length) return { ok: false, errors };
      return { ok: true, wet: data };
    }
    const { data, errors } = mergePendingWetReadings(wet, newWetOD, newWetOS);
    if (!hasWetSectionContent(data)) {
      return { ok: false, errors: ['Wet retinoscopy requires cycloplegic drug and OD/OS readings.'] };
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true, wet: data };
  }

  if (sectionId === 'dry') {
    if (editTarget?.sectionId === 'dry' && editTarget.kind === 'reading') {
      const errors: string[] = [];
      let data = dry;
      const form = editTarget.eye === 'od' ? newDryOD : newDryOS;
      const key = editTarget.eye === 'od' ? 'odReadings' : 'osReadings';
      const replaced = replaceReadingInList(data[key], form, editTarget.readingId);
      if (replaced.error) errors.push(replaced.error);
      data = { ...data, [key]: replaced.readings };
      if (!hasDrySectionContent(data)) {
        return { ok: false, errors: ['Dry retinoscopy requires OD and OS readings.'] };
      }
      if (errors.length) return { ok: false, errors };
      return { ok: true, dry: data };
    }
    const { data, errors } = mergePendingDryReadings(dry, newDryOD, newDryOS);
    if (!hasDrySectionContent(data)) {
      return { ok: false, errors: ['Dry retinoscopy requires OD and OS readings.'] };
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true, dry: data };
  }

  if (editTarget?.sectionId === 'subjective' && editTarget.kind === 'subjective') {
    const result = subjectiveFormToReading(newSubj);
    if ('error' in result) {
      return { ok: false, errors: [result.error] };
    }
    const readings = subjective.readings.map((r) =>
      r.id === editTarget.readingId ? result.reading : r,
    );
    const data = { readings };
    if (!hasSubjectiveSectionContent(data)) {
      return { ok: false, errors: ['Subjective refraction requires at least one reading.'] };
    }
    return { ok: true, subjective: data };
  }

  const { data, errors } = mergePendingSubjectiveReading(subjective, newSubj);
  if (!hasSubjectiveSectionContent(data)) {
    return { ok: false, errors: ['Subjective refraction requires at least one reading.'] };
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, subjective: data };
}
