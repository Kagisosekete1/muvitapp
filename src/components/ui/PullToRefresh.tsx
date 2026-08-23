import React from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isRefreshing,
  threshold = 80,
}) => {
  const progress = Math.min(pullDistance / threshold, 1);
  const shouldShow = pullDistance > 10 || isRefreshing;

  if (!shouldShow) return null;

  return (
    <div 
      className="absolute top-0 left-0 right-0 flex justify-center z-10 pointer-events-none"
      style={{ 
        transform: `translateY(${Math.min(pullDistance, threshold * 1.2)}px)`,
        opacity: progress 
      }}
    >
      <div className="bg-primary/10 backdrop-blur-sm rounded-full p-2 -mt-10">
        <RefreshCw 
          className={`w-5 h-5 text-primary transition-transform ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{ 
            transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)` 
          }}
        />
      </div>
    </div>
  );
};
