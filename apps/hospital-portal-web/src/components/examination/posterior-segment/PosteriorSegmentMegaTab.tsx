'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Aperture, Eye, GitBranch, Sparkles, Target, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExamInput } from '@/components/examination/ExamCard';
import { ExamSelectField } from '@/components/examination/exam-ui/ExamSelectField';
import { BilateralTable, BilateralRow, BilateralSectionHeader } from '@/components/examination/exam-ui/BilateralTable';
import { BilateralSelectRow } from '@/components/examination/exam-ui/BilateralSelectRow';
import { BilateralNotesFields } from '@/components/examination/exam-ui/BilateralNotesFields';
import { PosteriorSegmentSectionToolbar } from './PosteriorSegmentSectionToolbar';
import { PosteriorSegmentSectionCard } from './PosteriorSegmentSectionCard';
import { PosteriorSegmentLayout } from './PosteriorSegmentLayout';
import { VesselChangeChips } from '@/components/examination/exam-ui/VesselChangeChips';
import {
  POSTERIOR_SECTIONS,
  ARTERIAL_CHANGE_OPTIONS,
  VENOUS_CHANGE_OPTIONS,
  type PosteriorSectionId,
} from '@/lib/optometry/posterior-segment-section-constants';
import {
  ABSENT_PRESENT,
  AV_CROSSING_OPTIONS,
  AV_RATIO_OPTIONS,
  CUP_DISC_RATIO_OPTIONS,
  DILATION_DRUG_OPTIONS,
  DISC_COLOR_OPTIONS,
  DISC_MARGINS_OPTIONS,
  DIABETIC_RETINOPATHY_OPTIONS,
  DRUSEN_OPTIONS,
  FOVEAL_REFLEX_OPTIONS,
  MACULAR_EDEMA_OPTIONS,
  MEDIA_CLARITY_OPTIONS,
  OVERALL_FINDING_OPTIONS,
  PERIPHERAL_APPEARANCE_OPTIONS,
  PERIPHERAL_DEGENERATION_OPTIONS,
  RETINA_CONFIG_OPTIONS,
  RETINAL_EXUDATES_OPTIONS,
  RETINAL_HEMORRHAGE_OPTIONS,
  VIEW_EXTENT_OPTIONS,
  VITREOUS_CELLS_OPTIONS,
  VITREOUS_CLARITY_OPTIONS,
  VITREOUS_PVD_OPTIONS,
  VITREOUS_SYNERESIS_OPTIONS,
} from '@/lib/optometry/posterior-segment-form-options';
import {
  applyPosteriorNormalToEye,
  copyPosteriorOdToOsSection,
} from '@/lib/optometry/posterior-segment-normal-presets';
import type {
  FundusExamData,
  PeripheralRetinaExamData,
  PosteriorSegmentExamData,
  PosteriorTabSavePayload,
  VitreousExamData,
} from '@/lib/optometry/posterior-segment-types';
import {
  DEFAULT_FUNDUS_EXAM,
  DEFAULT_PERIPHERAL_RETINA_EXAM,
  DEFAULT_POSTERIOR_SEGMENT,
  DEFAULT_VITREOUS_EXAM,
} from '@/lib/optometry/visit-segment-defaults';
import {
  priorFundusFieldHint,
  priorPeriphFieldHint,
  priorVitreousFieldHint,
} from '@/lib/optometry/posterior-segment-section-history';
import { posteriorSectionHasValues } from '@/lib/optometry/posterior-segment-section-values';
import { isPsSelectAbnormal, PS_NORMAL } from '@/lib/optometry/posterior-segment-abnormal';
import { priorRawFromSnapshot } from '@/lib/optometry/prior-segment-raw';
import { posteriorTabHasAnyData } from '@/lib/optometry/posterior-segment-tab-utils';
import type { PriorVisitSnapshot } from '@/lib/optometry/optometry-exam-types';

