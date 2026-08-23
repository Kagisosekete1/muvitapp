import React from 'react';

import { cn } from '@/lib/utils';

const ZOOM_OPTIONS = [
  { level: 0, label: '05' },
  { level: 1, label: '-1' },
  { level: 2, label: '-2' },
  { level: 3, label: '-3' },
  { level: 4, label: '-4' },
] as const;

interface LiveZoomControlProps {
  className?: string;
  onChange: (level: number) => void;
  zoomLevel: number;
}

const LiveZoomControl = ({ className, onChange, zoomLevel }: LiveZoomControlProps) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1.5 backdrop-blur-md',
        className,
      )}
    >
      <span className="text-[9px] font-medium text-white/70">🔍</span>
      {ZOOM_OPTIONS.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onChange(option.level)}
          aria-pressed={zoomLevel === option.level}
          title={`Set live camera to ${option.label}`}
          className={cn(
            'h-7 w-7 rounded-full text-[10px] font-bold transition-all',
            zoomLevel === option.level
              ? 'scale-110 bg-white text-black shadow-lg'
              : 'bg-white/15 text-white/80 hover:bg-white/25',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default LiveZoomControl;