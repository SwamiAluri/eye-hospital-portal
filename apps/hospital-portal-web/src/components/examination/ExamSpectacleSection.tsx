'use client';

import { ExamCard, ExamInput, ExamSelect } from './ExamCard';
import {
  EMPTY_SPECTACLE_DRAFT,
  type SpectacleDispensingDraft,
} from '@/lib/optometry/optometry-persistence';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';
import { PriorValueHint } from './exam-ui/PriorValueHint';

interface ExamSpectacleSectionProps {
  data: SpectacleDispensingDraft | null;
  priorVisit?: PriorVisitSnapshot | null;
  canEdit: boolean;
  onChange: (data: SpectacleDispensingDraft) => void;
  onPrefillFromRefraction?: () => void;
  onSaveToBundle?: () => void;
}

function eyeField(
  data: SpectacleDispensingDraft,
  eye: 'od' | 'os',
  field: 'sphere' | 'cylinder' | 'axis' | 'add',
  value: string,
): SpectacleDispensingDraft {
  return {
    ...data,
    [eye]: { ...data[eye], [field]: value },
  };
}

export function ExamSpectacleSection({
  data,
  priorVisit,
  canEdit,
  onChange,
  onPrefillFromRefraction,
  onSaveToBundle,
}: ExamSpectacleSectionProps) {
  const spec = data ?? EMPTY_SPECTACLE_DRAFT;
  const priorOd = priorVisit?.refraction?.finalRxOD ?? priorVisit?.refraction?.startingRxOD;
  const priorOs = priorVisit?.refraction?.finalRxOS ?? priorVisit?.refraction?.startingRxOS;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-end">
        {onPrefillFromRefraction && (
          <button
            type="button"
            onClick={onPrefillFromRefraction}
            disabled={!canEdit}
            className="text-xs font-semibold text-emerald-700 border border-emerald-600 rounded-md px-3 py-1.5 hover:bg-emerald-50 disabled:opacity-50"
          >
            Prefill from today&apos;s refraction
          </button>
        )}
        {onSaveToBundle && (
          <button
            type="button"
            onClick={onSaveToBundle}
            disabled={!canEdit}
            className="text-xs font-semibold bg-emerald-600 text-white rounded-md px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-50"
          >
            Save spectacle to visit
          </button>
        )}
      </div>

      <ExamCard dense title="Spectacle prescription">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Right eye (OD)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ExamInput
                label="Sphere (D)"
                value={spec.od?.sphere ?? ''}
                onChange={(e) => onChange(eyeField(spec, 'od', 'sphere', e.target.value))}
                disabled={!canEdit}
              />
              <ExamInput
                label="Cylinder (D)"
                value={spec.od?.cylinder ?? ''}
                onChange={(e) => onChange(eyeField(spec, 'od', 'cylinder', e.target.value))}
                disabled={!canEdit}
              />
              <ExamInput
                label="Axis"
                value={spec.od?.axis ?? ''}
                onChange={(e) => onChange(eyeField(spec, 'od', 'axis', e.target.value))}
                disabled={!canEdit}
              />
              <ExamInput
                label="Add"
                value={spec.od?.add ?? ''}
                onChange={(e) => onChange(eyeField(spec, 'od', 'add', e.target.value))}
                disabled={!canEdit}
              />
            </div>
            <PriorValueHint
              value={
                priorOd
                  ? `${priorOd.sphere}/${priorOd.cylinder ?? '—'}×${priorOd.axis ?? '—'}`
                  : null
              }
            />
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Left eye (OS)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ExamInput
                label="Sphere (D)"
                value={spec.os?.sphere ?? ''}
                onChange={(e) => onChange(eyeField(spec, 'os', 'sphere', e.target.value))}
                disabled={!canEdit}
              />
              <ExamInput
                label="Cylinder (D)"
                value={spec.os?.cylinder ?? ''}
                onChange={(e) => onChange(eyeField(spec, 'os', 'cylinder', e.target.value))}
                disabled={!canEdit}
              />
              <ExamInput
                label="Axis"
                value={spec.os?.axis ?? ''}
                onChange={(e) => onChange(eyeField(spec, 'os', 'axis', e.target.value))}
                disabled={!canEdit}
              />
              <ExamInput
                label="Add"
                value={spec.os?.add ?? ''}
                onChange={(e) => onChange(eyeField(spec, 'os', 'add', e.target.value))}
                disabled={!canEdit}
              />
            </div>
            <PriorValueHint
              value={
                priorOs
                  ? `${priorOs.sphere}/${priorOs.cylinder ?? '—'}×${priorOs.axis ?? '—'}`
                  : null
              }
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <ExamInput
            label="Pupillary distance (PD)"
            value={spec.pupillaryDistance ?? ''}
            onChange={(e) => onChange({ ...spec, pupillaryDistance: e.target.value })}
            disabled={!canEdit}
            placeholder="62 mm"
          />
          <ExamSelect
            label="Lens type"
            value={spec.lensType ?? ''}
            onChange={(v) => onChange({ ...spec, lensType: v })}
            disabled={!canEdit}
          >
            <option value="">Select</option>
            <option value="Single Vision">Single Vision</option>
            <option value="Bifocal">Bifocal</option>
            <option value="Progressive">Progressive</option>
            <option value="Reading Only">Reading Only</option>
          </ExamSelect>
        </div>
      </ExamCard>

      <ExamCard dense title="Lens & frame">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ExamSelect
            label="Lens material"
            value={spec.lensMaterial ?? ''}
            onChange={(v) => onChange({ ...spec, lensMaterial: v })}
            disabled={!canEdit}
          >
            <option value="">Select</option>
            <option value="CR-39 (Standard)">CR-39 (Standard)</option>
            <option value="Polycarbonate">Polycarbonate</option>
            <option value="High-Index 1.67">High-Index 1.67</option>
            <option value="Trivex">Trivex</option>
          </ExamSelect>
          <ExamSelect
            label="Lens coating"
            value={spec.lensCoating ?? ''}
            onChange={(v) => onChange({ ...spec, lensCoating: v })}
            disabled={!canEdit}
          >
            <option value="">Select</option>
            <option value="Anti-Reflective">Anti-Reflective</option>
            <option value="UV Protection">UV Protection</option>
            <option value="Blue Light Filter">Blue Light Filter</option>
            <option value="Photochromic">Photochromic</option>
          </ExamSelect>
          <ExamSelect
            label="Frame type"
            value={spec.frameType ?? ''}
            onChange={(v) => onChange({ ...spec, frameType: v })}
            disabled={!canEdit}
          >
            <option value="">Select</option>
            <option value="Full Rim">Full Rim</option>
            <option value="Semi-Rimless">Semi-Rimless</option>
            <option value="Rimless">Rimless</option>
          </ExamSelect>
          <ExamInput
            label="Frame size"
            value={spec.frameSize ?? ''}
            onChange={(e) => onChange({ ...spec, frameSize: e.target.value })}
            disabled={!canEdit}
            placeholder="52-18-140"
          />
        </div>
      </ExamCard>

      <ExamCard dense title="Dispensing instructions">
        <ExamInput
          label="Special instructions"
          value={spec.specialInstructions ?? ''}
          onChange={(e) => onChange({ ...spec, specialInstructions: e.target.value })}
          disabled={!canEdit}
        />
        <ExamInput
          label="Follow-up date"
          type="date"
          value={spec.followUpDate ?? ''}
          onChange={(e) => onChange({ ...spec, followUpDate: e.target.value })}
          disabled={!canEdit}
        />
      </ExamCard>
    </div>
  );
}
