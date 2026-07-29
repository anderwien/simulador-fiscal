import { useState } from 'react';
import { computeTreemap } from '../lib/treemap';

const TREEMAP_W = 1000;
const TREEMAP_H = 380;
const LABEL_AREA_THRESHOLD = 0.035;
const COMPACT_LABEL_AREA_THRESHOLD = 0.075;
const PCT_AREA_THRESHOLD = 0.008;

export interface BreakdownSegment {
  id: string;
  label: string;
  amount: number;
  color: string;
  porc: number;
}

interface BreakdownTreemapProps {
  segments: BreakdownSegment[];
  formatCurrency: (n: number) => string;
  emptyMessage: string;
}

export default function BreakdownTreemap({ segments, formatCurrency, emptyMessage }: BreakdownTreemapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const visibleSegments = segments.filter((s) => s.amount > 0);

  if (visibleSegments.length === 0) {
    return (
      <div className="text-center p-6 text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
        {emptyMessage}
      </div>
    );
  }

  const rects = computeTreemap(
    visibleSegments.map((s) => ({ id: s.id, value: s.amount })),
    TREEMAP_W,
    TREEMAP_H
  );

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="relative flex-1 w-full h-72 md:h-80 rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
        {rects.map((rect) => {
          const seg = visibleSegments.find((s) => s.id === rect.id);
          if (!seg) return null;
          const isHovered = hoveredId === seg.id;
          const isDimmed = hoveredId !== null && !isHovered;
          const areaFraction = (rect.w / TREEMAP_W) * (rect.h / TREEMAP_H);
          const showLabel = areaFraction > LABEL_AREA_THRESHOLD;
          const showPctOnly = !showLabel && areaFraction > PCT_AREA_THRESHOLD;
          const compact = areaFraction <= COMPACT_LABEL_AREA_THRESHOLD;

          return (
            <div
              key={seg.id}
              onMouseEnter={() => setHoveredId(seg.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setHoveredId(seg.id)}
              className={`absolute overflow-hidden border border-white/30 cursor-pointer transition-all duration-200 ${seg.color} ${isHovered ? 'z-10 brightness-110 shadow-lg' : ''} ${isDimmed ? 'opacity-50' : 'opacity-100'}`}
              style={{
                left: `${(rect.x / TREEMAP_W) * 100}%`,
                top: `${(rect.y / TREEMAP_H) * 100}%`,
                width: `${(rect.w / TREEMAP_W) * 100}%`,
                height: `${(rect.h / TREEMAP_H) * 100}%`,
              }}
            >
              {showLabel && (
                <div className="absolute top-0 left-0 right-0 flex flex-col items-start p-1.5">
                  <span className={`${compact ? 'text-[9px]' : 'text-xs'} font-bold text-white/90 leading-tight break-words w-full`}>{seg.label}</span>
                  <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} text-white/80 leading-tight break-words w-full`}>{formatCurrency(seg.amount)}</span>
                </div>
              )}
              {(showLabel || showPctOnly) && (
                <div className="absolute inset-0 flex items-center justify-center p-1 pointer-events-none">
                  <span className={`${showPctOnly ? 'text-sm' : compact ? 'text-base' : 'text-xl'} font-extrabold text-white leading-none drop-shadow-sm`}>
                    {seg.porc.toFixed(1)}%
                  </span>
                </div>
              )}
              <div
                className={`pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 origin-bottom bg-slate-800 text-white text-xs py-1 px-2 rounded z-20 whitespace-nowrap transition-transform ${isHovered ? 'scale-100' : 'scale-0'}`}
              >
                {seg.label}: {formatCurrency(seg.amount)} (<span className="font-extrabold">{seg.porc.toFixed(1)}%</span>)
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-row md:flex-col flex-wrap md:flex-nowrap gap-1.5 md:w-40 shrink-0 md:max-h-80 md:overflow-y-auto">
        {visibleSegments.map((seg) => {
          const isHovered = hoveredId === seg.id;
          return (
            <button
              key={seg.id}
              type="button"
              onMouseEnter={() => setHoveredId(seg.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setHoveredId(seg.id)}
              className={`flex items-start gap-1.5 text-left p-1 rounded-lg transition-colors ${isHovered ? 'bg-slate-100' : ''}`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${seg.color} shrink-0 mt-0.5`}></div>
              <div className="min-w-0">
                <p className="font-medium text-slate-700 text-[11px] leading-snug break-words">{seg.label}</p>
                <p className="text-[10px] text-slate-500">
                  {formatCurrency(seg.amount)} · <span className="font-extrabold text-xs text-slate-800">{seg.porc.toFixed(1)}%</span>
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
