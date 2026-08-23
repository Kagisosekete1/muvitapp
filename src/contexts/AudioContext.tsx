import React, { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react';

interface AudioContextType {
  // Register a video element and get permission to play audio
  requestAudioFocus: (videoElement: HTMLVideoElement, reelId: string) => void;
  // Release audio focus when reel becomes inactive
  releaseAudioFocus: (reelId: string) => void;
  // Check if this reel currently has audio focus
  hasAudioFocus: (reelId: string) => boolean;
  // Global mute state (user preference)
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  // Silence all audio globally
  silenceAll: () => void;
  // Force cleanup all audio elements
  forceCleanupAll: () => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Track which reel currently has audio focus
  const activeReelIdRef = useRef<string | null>(null);
  // Store reference to the active video element
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  // Track all registered video elements
  const registeredVideos = useRef<Map<string, HTMLVideoElement>>(new Map());
  
  // Global reel audio state - always starts sound ON.
  const [isMuted, setIsMutedState] = useState(false);

  // Reels should not persist or default to mute.
  const setIsMuted = useCallback((muted: boolean) => {
    setIsMutedState(false);
    sessionStorage.removeItem('reelAudioMuted');
  }, []);

  // Force mute and pause a single media element (do NOT reset currentTime; we want instant resume when user scrolls back)
  const forceSilenceElement = useCallback((el: HTMLMediaElement) => {
    try {
      el.pause();
      el.muted = true;
      el.volume = 0;
    } catch {
      // ignore
    }
  }, []);


  // Silence all media elements except the active one
  const silenceAllExcept = useCallback((exceptElement?: HTMLVideoElement) => {
    // Silence registered videos
    registeredVideos.current.forEach((video) => {
      if (video === exceptElement) return;
      forceSilenceElement(video);
    });

    // CRITICAL: Also silence any unregistered media elements in the DOM
    document.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
      if (video === exceptElement) return;
      forceSilenceElement(video);
    });

    document.querySelectorAll<HTMLAudioElement>('audio').forEach((audio) => {
      forceSilenceElement(audio);
    });
  }, [forceSilenceElement]);

  // Silence everything including the active one
  const silenceAll = useCallback(() => {
    activeReelIdRef.current = null;
    activeVideoRef.current = null;
    silenceAllExcept(undefined);
  }, [silenceAllExcept]);

  // Force cleanup all audio - more aggressive than silenceAll
  const forceCleanupAll = useCallback(() => {
    activeReelIdRef.current = null;
    activeVideoRef.current = null;
    registeredVideos.current.clear();

    // Aggressively silence and reset all media
    document.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
      try {
        video.pause();
        video.muted = true;
        video.volume = 0;
        video.currentTime = 0;
        video.removeAttribute('src');
        video.load();
      } catch {
        // ignore
      }
    });

    document.querySelectorAll<HTMLAudioElement>('audio').forEach((audio) => {
      try {
        audio.pause();
        audio.muted = true;
        audio.volume = 0;
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();
      } catch {
        // ignore
      }
    });
  }, []);

  // Request audio focus for a reel
  const requestAudioFocus = useCallback((videoElement: HTMLVideoElement, reelId: string) => {
    // Register this video
    registeredVideos.current.set(reelId, videoElement);

    // If this reel already has focus, just ensure state is correct
    if (activeReelIdRef.current === reelId) {
      videoElement.muted = false;
      videoElement.volume = 1;
      return;
    }

    // CRITICAL: Silence ALL other media first before granting focus
    silenceAllExcept(videoElement);

    // Grant focus to this reel
    activeReelIdRef.current = reelId;
    activeVideoRef.current = videoElement;

    videoElement.muted = false;
    videoElement.volume = 1;
  }, [silenceAllExcept]);

  // Release audio focus (pause + mute, but keep src + currentTime so scrolling back is instant)
  const releaseAudioFocus = useCallback((reelId: string) => {
    const video = registeredVideos.current.get(reelId);
    if (video) {
      try {
        video.pause();
        video.muted = true;
        video.volume = 0;
      } catch {
        // ignore
      }

      // If the element is no longer in the DOM (unmounted), drop the reference.
      if (!video.isConnected) {
        registeredVideos.current.delete(reelId);
      }
    }

    if (activeReelIdRef.current === reelId) {
      activeReelIdRef.current = null;
      activeVideoRef.current = null;
    }
  }, []);


  // Check if a reel has audio focus
  const hasAudioFocus = useCallback((reelId: string) => {
    return activeReelIdRef.current === reelId;
  }, []);

  // Sync mute state to active video when isMuted changes
  useEffect(() => {
    if (activeVideoRef.current) {
      activeVideoRef.current.muted = false;
      activeVideoRef.current.volume = 1;
    }
  }, [isMuted]);

  // Less aggressive periodic safety check - runs every 500ms to reduce CPU usage
  // This prevents reel jamming caused by too frequent DOM queries
  useEffect(() => {
    const interval = setInterval(() => {
      const activeVideo = activeVideoRef.current;

      // Only check registered videos instead of querying entire DOM
      registeredVideos.current.forEach((video, reelId) => {
        // Skip the active video
        if (activeVideo && video === activeVideo) {
          video.muted = false;
          video.volume = 1;
          return;
        }

        // Any other registered video should be silent
        if (!video.muted || video.volume > 0) {
          try {
            video.muted = true;
            video.volume = 0;
          } catch {
            // ignore
          }
        }
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      forceCleanupAll();
    };
  }, [forceCleanupAll]);

  return (
    <AudioContext.Provider
      value={{
        requestAudioFocus,
        releaseAudioFocus,
        hasAudioFocus,
        isMuted,
        setIsMuted,
        silenceAll,
        forceCleanupAll,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
