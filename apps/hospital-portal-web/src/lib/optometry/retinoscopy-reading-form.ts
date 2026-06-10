import type { RetinoscopyReading } from './retinoscopy-types';

/** In-form state for "New Reading" rows (empty = Select / None). */
export interface RetinoscopyNewReadingForm {
  id: string;
  workingDistance: string;
  sphere: string;
  cylinder: string;
  axis: string;
}

export function createEmptyRetinoscopyNewReadingForm(): RetinoscopyNewReadingForm {
  return {
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 11),
    workingDistance: '',
    sphere: '',
    cylinder: '',
    axis: '',
  };
}

export function readingToNewReadingForm(reading: RetinoscopyReading): RetinoscopyNewReadingForm {
  return {
    id: reading.id,
    workingDistance: String(reading.workingDistance),
    sphere: reading.sphere.toFixed(2),
    cylinder: reading.cylinder != null ? reading.cylinder.toFixed(2) : '',
    axis: reading.axis != null ? String(reading.axis) : '',
  };
}

export function commitNewReadingForm(
  form: RetinoscopyNewReadingForm,
): { reading: RetinoscopyReading } | { error: string } {
  if (!form.workingDistance.trim()) {
    return { error: 'Select working distance before adding a reading.' };
  }
  if (!form.sphere.trim()) {
    return { error: 'Select sphere before adding a reading.' };
  }
  const sphere = parseFloat(form.sphere);
  const workingDistance = parseInt(form.workingDistance, 10);
  if (Number.isNaN(sphere) || Number.isNaN(workingDistance)) {
    return { error: 'Invalid sphere or working distance.' };
  }
  const hasCylinder = Boolean(form.cylinder.trim());
  const cylinder = hasCylinder ? parseFloat(form.cylinder) : undefined;
  const axis = hasCylinder && form.axis.trim() ? parseInt(form.axis, 10) : undefined;
  if (hasCylinder && (axis == null || Number.isNaN(axis))) {
    return { error: 'Select axis when cylinder is entered.' };
  }
  return {
    reading: {
      id: form.id,
      sphere,
      workingDistance,
      cylinder,
      axis,
    },
  };
}
