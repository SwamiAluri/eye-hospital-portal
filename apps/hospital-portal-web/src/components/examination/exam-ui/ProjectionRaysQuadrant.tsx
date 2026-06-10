'use client';

import { Eye } from 'lucide-react';

export interface PrQuadrants {
  superior: boolean;
  inferior: boolean;
  nasal: boolean;
  temporal: boolean;
}

interface ProjectionRaysQuadrantProps {
  title: string;
  quadrants: PrQuadrants;
  canEdit: boolean;
  variant?: 'blue' | 'emerald';
  onToggle: (quadrant: keyof PrQuadrants) => void;
}

export function ProjectionRaysQuadrant({
  title,
  quadrants,
  canEdit,
  variant = 'blue',
  onToggle,
}: ProjectionRaysQuadrantProps) {
  const ring = variant === 'emerald' ? 'bg-emerald-100 border-emerald-300' : 'bg-blue-100 border-blue-300';
  const icon = variant === 'emerald' ? 'text-emerald-600' : 'text-blue-600';
  const wrap = variant === 'emerald' ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200';

  const btn = (q: keyof PrQuadrants, label: string, pos: string) => (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => onToggle(q)}
      className={`absolute ${pos} w-9 h-9 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
        quadrants[q] ? 'bg-green-500 text-white shadow' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className={`p-3 rounded-lg border ${wrap}`}>
      <p className="text-xs font-medium text-gray-700 mb-2 text-center">{title}</p>
      <div className="relative w-28 h-28 mx-auto">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${ring}`}>
            <Eye className={`w-5 h-5 ${icon}`} />
          </div>
        </div>
        {btn('superior', 'S', 'top-0 left-1/2 -translate-x-1/2')}
        {btn('inferior', 'I', 'bottom-0 left-1/2 -translate-x-1/2')}
        {btn('nasal', 'N', variant === 'emerald' ? 'right-0 top-1/2 -translate-y-1/2' : 'left-0 top-1/2 -translate-y-1/2')}
        {btn('temporal', 'T', variant === 'emerald' ? 'left-0 top-1/2 -translate-y-1/2' : 'right-0 top-1/2 -translate-y-1/2')}
      </div>
    </div>
  );
}