interface PosteriorSegmentMegaTabProps {
  posteriorSegmentData: PosteriorSegmentExamData | null;
  fundusExamData: FundusExamData | null;
  vitreousExamData: VitreousExamData | null;
  peripheralRetinaExamData: PeripheralRetinaExamData | null;
  priorVisit?: PriorVisitSnapshot | null;
  canEdit: boolean;
  saving?: boolean;
  onSaveTab: (payload: PosteriorTabSavePayload) => Promise<boolean> | boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

function mergeOverview(src: PosteriorSegmentExamData | null): PosteriorSegmentExamData {
  return { ...DEFAULT_POSTERIOR_SEGMENT, ...(src ?? {}) };
}
function mergeFundus(src: FundusExamData | null): FundusExamData {
  return { ...DEFAULT_FUNDUS_EXAM, ...(src ?? {}) };
}
function mergeVitreous(src: VitreousExamData | null): VitreousExamData {
  return { ...DEFAULT_VITREOUS_EXAM, ...(src ?? {}) };
}
function mergePeripheral(src: PeripheralRetinaExamData | null): PeripheralRetinaExamData {
  return { ...DEFAULT_PERIPHERAL_RETINA_EXAM, ...(src ?? {}) };
}

export default function PosteriorSegmentMegaTab({
  posteriorSegmentData,
  fundusExamData,
  vitreousExamData,
  peripheralRetinaExamData,
  priorVisit,
  canEdit,
  saving = false,
  onSaveTab,
  onDirtyChange,
}: PosteriorSegmentMegaTabProps) {
  const [overview, setOverview] = useState(() => mergeOverview(posteriorSegmentData));
  const [fundus, setFundus] = useState(() => mergeFundus(fundusExamData));
  const [vitreous, setVitreous] = useState(() => mergeVitreous(vitreousExamData));
  const [peripheralRetina, setPeripheralRetina] = useState(() =>
    mergePeripheral(peripheralRetinaExamData),
  );
  const [expanded, setExpanded] = useState<Record<PosteriorSectionId, boolean>>(() =>
    Object.fromEntries(POSTERIOR_SECTIONS.map((s) => [s.id, s.defaultExpanded])) as Record<
      PosteriorSectionId,
      boolean
    >,
  );

  const baseline = useMemo(
    () => ({
      overview: mergeOverview(posteriorSegmentData),
      fundus: mergeFundus(fundusExamData),
      vitreous: mergeVitreous(vitreousExamData),
      peripheralRetina: mergePeripheral(peripheralRetinaExamData),
    }),
    [posteriorSegmentData, fundusExamData, vitreousExamData, peripheralRetinaExamData],
  );

  useEffect(() => {
    setOverview(mergeOverview(posteriorSegmentData));
    setFundus(mergeFundus(fundusExamData));
    setVitreous(mergeVitreous(vitreousExamData));
    setPeripheralRetina(mergePeripheral(peripheralRetinaExamData));
  }, [posteriorSegmentData, fundusExamData, vitreousExamData, peripheralRetinaExamData]);

  const dirty = useMemo(
    () =>
      JSON.stringify({ overview, fundus, vitreous, peripheralRetina }) !==
      JSON.stringify(baseline),
    [overview, fundus, vitreous, peripheralRetina, baseline],
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const setO = useCallback(
    <K extends keyof PosteriorSegmentExamData>(k: K, v: PosteriorSegmentExamData[K]) =>
      setOverview((o) => ({ ...o, [k]: v })),
    [],
  );
  const setF = useCallback(
    <K extends keyof FundusExamData>(k: K, v: FundusExamData[K]) =>
      setFundus((f) => ({ ...f, [k]: v })),
    [],
  );
  const setV = useCallback(
    <K extends keyof VitreousExamData>(k: K, v: VitreousExamData[K]) =>
      setVitreous((x) => ({ ...x, [k]: v })),
    [],
  );
  const setP = useCallback(
    <K extends keyof PeripheralRetinaExamData>(k: K, v: PeripheralRetinaExamData[K]) =>
      setPeripheralRetina((x) => ({ ...x, [k]: v })),
    [],
  );

  const applyNormal = (sectionId: PosteriorSectionId, eye: 'OD' | 'OS' | 'both') => {
    const r = applyPosteriorNormalToEye(sectionId, eye, overview, fundus, vitreous, peripheralRetina);
    setOverview(r.overview);
    setFundus(r.fundus);
    setVitreous(r.vitreous);
    setPeripheralRetina(r.peripheralRetina);
  };

  const copyOd = (sectionId: PosteriorSectionId) => {
    const r = copyPosteriorOdToOsSection(sectionId, overview, fundus, vitreous, peripheralRetina);
    setOverview(r.overview);
    setFundus(r.fundus);
    setVitreous(r.vitreous);
    setPeripheralRetina(r.peripheralRetina);
  };

  const prior = priorRawFromSnapshot(priorVisit?.raw as Record<string, unknown> | undefined);
  const priorFundus = prior.fundusExam;
  const priorOverview = prior.posteriorSegment;
  const priorVitreous = prior.vitreousExam;
  const priorPeriph = prior.peripheralRetinaExam;
  const showLast = Boolean(
    priorVisit && (priorFundus || priorOverview || priorVitreous || priorPeriph),
  );
  const sectionTitle = (id: PosteriorSectionId) =>
    POSTERIOR_SECTIONS.find((s) => s.id === id)?.label ?? 'Section';

  const toolbar = (sectionId: PosteriorSectionId, showCopy = true) => (
    <PosteriorSegmentSectionToolbar
      canEdit={canEdit}
      showCopy={showCopy}
      sectionTitle={sectionTitle(sectionId)}
      hasExistingValues={posteriorSectionHasValues(
        sectionId,
        overview,
        fundus,
        vitreous,
        peripheralRetina,
      )}
      onMarkNormalOd={() => applyNormal(sectionId, 'OD')}
      onMarkNormalOs={() => applyNormal(sectionId, 'OS')}
      onMarkNormalBoth={() => applyNormal(sectionId, 'both')}
      onCopyOdToOs={() => copyOd(sectionId)}
    />
  );

  const isDilated = overview.isDilatedOD || overview.isDilatedOS;

  const handleSave = async () => {
    const ok = await onSaveTab({ overview, fundus, vitreous, peripheralRetina });
    if (ok) {
      toast.success('Posterior segment saved');
    } else {
      toast.error('Failed to save posterior segment');
    }
  };

  return (
    <PosteriorSegmentLayout
      sections={POSTERIOR_SECTIONS}
      defaultSectionId="dilation"
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
            disabled={
              !canEdit ||
              saving ||
              (!dirty &&
                !posteriorTabHasAnyData(overview, fundus, vitreous, peripheralRetina))
            }
            onClick={handleSave}
            className="min-h-[44px]"
          >
            {saving ? 'Saving…' : 'Save posterior segment'}
          </Button>
        </div>
      }
    >
      <PosteriorSegmentSectionCard
        anchor="ps-section-dilation"
        title="Dilatation"
        icon={<Eye className="w-4 h-4" />}
        expanded={expanded.dilation}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, dilation: v }))}
      >
        {toolbar('dilation', false)}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Dilatation Status</label>
            <ExamSelectField
              value={isDilated ? 'Dilated' : 'Undilated'}
              options={['Undilated', 'Dilated']}
              onChange={(v) => {
                const dil = v === 'Dilated';
                setO('isDilatedOD', dil);
                setO('isDilatedOS', dil);
                if (!dil) {
                  setO('dilationDrug', undefined);
                  setO('dilationTime', undefined);
                }
              }}
              disabled={!canEdit}
            />
          </div>
          {isDilated && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Dilatation Drug</label>
                <ExamSelectField
                  value={overview.dilationDrug ?? ''}
                  options={DILATION_DRUG_OPTIONS}
                  onChange={(v) => setO('dilationDrug', v || undefined)}
                  disabled={!canEdit}
                />
              </div>
              <ExamInput
                label="Dilatation Time"
                type="time"
                value={overview.dilationTime ?? ''}
                onChange={(e) => setO('dilationTime', e.target.value || undefined)}
                disabled={!canEdit}
              />
            </>
          )}
        </div>
      </PosteriorSegmentSectionCard>

      <PosteriorSegmentSectionCard
        anchor="ps-section-overview"
        title="Fundus overview"
        expanded={expanded.overview}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, overview: v }))}
      >
        {toolbar('overview')}
        <BilateralTable showLastColumn={showLast}>
          <BilateralSelectRow label="Media Clarity" options={MEDIA_CLARITY_OPTIONS} odValue={overview.mediaClarityOD ?? ''} osValue={overview.mediaClarityOS ?? ''} onOdChange={(v) => setO('mediaClarityOD', v)} onOsChange={(v) => setO('mediaClarityOS', v)} disabled={!canEdit} priorOd={priorOverview?.mediaClarityOD} priorOs={priorOverview?.mediaClarityOS} abnormalOd={isPsSelectAbnormal(overview.mediaClarityOD, PS_NORMAL.mediaClarity)} abnormalOs={isPsSelectAbnormal(overview.mediaClarityOS, PS_NORMAL.mediaClarity)} />
          <BilateralSelectRow label="Overall Finding" options={OVERALL_FINDING_OPTIONS} odValue={overview.overallFindingOD ?? ''} osValue={overview.overallFindingOS ?? ''} onOdChange={(v) => setO('overallFindingOD', v)} onOsChange={(v) => setO('overallFindingOS', v)} disabled={!canEdit} priorOd={priorOverview?.overallFindingOD} priorOs={priorOverview?.overallFindingOS} abnormalOd={isPsSelectAbnormal(overview.overallFindingOD, PS_NORMAL.overallFinding)} abnormalOs={isPsSelectAbnormal(overview.overallFindingOS, PS_NORMAL.overallFinding)} />
        </BilateralTable>
      </PosteriorSegmentSectionCard>

      <PosteriorSegmentSectionCard
        anchor="ps-section-disc"
        title="Optic disc"
        icon={<Target className="w-4 h-4" />}
        expanded={expanded.disc}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, disc: v }))}
      >
        {toolbar('disc')}
        <BilateralTable showLastColumn={showLast}>
          <BilateralSectionHeader title="Optic disc findings" />
          <BilateralSelectRow label="Cup/Disc Ratio" options={CUP_DISC_RATIO_OPTIONS} odValue={fundus.cupDiscRatioOD ?? ''} osValue={fundus.cupDiscRatioOS ?? ''} onOdChange={(v) => setF('cupDiscRatioOD', v)} onOsChange={(v) => setF('cupDiscRatioOS', v)} disabled={!canEdit} priorOd={priorFundusFieldHint(priorFundus, 'cupDiscRatioOD')} priorOs={priorFundusFieldHint(priorFundus, 'cupDiscRatioOS')} />
          <BilateralSelectRow label="Disc Color" options={DISC_COLOR_OPTIONS} odValue={fundus.discColorOD ?? ''} osValue={fundus.discColorOS ?? ''} onOdChange={(v) => setF('discColorOD', v)} onOsChange={(v) => setF('discColorOS', v)} disabled={!canEdit} priorOd={priorFundus?.discColorOD} priorOs={priorFundus?.discColorOS} abnormalOd={isPsSelectAbnormal(fundus.discColorOD, PS_NORMAL.discColor)} abnormalOs={isPsSelectAbnormal(fundus.discColorOS, PS_NORMAL.discColor)} />
          <BilateralSelectRow label="Disc Margins" options={DISC_MARGINS_OPTIONS} odValue={fundus.discMarginsOD ?? ''} osValue={fundus.discMarginsOS ?? ''} onOdChange={(v) => setF('discMarginsOD', v)} onOsChange={(v) => setF('discMarginsOS', v)} disabled={!canEdit} priorOd={priorFundus?.discMarginsOD} priorOs={priorFundus?.discMarginsOS} abnormalOd={isPsSelectAbnormal(fundus.discMarginsOD, PS_NORMAL.discMargins)} abnormalOs={isPsSelectAbnormal(fundus.discMarginsOS, PS_NORMAL.discMargins)} />
          <BilateralSelectRow label="Disc Neovascularization" options={ABSENT_PRESENT} odValue={fundus.discNvOD ?? ''} osValue={fundus.discNvOS ?? ''} onOdChange={(v) => setF('discNvOD', v)} onOsChange={(v) => setF('discNvOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.discNvOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(fundus.discNvOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Disc Hemorrhage" options={ABSENT_PRESENT} odValue={fundus.discHemorrhageOD ?? ''} osValue={fundus.discHemorrhageOS ?? ''} onOdChange={(v) => setF('discHemorrhageOD', v)} onOsChange={(v) => setF('discHemorrhageOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.discHemorrhageOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(fundus.discHemorrhageOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Peripapillary Atrophy" options={ABSENT_PRESENT} odValue={fundus.peripapillaryAtrophyOD ?? ''} osValue={fundus.peripapillaryAtrophyOS ?? ''} onOdChange={(v) => setF('peripapillaryAtrophyOD', v)} onOsChange={(v) => setF('peripapillaryAtrophyOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.peripapillaryAtrophyOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(fundus.peripapillaryAtrophyOS, PS_NORMAL.absent)} />
        </BilateralTable>
        <BilateralNotesFields odValue={fundus.discNotesOD ?? ''} osValue={fundus.discNotesOS ?? ''} onOdChange={(v) => setF('discNotesOD', v)} onOsChange={(v) => setF('discNotesOS', v)} disabled={!canEdit} />
      </PosteriorSegmentSectionCard>

      <PosteriorSegmentSectionCard
        anchor="ps-section-macula"
        title="Macula"
        icon={<Aperture className="w-4 h-4" />}
        expanded={expanded.macula}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, macula: v }))}
      >
        {toolbar('macula')}
        <BilateralTable showLastColumn={showLast}>
          <BilateralSelectRow label="Foveal Reflex" options={FOVEAL_REFLEX_OPTIONS} odValue={fundus.fovealReflexOD ?? ''} osValue={fundus.fovealReflexOS ?? ''} onOdChange={(v) => setF('fovealReflexOD', v)} onOsChange={(v) => setF('fovealReflexOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.fovealReflexOD, PS_NORMAL.fovealReflex)} abnormalOs={isPsSelectAbnormal(fundus.fovealReflexOS, PS_NORMAL.fovealReflex)} />
          <BilateralSelectRow label="Macular Edema" options={MACULAR_EDEMA_OPTIONS} odValue={fundus.macularEdemaOD ?? ''} osValue={fundus.macularEdemaOS ?? ''} onOdChange={(v) => setF('macularEdemaOD', v)} onOsChange={(v) => setF('macularEdemaOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.macularEdemaOD, PS_NORMAL.macularEdema)} abnormalOs={isPsSelectAbnormal(fundus.macularEdemaOS, PS_NORMAL.macularEdema)} />
          <BilateralSelectRow label="Macular Hemorrhage" options={ABSENT_PRESENT} odValue={fundus.macularHemorrhageOD ?? ''} osValue={fundus.macularHemorrhageOS ?? ''} onOdChange={(v) => setF('macularHemorrhageOD', v)} onOsChange={(v) => setF('macularHemorrhageOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.macularHemorrhageOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(fundus.macularHemorrhageOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Macular Exudates" options={ABSENT_PRESENT} odValue={fundus.macularExudatesOD ?? ''} osValue={fundus.macularExudatesOS ?? ''} onOdChange={(v) => setF('macularExudatesOD', v)} onOsChange={(v) => setF('macularExudatesOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.macularExudatesOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(fundus.macularExudatesOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Drusen" options={DRUSEN_OPTIONS} odValue={fundus.drusenOD ?? ''} osValue={fundus.drusenOS ?? ''} onOdChange={(v) => setF('drusenOD', v)} onOsChange={(v) => setF('drusenOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.drusenOD, PS_NORMAL.drusen)} abnormalOs={isPsSelectAbnormal(fundus.drusenOS, PS_NORMAL.drusen)} />
          <BilateralSelectRow label="Macular Scar" options={ABSENT_PRESENT} odValue={fundus.macularScarOD ?? ''} osValue={fundus.macularScarOS ?? ''} onOdChange={(v) => setF('macularScarOD', v)} onOsChange={(v) => setF('macularScarOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.macularScarOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(fundus.macularScarOS, PS_NORMAL.absent)} />
        </BilateralTable>
        <BilateralNotesFields odValue={fundus.maculaNotesOD ?? ''} osValue={fundus.maculaNotesOS ?? ''} onOdChange={(v) => setF('maculaNotesOD', v)} onOsChange={(v) => setF('maculaNotesOS', v)} disabled={!canEdit} />
      </PosteriorSegmentSectionCard>

      <PosteriorSegmentSectionCard
        anchor="ps-section-retina"
        title="Retina"
        icon={<Waves className="w-4 h-4" />}
        expanded={expanded.retina}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, retina: v }))}
      >
        {toolbar('retina')}
        <BilateralTable showLastColumn={showLast}>
          <BilateralSelectRow label="Configuration" options={RETINA_CONFIG_OPTIONS} odValue={fundus.retinaConfigOD ?? ''} osValue={fundus.retinaConfigOS ?? ''} onOdChange={(v) => setF('retinaConfigOD', v)} onOsChange={(v) => setF('retinaConfigOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.retinaConfigOD, PS_NORMAL.retinaConfig)} abnormalOs={isPsSelectAbnormal(fundus.retinaConfigOS, PS_NORMAL.retinaConfig)} />
          <BilateralSelectRow label="Retinal Tears" options={ABSENT_PRESENT} odValue={fundus.retinalTearsOD ?? ''} osValue={fundus.retinalTearsOS ?? ''} onOdChange={(v) => setF('retinalTearsOD', v)} onOsChange={(v) => setF('retinalTearsOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.retinalTearsOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(fundus.retinalTearsOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Retinal Hemorrhage" options={RETINAL_HEMORRHAGE_OPTIONS} odValue={fundus.retinalHemorrhageOD ?? ''} osValue={fundus.retinalHemorrhageOS ?? ''} onOdChange={(v) => setF('retinalHemorrhageOD', v)} onOsChange={(v) => setF('retinalHemorrhageOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.retinalHemorrhageOD, PS_NORMAL.retinalHemorrhage)} abnormalOs={isPsSelectAbnormal(fundus.retinalHemorrhageOS, PS_NORMAL.retinalHemorrhage)} />
          <BilateralSelectRow label="Retinal Exudates" options={RETINAL_EXUDATES_OPTIONS} odValue={fundus.retinalExudatesOD ?? ''} osValue={fundus.retinalExudatesOS ?? ''} onOdChange={(v) => setF('retinalExudatesOD', v)} onOsChange={(v) => setF('retinalExudatesOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.retinalExudatesOD, PS_NORMAL.retinalExudates)} abnormalOs={isPsSelectAbnormal(fundus.retinalExudatesOS, PS_NORMAL.retinalExudates)} />
          <BilateralSelectRow label="Diabetic Retinopathy" options={DIABETIC_RETINOPATHY_OPTIONS} odValue={fundus.diabeticRetinopathyOD ?? ''} osValue={fundus.diabeticRetinopathyOS ?? ''} onOdChange={(v) => setF('diabeticRetinopathyOD', v)} onOsChange={(v) => setF('diabeticRetinopathyOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.diabeticRetinopathyOD, PS_NORMAL.diabeticRetinopathy)} abnormalOs={isPsSelectAbnormal(fundus.diabeticRetinopathyOS, PS_NORMAL.diabeticRetinopathy)} />
          <BilateralSelectRow label="Peripheral Degeneration" options={PERIPHERAL_DEGENERATION_OPTIONS} odValue={fundus.peripheralDegenerationOD ?? ''} osValue={fundus.peripheralDegenerationOS ?? ''} onOdChange={(v) => setF('peripheralDegenerationOD', v)} onOsChange={(v) => setF('peripheralDegenerationOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.peripheralDegenerationOD, PS_NORMAL.peripheralDegeneration)} abnormalOs={isPsSelectAbnormal(fundus.peripheralDegenerationOS, PS_NORMAL.peripheralDegeneration)} />
        </BilateralTable>
        <BilateralNotesFields odValue={fundus.retinaNotesOD ?? ''} osValue={fundus.retinaNotesOS ?? ''} onOdChange={(v) => setF('retinaNotesOD', v)} onOsChange={(v) => setF('retinaNotesOS', v)} disabled={!canEdit} />
      </PosteriorSegmentSectionCard>

      <PosteriorSegmentSectionCard
        anchor="ps-section-vessels"
        title="Retinal vessels"
        icon={<GitBranch className="w-4 h-4" />}
        expanded={expanded.vessels}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, vessels: v }))}
      >
        {toolbar('vessels')}
        <BilateralTable showLastColumn={showLast}>
          <BilateralSelectRow label="A/V Ratio" options={AV_RATIO_OPTIONS} odValue={fundus.avRatioOD ?? ''} osValue={fundus.avRatioOS ?? ''} onOdChange={(v) => setF('avRatioOD', v)} onOsChange={(v) => setF('avRatioOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.avRatioOD, PS_NORMAL.avRatio)} abnormalOs={isPsSelectAbnormal(fundus.avRatioOS, PS_NORMAL.avRatio)} />
          <BilateralRow
            label="Arterial Changes"
            od={
              <VesselChangeChips
                label="Arterial Changes"
                eyeLabel="OD"
                options={ARTERIAL_CHANGE_OPTIONS}
                selected={fundus.arterialChangesOD ?? []}
                onChange={(n) => setF('arterialChangesOD', n)}
                disabled={!canEdit}
              />
            }
            os={
              <VesselChangeChips
                label="Arterial Changes"
                eyeLabel="OS"
                options={ARTERIAL_CHANGE_OPTIONS}
                selected={fundus.arterialChangesOS ?? []}
                onChange={(n) => setF('arterialChangesOS', n)}
                disabled={!canEdit}
              />
            }
          />
          <BilateralRow
            label="Venous Changes"
            od={
              <VesselChangeChips
                label="Venous Changes"
                eyeLabel="OD"
                options={VENOUS_CHANGE_OPTIONS}
                selected={fundus.venousChangesOD ?? []}
                onChange={(n) => setF('venousChangesOD', n)}
                disabled={!canEdit}
              />
            }
            os={
              <VesselChangeChips
                label="Venous Changes"
                eyeLabel="OS"
                options={VENOUS_CHANGE_OPTIONS}
                selected={fundus.venousChangesOS ?? []}
                onChange={(n) => setF('venousChangesOS', n)}
                disabled={!canEdit}
              />
            }
          />
          <BilateralSelectRow label="AV Crossing Changes" options={AV_CROSSING_OPTIONS} odValue={fundus.avCrossingOD ?? ''} osValue={fundus.avCrossingOS ?? ''} onOdChange={(v) => setF('avCrossingOD', v)} onOsChange={(v) => setF('avCrossingOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.avCrossingOD, PS_NORMAL.avCrossing)} abnormalOs={isPsSelectAbnormal(fundus.avCrossingOS, PS_NORMAL.avCrossing)} />
          <BilateralSelectRow label="Neovascularization" options={ABSENT_PRESENT} odValue={fundus.vesselNvOD ?? ''} osValue={fundus.vesselNvOS ?? ''} onOdChange={(v) => setF('vesselNvOD', v)} onOsChange={(v) => setF('vesselNvOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(fundus.vesselNvOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(fundus.vesselNvOS, PS_NORMAL.absent)} />
        </BilateralTable>
        <BilateralNotesFields odValue={fundus.vesselNotesOD ?? ''} osValue={fundus.vesselNotesOS ?? ''} onOdChange={(v) => setF('vesselNotesOD', v)} onOsChange={(v) => setF('vesselNotesOS', v)} disabled={!canEdit} />
      </PosteriorSegmentSectionCard>

      <PosteriorSegmentSectionCard
        anchor="ps-section-vitreous"
        title="Vitreous"
        icon={<Sparkles className="w-4 h-4" />}
        expanded={expanded.vitreous}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, vitreous: v }))}
      >
        {toolbar('vitreous')}
        <BilateralTable showLastColumn={showLast}>
          <BilateralSelectRow label="Clarity" options={VITREOUS_CLARITY_OPTIONS} odValue={vitreous.clarityOD ?? ''} osValue={vitreous.clarityOS ?? ''} onOdChange={(v) => setV('clarityOD', v)} onOsChange={(v) => setV('clarityOS', v)} disabled={!canEdit} priorOd={priorVitreousFieldHint(priorVitreous, 'clarityOD')} priorOs={priorVitreousFieldHint(priorVitreous, 'clarityOS')} abnormalOd={isPsSelectAbnormal(vitreous.clarityOD, PS_NORMAL.vitreousClarity)} abnormalOs={isPsSelectAbnormal(vitreous.clarityOS, PS_NORMAL.vitreousClarity)} />
          <BilateralSelectRow label="Cells" options={VITREOUS_CELLS_OPTIONS} odValue={vitreous.cellsOD ?? ''} osValue={vitreous.cellsOS ?? ''} onOdChange={(v) => setV('cellsOD', v)} onOsChange={(v) => setV('cellsOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(vitreous.cellsOD, PS_NORMAL.vitreousCells)} abnormalOs={isPsSelectAbnormal(vitreous.cellsOS, PS_NORMAL.vitreousCells)} />
          <BilateralSelectRow label="Hemorrhage" options={ABSENT_PRESENT} odValue={vitreous.hemorrhageOD ?? ''} osValue={vitreous.hemorrhageOS ?? ''} onOdChange={(v) => setV('hemorrhageOD', v)} onOsChange={(v) => setV('hemorrhageOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(vitreous.hemorrhageOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(vitreous.hemorrhageOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="PVD" options={VITREOUS_PVD_OPTIONS} odValue={vitreous.pvdOD ?? ''} osValue={vitreous.pvdOS ?? ''} onOdChange={(v) => setV('pvdOD', v)} onOsChange={(v) => setV('pvdOS', v)} disabled={!canEdit} />
          <BilateralSelectRow label="Vitritis" options={ABSENT_PRESENT} odValue={vitreous.vitritisOD ?? ''} osValue={vitreous.vitritisOS ?? ''} onOdChange={(v) => setV('vitritisOD', v)} onOsChange={(v) => setV('vitritisOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(vitreous.vitritisOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(vitreous.vitritisOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Asteroid Hyalosis" options={ABSENT_PRESENT} odValue={vitreous.asteroidHyalosisOD ?? ''} osValue={vitreous.asteroidHyalosisOS ?? ''} onOdChange={(v) => setV('asteroidHyalosisOD', v)} onOsChange={(v) => setV('asteroidHyalosisOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(vitreous.asteroidHyalosisOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(vitreous.asteroidHyalosisOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Syneresis" options={VITREOUS_SYNERESIS_OPTIONS} odValue={vitreous.syneresisOD ?? ''} osValue={vitreous.syneresisOS ?? ''} onOdChange={(v) => setV('syneresisOD', v)} onOsChange={(v) => setV('syneresisOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(vitreous.syneresisOD, PS_NORMAL.vitreousSyneresis)} abnormalOs={isPsSelectAbnormal(vitreous.syneresisOS, PS_NORMAL.vitreousSyneresis)} />
        </BilateralTable>
        <BilateralNotesFields odValue={vitreous.vitreousNotesOD ?? ''} osValue={vitreous.vitreousNotesOS ?? ''} onOdChange={(v) => setV('vitreousNotesOD', v)} onOsChange={(v) => setV('vitreousNotesOS', v)} disabled={!canEdit} />
      </PosteriorSegmentSectionCard>

      <PosteriorSegmentSectionCard
        anchor="ps-section-peripheral-retina"
        title="Peripheral retina"
        expanded={expanded['peripheral-retina']}
        onExpandedChange={(v) => setExpanded((e) => ({ ...e, 'peripheral-retina': v }))}
      >
        {toolbar('peripheral-retina')}
        <BilateralTable showLastColumn={showLast}>
          <BilateralSelectRow label="Peripheral Appearance" options={PERIPHERAL_APPEARANCE_OPTIONS} odValue={peripheralRetina.peripheralAppearanceOD ?? ''} osValue={peripheralRetina.peripheralAppearanceOS ?? ''} onOdChange={(v) => setP('peripheralAppearanceOD', v)} onOsChange={(v) => setP('peripheralAppearanceOS', v)} disabled={!canEdit} priorOd={priorPeriphFieldHint(priorPeriph, 'peripheralAppearanceOD')} priorOs={priorPeriphFieldHint(priorPeriph, 'peripheralAppearanceOS')} abnormalOd={isPsSelectAbnormal(peripheralRetina.peripheralAppearanceOD, PS_NORMAL.peripheralAppearance)} abnormalOs={isPsSelectAbnormal(peripheralRetina.peripheralAppearanceOS, PS_NORMAL.peripheralAppearance)} />
          <BilateralSelectRow label="Peripheral Breaks" options={ABSENT_PRESENT} odValue={peripheralRetina.peripheralBreaksOD ?? ''} osValue={peripheralRetina.peripheralBreaksOS ?? ''} onOdChange={(v) => setP('peripheralBreaksOD', v)} onOsChange={(v) => setP('peripheralBreaksOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(peripheralRetina.peripheralBreaksOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(peripheralRetina.peripheralBreaksOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Lattice Degeneration" options={ABSENT_PRESENT} odValue={peripheralRetina.latticeDegenerationOD ?? ''} osValue={peripheralRetina.latticeDegenerationOS ?? ''} onOdChange={(v) => setP('latticeDegenerationOD', v)} onOsChange={(v) => setP('latticeDegenerationOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(peripheralRetina.latticeDegenerationOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(peripheralRetina.latticeDegenerationOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Horseshoe Tear" options={ABSENT_PRESENT} odValue={peripheralRetina.horseshoeTearOD ?? ''} osValue={peripheralRetina.horseshoeTearOS ?? ''} onOdChange={(v) => setP('horseshoeTearOD', v)} onOsChange={(v) => setP('horseshoeTearOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(peripheralRetina.horseshoeTearOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(peripheralRetina.horseshoeTearOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Retinoschisis" options={ABSENT_PRESENT} odValue={peripheralRetina.retinoschisisOD ?? ''} osValue={peripheralRetina.retinoschisisOS ?? ''} onOdChange={(v) => setP('retinoschisisOD', v)} onOsChange={(v) => setP('retinoschisisOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(peripheralRetina.retinoschisisOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(peripheralRetina.retinoschisisOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Chorioretinal Scars" options={ABSENT_PRESENT} odValue={peripheralRetina.chorioretinalScarsOD ?? ''} osValue={peripheralRetina.chorioretinalScarsOS ?? ''} onOdChange={(v) => setP('chorioretinalScarsOD', v)} onOsChange={(v) => setP('chorioretinalScarsOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(peripheralRetina.chorioretinalScarsOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(peripheralRetina.chorioretinalScarsOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Pigment Changes" options={ABSENT_PRESENT} odValue={peripheralRetina.pigmentChangesOD ?? ''} osValue={peripheralRetina.pigmentChangesOS ?? ''} onOdChange={(v) => setP('pigmentChangesOD', v)} onOsChange={(v) => setP('pigmentChangesOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(peripheralRetina.pigmentChangesOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(peripheralRetina.pigmentChangesOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="Laser Scars" options={ABSENT_PRESENT} odValue={peripheralRetina.laserScarsOD ?? ''} osValue={peripheralRetina.laserScarsOS ?? ''} onOdChange={(v) => setP('laserScarsOD', v)} onOsChange={(v) => setP('laserScarsOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(peripheralRetina.laserScarsOD, PS_NORMAL.absent)} abnormalOs={isPsSelectAbnormal(peripheralRetina.laserScarsOS, PS_NORMAL.absent)} />
          <BilateralSelectRow label="View Extent" options={VIEW_EXTENT_OPTIONS} odValue={peripheralRetina.viewExtentOD ?? ''} osValue={peripheralRetina.viewExtentOS ?? ''} onOdChange={(v) => setP('viewExtentOD', v)} onOsChange={(v) => setP('viewExtentOS', v)} disabled={!canEdit} abnormalOd={isPsSelectAbnormal(peripheralRetina.viewExtentOD, PS_NORMAL.viewExtent)} abnormalOs={isPsSelectAbnormal(peripheralRetina.viewExtentOS, PS_NORMAL.viewExtent)} />
        </BilateralTable>
        <BilateralNotesFields
          odValue={peripheralRetina.peripheralRetinaNotesOD ?? ''}
          osValue={peripheralRetina.peripheralRetinaNotesOS ?? ''}
          onOdChange={(v) => setP('peripheralRetinaNotesOD', v)}
          onOsChange={(v) => setP('peripheralRetinaNotesOS', v)}
          disabled={!canEdit}
        />
      </PosteriorSegmentSectionCard>
    </PosteriorSegmentLayout>
  );
}
