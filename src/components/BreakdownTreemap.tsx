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
    <div>
      <div className="relative w-full h-72 md:h-80 rounded-xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
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
              className={`absolute flex flex-col items-start justify-end overflow-hidden p-1.5 border border-white/30 cursor-pointer transition-all duration-200 ${seg.color} ${isHovered ? 'z-10 brightness-110 shadow-lg' : ''} ${isDimmed ? 'opacity-50' : 'opacity-100'}`}
              style={{
                left: `${(rect.x / TREEMAP_W) * 100}%`,
                top: `${(rect.y / TREEMAP_H) * 100}%`,
                width: `${(rect.w / TREEMAP_W) * 100}%`,
                height: `${(rect.h / TREEMAP_H) * 100}%`,
              }}
            >
              {showLabel && (
                <>
                  <span className={`${compact ? 'text-[9px]' : 'text-xs'} font-bold text-white/90 leading-tight break-words w-full`}>{seg.label}</span>
                  <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} text-white/80 leading-tight break-words w-full`}>{formatCurrency(seg.amount)}</span>
                  <span className={`${compact ? 'text-xs' : 'text-base'} font-extrabold text-white leading-tight break-words w-full`}>{seg.porc.toFixed(1)}%</span>
                </>
              )}
              {showPctOnly && (
                <span className="text-sm font-extrabold text-white w-full text-center leading-tight">{seg.porc.toFixed(0)}%</span>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6">
        {visibleSegments.map((seg) => {
          const isHovered = hoveredId === seg.id;
          return (
            <button
              key={seg.id}
              type="button"
              onMouseEnter={() => setHoveredId(seg.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => setHoveredId(seg.id)}
              className={`flex items-center gap-2 text-sm text-left p-1.5 rounded-lg transition-colors ${isHovered ? 'bg-slate-100' : ''}`}
            >
              <div className={`w-3 h-3 rounded-full ${seg.color} shrink-0 mt-0.5`}></div>
              <div className="min-w-0">
                <p className="font-medium text-slate-700 text-xs leading-snug break-words">{seg.label}</p>
                <p className="text-xs text-slate-500">
                  {formatCurrency(seg.amount)} · <span className="font-extrabold text-sm text-slate-800">{seg.porc.toFixed(1)}%</span>
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
