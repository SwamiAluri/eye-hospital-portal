'use client';

import { useMemo } from 'react';
import { formatTrendRowSummary } from '@/lib/optometry/iop-section-history';

interface IOPTrendChartProps {
  history: any[];
  targetIOPOD?: number;
  targetIOPOS?: number;
  /** Table-only summary for sidebar / mobile strip */
  compact?: boolean;
}

export default function IOPTrendChart({
  history,
  targetIOPOD,
  targetIOPOS,
  compact = false,
}: IOPTrendChartProps) {
  const chartData = useMemo(() => {
    return [...history]
      .sort((a, b) => new Date(a.examinationDate).getTime() - new Date(b.examinationDate).getTime())
      .map((record) => ({
        date: new Date(record.examinationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: new Date(record.examinationDate),
        iopOD: record.OD?.measuredIOP ?? record.OD?.predilation,
        iopOS: record.OS?.measuredIOP ?? record.OS?.predilation,
        method: record.method,
        raw: record,
      }));
  }, [history]);

  const recentRows = useMemo(
    () =>
      [...chartData]
        .reverse()
        .slice(0, 5)
        .map((row) => formatTrendRowSummary(row.raw as Record<string, unknown>)),
    [chartData],
  );

  const scale = useMemo(() => {
    if (chartData.length === 0) return { minIOP: 0, maxIOP: 21 };
    const allIOPs = chartData.flatMap((d) => [d.iopOD, d.iopOS]).filter((v) => v != null) as number[];
    return {
      minIOP: Math.floor(Math.min(...allIOPs, targetIOPOD || 21, targetIOPOS || 21) - 2),
      maxIOP: Math.ceil(Math.max(...allIOPs, 21) + 2),
    };
  }, [chartData, targetIOPOD, targetIOPOS]);

  if (chartData.length === 0) {
    return (
      <div className={`flex items-center justify-center text-gray-500 ${compact ? 'h-16 text-[10px]' : 'h-64'}`}>
        No IOP history available
      </div>
    );
  }

  if (compact) {
    const latest = chartData[chartData.length - 1];
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] tabular-nums">
          <span className="text-blue-700 font-medium">OD {latest.iopOD ?? '—'}</span>
          <span className="text-emerald-700 font-medium">OS {latest.iopOS ?? '—'}</span>
          {(targetIOPOD != null || targetIOPOS != null) && (
            <span className="text-purple-700">
              Target ≤{targetIOPOD ?? '—'}/{targetIOPOS ?? '—'}
            </span>
          )}
        </div>
        <ul className="space-y-1">
          {recentRows.map((row, i) => (
            <li key={`${row.date}-${i}`} className="flex justify-between gap-2 text-[10px] text-slate-600">
              <span>{row.date}</span>
              <span className="tabular-nums text-slate-800">
                {row.od ?? '—'}/{row.os ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const { minIOP, maxIOP } = scale;
  const iopRange = maxIOP - minIOP || 1;
  const chartHeight = 300;
  const chartWidth = 800;

  const getYPosition = (iop: number) => {
    const percentage = (iop - minIOP) / iopRange;
    return chartHeight - percentage * chartHeight;
  };

  const generatePath = (dataKey: 'iopOD' | 'iopOS') => {
    if (chartData.length <= 1) return '';
    return chartData
      .map((point, index) => {
        const x = (index / (chartData.length - 1)) * chartWidth;
        const y = getYPosition(point[dataKey]);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[800px]">
        <div className="flex items-center justify-center space-x-6 mb-4">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
            <span className="text-sm font-medium text-gray-700">OD (Right Eye)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
            <span className="text-sm font-medium text-gray-700">OS (Left Eye)</span>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-0.5 bg-red-400 border-t-2 border-dashed border-red-400 mr-2"></div>
            <span className="text-sm font-medium text-gray-700">Normal Limit (21 mmHg)</span>
          </div>
          {(targetIOPOD || targetIOPOS) && (
            <div className="flex items-center">
              <div className="w-8 h-0.5 bg-purple-400 border-t-2 border-dashed border-purple-400 mr-2"></div>
              <span className="text-sm font-medium text-gray-700">Target IOP</span>
            </div>
          )}
        </div>

        <svg
          viewBox={`0 0 ${chartWidth + 100} ${chartHeight + 60}`}
          className="w-full"
          style={{ maxHeight: '400px' }}
        >
          {Array.from({ length: 6 }).map((_, i) => {
            const iop = minIOP + (iopRange / 5) * i;
            const y = getYPosition(iop);
            return (
              <g key={i}>
                <line x1="50" y1={y + 20} x2={chartWidth + 50} y2={y + 20} stroke="#e5e7eb" strokeWidth="1" />
                <text x="30" y={y + 25} fontSize="12" fill="#6b7280" textAnchor="end">
                  {Math.round(iop)}
                </text>
              </g>
            );
          })}

          <line
            x1="50"
            y1={getYPosition(21) + 20}
            x2={chartWidth + 50}
            y2={getYPosition(21) + 20}
            stroke="#f87171"
            strokeWidth="2"
            strokeDasharray="5,5"
          />

          {targetIOPOD && (
            <line
              x1="50"
              y1={getYPosition(targetIOPOD) + 20}
              x2={chartWidth / 2 + 50}
              y2={getYPosition(targetIOPOD) + 20}
              stroke="#a78bfa"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          )}
          {targetIOPOS && (
            <line
              x1={chartWidth / 2 + 50}
              y1={getYPosition(targetIOPOS) + 20}
              x2={chartWidth + 50}
              y2={getYPosition(targetIOPOS) + 20}
              stroke="#a78bfa"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          )}

          {chartData.length > 1 && (
            <>
              <path
                d={generatePath('iopOD')
                  .split(' ')
                  .map((segment, i) => {
                    if (i === 0) return segment;
                    const [cmd, x, y] = segment.split(' ');
                    return `${cmd} ${parseFloat(x) + 50} ${parseFloat(y) + 20}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
              />
              <path
                d={generatePath('iopOS')
                  .split(' ')
                  .map((segment, i) => {
                    if (i === 0) return segment;
                    const [cmd, x, y] = segment.split(' ');
                    return `${cmd} ${parseFloat(x) + 50} ${parseFloat(y) + 20}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
              />
            </>
          )}

          {chartData.map((point, index) => {
            const x =
              chartData.length <= 1 ? chartWidth / 2 + 50 : (index / (chartData.length - 1)) * chartWidth + 50;
            const yOd = getYPosition(point.iopOD) + 20;
            const yOs = getYPosition(point.iopOS) + 20;
            return (
              <g key={`points-${index}`}>
                <circle cx={x} cy={yOd} r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />
                <text x={x} y={yOd - 10} fontSize="11" fill="#1e40af" textAnchor="middle" fontWeight="600">
                  {point.iopOD}
                </text>
                <circle cx={x} cy={yOs} r="5" fill="#10b981" stroke="white" strokeWidth="2" />
                <text x={x} y={yOs + 18} fontSize="11" fill="#047857" textAnchor="middle" fontWeight="600">
                  {point.iopOS}
                </text>
              </g>
            );
          })}

          {chartData.map((point, index) => {
            const x =
              chartData.length <= 1 ? chartWidth / 2 + 50 : (index / (chartData.length - 1)) * chartWidth + 50;
            return (
              <text key={`label-${index}`} x={x} y={chartHeight + 35} fontSize="11" fill="#6b7280" textAnchor="middle">
                {point.date}
              </text>
            );
          })}

          <text
            x="10"
            y={chartHeight / 2}
            fontSize="12"
            fill="#374151"
            textAnchor="middle"
            transform={`rotate(-90 10 ${chartHeight / 2})`}
            fontWeight="600"
          >
            IOP (mmHg)
          </text>
        </svg>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">OD (Right Eye) Statistics</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Latest IOP:</span>
                <span className="font-medium text-blue-900">{chartData[chartData.length - 1].iopOD} mmHg</span>
              </div>
              {targetIOPOD && (
                <div className="flex justify-between pt-1 border-t border-blue-200">
                  <span className="text-gray-700">Target IOP:</span>
                  <span className="font-medium text-purple-900">{targetIOPOD} mmHg</span>
                </div>
              )}
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">OS (Left Eye) Statistics</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Latest IOP:</span>
                <span className="font-medium text-green-900">{chartData[chartData.length - 1].iopOS} mmHg</span>
              </div>
              {targetIOPOS && (
                <div className="flex justify-between pt-1 border-t border-green-200">
                  <span className="text-gray-700">Target IOP:</span>
                  <span className="font-medium text-purple-900">{targetIOPOS} mmHg</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
