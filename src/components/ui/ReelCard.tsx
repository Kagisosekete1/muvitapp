import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share, MoreHorizontal, Flag, Ban, Trash2, Bookmark, BookmarkCheck, UserPlus, UserCheck, Edit2, Maximize, Download, BarChart2, Repeat2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useAudio } from '@/contexts/AudioContext';
import { useVideoQuality } from '@/contexts/VideoQualityContext';
import CommentsModal from '@/components/CommentsModal';
import ShareReelModal from '@/components/ShareReelModal';
import LikerAvatars from '@/components/ui/LikerAvatars';
import FloatingCommentBubble from '@/components/ui/FloatingCommentBubble';

import EditReelModal from '@/components/EditReelModal';
import ProfileLink from '@/components/ui/ProfileLink';
import DoubleTapLikeAnimation from '@/components/ui/DoubleTapLikeAnimation';
import { sendLikeNotification, sendRepostNotification } from '@/services/notificationService';
import { useOfflineVideoCache } from '@/hooks/useOfflineVideoCache';
import VideoAnalyticsModal from '@/components/VideoAnalyticsModal';
import { useWatchTimeTracker } from '@/hooks/useWatchTimeTracker';
import VideoDebugOverlay from '@/components/ui/VideoDebugOverlay';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Helper to parse and render hashtags as clickable links
const renderTextWithHashtags = (text: string, navigate: (path: string) => void) => {
  const parts = text.split(/(#\w+)/g);
  return parts.map((part, index) => {
    if (part.startsWith('#')) {
      const tag = part.slice(1);
      return (
        <button
          key={index}
          className="text-primary font-medium hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/search?hashtag=${encodeURIComponent(tag)}`);
          }}
        >
          {part}
        </button>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

interface Reel {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  description?: string;
  user: {
    id: string;
    profileId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    verified: boolean;
  };
  stats: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  soundTrack?: {
    title: string;
    artist: string;
  };
  isLiked?: boolean;
}

interface ReelCardProps {
  reel: Reel;
  followingIds: Set<string>;
  toggleFollow: (userId: string) => Promise<void>;
  isActive?: boolean;
  isOwner?: boolean;
  onPause?: () => void;
  onDelete?: (reelId: string) => void;
  onEnded?: () => void;
  autoAdvance?: boolean;
  variant?: 'home' | 'profile';
  /** If true, show a big play button and wait for user tap before playing (first reel in app) */
  startPaused?: boolean;
  /** Callback when user manually triggers play for the first time */
  onUserTriggeredPlay?: () => void;
  /** Callback to open comments in a side panel (desktop) */
  onOpenDesktopComments?: (reelId: string, reelOwnerId: string) => void;
}

const ReelCard: React.FC<ReelCardProps> = ({ 
  reel, 
  followingIds, 
  toggleFollow,
  isActive = false,
  isOwner = false,
  onPause,
  onDelete,
  onEnded,
  autoAdvance = false,
  variant = 'home',
  startPaused = false,
  onUserTriggeredPlay,
  onOpenDesktopComments,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { authUser } = useUser();
  const { requestAudioFocus, releaseAudioFocus, isMuted, setIsMuted } = useAudio();
  const { getPreloadStrategy, shouldReduceQuality } = useVideoQuality();
  const { cacheVideo, isVideoCached, isOnline } = useOfflineVideoCache();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(reel.isLiked || false);
  const [isSaved, setIsSaved] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [likeCount, setLikeCount] = useState(reel.stats.likes);
  const [commentCount, setCommentCount] = useState(reel.stats.comments);
  const [shareCount, setShareCount] = useState(reel.stats.shares);
  const [isVideoReady, setIsVideoReady] = useState(false);

  // Tracks whether user has interacted to play (for startPaused mode)
  const [userHasPlayed, setUserHasPlayed] = useState(!startPaused);

  // Realtime subscription for likes - show animation when someone likes this reel
  useEffect(() => {
    const channel = supabase
      .channel(`likes-${reel.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'likes', filter: `reel_id=eq.${reel.id}` },
        async (payload) => {
          const { count } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('reel_id', reel.id);
          setLikeCount(count || 0);

          // Show realtime like animation if it's not from the current user
          const likerId = (payload.new as any).user_id;
          if (likerId && likerId !== authUser?.id && isActive) {
            // Fetch liker's profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('user_id', likerId)
              .single();

            if (profile) {
              setRealtimeLiker({
                avatarUrl: profile.avatar_url || '',
                username: profile.username,
              });
              setTimeout(() => setRealtimeLiker(null), 2000);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'likes', filter: `reel_id=eq.${reel.id}` },
        async () => {
          const { count } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('reel_id', reel.id);
          setLikeCount(count || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reel.id, authUser?.id, isActive]);

  // Realtime subscription for comments
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${reel.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `reel_id=eq.${reel.id}` },
        async (payload) => {
          const { count } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('reel_id', reel.id);
          setCommentCount(count || 0);

          // Floating bubble for live comments from other users
          if (payload.eventType === 'INSERT' && isActive) {
            const row = payload.new as { user_id: string; content: string };
            if (row.user_id && row.user_id !== authUser?.id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('user_id', row.user_id)
                .single();
              if (profile) {
                setRealtimeComment({
                  avatarUrl: profile.avatar_url || '',
                  username: profile.username,
                  content: row.content,
                });
                setTimeout(() => setRealtimeComment(null), 3500);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reel.id, isActive, authUser?.id]);
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const [realtimeLiker, setRealtimeLiker] = useState<{ avatarUrl: string; username: string } | null>(null);
  const [realtimeComment, setRealtimeComment] = useState<{ avatarUrl: string; username: string; content: string } | null>(null);
  const [progress, setProgress] = useState(0);
  const [isClearScreen, setIsClearScreen] = useState(false);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const lastTapRef = useRef<number>(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);
  const [videoSrc, setVideoSrc] = useState<string | undefined>(reel.videoUrl);
  const [isBuffering, setIsBuffering] = useState(false);
  const [reelTitle, setReelTitle] = useState(reel.title);
  const [reelDescription, setReelDescription] = useState(reel.description || '');

  // If the same ReelCard instance is ever reused for a different reel, force-sync media + text.
  // This prevents "I clicked one Muv but another plays" and avoids stale overlays.
  useEffect(() => {
    setVideoSrc(reel.videoUrl);
    setReelTitle(reel.title);
    setReelDescription(reel.description || '');
    setIsVideoReady(false);
    setIsPlaying(false);
    setIsBuffering(false);
  }, [reel.id, reel.videoUrl, reel.title, reel.description]);

  // Check if user has liked/saved this reel
  useEffect(() => {
    if (authUser) {
      checkUserInteractions();
    }
  }, [authUser, reel.id]);

  const checkUserInteractions = async () => {
    if (!authUser) return;

    const [
      { data: likeData },
      { data: saveData },
      { data: repostData },
      { count: repostCountData },
      { count: likesCount },
      { count: commentsCount },
      { data: reelRow },
    ] = await Promise.all([
      supabase.from('likes').select('id').eq('user_id', authUser.id).eq('reel_id', reel.id).maybeSingle(),
      supabase.from('saved_reels').select('id').eq('user_id', authUser.id).eq('reel_id', reel.id).maybeSingle(),
      supabase.from('reposts').select('id').eq('user_id', authUser.id).eq('reel_id', reel.id).maybeSingle(),
      supabase.from('reposts').select('*', { count: 'exact', head: true }).eq('reel_id', reel.id),
      supabase.from('likes').select('*', { count: 'exact', head: true }).eq('reel_id', reel.id),
      supabase.from('comments').select('*', { count: 'exact', head: true }).eq('reel_id', reel.id),
      supabase.from('reels').select('shares_count').eq('id', reel.id).maybeSingle(),
    ]);

    setIsLiked(!!likeData);
    setIsSaved(!!saveData);
    setIsReposted(!!repostData);
    setRepostCount(repostCountData || 0);
    // Always trust authoritative counts so they don't appear missing after app resume
    if (typeof likesCount === 'number') setLikeCount((prev) => Math.max(prev, likesCount));
    if (typeof commentsCount === 'number') setCommentCount((prev) => Math.max(prev, commentsCount));
    if (typeof reelRow?.shares_count === 'number') setShareCount((prev) => Math.max(prev, reelRow.shares_count));
  };

  // Realtime engagement counts: when anyone likes/comments/reposts/saves this reel,
  // update the local counters immediately for everyone watching.
  useEffect(() => {
    if (!reel?.id) return;
    const channel = supabase
      .channel(`reel-engagement:${reel.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'likes', filter: `reel_id=eq.${reel.id}` },
        (payload) => {
          if ((payload.new as any)?.user_id === authUser?.id) return;
          setLikeCount((c) => c + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'likes', filter: `reel_id=eq.${reel.id}` },
        (payload) => {
          if ((payload.old as any)?.user_id === authUser?.id) return;
          setLikeCount((c) => Math.max(0, c - 1));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `reel_id=eq.${reel.id}` },
        () => setCommentCount((c) => c + 1)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments', filter: `reel_id=eq.${reel.id}` },
        () => setCommentCount((c) => Math.max(0, c - 1))
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reposts', filter: `reel_id=eq.${reel.id}` },
        (payload) => {
          if ((payload.new as any)?.user_id === authUser?.id) return;
          setRepostCount((c) => c + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reposts', filter: `reel_id=eq.${reel.id}` },
        (payload) => {
          if ((payload.old as any)?.user_id === authUser?.id) return;
          setRepostCount((c) => Math.max(0, c - 1));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reels', filter: `id=eq.${reel.id}` },
        (payload) => {
          const next = payload.new as any;
          if (typeof next?.shares_count === 'number') setShareCount(next.shares_count);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [reel?.id, authUser?.id]);

  // Watch time tracking for monetization
  useWatchTimeTracker({
    reelId: reel.id,
    creatorId: reel.user.id,
    isActive,
    videoRef,
  });

  // Debounced play function to prevent rapid play/pause cycles
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingAttemptRef = useRef(false);

  const attemptPlay = useCallback(async (video: HTMLVideoElement) => {
    if (isPlayingAttemptRef.current) return;
    isPlayingAttemptRef.current = true;

    try {
      // Wait for video to have enough data
      if (video.readyState >= 3) {
        setIsVideoReady(true);
        setIsBuffering(false);
      }

      // Don't reset currentTime if video has already played (scrolling back)
      if (video.currentTime === 0 || video.ended) {
        video.currentTime = 0;
      }
      
      await video.play();
      setIsPlaying(true);
    } catch {
      // Browser/WebView autoplay may still require a tap before sound; never force muted.
    } finally {
      isPlayingAttemptRef.current = false;
    }
  }, []);

  // Auto-play/pause using global audio manager - optimized to prevent jamming
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Clear any pending play attempts
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }

    if (isActive) {
      // Request audio focus from global manager - this silences all other videos
      requestAudioFocus(video, reel.id);
      
      // Set video source FIRST before anything else
      if (!videoSrc) {
        setVideoSrc(reel.videoUrl);
      }
      
      video.muted = false;
      video.volume = 1;

      // If startPaused mode and user has not played yet, do NOT auto-play
      if (!userHasPlayed) {
        // Load video but stay paused - show first frame
        video.currentTime = 0;
        video.load();
        return;
      }

      // Debounced play to prevent rapid state changes during scroll
      playTimeoutRef.current = setTimeout(() => {
        void attemptPlay(video);
      }, 100);

      return () => {
        if (playTimeoutRef.current) {
          clearTimeout(playTimeoutRef.current);
          playTimeoutRef.current = null;
        }
      };
    } else {
      // Release audio focus but keep video state for smooth scroll back
      releaseAudioFocus(reel.id);
      
      // Gentle pause without resetting - preserves position for scroll back
      if (!video.paused) {
        video.pause();
      }
      video.muted = true;
      setIsPlaying(false);
    }

    return () => {
      if (playTimeoutRef.current) {
        clearTimeout(playTimeoutRef.current);
        playTimeoutRef.current = null;
      }
    };
  }, [isActive, reel.id, reel.videoUrl, requestAudioFocus, releaseAudioFocus, userHasPlayed, isMuted, setIsMuted, attemptPlay, videoSrc]);

  // Sync mute state from global context to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video && isActive) {
      video.muted = false;
      video.volume = 1;
    }
  }, [isMuted, isActive]);

  // Handle app visibility change - resume playback + refresh counts when coming back
  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      const video = videoRef.current;

      if (document.visibilityState === 'visible') {
        // Re-fetch authoritative engagement counts so they don't appear missing
        if (authUser) {
          checkUserInteractions().catch(() => {});
        }
        if (video && userHasPlayed && !video.ended) {
          video.play().catch(() => {});
          setIsPlaying(true);
        }
      } else if (video) {
        video.pause();
        setIsPlaying(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive, userHasPlayed, authUser?.id, reel.id]);

  // Safety net: whenever THIS video plays or is unmuted, ensure it has audio focus
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      // If an inactive reel ever starts playing, force it to stop immediately.
      if (!isActive) {
        try {
          video.pause();
          video.muted = true;
          video.currentTime = 0;
        } catch {
          // ignore
        }
        return;
      }

      // Request audio focus when playing
      requestAudioFocus(video, reel.id);
    };

    const onVolumeChange = () => {
      if (!isActive) {
        try {
          video.muted = true;
        } catch {
          // ignore
        }
        return;
      }

      // If unmuting, request audio focus
      if (!video.muted) {
        requestAudioFocus(video, reel.id);
      }
    };

    const onTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => setIsBuffering(false);

    const onVideoEnded = () => {
      if (autoAdvance && onEnded) {
        onEnded();
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('ended', onVideoEnded);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('ended', onVideoEnded);
    };
  }, [reel.id, autoAdvance, onEnded, isActive]);

  // Desktop keyboard shortcuts (only when this reel is active)
  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't hijack typing
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (target as any)?.isContentEditable) return;

      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePlay();
      }

      if (e.key.toLowerCase() === 'm') {
        // mimic click behavior
        const video = videoRef.current;
        if (!video) return;
        if (!isActive) return;

        const nextMuted = !isMuted;
        video.muted = nextMuted;
        setIsMuted(nextMuted);
        if (!nextMuted) requestAudioFocus(video, reel.id);
      }

      if (e.key.toLowerCase() === 'l') {
        void handleLike();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, isMuted, reel.id, requestAudioFocus]);

  const triggerHaptic = () => {
    // PWA/mobile friendly haptic (best-effort)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      (navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }).vibrate?.(20);
    }
  };

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Hold-to-clear screen: hold 0.5s to hide UI; when hidden, hold 3s to show UI again
  const handleTouchStart = () => {
    if (!isActive) return;

    isHoldingRef.current = true;

    const delayMs = isClearScreen ? 3000 : 500;

    holdTimerRef.current = setTimeout(() => {
      if (!isHoldingRef.current) return;
      setIsClearScreen(prev => {
        const next = !prev;
        triggerHaptic();
        return next;
      });
    }, delayMs);
  };

  const handleTouchEnd = () => {
    isHoldingRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleVideoTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap - like
      handleDoubleTapLike();
      lastTapRef.current = 0;
    } else {
      // Single tap - play/pause
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current !== 0 && Date.now() - lastTapRef.current >= DOUBLE_TAP_DELAY) {
          togglePlay();
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handleDoubleTapLike = async () => {
    // Show heart animation
    setShowDoubleTapHeart(true);
    setTimeout(() => setShowDoubleTapHeart(false), 800);

    // Like if not already liked
    if (!isLiked) {
      const nextCount = likeCount + 1;
      setIsLiked(true);
      setLikeCount(nextCount);

      if (authUser) {
        await supabase.from('likes').insert({ user_id: authUser.id, reel_id: reel.id });
        await supabase.from('reels').update({ likes_count: nextCount }).eq('id', reel.id);
        
        // Create the in-app notification and OneSignal push in one place.
        if (reel.user.id !== authUser.id) {
          sendLikeNotification(reel.user.id, authUser.id, reel.id);
        }
      }
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    // If in startPaused mode and user hasn't played yet, mark user as having played
    if (!userHasPlayed) {
      setUserHasPlayed(true);
      onUserTriggeredPlay?.();

      // Wait briefly for effect to register, then play
      requestAudioFocus(video, reel.id);
      video.play().then(() => setIsPlaying(true)).catch(() => {});
      return;
    }

    if (isPlaying) {
      video.pause();
      onPause?.();
      setIsPlaying(false);
      return;
    }

    // Request audio focus when playing - this silences other videos
    requestAudioFocus(video, reel.id);

    // Resume from current position (don't reset currentTime)
    video.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      // ignore
    });
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Never allow muting/unmuting on an inactive reel
    if (!isActive) return;

    const video = videoRef.current;
    if (!video) return;

    // Store current time and playing state to prevent restart
    const currentTime = video.currentTime;
    const wasPlaying = !video.paused;

    const nextMuted = !isMuted;
    
    // Update mute state without affecting playback
    video.muted = nextMuted;
    setIsMuted(nextMuted);

    // Restore time in case browser resets it
    requestAnimationFrame(() => {
      if (video.currentTime !== currentTime) {
        video.currentTime = currentTime;
      }
      // Ensure video continues playing if it was playing
      if (wasPlaying && video.paused) {
        video.play().catch(() => {});
      }
    });

    if (!nextMuted) {
      // Request audio focus when unmuting
      requestAudioFocus(video, reel.id);
    }
  };

  const handleLike = async () => {
    if (!authUser) {
      toast({ title: 'Sign in required', description: "Please sign in to like Muv'z" });
      return;
    }

    // Optimistic UI - instant feedback
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      if (!wasLiked) {
        setShowDoubleTapHeart(true);
        setTimeout(() => setShowDoubleTapHeart(false), 800);
        
        await supabase.from('likes').insert({ user_id: authUser.id, reel_id: reel.id });
        
        // Send push + create in-app notification via backend (prevents duplicates)
        if (reel.user.id !== authUser.id) {
          void sendLikeNotification(reel.user.id, authUser.id, reel.id);
        }
      } else {
        await supabase.from('likes').delete().eq('user_id', authUser.id).eq('reel_id', reel.id);
      }
    } catch (error) {
      // Revert on error
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
      console.error('Error toggling like:', error);
    }
  };

  const handleSave = async () => {
    if (!authUser) {
      toast({ title: 'Sign in required', description: "Please sign in to save Muv'z" });
      return;
    }

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    if (newIsSaved) {
      await supabase.from('saved_reels').insert({ user_id: authUser.id, reel_id: reel.id });
      toast({ title: 'Saved', description: "Muv saved to your collection" });
    } else {
      await supabase.from('saved_reels').delete().eq('user_id', authUser.id).eq('reel_id', reel.id);
      toast({ title: 'Removed', description: "Muv removed from saved" });
    }
  };

  const handleComment = () => {
    // On desktop/tablet, use side panel if callback provided
    const isDesktop = window.innerWidth >= 1024;
    if (isDesktop && onOpenDesktopComments) {
      onOpenDesktopComments(reel.id, reel.user.id);
    } else {
      setShowComments(true);
    }
  };

  const handleShare = async () => {
    setShowShareModal(true);
  };

  const handleRepost = async () => {
    if (!authUser) {
      toast({ title: 'Sign in to repost', variant: 'destructive' });
      return;
    }
    if (isReposted) {
      await supabase.from('reposts').delete().eq('user_id', authUser.id).eq('reel_id', reel.id);
      setIsReposted(false);
      setRepostCount(prev => Math.max(0, prev - 1));
      toast({ title: 'Repost removed' });
    } else {
      await supabase.from('reposts').insert({ user_id: authUser.id, reel_id: reel.id });
      setIsReposted(true);
      setRepostCount(prev => prev + 1);
      if (reel.user.id !== authUser.id) {
        void sendRepostNotification(reel.user.id, authUser.id, reel.id);
      }
      toast({ title: 'Reposted!' });
    }
  };

  const handleDownload = async () => {
    try {
      toast({ title: 'Preparing download...', description: "Adding Muv'it watermark" });
      
      // Check if running on native platform
      const isNative = Capacitor.isNativePlatform();
      
      // Load video and logo
      const [videoResponse, logoResponse] = await Promise.all([
        fetch(reel.videoUrl),
        fetch('/icons/android/icon-192x192.png').catch(() => null)
      ]);
      
      const videoBlob = await videoResponse.blob();
      
      // Create canvas for watermarking
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoBlob);
      video.muted = true;
      video.playsInline = true;
      
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
        video.load();
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        // Fallback: download without watermark
        if (isNative) {
          await saveToGallery(videoBlob, `Muvit_@${reel.user.username}_${reel.id}.mp4`);
        } else {
          const url = URL.createObjectURL(videoBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Muvit_@${reel.user.username}_${reel.id}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        URL.revokeObjectURL(video.src);
        toast({ title: 'Download started', description: "Your Muv'it video is being downloaded." });
        return;
      }
      
      // Load logo image
      let logoImg: HTMLImageElement | null = null;
      if (logoResponse) {
        const logoBlob = await logoResponse.blob();
        logoImg = new Image();
        logoImg.src = URL.createObjectURL(logoBlob);
        await new Promise<void>((resolve) => {
          logoImg!.onload = () => resolve();
        });
      }
      
      // Record video with watermark using MediaRecorder
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }));
        };
      });
      
      mediaRecorder.start();
      video.currentTime = 0;
      await video.play();
      
      const drawFrame = () => {
        if (video.paused || video.ended) {
          mediaRecorder.stop();
          return;
        }
        
        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Draw Muv'it logo watermark at 30% opacity on middle-left
        if (logoImg) {
          ctx.save();
          ctx.globalAlpha = 0.3;
          const logoSize = Math.min(canvas.width, canvas.height) * 0.15;
          const logoX = 20;
          const logoY = (canvas.height - logoSize) / 2;
          ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
          ctx.restore();
        }
        
        // Add Muv'it text below logo
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.floor(canvas.width * 0.04)}px sans-serif`;
        ctx.fillText("Muv'it", 20, (canvas.height / 2) + (canvas.width * 0.1));
        ctx.restore();
        
        requestAnimationFrame(drawFrame);
      };
      
      drawFrame();
      
      const watermarkedBlob = await recordingPromise;
      
      // Clean up video
      video.pause();
      URL.revokeObjectURL(video.src);
      if (logoImg) URL.revokeObjectURL(logoImg.src);
      
      // Download the watermarked video
      if (isNative) {
        await saveToGallery(watermarkedBlob, `Muvit_@${reel.user.username}_${reel.id}.webm`);
      } else {
        const downloadUrl = URL.createObjectURL(watermarkedBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `Muvit_@${reel.user.username}_${reel.id}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }
      
      toast({ title: 'Download complete!', description: "Your Muv'it video has been saved with watermark." });
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: simple download without watermark
      try {
        const response = await fetch(reel.videoUrl);
        const blob = await response.blob();
        
        if (Capacitor.isNativePlatform()) {
          await saveToGallery(blob, `Muvit_@${reel.user.username}_${reel.id}.mp4`);
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Muvit_@${reel.user.username}_${reel.id}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        toast({ title: 'Download started', description: "Your Muv'it video is being downloaded." });
      } catch {
        toast({ title: 'Download failed', description: 'Could not download video.', variant: 'destructive' });
      }
    }
  };

  // Save to device gallery using Capacitor Filesystem
  const saveToGallery = async (blob: Blob, fileName: string) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      // Save to Downloads/Muvit folder
      await Filesystem.writeFile({
        path: `Muvit/${fileName}`,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      toast({ 
        title: 'Saved to Gallery!', 
        description: `Video saved to Documents/Muvit/${fileName}` 
      });
    } catch (error) {
      console.error('Error saving to gallery:', error);
      throw error;
    }
  };

  const handleReport = async () => {
    if (!authUser) {
      toast({ title: 'Sign in required', description: 'Please sign in to report content' });
      return;
    }

    const { error } = await supabase.from('reports').insert({
      reporter_id: authUser.id,
      reported_reel_id: reel.id,
      reason: 'Reported from reel',
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to submit report.', variant: 'destructive' });
      return;
    }

    toast({ title: 'Report submitted', description: 'Thank you for reporting this content.' });
  };

  const handleBlock = () => {
    toast({ title: 'User blocked', description: `@${reel.user.username} has been blocked.` });
  };

  const handleDelete = async () => {
    const { error } = await supabase.from('reels').delete().eq('id', reel.id);
    if (!error) {
      toast({ title: 'Muv deleted', description: 'Your Muv has been removed.' });
      onDelete?.(reel.id);
    } else {
      toast({ title: 'Error', description: 'Failed to delete Muv.', variant: 'destructive' });
    }
  };

  const isFollowing = followingIds.has(reel.user.id);
  const formatCount = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // De-dupe noisy captions that sometimes repeat username/title across devices
  const displayTitle = useMemo(() => {
    const username = (reel.user.username || '').trim().toLowerCase();
    const handle = username ? `@${username}` : '';
    const displayName = (reel.user.displayName || '').trim().toLowerCase();

    let raw = (reelTitle || '').trim();
    if (!raw) return '';

    // Remove leading @username or display name
    const lowerRaw = raw.toLowerCase();
    if (handle && lowerRaw.startsWith(handle)) {
      raw = raw.slice(handle.length).trimStart().replace(/^[-–—:|]+\s*/, '');
    } else if (displayName && lowerRaw.startsWith(displayName)) {
      raw = raw.slice(displayName.length).trimStart().replace(/^[-–—:|]+\s*/, '');
    }

    return raw;
  }, [reelTitle, reel.user.username, reel.user.displayName]);

  const displayDescription = useMemo(() => {
    const username = (reel.user.username || '').trim().toLowerCase();
    const handle = username ? `@${username}` : '';
    const displayName = (reel.user.displayName || '').trim().toLowerCase();

    let raw = (reelDescription || '').trim();
    if (!raw) return '';

    // Remove leading @username or display name
    const lowerRaw = raw.toLowerCase();
    if (handle && lowerRaw.startsWith(handle)) {
      raw = raw.slice(handle.length).trimStart().replace(/^[-–—:|]+\s*/, '');
    } else if (displayName && lowerRaw.startsWith(displayName)) {
      raw = raw.slice(displayName.length).trimStart().replace(/^[-–—:|]+\s*/, '');
    }

    // If description is effectively the same as the title, hide it
    const norm = (s: string) => s.toLowerCase().replace(/[#\s]+/g, ' ').trim();
    if (displayTitle && norm(raw) === norm(displayTitle)) return '';

    // If description only contains hashtags already in title, hide it
    const titleHashtags = new Set((displayTitle.match(/#\w+/g) || []).map(t => t.toLowerCase()));
    const descHashtags = raw.match(/#\w+/g) || [];
    const descWithoutHashtags = raw.replace(/#\w+/g, '').trim();
    
    if (!descWithoutHashtags && descHashtags.every(h => titleHashtags.has(h.toLowerCase()))) {
      return '';
    }

    return raw;
  }, [reelDescription, reel.user.username, reel.user.displayName, displayTitle]);

  // Button size based on variant
  const buttonSize = variant === 'profile' ? 'w-9 h-9' : 'w-9 h-9';
  const iconSize = variant === 'profile' ? 'w-4 h-4' : 'w-5 h-5';
  const infoOverlayClassName = variant === 'profile'
    ? 'absolute bottom-[8.5rem] left-3 right-16 sm:right-20 md:right-24 z-10 max-w-[calc(100%-5rem)] sm:max-w-md pointer-events-auto'
    : 'absolute bottom-16 left-3 right-16 sm:right-20 md:right-24 z-10 max-w-[calc(100%-5rem)] sm:max-w-md pointer-events-auto';
  const actionRailClassName = variant === 'profile'
    ? 'absolute bottom-[9rem] right-2 z-10 flex flex-col items-center space-y-3'
    : 'absolute bottom-20 right-2 z-10 flex flex-col items-center space-y-3';

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
    >
      {/* Video container keeps the native frame visible without browser cropping. */}
      <div className="relative w-full h-full max-w-[56.25vh] mx-auto flex items-center justify-center bg-video">
        {/* Solid video surface fallback */}
        <div className="absolute inset-0 bg-video" />

        {/*
          Tap-catcher layer:
          Some mobile WebViews show a big native play overlay when a <video> is paused.
          We keep taps working even when the video element is visually hidden.
        */}
        <div className="absolute inset-0 z-[1]" onClick={handleVideoTap} />

        {/* Thumbnail/placeholder crossfade layer */}
        {reel.thumbnailUrl && isVideoReady ? (
          <img
            src={reel.thumbnailUrl}
            alt={reel.title}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: isActive && isVideoReady && isPlaying ? 0 : 1,
              transition: 'opacity 0.25s ease-in-out',
            }}
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0 bg-video"
            style={{
              opacity: isActive && isVideoReady && isPlaying ? 0 : 1,
              transition: 'opacity 0.25s ease-in-out',
            }}
          />
        )}

        {/* Mobile-friendly transition/loading layer: forces a black surface and prevents native big-play overlays */}
        {isActive && (!isVideoReady || isBuffering) && (
          <div className="absolute inset-0 z-[2] bg-video flex items-center justify-center">
            <div className="w-7 h-7 rounded-full border-2 border-foreground/60 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Dev-only debug overlay for video state inspection */}
        <VideoDebugOverlay
          videoRef={videoRef}
          reelId={reel.id}
          isActive={isActive}
        />

        <video
          ref={videoRef}
          data-reel-video="true"
          className="absolute inset-0 w-full h-full object-contain"
          style={{
            // Keep the video element mounted/loaded even when inactive.
            // On iOS/Capacitor, swapping src/visibility on scroll can trigger the native
            // big-play overlay during transitions and when scrolling back.
            opacity: isActive && isVideoReady ? 1 : 0,
            visibility: 'visible',
            pointerEvents: isActive && isVideoReady ? 'auto' : 'none',
            // Force hardware acceleration for smoother transitions
            transform: 'translateZ(0)',
            willChange: isActive ? 'opacity' : 'auto',
          }}
          // IMPORTANT: do not unset src on inactive reels; it causes iOS to re-create
          // the native overlay UI when the reel becomes active again.
          src={videoSrc}
          // Always preload auto to prevent native loading UI
          preload="auto"
          loop={!autoAdvance}
            muted={false}
          playsInline
          // Disable native controls completely
          controls={false}
          // Disable context menu (right-click)
          onContextMenu={(e) => e.preventDefault()}
          // These attributes help suppress native UI on mobile
          disablePictureInPicture
          disableRemotePlayback
          // @ts-ignore - webkit-specific attributes to prevent native overlay
          webkit-playsinline="true"
          x-webkit-airplay="deny"
          // 1x1 transparent PNG data URI prevents native poster/play button
          poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
          onLoadedData={() => {
            setIsVideoReady(true);
            setIsBuffering(false);
          }}
          onCanPlay={() => {
            setIsVideoReady(true);
            setIsBuffering(false);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current && videoRef.current.readyState >= 1) {
              setIsBuffering(false);
            }
          }}
          onError={(e) => {
            console.error('Video load error:', e);
            setIsBuffering(false);
            if (videoRef.current && reel.videoUrl) {
              videoRef.current.load();
            }
          }}
          onStalled={() => {
            setIsBuffering(true);
          }}
          onWaiting={() => {
            setIsBuffering(true);
          }}
          onPlaying={() => {
            setIsPlaying(true);
            setIsVideoReady(true);
            setIsBuffering(false);
            // Cache video for offline playback when it starts playing
            if (isOnline && !isVideoCached(reel.id)) {
              cacheVideo(reel.id, reel.videoUrl);
            }
          }}
        />
      </div>
      
      {/* Double-tap Heart Animation (own action) */}
      <DoubleTapLikeAnimation show={showDoubleTapHeart} />
      
      {/* Realtime Like Animation (from other users) */}
      <DoubleTapLikeAnimation 
        show={!!realtimeLiker} 
        likerAvatarUrl={realtimeLiker?.avatarUrl}
        likerUsername={realtimeLiker?.username}
      />

      {/* Realtime Comment Bubble (from other users) */}
      <FloatingCommentBubble
        show={!!realtimeComment}
        avatarUrl={realtimeComment?.avatarUrl}
        username={realtimeComment?.username}
        content={realtimeComment?.content}
      />
      
      {/* No paused-state play badge: scroll transitions stay clean like TikTok. */}

      {/* UI Elements - Hidden in clear screen mode */}
      <div 
        className="transition-opacity duration-300"
        style={{ opacity: isClearScreen ? 0 : 1, pointerEvents: isClearScreen ? 'none' : 'auto' }}
      >

        {/* User Info & Caption - Bottom Left (single block, no duplicates) */}
        <div className={infoOverlayClassName}>
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2">
              {/* User Avatar */}
              <ProfileLink username={reel.user.username}>
                <img
                  src={reel.user.avatarUrl || '/placeholder.svg'}
                  alt={reel.user.username}
                  className="w-8 h-8 rounded-full border border-white/50 object-cover flex-shrink-0"
                />
              </ProfileLink>
              <ProfileLink username={reel.user.username} className="flex items-center gap-2 min-w-0 shrink">
                <span className="text-white font-bold text-sm sm:text-base drop-shadow-lg truncate">
                  @{reel.user.username}
                </span>
              </ProfileLink>
              {reel.user.verified && (
                <VerifiedBadge size="sm" />
              )}
            </div>

            {/* Description under username */}
            {displayTitle && (
              <p className="text-white text-sm sm:text-base font-medium leading-snug line-clamp-2 drop-shadow-lg break-words">
                {displayTitle.replace(/#\w+/g, '').trim()}
              </p>
            )}

            {/* Hashtags below description */}
            {(displayDescription || displayTitle) && (
              <p className="text-white/90 text-sm leading-snug line-clamp-2 drop-shadow-lg break-words">
                {renderTextWithHashtags(
                  ((displayDescription || displayTitle).match(/#\w+/g) || []).join(' '),
                  navigate
                )}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons - Right Side */}
        <div className={actionRailClassName} style={{ opacity: 0.85 }}>
          {/* User Avatar with Follow Button */}
          <div className="relative mb-1">
            <ProfileLink username={reel.user.username}>
              <img
                src={reel.user.avatarUrl}
                alt={reel.user.username}
                className="w-10 h-10 rounded-full border-2 border-white"
              />
            </ProfileLink>
            {/* Follow button - only show if not owner and not already following */}
            {authUser && !isOwner && !followingIds.has(reel.user.id) && (
              <button
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-primary rounded-full flex items-center justify-center border border-white"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFollow(reel.user.id);
                }}
              >
                <UserPlus className="w-3 h-3 text-primary-foreground" />
              </button>
            )}
            {/* Following indicator */}
            {authUser && !isOwner && followingIds.has(reel.user.id) && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-primary rounded-full flex items-center justify-center border border-background">
                <UserCheck className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
          </div>

          {/* Like */}
          <button
            type="button"
            className="flex flex-col items-center p-1.5 -m-1.5"
            style={{ touchAction: 'manipulation' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleLike();
            }}
          >
            <div className={`${buttonSize} rounded-full flex items-center justify-center ${isLiked ? 'bg-red-500/30' : 'bg-black/20'}`}>
              <Heart className={`${iconSize} ${isLiked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
            </div>
            <span className="text-[10px] text-white mt-0.5">{formatCount(likeCount)}</span>
            <LikerAvatars reelId={reel.id} count={likeCount} refreshKey={likeCount} />
          </button>

          {/* Comment */}
          <button
            type="button"
            className="flex flex-col items-center p-1.5 -m-1.5"
            style={{ touchAction: 'manipulation' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleComment();
            }}
          >
            <div className={`${buttonSize} rounded-full bg-black/20 flex items-center justify-center`}>
              <MessageCircle className={`${iconSize} text-white`} />
            </div>
            <span className="text-[10px] text-white mt-0.5">{formatCount(commentCount)}</span>
          </button>

          {/* Save */}
          <button
            className="flex flex-col items-center"
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
          >
            <div className={`${buttonSize} rounded-full flex items-center justify-center ${isSaved ? 'bg-yellow-500/30' : 'bg-black/20'}`}>
              {isSaved ? (
                <BookmarkCheck className={`${iconSize} text-yellow-500`} />
              ) : (
                <Bookmark className={`${iconSize} text-white`} />
              )}
            </div>
          </button>

          {/* Share */}
          <button
            className="flex flex-col items-center"
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
          >
            <div className={`${buttonSize} rounded-full bg-black/20 flex items-center justify-center`}>
              <Share className={`${iconSize} text-white`} />
            </div>
          </button>

          {/* Repost */}
          <button
            className="flex flex-col items-center"
            onClick={(e) => {
              e.stopPropagation();
              handleRepost();
            }}
          >
            <div className={`${buttonSize} rounded-full flex items-center justify-center ${isReposted ? 'bg-green-500/30' : 'bg-black/20'}`}>
              <Repeat2 className={`${iconSize} ${isReposted ? 'text-green-500' : 'text-white'}`} />
            </div>
            <span className="text-[10px] text-white mt-0.5">{repostCount > 0 ? repostCount : ''}</span>
          </button>

          {/* Download for offline */}
          <button
            className="flex flex-col items-center"
            onClick={(e) => {
              e.stopPropagation();
              if (isVideoCached(reel.id)) {
                toast({ title: 'Already saved', description: "This Muv is already available offline" });
                return;
              }
              cacheVideo(reel.id, reel.videoUrl);
              toast({ title: 'Saving for offline', description: "This Muv will be available offline" });
            }}
          >
            <div className={`${buttonSize} rounded-full flex items-center justify-center ${isVideoCached(reel.id) ? 'bg-green-500/30' : 'bg-black/20'}`}>
              <Download className={`${iconSize} ${isVideoCached(reel.id) ? 'text-green-500' : 'text-white'}`} />
            </div>
            <span className="text-[10px] text-white mt-0.5">{isVideoCached(reel.id) ? 'Saved' : 'Save'}</span>
          </button>
          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center">
                <div className={`${buttonSize} rounded-full bg-black/20 flex items-center justify-center`}>
                  <MoreHorizontal className={`${iconSize} text-white`} />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              {isOwner && (
                <>
                  <DropdownMenuItem onClick={() => setShowAnalyticsModal(true)}>
                    <BarChart2 className="w-4 h-4 mr-2" />
                    View Analytics
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowEditModal(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Muv
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Muv
                  </DropdownMenuItem>
                </>
              )}
              {!isOwner && (
                <>
                  <DropdownMenuItem onClick={handleReport} className="text-destructive">
                    <Flag className="w-4 h-4 mr-2" />
                    Report
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBlock} className="text-destructive">
                    <Ban className="w-4 h-4 mr-2" />
                    Block User
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Progress bar + Fullscreen - For home variant (with time display) */}
        {variant === 'home' && (
          <div className="absolute bottom-4 left-3 right-3 z-10 flex items-center gap-2">
            {/* Time Display */}
            <span className="text-[10px] text-white/80 font-medium min-w-[32px]">
              {videoRef.current ? formatTime(videoRef.current.currentTime) : '0:00'}
            </span>
            
            {/* Progress Bar */}
            <div 
              className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const video = videoRef.current;
                if (!video) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percent = clickX / rect.width;
                video.currentTime = percent * video.duration;
              }}
            >
              <div 
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            {/* Fullscreen Button - opens in container with black bars */}
            <button
              className="p-1 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                // Find the parent container to fullscreen (shows video centered with black bars)
                const container = (e.currentTarget as HTMLElement).closest('[data-reel-item="true"]') || 
                                   (e.currentTarget as HTMLElement).closest('.relative.w-full.h-full');
                if (container) {
                  if (container.requestFullscreen) {
                    container.requestFullscreen();
                  } else if ((container as any).webkitRequestFullscreen) {
                    (container as any).webkitRequestFullscreen();
                  }
                } else {
                  // Fallback to video element
                  const video = videoRef.current;
                  if (!video) return;
                  if (video.requestFullscreen) {
                    video.requestFullscreen();
                  } else if ((video as any).webkitRequestFullscreen) {
                    (video as any).webkitRequestFullscreen();
                  } else if ((video as any).webkitEnterFullscreen) {
                    (video as any).webkitEnterFullscreen();
                  }
                }
              }}
            >
              <Maximize className="w-4 h-4 text-white" />
            </button>
          </div>
        )}

        {/* Progress bar only - For non-home variants (trending, tutorials) */}
        {variant !== 'home' && (
          <div className="absolute bottom-4 left-3 right-3 z-10">
            {/* Progress Bar Only - no time display */}
            <div 
              className="h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const video = videoRef.current;
                if (!video) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percent = clickX / rect.width;
                video.currentTime = percent * video.duration;
              }}
            >
              <div 
                className="h-full bg-white rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {/* Edit Reel Modal */}
      <EditReelModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        reel={{
          id: reel.id,
          title: reelTitle,
          description: reelDescription,
          videoUrl: reel.videoUrl,
          thumbnailUrl: reel.thumbnailUrl,
        }}
        onUpdate={() => {
          // Refresh the title/description from DB
          supabase
            .from('reels')
            .select('title, description, thumbnail_url')
            .eq('id', reel.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setReelTitle(data.title);
                setReelDescription(data.description || '');
              }
            });
        }}
      />

      {/* Video Analytics Modal */}
      <VideoAnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        reelId={reel.id}
        reelTitle={reel.title}
      />

      <CommentsModal
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        reelId={reel.id}
        reelOwnerId={reel.user.id}
        onCommentCountChange={setCommentCount}
      />

      <ShareReelModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        reelId={reel.id}
        reelTitle={reel.title}
        username={reel.user.username}
        videoUrl={reel.videoUrl}
      />
    </div>
  );
};

export default ReelCard;
