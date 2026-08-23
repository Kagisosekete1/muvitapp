import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';

interface WatchProgress {
  reelId: string;
  title: string;
  thumbnailUrl: string | null;
  videoUrl: string;
  progress: number; // 0-100 percentage
  currentTime: number; // actual seconds into the video
  duration: number; // total duration in seconds
  lastWatched: number; // timestamp
  userId: string;
  profile?: {
    id?: string;
    username: string;
    display_name?: string;
    avatar_url: string | null;
    verified?: boolean;
  };
}

const STORAGE_KEY = 'muvit_continue_watching';
const MAX_ITEMS = 10;

export const useContinueWatching = () => {
  const { authUser } = useUser();
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    if (!authUser) {
      setContinueWatching([]);
      return;
    }

    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${authUser.id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as WatchProgress[];
        // Filter out items older than 7 days
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const valid = parsed.filter(item => item.lastWatched > weekAgo);
        setContinueWatching(valid);
      }
    } catch (e) {
      console.error('Failed to load continue watching:', e);
    }
  }, [authUser]);

  // Save to localStorage whenever continueWatching changes
  useEffect(() => {
    if (!authUser) return;

    try {
      localStorage.setItem(`${STORAGE_KEY}_${authUser.id}`, JSON.stringify(continueWatching));
    } catch (e) {
      console.error('Failed to save continue watching:', e);
    }
  }, [continueWatching, authUser]);

  const updateProgress = useCallback((
    reelId: string,
    progress: number,
    currentTime: number,
    duration: number,
    reelData: {
      title: string;
      thumbnailUrl: string | null;
      videoUrl: string;
      userId: string;
      profile?: WatchProgress['profile'];
    }
  ) => {
    if (!authUser) return;

    // Don't save if progress is 0 or 100 (completed)
    if (progress <= 5 || progress >= 95) {
      // Remove from continue watching if completed
      if (progress >= 95) {
        setContinueWatching(prev => prev.filter(item => item.reelId !== reelId));
      }
      return;
    }

    setContinueWatching(prev => {
      const existing = prev.findIndex(item => item.reelId === reelId);
      const newItem: WatchProgress = {
        reelId,
        title: reelData.title,
        thumbnailUrl: reelData.thumbnailUrl,
        videoUrl: reelData.videoUrl,
        progress,
        currentTime,
        duration,
        lastWatched: Date.now(),
        userId: reelData.userId,
        profile: reelData.profile,
      };

      let updated: WatchProgress[];
      if (existing >= 0) {
        updated = [...prev];
        updated[existing] = newItem;
      } else {
        updated = [newItem, ...prev];
      }

      // Sort by lastWatched and limit to MAX_ITEMS
      return updated
        .sort((a, b) => b.lastWatched - a.lastWatched)
        .slice(0, MAX_ITEMS);
    });
  }, [authUser]);

  const getResumeTime = useCallback((reelId: string): number => {
    const item = continueWatching.find(w => w.reelId === reelId);
    return item?.currentTime || 0;
  }, [continueWatching]);

  const removeFromContinueWatching = useCallback((reelId: string) => {
    setContinueWatching(prev => prev.filter(item => item.reelId !== reelId));
  }, []);

  const clearAll = useCallback(() => {
    setContinueWatching([]);
    if (authUser) {
      localStorage.removeItem(`${STORAGE_KEY}_${authUser.id}`);
    }
  }, [authUser]);

  return {
    continueWatching,
    updateProgress,
    getResumeTime,
    removeFromContinueWatching,
    clearAll,
  };
};

export type { WatchProgress };
