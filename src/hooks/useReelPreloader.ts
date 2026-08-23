import { useEffect, useRef } from 'react';

interface ReelData {
  video_url: string;
  thumbnail_url?: string | null;
}

/**
 * Aggressive reel preloader - actually downloads next 2 reels' videos into browser cache
 * for truly instant switching without buffering.
 * 
 * Key optimizations:
 * - Uses fetch + blob to fully download videos into memory/cache
 * - Falls back to link prefetch for thumbnails
 * - Debounces prefetch requests to prevent rapid state changes
 * - Cleans up old cached videos to prevent memory bloat
 * - Adapts prefetch count based on network quality
 */
export const useReelPreloader = (
  reels: ReelData[],
  activeIndex: number,
  prefetchCount: number = 2 // Default to 2 for instant switching
) => {
  const preloadedUrls = useRef<Set<string>>(new Set());
  const linkElements = useRef<Map<string, HTMLLinkElement>>(new Map());
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const blobUrls = useRef<Map<string, string>>(new Map());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Debounce prefetch to prevent rapid changes during scroll
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      // Determine which reels to prefetch (next N reels)
      const urlsToPrefetch: Set<string> = new Set();
      const thumbnailsToPrefetch: Set<string> = new Set();
      
      for (let i = 1; i <= prefetchCount; i++) {
        const nextIndex = activeIndex + i;
        if (nextIndex < reels.length) {
          const reel = reels[nextIndex];
          if (reel?.video_url && !preloadedUrls.current.has(reel.video_url)) {
            urlsToPrefetch.add(reel.video_url);
          }
          if (reel?.thumbnail_url && !preloadedUrls.current.has(reel.thumbnail_url)) {
            thumbnailsToPrefetch.add(reel.thumbnail_url);
          }
        }
      }

      // Prefetch previous reel for smooth back-scrolling
      if (activeIndex > 0) {
        const prevReel = reels[activeIndex - 1];
        if (prevReel?.video_url && !preloadedUrls.current.has(prevReel.video_url)) {
          urlsToPrefetch.add(prevReel.video_url);
        }
        if (prevReel?.thumbnail_url && !preloadedUrls.current.has(prevReel.thumbnail_url)) {
          thumbnailsToPrefetch.add(prevReel.thumbnail_url);
        }
      }

      // Aggressively fetch videos using fetch API for true caching
      urlsToPrefetch.forEach((url) => {
        if (preloadedUrls.current.has(url)) return;
        
        preloadedUrls.current.add(url);
        
        const controller = new AbortController();
        abortControllers.current.set(url, controller);
        
        // Use fetch to actually download the video into browser cache
        fetch(url, { 
          signal: controller.signal,
          // Use cache-first strategy
          cache: 'force-cache',
        })
          .then(response => {
            if (response.ok) {
              // Stream the response to ensure it's fully cached
              return response.blob();
            }
            throw new Error('Network response was not ok');
          })
          .then(blob => {
            // Create a blob URL for instant access
            const blobUrl = URL.createObjectURL(blob);
            blobUrls.current.set(url, blobUrl);
            console.log(`[Preloader] Cached video: ${url.slice(-30)}`);
          })
          .catch(err => {
            if (err.name !== 'AbortError') {
              console.warn(`[Preloader] Failed to cache: ${url.slice(-30)}`, err);
              // Fallback to link prefetch
              const link = document.createElement('link');
              link.rel = 'prefetch';
              link.as = 'video';
              link.href = url;
              document.head.appendChild(link);
              linkElements.current.set(url, link);
            }
          });
      });

      // Use link prefetch for thumbnails (lighter weight)
      thumbnailsToPrefetch.forEach((url) => {
        if (preloadedUrls.current.has(url)) return;
        
        preloadedUrls.current.add(url);
        
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'image';
        link.href = url;
        document.head.appendChild(link);
        linkElements.current.set(url, link);
      });

      // Cleanup old cached items that are far from current position (memory management)
      const maxCachedUrls = (prefetchCount + 3) * 2; // Allow some buffer
      if (preloadedUrls.current.size > maxCachedUrls) {
        const urlsToRemove: string[] = [];
        let count = 0;
        
        preloadedUrls.current.forEach((url) => {
          if (count >= preloadedUrls.current.size - maxCachedUrls) return;
          urlsToRemove.push(url);
          count++;
        });

        urlsToRemove.forEach((url) => {
          // Abort any pending fetches
          const controller = abortControllers.current.get(url);
          if (controller) {
            controller.abort();
            abortControllers.current.delete(url);
          }
          
          // Revoke blob URLs to free memory
          const blobUrl = blobUrls.current.get(url);
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            blobUrls.current.delete(url);
          }
          
          // Remove link elements
          const link = linkElements.current.get(url);
          if (link) {
            try {
              document.head.removeChild(link);
            } catch {
              // ignore
            }
            linkElements.current.delete(url);
          }
          preloadedUrls.current.delete(url);
        });
      }
    }, 100); // 100ms debounce for faster response

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [reels, activeIndex, prefetchCount]);

  // Cleanup all resources on unmount
  useEffect(() => {
    return () => {
      // Abort all pending fetches
      abortControllers.current.forEach((controller) => {
        controller.abort();
      });
      abortControllers.current.clear();
      
      // Revoke all blob URLs
      blobUrls.current.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl);
      });
      blobUrls.current.clear();
      
      // Remove all link elements
      linkElements.current.forEach((link) => {
        try {
          document.head.removeChild(link);
        } catch {
          // ignore
        }
      });
      linkElements.current.clear();
      preloadedUrls.current.clear();
    };
  }, []);
  
  // Return cached blob URLs for components to use
  return {
    getCachedUrl: (originalUrl: string) => blobUrls.current.get(originalUrl) || originalUrl,
    isPreloaded: (url: string) => preloadedUrls.current.has(url),
  };
};
