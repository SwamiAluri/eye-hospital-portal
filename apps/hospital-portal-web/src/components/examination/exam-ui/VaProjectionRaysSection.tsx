'use client';

import { ProjectionRaysQuadrant, type PrQuadrants } from './ProjectionRaysQuadrant';

const LOW_VA = ['HM (Hand Movement)', 'PL (Perception of Light)'];

interface VaEye {
  unaided: string;
  aided: string;
}

interface ProjectionRaysState {
  OD: { unaided: PrQuadrants; aided: PrQuadrants };
  OS: { unaided: PrQuadrants; aided: PrQuadrants };
}

interface VaProjectionRaysSectionProps {
  distanceVision: { OD: VaEye; OS: VaEye };
  projectionRays: ProjectionRaysState;
  canEdit: boolean;
  onPrChange: (next: ProjectionRaysState) => void;
}

function needsPr(va: string) {
  return LOW_VA.includes(va);
}

export function VaProjectionRaysSection({
  distanceVision,
  projectionRays,
  canEdit,
  onPrChange,
}: VaProjectionRaysSectionProps) {
  const show =
    needsPr(distanceVision.OD.unaided) ||
    needsPr(distanceVision.OD.aided) ||
    needsPr(distanceVision.OS.unaided) ||
    needsPr(distanceVision.OS.aided);

  if (!show) return null;

  const toggle = (
    eye: 'OD' | 'OS',
    mode: 'unaided' | 'aided',
    quadrant: keyof PrQuadrants,
  ) => {
    onPrChange({
      ...projectionRays,
      [eye]: {
        ...projectionRays[eye],
        [mode]: {
          ...projectionRays[eye][mode],
          [quadrant]: !projectionRays[eye][mode][quadrant],
        },
      },
    });
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <p className="text-xs font-semibold text-gray-700 mb-2">
        Projection of Rays (when VA is HM or PL)
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {needsPr(distanceVision.OD.unaided) && (
          <ProjectionRaysQuadrant
            title="OD Unaided"
            quadrants={projectionRays.OD.unaided}
            canEdit={canEdit}
            onToggle={(q) => toggle('OD', 'unaided', q)}
          />
        )}
        {needsPr(distanceVision.OD.aided) && (
          <ProjectionRaysQuadrant
            title="OD Aided"
            quadrants={projectionRays.OD.aided}
            canEdit={canEdit}
            onToggle={(q) => toggle('OD', 'aided', q)}
          />
        )}
        {needsPr(distanceVision.OS.unaided) && (
          <ProjectionRaysQuadrant
            title="OS Unaided"
            quadrants={projectionRays.OS.unaided}
            canEdit={canEdit}
            variant="emerald"
            onToggle={(q) => toggle('OS', 'unaided', q)}
          />
        )}
        {needsPr(distanceVision.OS.aided) && (
          <ProjectionRaysQuadrant
            title="OS Aided"
            quadrants={projectionRays.OS.aided}
            canEdit={canEdit}
            variant="emerald"
            onToggle={(q) => toggle('OS', 'aided', q)}
          />
        )}
      </div>
      <p className="text-[10px] text-gray-500 mt-2 text-center">
        Green = accurate projection in that quadrant
      </p>
    </div>
  );
}
