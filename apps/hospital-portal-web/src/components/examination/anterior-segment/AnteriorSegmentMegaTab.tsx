'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CircleDot, Eye, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExamSelectField } from '@/components/examination/exam-ui/ExamSelectField';
import { BilateralTable, BilateralSectionHeader } from '@/components/examination/exam-ui/BilateralTable';
import { BilateralSelectRow } from '@/components/examination/exam-ui/BilateralSelectRow';
import { RedEyeExamBanner } from '@/components/examination/exam-ui/RedEyeExamBanner';
import { AnteriorSegmentSectionToolbar } from './AnteriorSegmentSectionToolbar';
import { AnteriorSegmentSectionCard } from './AnteriorSegmentSectionCard';
import { AnteriorSegmentLayout } from './AnteriorSegmentLayout';
import {
  ANTERIOR_SECTIONS,
  type AnteriorSectionId,
} from '@/lib/optometry/anterior-segment-section-constants';
import {
  AC_DEPTH_OPTIONS,
  AC_OPTIONS,
  CONJUNCTIVA_OPTIONS,
  CORNEA_OPTIONS,
  IRIS_OPTIONS,
  LACRIMAL_OPTIONS,
  LENS_CLEAR_TYPES,
  LENS_OPACITY_GRADE_OPTIONS,
  LENS_OPTIONS,
  LIDS_OPTIONS,
  PUPIL_CONSENSUAL,
  PUPIL_REACTION,
  PUPIL_SHAPE,
  PUPIL_SIZE_MM,
  SCLERA_OPTIONS,
} from '@/lib/optometry/anterior-segment-form-options';
import {
  applyAnteriorNormalToEye,
  copyAnteriorOdToOsSection,
} from '@/lib/optometry/anterior-segment-normal-presets';
import {
  anteriorTabHasAnyData,
  validatePupilExamRequired,
} from '@/lib/optometry/anterior-segment-validation';
import type {
  AnteriorSegmentExamData,
  AnteriorTabSavePayload,
  PupilExamData,
} from '@/lib/optometry/anterior-segment-types';
import {
  DEFAULT_ANTERIOR_SEGMENT,
  DEFAULT_PUPIL_EXAM,
} from '@/lib/optometry/visit-segment-defaults';
import { anteriorSectionHasValues } from '@/lib/optometry/anterior-segment-section-values';
import { priorFieldHint } from '@/lib/optometry/anterior-segment-section-history';
import { priorRawFromSnapshot } from '@/lib/optometry/prior-segment-raw';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';

