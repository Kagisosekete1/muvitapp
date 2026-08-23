import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useDebug } from '@/contexts/DebugContext';

interface VideoDebugOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  reelId: string;
  isActive: boolean;
}

const READY_STATE_LABELS: Record<number, string> = {
  0: 'HAVE_NOTHING',
  1: 'HAVE_METADATA',
  2: 'HAVE_CURRENT_DATA',
  3: 'HAVE_FUTURE_DATA',
  4: 'HAVE_ENOUGH_DATA',
};

const NETWORK_STATE_LABELS: Record<number, string> = {
  0: 'EMPTY',
  1: 'IDLE',
  2: 'LOADING',
  3: 'NO_SOURCE',
};

const VideoDebugOverlay: React.FC<VideoDebugOverlayProps> = ({
  videoRef,
  reelId,
  isActive,
}) => {
  const { showVideoDebug } = useDebug();
  const [stats, setStats] = useState({
    readyState: 0,
    networkState: 0,
    buffered: '',
    currentTime: 0,
    duration: 0,
    paused: true,
    seeking: false,
    ended: false,
    error: null as string | null,
  });

  const updateStats = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Get buffered ranges
    let bufferedRanges = '';
    if (video.buffered.length > 0) {
      const ranges: string[] = [];
      for (let i = 0; i < video.buffered.length; i++) {
        ranges.push(`${video.buffered.start(i).toFixed(1)}-${video.buffered.end(i).toFixed(1)}s`);
      }
      bufferedRanges = ranges.join(', ');
    } else {
      bufferedRanges = 'none';
    }

    setStats({
      readyState: video.readyState,
      networkState: video.networkState,
      buffered: bufferedRanges,
      currentTime: video.currentTime,
      duration: video.duration || 0,
      paused: video.paused,
      seeking: video.seeking,
      ended: video.ended,
      error: video.error ? `${video.error.code}: ${video.error.message}` : null,
    });
  }, [videoRef]);

  useEffect(() => {
    if (!isActive || !showVideoDebug) return;

    // Update stats every 250ms when visible and active
    const interval = setInterval(updateStats, 250);
    updateStats(); // Initial update

    return () => clearInterval(interval);
  }, [isActive, showVideoDebug, updateStats]);

  // Only show for active reel when debug is enabled
  if (!showVideoDebug || !isActive) {
    return null;
  }

  const getReadyStateColor = (state: number) => {
    if (state >= 4) return 'text-green-400';
    if (state >= 3) return 'text-yellow-400';
    if (state >= 1) return 'text-orange-400';
    return 'text-red-400';
  };

  const getNetworkStateColor = (state: number) => {
    if (state === 1) return 'text-green-400'; // IDLE = good
    if (state === 2) return 'text-yellow-400'; // LOADING
    return 'text-red-400';
  };

  return (
    <div className="absolute top-20 right-2 z-[60] bg-black/80 backdrop-blur-sm rounded-lg p-3 text-xs font-mono text-white/90 min-w-[200px] max-w-[280px]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-white flex items-center gap-1.5">
          🐛 Video Debug
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-white/60">Reel ID:</span>
          <span className="text-white/80 truncate max-w-[120px]">{reelId.slice(0, 8)}...</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">readyState:</span>
          <span className={getReadyStateColor(stats.readyState)}>
            {stats.readyState} ({READY_STATE_LABELS[stats.readyState]})
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">networkState:</span>
          <span className={getNetworkStateColor(stats.networkState)}>
            {stats.networkState} ({NETWORK_STATE_LABELS[stats.networkState]})
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Buffered:</span>
          <span className="text-white/80 text-right max-w-[140px] break-words">{stats.buffered}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Time:</span>
          <span className="text-white/80">
            {stats.currentTime.toFixed(1)}s / {stats.duration.toFixed(1)}s
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">State:</span>
          <span className="text-white/80">
            {stats.paused ? '⏸ Paused' : '▶ Playing'}
            {stats.seeking && ' 🔍'}
            {stats.ended && ' ✓'}
          </span>
        </div>

        {stats.error && (
          <div className="flex justify-between">
            <span className="text-red-400">Error:</span>
            <span className="text-red-300 text-right max-w-[140px]">{stats.error}</span>
          </div>
        )}

        {/* Buffer percentage bar */}
        <div className="mt-2">
          <div className="text-white/60 mb-1">Buffer Progress:</div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-200"
              style={{
                width: stats.duration > 0
                  ? `${Math.min((stats.currentTime / stats.duration) * 100, 100)}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoDebugOverlay;
