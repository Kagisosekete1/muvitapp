import { useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WatchTimeTrackerOptions {
  reelId: string;
  creatorId: string;
  isActive: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
}

/**
 * Real-time watch time tracking hook.
 * Tracks how long a user watches each reel and persists to database
 * for accurate monetization watch hour calculations.
 */
export const useWatchTimeTracker = ({
  reelId,
  creatorId,
  isActive,
  videoRef,
}: WatchTimeTrackerOptions) => {
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const isTrackingRef = useRef(false);

  // Create a new watch session
  const startSession = useCallback(async () => {
    if (isTrackingRef.current || !reelId) return;
    
    isTrackingRef.current = true;
    startTimeRef.current = Date.now();
    accumulatedTimeRef.current = 0;
    lastUpdateRef.current = Date.now();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const viewerId = user?.id || null;

      const { data, error } = await supabase
        .from('watch_sessions')
        .insert({
          reel_id: reelId,
          user_id: creatorId, // Creator who owns the reel
          viewer_id: viewerId,
          watch_duration_seconds: 0,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (!error && data) {
        sessionIdRef.current = data.id;
      }
    } catch (err) {
      console.error('Failed to start watch session:', err);
    }
  }, [reelId, creatorId]);

  // Update watch duration periodically (every 5 seconds while watching)
  const updateDuration = useCallback(async () => {
    if (!sessionIdRef.current || !startTimeRef.current) return;

    const now = Date.now();
    const elapsedSinceStart = (now - startTimeRef.current) / 1000;
    const totalDuration = accumulatedTimeRef.current + elapsedSinceStart;

    // Only update if at least 5 seconds have passed since last update
    if (now - lastUpdateRef.current < 5000) return;
    lastUpdateRef.current = now;

    try {
      const video = videoRef.current;
      const videoDuration = video?.duration || null;

      await supabase
        .from('watch_sessions')
        .update({
          watch_duration_seconds: Math.round(totalDuration),
          total_video_duration_seconds: videoDuration ? Math.round(videoDuration) : null,
          is_complete: videoDuration ? totalDuration >= videoDuration * 0.9 : false,
        })
        .eq('id', sessionIdRef.current);
    } catch (err) {
      console.error('Failed to update watch duration:', err);
    }
  }, [videoRef]);

  // End the current session
  const endSession = useCallback(async () => {
    if (!sessionIdRef.current || !startTimeRef.current) {
      isTrackingRef.current = false;
      return;
    }

    const now = Date.now();
    const elapsedSinceStart = (now - startTimeRef.current) / 1000;
    const totalDuration = accumulatedTimeRef.current + elapsedSinceStart;

    try {
      const video = videoRef.current;
      const videoDuration = video?.duration || null;

      await supabase
        .from('watch_sessions')
        .update({
          watch_duration_seconds: Math.round(totalDuration),
          total_video_duration_seconds: videoDuration ? Math.round(videoDuration) : null,
          is_complete: videoDuration ? totalDuration >= videoDuration * 0.9 : false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionIdRef.current);
    } catch (err) {
      console.error('Failed to end watch session:', err);
    }

    // Reset state
    sessionIdRef.current = null;
    startTimeRef.current = null;
    accumulatedTimeRef.current = 0;
    isTrackingRef.current = false;
  }, [videoRef]);

  // Pause tracking (when video is paused)
  const pauseTracking = useCallback(() => {
    if (!startTimeRef.current) return;
    
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    accumulatedTimeRef.current += elapsed;
    startTimeRef.current = null;
  }, []);

  // Resume tracking (when video resumes)
  const resumeTracking = useCallback(() => {
    if (isTrackingRef.current && !startTimeRef.current) {
      startTimeRef.current = Date.now();
    }
  }, []);

  // Start/stop session based on isActive
  useEffect(() => {
    if (isActive) {
      startSession();
    } else {
      endSession();
    }

    return () => {
      // Cleanup on unmount
      if (isTrackingRef.current) {
        endSession();
      }
    };
  }, [isActive, startSession, endSession]);

  // Periodic update while active
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      updateDuration();
    }, 5000);

    return () => clearInterval(interval);
  }, [isActive, updateDuration]);

  // Listen to video play/pause events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => resumeTracking();
    const handlePause = () => pauseTracking();
    const handleEnded = () => {
      pauseTracking();
      updateDuration();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoRef, resumeTracking, pauseTracking, updateDuration]);

  return {
    pauseTracking,
    resumeTracking,
    endSession,
  };
};
