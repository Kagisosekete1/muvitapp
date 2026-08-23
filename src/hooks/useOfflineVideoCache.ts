import { useState, useEffect, useCallback, useRef } from 'react';

const CACHE_NAME = 'muvit-video-cache-v1';
const MAX_CACHED_VIDEOS = 20; // Limit number of cached videos
const MAX_CACHE_SIZE_MB = 500; // 500MB limit

interface CachedVideoMeta {
  id: string;
  url: string;
  cachedAt: number;
  size: number;
}

/**
 * Hook for caching recently watched videos for offline playback
 */
export function useOfflineVideoCache() {
  const [cachedVideos, setCachedVideos] = useState<CachedVideoMeta[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheSize, setCacheSize] = useState(0);
  const cacheRef = useRef<Cache | null>(null);

  // Initialize cache
  useEffect(() => {
    const initCache = async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        cacheRef.current = cache;
        await loadCachedVideoList();
      } catch (err) {
        console.error('Failed to initialize video cache:', err);
      }
    };
    initCache();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cached video metadata from localStorage
  const loadCachedVideoList = useCallback(async () => {
    try {
      const stored = localStorage.getItem('muvit_cached_videos');
      if (stored) {
        const videos: CachedVideoMeta[] = JSON.parse(stored);
        setCachedVideos(videos);
        const totalSize = videos.reduce((acc, v) => acc + v.size, 0);
        setCacheSize(totalSize);
      }
    } catch (err) {
      console.error('Failed to load cached video list:', err);
    }
  }, []);

  // Save cached video metadata to localStorage
  const saveCachedVideoList = useCallback((videos: CachedVideoMeta[]) => {
    try {
      localStorage.setItem('muvit_cached_videos', JSON.stringify(videos));
      setCachedVideos(videos);
      const totalSize = videos.reduce((acc, v) => acc + v.size, 0);
      setCacheSize(totalSize);
    } catch (err) {
      console.error('Failed to save cached video list:', err);
    }
  }, []);

  // Clean up old cached videos if over limit
  const cleanupOldVideos = useCallback(async (currentVideos: CachedVideoMeta[]) => {
    const cache = cacheRef.current;
    if (!cache) return currentVideos;

    let videos = [...currentVideos];
    
    // Remove oldest videos if count exceeds limit
    while (videos.length > MAX_CACHED_VIDEOS) {
      const oldest = videos.reduce((a, b) => a.cachedAt < b.cachedAt ? a : b);
      try {
        await cache.delete(oldest.url);
        videos = videos.filter(v => v.id !== oldest.id);
      } catch {
        break;
      }
    }

    // Remove oldest videos if size exceeds limit
    let totalSize = videos.reduce((acc, v) => acc + v.size, 0);
    while (totalSize > MAX_CACHE_SIZE_MB * 1024 * 1024 && videos.length > 0) {
      const oldest = videos.reduce((a, b) => a.cachedAt < b.cachedAt ? a : b);
      try {
        await cache.delete(oldest.url);
        totalSize -= oldest.size;
        videos = videos.filter(v => v.id !== oldest.id);
      } catch {
        break;
      }
    }

    return videos;
  }, []);

  // Cache a video for offline playback
  const cacheVideo = useCallback(async (reelId: string, videoUrl: string): Promise<boolean> => {
    const cache = cacheRef.current;
    if (!cache || !navigator.onLine) return false;

    // Skip if already cached
    if (cachedVideos.some(v => v.id === reelId)) {
      return true;
    }

    try {
      // Fetch the video
      const response = await fetch(videoUrl, { mode: 'cors' });
      if (!response.ok) return false;

      // Get video size
      const blob = await response.blob();
      const size = blob.size;

      // Create a new response from the blob to cache
      const cacheResponse = new Response(blob, {
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
          'Content-Length': String(size),
        },
      });

      // Store in cache
      await cache.put(videoUrl, cacheResponse);

      // Update metadata
      const newMeta: CachedVideoMeta = {
        id: reelId,
        url: videoUrl,
        cachedAt: Date.now(),
        size,
      };

      let updatedVideos = [...cachedVideos, newMeta];
      updatedVideos = await cleanupOldVideos(updatedVideos);
      saveCachedVideoList(updatedVideos);

      console.log(`Cached video ${reelId}, size: ${(size / 1024 / 1024).toFixed(2)}MB`);
      return true;
    } catch (err) {
      console.error('Failed to cache video:', err);
      return false;
    }
  }, [cachedVideos, cleanupOldVideos, saveCachedVideoList]);

  // Get cached video URL (returns cached version if available when offline)
  const getCachedVideoUrl = useCallback(async (reelId: string, originalUrl: string): Promise<string> => {
    const cache = cacheRef.current;
    
    // If online, use original URL but cache in background
    if (navigator.onLine) {
      // Cache in background after a delay (when user is watching)
      return originalUrl;
    }

    // If offline, try to get from cache
    if (!cache) return originalUrl;

    try {
      const cachedResponse = await cache.match(originalUrl);
      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        return URL.createObjectURL(blob);
      }
    } catch (err) {
      console.error('Failed to retrieve cached video:', err);
    }

    return originalUrl;
  }, []);

  // Check if a video is cached
  const isVideoCached = useCallback((reelId: string): boolean => {
    return cachedVideos.some(v => v.id === reelId);
  }, [cachedVideos]);

  // Clear all cached videos
  const clearVideoCache = useCallback(async () => {
    try {
      await caches.delete(CACHE_NAME);
      localStorage.removeItem('muvit_cached_videos');
      setCachedVideos([]);
      setCacheSize(0);
      
      // Re-initialize cache
      const cache = await caches.open(CACHE_NAME);
      cacheRef.current = cache;
    } catch (err) {
      console.error('Failed to clear video cache:', err);
    }
  }, []);

  // Remove specific video from cache
  const removeCachedVideo = useCallback(async (reelId: string) => {
    const cache = cacheRef.current;
    if (!cache) return;

    const video = cachedVideos.find(v => v.id === reelId);
    if (!video) return;

    try {
      await cache.delete(video.url);
      const updatedVideos = cachedVideos.filter(v => v.id !== reelId);
      saveCachedVideoList(updatedVideos);
    } catch (err) {
      console.error('Failed to remove cached video:', err);
    }
  }, [cachedVideos, saveCachedVideoList]);

  return {
    cacheVideo,
    getCachedVideoUrl,
    isVideoCached,
    clearVideoCache,
    removeCachedVideo,
    cachedVideos,
    cacheSize,
    isOnline,
    maxCacheSize: MAX_CACHE_SIZE_MB * 1024 * 1024,
  };
}

export default useOfflineVideoCache;