interface AnteriorSegmentMegaTabProps {
  pupilExamData: PupilExamData | null;
  anteriorSegmentData: AnteriorSegmentExamData | null;
  priorVisit?: PriorVisitSnapshot | null;
  chiefComplaint?: string | null;
  canEdit: boolean;
  saving?: boolean;
  onSaveTab: (payload: AnteriorTabSavePayload) => Promise<boolean> | boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

function mergePupil(src: PupilExamData | null): PupilExamData {
  return { ...DEFAULT_PUPIL_EXAM, ...(src ?? {}) };
}

function mergeSegment(src: AnteriorSegmentExamData | null): AnteriorSegmentExamData {
  return { ...DEFAULT_ANTERIOR_SEGMENT, ...(src ?? {}) };
}

export default function AnteriorSegmentMegaTab({
  pupilExamData,
  anteriorSegmentData,
  priorVisit,
  chiefComplaint,
  canEdit,
  saving = false,
  onSaveTab,
  onDirtyChange,
}: AnteriorSegmentMegaTabProps) {
  const [pupil, setPupil] = useState<PupilExamData>(() => mergePupil(pupilExamData));
  const [segment, setSegment] = useState<AnteriorSegmentExamData>(() =>
    mergeSegment(anteriorSegmentData),
  );
  const [expanded, setExpanded] = useState<Record<AnteriorSectionId, boolean>>(() =>
    Object.fromEntries(ANTERIOR_SECTIONS.map((s) => [s.id, s.defaultExpanded])) as Record<
      AnteriorSectionId,
      boolean
    >,
  );
  const [pupilError, setPupilError] = useState<string | null>(null);

  const baselinePupil = useMemo(() => mergePupil(pupilExamData), [pupilExamData]);
  const baselineSegment = useMemo(() => mergeSegment(anteriorSegmentData), [anteriorSegmentData]);

  useEffect(() => {
    setPupil(mergePupil(pupilExamData));
    setSegment(mergeSegment(anteriorSegmentData));
  }, [pupilExamData, anteriorSegmentData]);

  const dirty = useMemo(() => {
    return (
      JSON.stringify(pupil) !== JSON.stringify(baselinePupil) ||
      JSON.stringify(segment) !== JSON.stringify(baselineSegment)
    );
  }, [pupil, segment, baselinePupil, baselineSegment]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const priorSeg = priorRawFromSnapshot(priorVisit?.raw as Record<string, unknown> | undefined);
  const priorAnterior = priorSeg.anteriorSegment;
  const priorPupil = priorSeg.pupilExam;
  const showLast = Boolean(priorVisit && (priorAnterior || priorPupil));
  const sectionTitle = (id: AnteriorSectionId) =>
    ANTERIOR_SECTIONS.find((s) => s.id === id)?.label ?? 'Section';

  const setPupilField = useCallback(<K extends keyof PupilExamData>(key: K, value: PupilExamData[K]) => {
    setPupil((p) => ({ ...p, [key]: value }));
  }, []);

  const setSegField = useCallback(
    <K extends keyof AnteriorSegmentExamData>(key: K, value: AnteriorSegmentExamData[K]) => {
      setSegment((s) => ({ ...s, [key]: value }));
    },
    [],
  );

  const toolbar = (sectionId: AnteriorSectionId) => (
    <AnteriorSegmentSectionToolbar
      canEdit={canEdit}
      sectionTitle={sectionTitle(sectionId)}
      hasExistingValues={anteriorSectionHasValues(sectionId, pupil, segment)}
      onMarkNormalOd={() => {
        const r = applyAnteriorNormalToEye(sectionId, 'OD', pupil, segment);
        setPupil(r.pupil);
        setSegment(r.segment);
      }}
      onMarkNormalOs={() => {
        const r = applyAnteriorNormalToEye(sectionId, 'OS', pupil, segment);
        setPupil(r.pupil);
        setSegment(r.segment);
      }}
      onMarkNormalBoth={() => {
        const r = applyAnteriorNormalToEye(sectionId, 'both', pupil, segment);
        setPupil(r.pupil);
        setSegment(r.segment);
      }}
      onCopyOdToOs={() => {
        const r = copyAnteriorOdToOsSection(sectionId, pupil, segment);
        setPupil(r.pupil);
        setSegment(r.segment);
      }}
    />
  );

  const handleSave = async () => {
    const err = validatePupilExamRequired(pupil);
    if (err) {
      setPupilError(err);
      toast.error(err);
      setExpanded((e) => ({ ...e, pupil: true }));
      document.getElementById('as-section-pupil')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setPupilError(null);
    const ok = await onSaveTab({ pupil, segment });
    if (ok) {
      toast.success('Anterior segment saved');
    } else {
      toast.error('Failed to save anterior segment');
    }
  };

  const sizeStr = (n?: number) => (n != null ? `${n}mm` : '');
  const parseSize = (s: string) => {
    const m = parseFloat(s.replace('mm', ''));
    return Number.isFinite(m) ? m : undefined;
  };

  return (
    <AnteriorSegmentLayout
      sections={ANTERIOR_SECTIONS}
      defaultSectionId="pupil"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-gray-200">
          {dirty && (
            <p className="text-sm text-amber-600 flex items-center gap-1 mr-auto">
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              Unsaved changes
            </p>
          )}
          <Button
            type="button"
            variant="primary"
            disabled={!canEdit || saving || (!dirty && !anteriorTabHasAnyData(pupil, segment as Record<string, unknown>))}
            onClick={handleSave}
            className="min-h-[44px]"
          >
            {saving ? 'Saving…' : 'Save anterior segment'}
          </Button>
        </div>
      }
    >
      <RedEyeExamBanner chiefComplaint={chiefComplaint} />

      <AnteriorSegmentSectionCard
        anchor="as-section-pupil"
        title="Pupil examination"
        icon={<CircleDot className="w-4 h-4" />}
        expanded={expanded.pupil}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, pupil: v }))}
      >
        {toolbar('pupil')}
        {pupilError && <p className="text-sm text-red-600 mb-2">{pupilError}</p>}
        <BilateralTable showLastColumn={showLast}>
          <BilateralSelectRow
            label="Size in Light (mm)"
            options={PUPIL_SIZE_MM}
            odValue={sizeStr(pupil.sizeLightOD)}
            osValue={sizeStr(pupil.sizeLightOS)}
            onOdChange={(v) => setPupilField('sizeLightOD', parseSize(v))}
            onOsChange={(v) => setPupilField('sizeLightOS', parseSize(v))}
            disabled={!canEdit}
          />
          <BilateralSelectRow
            label="Size in Dark (mm)"
            options={PUPIL_SIZE_MM}
            odValue={sizeStr(pupil.sizeDarkOD)}
            osValue={sizeStr(pupil.sizeDarkOS)}
            onOdChange={(v) => setPupilField('sizeDarkOD', parseSize(v))}
            onOsChange={(v) => setPupilField('sizeDarkOS', parseSize(v))}
            disabled={!canEdit}
          />
          <BilateralSelectRow
            label="Shape"
            options={PUPIL_SHAPE}
            odValue={pupil.shapeOD ?? ''}
            osValue={pupil.shapeOS ?? ''}
            onOdChange={(v) => setPupilField('shapeOD', v || undefined)}
            onOsChange={(v) => setPupilField('shapeOS', v || undefined)}
            disabled={!canEdit}
          />
          <BilateralSelectRow
            label="Direct Light Reaction"
            options={PUPIL_REACTION}
            odValue={pupil.directReactionOD ?? ''}
            osValue={pupil.directReactionOS ?? ''}
            onOdChange={(v) => setPupilField('directReactionOD', v || undefined)}
            onOsChange={(v) => setPupilField('directReactionOS', v || undefined)}
            disabled={!canEdit}
          />
          <BilateralSelectRow
            label="Consensual Reaction"
            options={PUPIL_CONSENSUAL}
            odValue={pupil.consensualReactionOD ?? ''}
            osValue={pupil.consensualReactionOS ?? ''}
            onOdChange={(v) => setPupilField('consensualReactionOD', v || undefined)}
            onOsChange={(v) => setPupilField('consensualReactionOS', v || undefined)}
            disabled={!canEdit}
          />
        </BilateralTable>
        <div className="mt-3 max-w-md">
          <label className="text-xs font-medium text-gray-600 block mb-1">RAPD Present?</label>
          <ExamSelectField
            value={pupil.rapdPresent ? 'Present' : 'Absent'}
            options={['Absent', 'Present']}
            onChange={(v) => {
              const present = v === 'Present';
              setPupilField('rapdPresent', present);
              if (!present) setPupilField('rapdEye', null);
            }}
            disabled={!canEdit}
          />
          {pupil.rapdPresent && (
            <div className="mt-2">
              <ExamSelectField
                value={pupil.rapdEye ?? ''}
                options={['OD', 'OS']}
                placeholder="Which eye?"
                onChange={(v) => setPupilField('rapdEye', (v as 'OD' | 'OS') || null)}
                disabled={!canEdit}
              />
            </div>
          )}
        </div>
      </AnteriorSegmentSectionCard>

      <AnteriorSegmentSectionCard
        anchor="as-section-external"
        title="External eye & adnexa"
        icon={<Eye className="w-4 h-4" />}
        expanded={expanded.external}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, external: v }))}
      >
        {toolbar('external')}
        <BilateralTable showLastColumn={showLast}>
          <BilateralSectionHeader title="External & adnexa findings" />
          <BilateralSelectRow label="Lids" options={LIDS_OPTIONS} odValue={segment.lidsOD ?? ''} osValue={segment.lidsOS ?? ''} onOdChange={(v) => setSegField('lidsOD', v)} onOsChange={(v) => setSegField('lidsOS', v)} disabled={!canEdit} abnormalOd={segment.lidsOD !== 'Normal'} abnormalOs={segment.lidsOS !== 'Normal'} />
          <BilateralSelectRow label="Conjunctiva" options={CONJUNCTIVA_OPTIONS} odValue={segment.conjunctivaOD ?? ''} osValue={segment.conjunctivaOS ?? ''} onOdChange={(v) => setSegField('conjunctivaOD', v)} onOsChange={(v) => setSegField('conjunctivaOS', v)} disabled={!canEdit} abnormalOd={segment.conjunctivaOD !== 'Normal'} abnormalOs={segment.conjunctivaOS !== 'Normal'} />
          <BilateralSelectRow label="Sclera" options={SCLERA_OPTIONS} odValue={segment.scleraOD ?? ''} osValue={segment.scleraOS ?? ''} onOdChange={(v) => setSegField('scleraOD', v)} onOsChange={(v) => setSegField('scleraOS', v)} disabled={!canEdit} abnormalOd={segment.scleraOD !== 'Normal'} abnormalOs={segment.scleraOS !== 'Normal'} />
          <BilateralSelectRow label="Lacrimal System" options={LACRIMAL_OPTIONS} odValue={segment.lacrimalOD ?? ''} osValue={segment.lacrimalOS ?? ''} onOdChange={(v) => setSegField('lacrimalOD', v)} onOsChange={(v) => setSegField('lacrimalOS', v)} disabled={!canEdit} abnormalOd={segment.lacrimalOD !== 'Normal'} abnormalOs={segment.lacrimalOS !== 'Normal'} />
        </BilateralTable>
      </AnteriorSegmentSectionCard>

      <AnteriorSegmentSectionCard
        anchor="as-section-cornea-ac"
        title="Cornea & anterior chamber"
        icon={<Sparkles className="w-4 h-4" />}
        expanded={expanded['cornea-ac']}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, 'cornea-ac': v }))}
      >
        {toolbar('cornea-ac')}
        <BilateralTable showLastColumn={showLast}>
          <BilateralSectionHeader title="Cornea & anterior chamber" />
          <BilateralSelectRow label="Cornea" options={CORNEA_OPTIONS} odValue={segment.corneaOD ?? ''} osValue={segment.corneaOS ?? ''} onOdChange={(v) => setSegField('corneaOD', v)} onOsChange={(v) => setSegField('corneaOS', v)} disabled={!canEdit} priorOd={priorFieldHint(priorAnterior, 'corneaOD')} priorOs={priorFieldHint(priorAnterior, 'corneaOS')} abnormalOd={segment.corneaOD !== 'Clear'} abnormalOs={segment.corneaOS !== 'Clear'} />
          <BilateralSelectRow label="Anterior Chamber" options={AC_OPTIONS} odValue={segment.acOD ?? ''} osValue={segment.acOS ?? ''} onOdChange={(v) => setSegField('acOD', v)} onOsChange={(v) => setSegField('acOS', v)} disabled={!canEdit} abnormalOd={segment.acOD !== 'Normal Depth'} abnormalOs={segment.acOS !== 'Normal Depth'} />
          <BilateralSelectRow label="AC Depth (Van Herick)" options={AC_DEPTH_OPTIONS} odValue={segment.acDepthOD ?? ''} osValue={segment.acDepthOS ?? ''} onOdChange={(v) => setSegField('acDepthOD', v)} onOsChange={(v) => setSegField('acDepthOS', v)} disabled={!canEdit} />
        </BilateralTable>
      </AnteriorSegmentSectionCard>

      <AnteriorSegmentSectionCard
        anchor="as-section-iris-lens"
        title="Iris & lens"
        expanded={expanded['iris-lens']}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, 'iris-lens': v }))}
      >
        {toolbar('iris-lens')}
        <BilateralTable showLastColumn={showLast}>
          <BilateralSectionHeader title="Iris & lens" />
          <BilateralSelectRow label="Iris" options={IRIS_OPTIONS} odValue={segment.irisOD ?? ''} osValue={segment.irisOS ?? ''} onOdChange={(v) => setSegField('irisOD', v)} onOsChange={(v) => setSegField('irisOS', v)} disabled={!canEdit} abnormalOd={segment.irisOD !== 'Normal'} abnormalOs={segment.irisOS !== 'Normal'} />
          <BilateralSelectRow
            label="Lens"
            options={LENS_OPTIONS}
            odValue={segment.lensOD ?? ''}
            osValue={segment.lensOS ?? ''}
            onOdChange={(v) => {
              setSegField('lensOD', v);
              if (LENS_CLEAR_TYPES.includes(v)) setSegField('lensOpacityGradeOD', undefined);
            }}
            onOsChange={(v) => {
              setSegField('lensOS', v);
              if (LENS_CLEAR_TYPES.includes(v)) setSegField('lensOpacityGradeOS', undefined);
            }}
            disabled={!canEdit}
            abnormalOd={segment.lensOD !== 'Clear'}
            abnormalOs={segment.lensOS !== 'Clear'}
          />
        </BilateralTable>
        {(segment.lensOD && !LENS_CLEAR_TYPES.includes(segment.lensOD)) ||
        (segment.lensOS && !LENS_CLEAR_TYPES.includes(segment.lensOS)) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            {segment.lensOD && !LENS_CLEAR_TYPES.includes(segment.lensOD) && (
              <div>
                <label className="text-xs font-medium text-blue-700 block mb-1">
                  Lens Opacity Grade (OD)
                </label>
                <ExamSelectField
                  value={segment.lensOpacityGradeOD ?? ''}
                  options={LENS_OPACITY_GRADE_OPTIONS}
                  onChange={(v) => setSegField('lensOpacityGradeOD', v || undefined)}
                  disabled={!canEdit}
                />
              </div>
            )}
            {segment.lensOS && !LENS_CLEAR_TYPES.includes(segment.lensOS) && (
              <div>
                <label className="text-xs font-medium text-emerald-700 block mb-1">
                  Lens Opacity Grade (OS)
                </label>
                <ExamSelectField
                  value={segment.lensOpacityGradeOS ?? ''}
                  options={LENS_OPACITY_GRADE_OPTIONS}
                  onChange={(v) => setSegField('lensOpacityGradeOS', v || undefined)}
                  disabled={!canEdit}
                />
              </div>
            )}
          </div>
        ) : null}
      </AnteriorSegmentSectionCard>
    </AnteriorSegmentLayout>
  );
}
