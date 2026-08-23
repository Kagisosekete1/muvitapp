import { useEffect, useRef } from 'react';

interface ReelData {
  video_url: string;
  thumbnail_url?: string | null;
}

/**
 * Lightweight preloader that warms the FIRST reel immediately on mount.
 * Uses link prefetch instead of creating video elements to reduce DOM pressure
 * and prevent playback jamming issues.
 */
export const useFirstReelPreloader = (reels: ReelData[]) => {
  const hasPreloaded = useRef(false);
  const linkRef = useRef<HTMLLinkElement | null>(null);

  useEffect(() => {
    if (hasPreloaded.current || reels.length === 0) return;
    const firstReel = reels[0];
    if (!firstReel?.video_url) return;
    hasPreloaded.current = true;

    // Defer to idle so initial paint isn't blocked by network warm-up
    const run = () => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'video';
      link.href = firstReel.video_url;
      // hint browser this is high priority for the LCP candidate
      (link as any).fetchPriority = 'high';
      document.head.appendChild(link);
      linkRef.current = link;

      if (firstReel.thumbnail_url) {
        const img = new Image();
        (img as any).fetchPriority = 'high';
        img.src = firstReel.thumbnail_url;
      }
    };

    const ric: any = (window as any).requestIdleCallback;
    const handle = ric ? ric(run, { timeout: 400 }) : window.setTimeout(run, 0);

    return () => {
      const cic: any = (window as any).cancelIdleCallback;
      if (ric && cic) cic(handle);
      else clearTimeout(handle as number);
      if (linkRef.current) {
        try { document.head.removeChild(linkRef.current); } catch {}
        linkRef.current = null;
      }
    };
  }, [reels]);
};

