import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type VideoQuality = 'auto' | 'low' | 'high';
export type NetworkSpeed = 'fast' | 'medium' | 'slow' | 'offline';

interface NetworkInfo {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  downlink?: number;
  saveData?: boolean;
  rtt?: number;
}

interface VideoQualityContextType {
  quality: VideoQuality;
  setQuality: (q: VideoQuality) => void;
  getPreloadStrategy: () => 'auto' | 'metadata' | 'none';
  isSlowConnection: boolean;
  networkSpeed: NetworkSpeed;
  getOptimalPrefetchCount: () => number;
  shouldReduceQuality: () => boolean;
  connectionDownlink: number | null;
  lastNetworkCheck: number;
}

const VideoQualityContext = createContext<VideoQualityContextType | undefined>(undefined);

const STORAGE_KEY = 'muvit_video_quality';
const NETWORK_CHECK_INTERVAL = 5000; // Re-evaluate network every 5s

export const VideoQualityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [quality, setQualityState] = useState<VideoQuality>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'auto' || saved === 'low' || saved === 'high') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'auto';
  });

  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [networkSpeed, setNetworkSpeed] = useState<NetworkSpeed>('fast');
  const [connectionDownlink, setConnectionDownlink] = useState<number | null>(null);
  const [lastNetworkCheck, setLastNetworkCheck] = useState(Date.now());

  // Classify network speed based on connection info
  const classifyNetworkSpeed = useCallback((conn: NetworkInfo | undefined): NetworkSpeed => {
    if (!conn) return 'fast'; // Assume fast if no info available

    // Check if user has data saver enabled
    if (conn.saveData === true) return 'slow';

    // Check effective type
    if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return 'slow';
    if (conn.effectiveType === '3g') return 'medium';

    // Check downlink speed (Mbps)
    if (conn.downlink !== undefined) {
      if (conn.downlink < 0.5) return 'slow';
      if (conn.downlink < 2) return 'medium';
      return 'fast';
    }

    // Check RTT (round trip time in ms)
    if (conn.rtt !== undefined) {
      if (conn.rtt > 500) return 'slow';
      if (conn.rtt > 200) return 'medium';
      return 'fast';
    }

    return 'fast';
  }, []);

  // Detect network quality for auto mode
  useEffect(() => {
    const updateNetworkInfo = () => {
      const nav = navigator as any;
      const conn: NetworkInfo | undefined = nav.connection || nav.mozConnection || nav.webkitConnection;
      
      // Check for offline status
      if (!navigator.onLine) {
        setNetworkSpeed('offline');
        setIsSlowConnection(true);
        setConnectionDownlink(0);
        setLastNetworkCheck(Date.now());
        return;
      }

      const speed = classifyNetworkSpeed(conn);
      setNetworkSpeed(speed);
      setIsSlowConnection(speed === 'slow' || speed === 'offline');
      setConnectionDownlink(conn?.downlink ?? null);
      setLastNetworkCheck(Date.now());

      console.log(`[VideoQuality] Network: ${speed}, Downlink: ${conn?.downlink ?? 'N/A'}Mbps, EffectiveType: ${conn?.effectiveType ?? 'N/A'}`);
    };

    updateNetworkInfo();

    // Listen for network changes
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn) {
      conn.addEventListener?.('change', updateNetworkInfo);
    }

    // Also listen for online/offline events
    window.addEventListener('online', updateNetworkInfo);
    window.addEventListener('offline', updateNetworkInfo);

    // Periodic check for network changes
    const intervalId = setInterval(updateNetworkInfo, NETWORK_CHECK_INTERVAL);

    return () => {
      if (conn) {
        conn.removeEventListener?.('change', updateNetworkInfo);
      }
      window.removeEventListener('online', updateNetworkInfo);
      window.removeEventListener('offline', updateNetworkInfo);
      clearInterval(intervalId);
    };
  }, [classifyNetworkSpeed]);

  const setQuality = (q: VideoQuality) => {
    setQualityState(q);
    try {
      localStorage.setItem(STORAGE_KEY, q);
    } catch {
      // ignore
    }
  };

  // Determine preload strategy based on quality setting and network
  const getPreloadStrategy = useCallback((): 'auto' | 'metadata' | 'none' => {
    if (quality === 'high') {
      return 'auto'; // Full preload
    }
    if (quality === 'low') {
      return 'metadata'; // Only metadata, no buffering
    }
    // Auto mode - adapt to network
    switch (networkSpeed) {
      case 'offline':
        return 'none';
      case 'slow':
        return 'metadata';
      case 'medium':
        return 'metadata';
      case 'fast':
      default:
        return 'auto';
    }
  }, [quality, networkSpeed]);

  // Determine optimal number of reels to prefetch based on network
  const getOptimalPrefetchCount = useCallback((): number => {
    if (quality === 'high') return 2;
    if (quality === 'low') return 0;

    // Auto mode
    switch (networkSpeed) {
      case 'offline':
        return 0;
      case 'slow':
        return 0;
      case 'medium':
        return 1;
      case 'fast':
      default:
        return 2;
    }
  }, [quality, networkSpeed]);

  // Should we reduce video quality/resolution?
  const shouldReduceQuality = useCallback((): boolean => {
    if (quality === 'high') return false;
    if (quality === 'low') return true;
    return networkSpeed === 'slow' || networkSpeed === 'medium';
  }, [quality, networkSpeed]);

  return (
    <VideoQualityContext.Provider
      value={{
        quality,
        setQuality,
        getPreloadStrategy,
        isSlowConnection,
        networkSpeed,
        getOptimalPrefetchCount,
        shouldReduceQuality,
        connectionDownlink,
        lastNetworkCheck,
      }}
    >
      {children}
    </VideoQualityContext.Provider>
  );
};

export const useVideoQuality = () => {
  const context = useContext(VideoQualityContext);
  if (!context) {
    throw new Error('useVideoQuality must be used within VideoQualityProvider');
  }
  return context;
};
