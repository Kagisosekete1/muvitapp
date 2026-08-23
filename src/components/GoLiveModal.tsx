import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Heart, Send, Users, Radio, Mic, MicOff, Camera, CameraOff, RotateCcw, MessageCircle, Power, Trash2, SwitchCamera, Sparkles, Monitor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUser } from '@/contexts/UserContext';
import { useAudio } from '@/contexts/AudioContext';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import FloatingHearts from '@/components/ui/FloatingHearts';
import ConfettiBurst from '@/components/ui/ConfettiBurst';
import ProfileLink from '@/components/ui/ProfileLink';
import { useLiveKitPublisher } from '@/hooks/useLiveKitStream';
import { sendLiveStartNotification } from '@/services/notificationService';
import GiftAnimation from '@/components/live/GiftAnimation';
import GiftLeaderboard from '@/components/live/GiftLeaderboard';
import PinnedMessage from '@/components/live/PinnedMessage';

interface GoLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Comment {
  id: string;
  username: string;
  text: string;
  timestamp: Date;
  avatarUrl?: string;
}

interface Viewer {
  oderId: string;
  username: string;
  avatarUrl?: string;
}

type ExtendedMediaTrackConstraints = MediaTrackConstraints;

interface CameraInspection {
  deviceId: string;
  label: string;
  lensRole: CameraLensRole;
  minZoom?: number;
  maxZoom?: number;
  score: number;
  nativeWidth?: number;
  nativeHeight?: number;
}

interface CameraCalibrationProfile {
  deviceSignature: string;
  platform: 'iphone' | 'samsung' | 'generic';
  zoomLevels: Record<number, { deviceId: string | null; zoom?: number }>;
  calibratedAt: number;
}

type CameraLensRole = 'front' | 'ultraWide' | 'wide' | 'telephoto' | 'rear' | 'unknown';

// Beauty filters for live camera
const BEAUTY_FILTERS = [
  { name: 'None', class: '', icon: '✨' },
  { name: 'Soft', class: 'brightness(105%) contrast(95%) saturate(90%)', icon: '🌸' },
  { name: 'Warm', class: 'sepia(15%) saturate(120%) brightness(105%)', icon: '☀️' },
  { name: 'Cool', class: 'hue-rotate(10deg) saturate(90%) brightness(105%)', icon: '❄️' },
  { name: 'Glow', class: 'brightness(110%) contrast(90%) saturate(110%)', icon: '💫' },
  { name: 'Vivid', class: 'saturate(130%) contrast(105%)', icon: '🌈' },
  { name: 'Portrait', class: 'brightness(108%) contrast(92%) saturate(95%)', icon: '📸' },
  { name: 'Dreamy', class: 'brightness(105%) blur(0.3px) saturate(85%)', icon: '🌙' },
];

// AR Face Effects - overlay emojis/stickers on the face area
const AR_EFFECTS = [
  { name: 'None', emoji: '❌', overlay: null },
  { name: 'Bunny', emoji: '🐰', overlay: '🐰' },
  { name: 'Cat', emoji: '🐱', overlay: '😺' },
  { name: 'Dog', emoji: '🐶', overlay: '🐕' },
  { name: 'Crown', emoji: '👑', overlay: '👑' },
  { name: 'Hearts', emoji: '💕', overlay: '💕' },
  { name: 'Stars', emoji: '⭐', overlay: '✨' },
  { name: 'Glasses', emoji: '🕶️', overlay: '🕶️' },
  { name: 'Angel', emoji: '😇', overlay: '😇' },
  { name: 'Devil', emoji: '😈', overlay: '😈' },
  { name: 'Fire', emoji: '🔥', overlay: '🔥' },
  { name: 'Sparkle', emoji: '✨', overlay: '💫' },
];

// Viewer milestones for confetti
const VIEWER_MILESTONES = [10, 50, 100, 500, 1000];
const PORTRAIT_STAGE_ASPECT_RATIO = 9 / 16;
const PREFERRED_PORTRAIT_WIDTH = 720;
const PREFERRED_PORTRAIT_HEIGHT = 1280;
const FALLBACK_PORTRAIT_WIDTH = 540;
const FALLBACK_PORTRAIT_HEIGHT = 960;
const MAX_CAMERA_FRAME_RATE = 24;
const CAMERA_CALIBRATION_STORAGE_KEY = 'muvit-live-camera-calibration-v2';

const GoLiveModal: React.FC<GoLiveModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const { currentUser, authUser } = useUser();
  const { forceCleanupAll } = useAudio();
  const isMobile = useIsMobile();
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const setupBackdropRef = useRef<HTMLVideoElement>(null);
  const previewBackdropRef = useRef<HTMLVideoElement>(null);
  const liveBackdropRef = useRef<HTMLVideoElement>(null);
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [viewers, setViewers] = useState<Map<string, Viewer>>(new Map());
  const [likeCount, setLikeCount] = useState(0);
  const [likeTrigger, setLikeTrigger] = useState(0);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [currentMilestone, setCurrentMilestone] = useState<number | undefined>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [liveTitle, setLiveTitle] = useState('');
  const [liveDescription, setLiveDescription] = useState('');
  const [step, setStep] = useState<'setup' | 'live' | 'ended'>('setup');
  const [isStartingLive, setIsStartingLive] = useState(false);
  const [liveStartTime, setLiveStartTime] = useState<Date | null>(null);
  const [liveDuration, setLiveDuration] = useState(0);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAREffect, setSelectedAREffect] = useState(0);
  const [showAREffects, setShowAREffects] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [commentsVisible, setCommentsVisible] = useState(true);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommentAtRef = useRef(0);
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reachedMilestones = useRef<Set<number>>(new Set());
  const preferredCameraIdsRef = useRef<Record<'user' | 'environment', string | null>>({
    user: null,
    environment: null,
  });
  const cameraCalibrationRef = useRef<CameraCalibrationProfile | null>(null);
  const cameraInspectionsRef = useRef<Record<'user' | 'environment', CameraInspection[]>>({
    user: [],
    environment: [],
  });
  const [giftAnimation, setGiftAnimation] = useState<{ id: number; emoji: string; name: string; senderName: string; animation: string } | null>(null);
  const [giftLeaderboard, setGiftLeaderboard] = useState<{ username: string; totalCoins: number }[]>([]);
  const [pinnedMsg, setPinnedMsg] = useState<{ username: string; content: string } | null>(null);
  const showCameraBackdrop = false;
  const livekitIdentity = useMemo(
    () => authUser
      ? {
          id: authUser.id,
          name: currentUser?.displayName || authUser.email || authUser.id,
        }
      : null,
    [authUser?.email, authUser?.id, currentUser?.displayName],
  );

  const viewerCount = viewers.size;
  const portraitStageStyle: React.CSSProperties = {
    width: isMobile
      ? '100vw'
      : `min(100vw, 420px, calc(100dvh * ${PORTRAIT_STAGE_ASPECT_RATIO}))`,
    height: isMobile ? '100dvh' : undefined,
    maxWidth: isMobile ? '100vw' : undefined,
    maxHeight: isMobile ? '100dvh' : undefined,
    aspectRatio: isMobile ? undefined : '9 / 16',
    // Full-screen stage guard: neutralize any inherited transforms / scaling
    // so a parent container can never reintroduce the horizontal zoomed framing.
    transform: 'none',
    WebkitTransform: 'none',
    filter: 'none',
    WebkitFilter: 'none',
    zoom: 1 as unknown as number,
    isolation: 'isolate',
    contain: 'layout paint size style',
    willChange: 'auto',
    transformOrigin: 'center center',
  };
  const cameraStageClassName = isMobile
    ? 'fixed inset-0 h-[100dvh] w-screen min-h-[100dvh] min-w-[100vw] overflow-hidden bg-black contain-layout transform-none !transform-none'
    : 'relative aspect-[9/16] max-h-[100dvh] overflow-hidden bg-black transform-none';
  const cameraViewportStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'black',
    overflow: 'hidden',
    // Guard against ancestor scaling/transforms reaching the video element.
    transform: 'none',
    WebkitTransform: 'none',
    filter: 'none',
    WebkitFilter: 'none',
    contain: 'layout paint size style',
    isolation: 'isolate',
  };
  const cameraVideoStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    zIndex: 1,
    width: '100%',
    height: '100%',
    maxWidth: 'none',
    objectFit: 'contain',
    objectPosition: 'center center',
    transform: `translate(-50%, -50%) ${currentFacingMode === 'user' ? 'scaleX(-1)' : ''}`.trim(),
    transformOrigin: 'center center',
    WebkitTransform: `translate(-50%, -50%) ${currentFacingMode === 'user' ? 'scaleX(-1)' : ''}`.trim(),
    WebkitTransformOrigin: 'center center',
  };
  // Blurred backdrop fills the empty letterbox bars with the same live frame
  // (no crop/zoom of the main feed — just an ambient fill behind it).
  const cameraBackdropStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    filter: 'blur(24px) saturate(130%)',
    WebkitFilter: 'blur(24px) saturate(130%)',
    transform: `${currentFacingMode === 'user' ? 'scaleX(-1) ' : ''}scale(1.15)`,
    WebkitTransform: `${currentFacingMode === 'user' ? 'scaleX(-1) ' : ''}scale(1.15)`,
    opacity: 0.55,
    pointerEvents: 'none',
    zIndex: 0,
  };

  const attachStreamToVideoElement = useCallback(
    async (videoElement: HTMLVideoElement | null, mediaStream: MediaStream) => {
      if (!videoElement) {
        return;
      }

      videoElement.srcObject = mediaStream;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('webkit-playsinline', 'true');
      videoElement.muted = true;

      videoElement.onloadedmetadata = async () => {
        try {
          await videoElement.play();
        } catch (error) {
          console.log('Video play error:', error);
        }
      };

      try {
        await videoElement.play();
      } catch (error) {
        console.log('Video play error:', error);

        setTimeout(() => {
          videoElement.play().catch((retryError) => {
            console.log('Video play retry error:', retryError);
          });
        }, 100);
      }
    },
    [],
  );

  // LiveKit: low-latency mobile portrait broadcast to viewers.
  const { connectionState: liveKitConnectionState } = useLiveKitPublisher({
    roomName: isLive ? liveSessionId : null,
    localStream: stream,
    identity: livekitIdentity,
    enabled: isLive && !!liveSessionId && !!stream,
  });

  // When opening the live modal, hard-stop any reel audio playing behind it.
  useEffect(() => {
    if (isOpen) {
      forceCleanupAll();
    }
  }, [isOpen, forceCleanupAll]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyWidth = body.style.width;
    const previousBodyHeight = body.style.height;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.width = '100vw';
    body.style.height = '100dvh';
    screen.orientation?.lock?.('portrait').catch(() => undefined);

    return () => {
      screen.orientation?.unlock?.();
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.width = previousBodyWidth;
      body.style.height = previousBodyHeight;
    };
  }, [isOpen, isMobile]);

  // Cleanup streams when modal closes
  useEffect(() => {
    if (!isOpen && stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [isOpen]);

  // Check for viewer milestones
  useEffect(() => {
    for (const milestone of VIEWER_MILESTONES) {
      if (viewerCount >= milestone && !reachedMilestones.current.has(milestone)) {
        reachedMilestones.current.add(milestone);
        setCurrentMilestone(milestone);
        setConfettiTrigger(prev => prev + 1);
        
        toast({
          title: `🎉 ${milestone} Viewers!`,
          description: "Your live is on fire!",
        });
      }
    }
  }, [viewerCount, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Update live duration
  useEffect(() => {
    if (isLive && liveStartTime) {
      const interval = setInterval(() => {
        setLiveDuration(Math.floor((Date.now() - liveStartTime.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isLive, liveStartTime]);

  useEffect(() => {
    if (!isLive || !liveSessionId || !authUser) return;

    const sendHeartbeat = () => {
      supabase.from('live_streams').update({
        last_heartbeat_at: new Date().toISOString(),
        status: 'live',
        is_active: true,
      }).eq('session_id', liveSessionId).eq('user_id', authUser.id);
    };

    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 30_000);

    return () => window.clearInterval(interval);
  }, [isLive, liveSessionId, authUser?.id]);

  // Setup Supabase Realtime for viewer presence when live
  useEffect(() => {
    if (!isLive || !liveSessionId || !authUser) return;

    const channel = supabase.channel(`live:${liveSessionId}`, {
      config: {
        presence: {
          key: authUser.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newViewers = new Map<string, Viewer>();
        
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== authUser.id && Array.isArray(presences) && presences.length > 0) {
            const presence = presences[0] as any;
            newViewers.set(key, {
              oderId: key,
              username: presence.username || 'Anonymous',
              avatarUrl: presence.avatarUrl,
            });
          }
        });
        
        setViewers(newViewers);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key !== authUser.id && newPresences.length > 0) {
          const presence = newPresences[0] as any;
          setViewers(prev => {
            const next = new Map(prev);
            next.set(key, {
              oderId: key,
              username: presence.username || 'Anonymous',
              avatarUrl: presence.avatarUrl,
            });
            return next;
          });
          
          toast({
            title: `${presence.username || 'Someone'} joined`,
            description: 'A new viewer is watching your live!',
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== authUser.id) {
          setViewers(prev => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        }
      })
      .on('broadcast', { event: 'like' }, () => {
        setLikeCount(prev => prev + 1);
        setLikeTrigger(prev => prev + 1);
      })
      .on('broadcast', { event: 'comment' }, ({ payload }) => {
        const comment = payload as Comment;
        // Store in BOTH - allComments for scroll history, comments for display
        setAllComments(prev => [...prev, comment]);
        setComments(prev => [...prev.slice(-20), comment]);
        // Auto-scroll to latest comment
        setTimeout(() => {
          if (commentsContainerRef.current) {
            commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
          }
        }, 100);
      })
      .on('broadcast', { event: 'gift' }, ({ payload }) => {
        const g = payload as { senderName: string; emoji: string; name: string; animation: string; cost: number };
        setGiftAnimation({ id: Date.now(), ...g });
        setGiftLeaderboard(prev => {
          const existing = prev.find(e => e.username === g.senderName);
          if (existing) {
            return prev.map(e => e.username === g.senderName ? { ...e, totalCoins: e.totalCoins + g.cost } : e)
              .sort((a, b) => b.totalCoins - a.totalCoins);
          }
          return [...prev, { username: g.senderName, totalCoins: g.cost }].sort((a, b) => b.totalCoins - a.totalCoins);
        });
      })
      .on('broadcast', { event: 'pin' }, ({ payload }) => {
        setPinnedMsg(payload as { username: string; content: string });
      })
      .on('broadcast', { event: 'unpin' }, () => {
        setPinnedMsg(null);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            username: currentUser?.username || 'Broadcaster',
            avatarUrl: currentUser?.avatarUrl,
            isBroadcaster: true,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [isLive, liveSessionId, authUser?.id]);

  // Attach stream to video when step changes to live
  useEffect(() => {
    if (step === 'live' && stream && liveVideoRef.current) {
      attachStreamToVideoElement(liveVideoRef.current, stream);
    }
    if (step === 'live' && stream && liveBackdropRef.current) {
      attachStreamToVideoElement(liveBackdropRef.current, stream);
    }
  }, [attachStreamToVideoElement, step, stream, showCameraBackdrop]);

  // Attach stream to preview video - ensure it works on mobile
  useEffect(() => {
    if ((step === 'setup' || step === 'live') && stream && previewVideoRef.current) {
      attachStreamToVideoElement(previewVideoRef.current, stream);
    }
    if (step === 'setup' && stream && setupBackdropRef.current) {
      attachStreamToVideoElement(setupBackdropRef.current, stream);
    }
    if (step === 'setup' && stream && previewBackdropRef.current) {
      attachStreamToVideoElement(previewBackdropRef.current, stream);
    }
  }, [attachStreamToVideoElement, step, stream]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const classifyCameraLens = (label: string): CameraLensRole => {
    const normalizedLabel = label.toLowerCase();

    if (/front|user|face|selfie|truedepth/.test(normalizedLabel)) return 'front';
    if (/tele|zoom|macro|portrait|depth|2x|3x|5x|10x/.test(normalizedLabel)) return 'telephoto';
    if (/ultra[\s-]?wide|super[\s-]?wide|wide[\s-]?angle|ultra\s+wide|0\.5|0,5|0\.6|0,6|0\.7|0,7|\buw\b/.test(normalizedLabel)) return 'ultraWide';
    if (/\bmain\b|\bwide\b|1x|standard|dual\s+wide|back camera/.test(normalizedLabel)) return 'wide';
    if (/back|rear|environment|world/.test(normalizedLabel)) return 'rear';

    return 'unknown';
  };

  const scoreCameraDevice = (label: string, facingMode: 'user' | 'environment') => {
    const normalizedLabel = label.toLowerCase();
    const lensRole = classifyCameraLens(label);

    if (facingMode === 'user') {
      return [
        lensRole === 'front' ? 100 : 0,
        /back|rear|environment/.test(normalizedLabel) ? -100 : 0,
      ].reduce((total, score) => total + score, 0);
    }

    const isMultiLensRear = /triple|dual|multi/.test(normalizedLabel);

    return [
      /back|rear|environment|world/.test(normalizedLabel) ? 140 : 0,
      lensRole === 'ultraWide' ? 320 : 0,
      lensRole === 'wide' ? 120 : 0,
      lensRole === 'rear' ? 70 : 0,
      isMultiLensRear ? 40 : 0,
      lensRole === 'telephoto' ? -260 : 0,
      lensRole === 'front' ? -220 : 0,
    ].reduce((total, score) => total + score, 0);
  };

  const buildPortraitConstraintCandidates = (
    facingMode: 'user' | 'environment',
    preferredDeviceId: string | null,
  ): ExtendedMediaTrackConstraints[] => {
    const candidates: ExtendedMediaTrackConstraints[] = [];

    if (preferredDeviceId) {
      candidates.push(
        {
          deviceId: { exact: preferredDeviceId },
          width: { ideal: PREFERRED_PORTRAIT_WIDTH },
          height: { ideal: PREFERRED_PORTRAIT_HEIGHT },
          frameRate: { ideal: MAX_CAMERA_FRAME_RATE, max: MAX_CAMERA_FRAME_RATE },
        },
        {
          deviceId: { exact: preferredDeviceId },
          width: { ideal: FALLBACK_PORTRAIT_WIDTH },
          height: { ideal: FALLBACK_PORTRAIT_HEIGHT },
          frameRate: { ideal: 24, max: MAX_CAMERA_FRAME_RATE },
        },
      );
    }

    candidates.push(
      {
        facingMode: { ideal: facingMode },
        width: { ideal: PREFERRED_PORTRAIT_WIDTH },
        height: { ideal: PREFERRED_PORTRAIT_HEIGHT },
        frameRate: { ideal: MAX_CAMERA_FRAME_RATE, max: MAX_CAMERA_FRAME_RATE },
      },
      {
        facingMode: { ideal: facingMode },
        width: { ideal: FALLBACK_PORTRAIT_WIDTH },
        height: { ideal: FALLBACK_PORTRAIT_HEIGHT },
        frameRate: { ideal: 24, max: MAX_CAMERA_FRAME_RATE },
      },
      {
        facingMode: { ideal: facingMode },
        frameRate: { ideal: 24, max: MAX_CAMERA_FRAME_RATE },
      },
    );

    return candidates;
  };

  const requestCameraStreamWithFallbacks = async ({
    audioConstraints,
    facingMode,
    preferredDeviceId,
  }: {
    audioConstraints: MediaTrackConstraints | boolean;
    facingMode: 'user' | 'environment';
    preferredDeviceId: string | null;
  }) => {
    let lastError: unknown = null;

    for (const videoConstraints of buildPortraitConstraintCandidates(facingMode, preferredDeviceId)) {
      let mediaStream: MediaStream | null = null;

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });

        const videoTrack = mediaStream.getVideoTracks()[0];
        if (!videoTrack) {
          throw new Error('No camera track available');
        }

        await enforcePortraitTrackConstraints(videoTrack);

        return mediaStream;
      } catch (error) {
        mediaStream?.getTracks().forEach((track) => track.stop());
        lastError = error;
      }
    }

    throw lastError ?? new Error('Unable to access camera');
  };

  const enforcePortraitTrackConstraints = async (videoTrack: MediaStreamTrack) => {
    if (!isMobile) {
      return;
    }

    const portraitConstraintCandidates: ExtendedMediaTrackConstraints[] = [
      {
        width: { ideal: PREFERRED_PORTRAIT_WIDTH },
        height: { ideal: PREFERRED_PORTRAIT_HEIGHT },
        frameRate: { ideal: MAX_CAMERA_FRAME_RATE, max: MAX_CAMERA_FRAME_RATE },
      },
      {
        width: { ideal: FALLBACK_PORTRAIT_WIDTH },
        height: { ideal: FALLBACK_PORTRAIT_HEIGHT },
        frameRate: { ideal: 24, max: MAX_CAMERA_FRAME_RATE },
      },
      {
        frameRate: { ideal: 24, max: MAX_CAMERA_FRAME_RATE },
      },
    ];

    for (const constraints of portraitConstraintCandidates) {
      try {
        await videoTrack.applyConstraints(constraints);
        return;
      } catch {
        continue;
      }
    }
  };

  const inspectCameraDevice = async (
    device: MediaDeviceInfo,
    facingMode: 'user' | 'environment'
  ): Promise<CameraInspection | null> => {
    let probeStream: MediaStream | null = null;

    try {
      const probeConstraints: ExtendedMediaTrackConstraints = {
        deviceId: { exact: device.deviceId },
        facingMode: { ideal: facingMode },
        width: { ideal: FALLBACK_PORTRAIT_WIDTH, max: PREFERRED_PORTRAIT_WIDTH },
        height: { ideal: FALLBACK_PORTRAIT_HEIGHT, max: PREFERRED_PORTRAIT_HEIGHT },
        aspectRatio: { ideal: PORTRAIT_STAGE_ASPECT_RATIO },
        frameRate: { ideal: 24, max: MAX_CAMERA_FRAME_RATE },
      };

      probeStream = await navigator.mediaDevices.getUserMedia({
        video: probeConstraints,
        audio: false,
      });

      const track = probeStream.getVideoTracks()[0];
      const settings = track.getSettings();
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
        zoom?: { min?: number; max?: number };
      };
      const label = track.label || device.label;
      const facingBonus =
        settings.facingMode === facingMode
          ? 160
          : settings.facingMode && settings.facingMode !== facingMode
            ? -160
            : 0;
      const zoomBonus = (() => {
        if (facingMode !== 'environment' || typeof capabilities.zoom?.min !== 'number') {
          return 0;
        }

        if (capabilities.zoom.min < 1) {
          return 420;
        }

        if (capabilities.zoom.min === 1) {
          return 80;
        }

        return -40;
      })();
      const portraitCaptureBonus =
        typeof settings.width === 'number' &&
        typeof settings.height === 'number' &&
        settings.height > settings.width
          ? 220
          : 0;

      return {
        deviceId: device.deviceId,
        label,
        lensRole: classifyCameraLens(label),
        minZoom: capabilities.zoom?.min,
        maxZoom: capabilities.zoom?.max,
        nativeWidth: settings.width,
        nativeHeight: settings.height,
        score: scoreCameraDevice(label, facingMode) + facingBonus + zoomBonus + portraitCaptureBonus,
      };
    } catch {
      if (!device.label.trim()) {
        return null;
      }

      return {
        deviceId: device.deviceId,
        label: device.label,
        lensRole: classifyCameraLens(device.label),
        score: scoreCameraDevice(device.label, facingMode),
      };
    } finally {
      probeStream?.getTracks().forEach((track) => track.stop());
    }
  };

  const detectMobileCameraPlatform = (inspections: CameraInspection[]): CameraCalibrationProfile['platform'] => {
    const ua = navigator.userAgent.toLowerCase();
    const labels = inspections.map((inspection) => inspection.label.toLowerCase()).join(' ');

    if (/iphone|ipad|ipod/.test(ua)) return 'iphone';
    if (/samsung|sm-|galaxy/.test(ua) || /samsung|galaxy/.test(labels)) return 'samsung';

    return 'generic';
  };

  const getCameraDeviceSignature = (inspections: CameraInspection[]) =>
    inspections
      .map((inspection) => [
        inspection.label || 'camera',
        inspection.lensRole,
        inspection.minZoom ?? 'no-min',
        inspection.maxZoom ?? 'no-max',
        inspection.nativeWidth ?? 'w',
        inspection.nativeHeight ?? 'h',
      ].join(':'))
      .sort()
      .join('|');

  const getZoomValueForLevel = (
    level: number,
    facingMode: 'user' | 'environment',
    hardwareMin: number,
    hardwareMax: number,
  ) => {
    const clampedLevel = Math.max(0, Math.min(4, level));
    const clampZoom = (value: number) => Math.max(hardwareMin, Math.min(hardwareMax, value));

    if (facingMode === 'user') {
      const range = hardwareMax - hardwareMin;
      return [
        clampZoom(hardwareMin + range * 0.5),
        clampZoom(hardwareMin + range * 0.35),
        clampZoom(hardwareMin + range * 0.2),
        clampZoom(hardwareMin + range * 0.1),
        clampZoom(hardwareMin),
      ][clampedLevel];
    }

    return [
      clampZoom(hardwareMin < 1 ? 2 : Math.min(hardwareMax, 2)),
      clampZoom(hardwareMin < 1 ? 1.5 : Math.min(hardwareMax, 1.5)),
      clampZoom(1),
      clampZoom(hardwareMin < 0.75 ? 0.75 : hardwareMin),
      clampZoom(hardwareMin),
    ][clampedLevel];
  };

  const buildCameraCalibrationProfile = (inspections: CameraInspection[]): CameraCalibrationProfile | null => {
    if (!inspections.length) return null;

    const sorted = [...inspections].sort((first, second) => second.score - first.score);
    const byMinZoom = [...inspections].sort(
      (first, second) => (first.minZoom ?? 1) - (second.minZoom ?? 1),
    );
    const ultraWide = inspections.find((inspection) => inspection.lensRole === 'ultraWide')
      ?? byMinZoom.find((inspection) => typeof inspection.minZoom === 'number' && inspection.minZoom < 1);
    const wide = inspections.find((inspection) => inspection.lensRole === 'wide')
      ?? inspections.find((inspection) => inspection.lensRole === 'rear')
      ?? sorted[0];
    const telephoto = inspections.find((inspection) => inspection.lensRole === 'telephoto');
    const widest = ultraWide ?? byMinZoom[0] ?? wide;
    const platform = detectMobileCameraPlatform(inspections);
    const deviceForLevel = (level: number) => {
      if (level >= 3) return widest;
      if (level === 2) return wide ?? widest;
      if (level === 1) return wide ?? telephoto ?? widest;
      return telephoto ?? wide ?? widest;
    };

    const zoomLevels = [0, 1, 2, 3, 4].reduce<CameraCalibrationProfile['zoomLevels']>((levels, level) => {
      const device = deviceForLevel(level);
      const hardwareMin = device?.minZoom ?? 1;
      const hardwareMax = device?.maxZoom ?? Math.max(hardwareMin, level === 0 ? 2 : 1);

      levels[level] = {
        deviceId: device?.deviceId ?? null,
        zoom: typeof device?.minZoom === 'number'
          ? getZoomValueForLevel(level, 'environment', hardwareMin, hardwareMax)
          : undefined,
      };

      return levels;
    }, {});

    return {
      deviceSignature: getCameraDeviceSignature(inspections),
      platform,
      zoomLevels,
      calibratedAt: Date.now(),
    };
  };

  const syncCameraCalibrationProfile = (inspections: CameraInspection[]) => {
    const nextProfile = buildCameraCalibrationProfile(inspections);
    if (!nextProfile) return;

    try {
      const storedProfiles = JSON.parse(localStorage.getItem(CAMERA_CALIBRATION_STORAGE_KEY) ?? '{}') as Record<string, CameraCalibrationProfile>;
      const cachedProfile = storedProfiles[nextProfile.deviceSignature];

      cameraCalibrationRef.current = cachedProfile ?? nextProfile;

      if (!cachedProfile || cachedProfile.platform !== nextProfile.platform) {
        storedProfiles[nextProfile.deviceSignature] = nextProfile;
        localStorage.setItem(CAMERA_CALIBRATION_STORAGE_KEY, JSON.stringify(storedProfiles));
      }
    } catch {
      cameraCalibrationRef.current = nextProfile;
    }
  };

  const getPreferredCameraDeviceId = async (facingMode: 'user' | 'environment') => {
    const cachedDeviceId = preferredCameraIdsRef.current[facingMode];
    if (cachedDeviceId) {
      return cachedDeviceId;
    }

    if (!navigator.mediaDevices?.enumerateDevices) {
      return null;
    }

    const videoDevices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === 'videoinput'
    );

    if (!videoDevices.length) {
      return null;
    }

    const hasLabels = videoDevices.some((device) => device.label.trim().length > 0);
    if (!hasLabels) {
      return null;
    }

    const inspections: CameraInspection[] = [];
    let rankedDevice: CameraInspection | null = null;

    for (const device of videoDevices) {
      const inspection = await inspectCameraDevice(device, facingMode);
      if (!inspection) continue;

      inspections.push(inspection);

      if (!rankedDevice || inspection.score > rankedDevice.score) {
        rankedDevice = inspection;
      }
    }

    cameraInspectionsRef.current[facingMode] = inspections.sort((first, second) => second.score - first.score);

    if (facingMode === 'environment') {
      syncCameraCalibrationProfile(cameraInspectionsRef.current.environment);
    }

    if (rankedDevice?.deviceId) {
      if (facingMode === 'environment') {
        const widestRearDevice = cameraInspectionsRef.current.environment.find(
          (inspection) =>
            inspection.lensRole === 'ultraWide' ||
            (typeof inspection.minZoom === 'number' && inspection.minZoom < 1),
        );

        preferredCameraIdsRef.current.environment = widestRearDevice?.deviceId ?? rankedDevice.deviceId;
        return preferredCameraIdsRef.current.environment;
      }

      preferredCameraIdsRef.current[facingMode] = rankedDevice.deviceId;
      return rankedDevice.deviceId;
    }

    const fallbackDevice = [...videoDevices].sort(
      (first, second) => scoreCameraDevice(second.label, facingMode) - scoreCameraDevice(first.label, facingMode)
    )[0];

    preferredCameraIdsRef.current[facingMode] = fallbackDevice?.deviceId ?? null;

    return fallbackDevice?.deviceId ?? null;
  };

  const getCameraDeviceIdForZoomLevel = async (level: number, facingMode: 'user' | 'environment') => {
    if (facingMode !== 'environment') {
      return getPreferredCameraDeviceId(facingMode);
    }

    await getPreferredCameraDeviceId('environment');

    const inspections = cameraInspectionsRef.current.environment;
    const clampedLevel = Math.max(0, Math.min(4, level));

    // Helper: best widest available 9:16-capable lens (auto portrait fallback).
    const pickWidestPortraitLens = (): string | null => {
      if (!inspections.length) return preferredCameraIdsRef.current.environment;
      const portraitCapable = inspections.filter(
        (i) =>
          // Native portrait sensor reading OR a wide/ultraWide lens we trust for 9:16.
          (typeof i.nativeWidth === 'number' &&
            typeof i.nativeHeight === 'number' &&
            i.nativeHeight >= i.nativeWidth) ||
          i.lensRole === 'ultraWide' ||
          i.lensRole === 'wide' ||
          i.lensRole === 'rear',
      );
      const pool = portraitCapable.length ? portraitCapable : inspections;
      const sorted = [...pool].sort((a, b) => {
        const minA = a.minZoom ?? 1;
        const minB = b.minZoom ?? 1;
        if (minA !== minB) return minA - minB; // smaller min zoom => wider
        return b.score - a.score;
      });
      return sorted[0]?.deviceId ?? preferredCameraIdsRef.current.environment;
    };

    const calibratedDeviceId = cameraCalibrationRef.current?.zoomLevels[clampedLevel]?.deviceId;
    const calibratedAvailable =
      calibratedDeviceId &&
      inspections.some((i) => i.deviceId === calibratedDeviceId);

    if (calibratedAvailable) {
      return calibratedDeviceId;
    }

    if (!inspections.length) {
      return preferredCameraIdsRef.current.environment;
    }

    const rolePriority: CameraLensRole[] =
      clampedLevel >= 3
        ? ['ultraWide', 'wide', 'rear']
        : clampedLevel === 2
          ? ['wide', 'rear', 'ultraWide']
          : clampedLevel === 1
            ? ['wide', 'rear', 'telephoto']
            : ['telephoto', 'wide', 'rear'];

    for (const role of rolePriority) {
      const match = inspections.find((inspection) => inspection.lensRole === role);
      if (match) {
        return match.deviceId;
      }
    }

    // Final automatic portrait fallback: the widest 9:16-capable lens we have.
    return pickWidestPortraitLens();
  };

  const applyZoomLevel = async (
    videoTrack: MediaStreamTrack,
    level: number, // 0-4, where 4 = widest
    facingMode: 'user' | 'environment' = currentFacingMode,
  ) => {
    try {
      const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & {
        zoom?: { min?: number; max?: number };
      };

      if (!capabilities?.zoom || typeof capabilities.zoom.min !== 'number') {
        return;
      }

      const hardwareMin = capabilities.zoom.min;
      const hardwareMax = capabilities.zoom.max ?? hardwareMin;
      const clampedLevel = Math.max(0, Math.min(4, level));
      const calibratedZoom = facingMode === 'environment'
        ? cameraCalibrationRef.current?.zoomLevels[clampedLevel]?.zoom
        : undefined;
      const targetZoom = calibratedZoom ?? getZoomValueForLevel(clampedLevel, facingMode, hardwareMin, hardwareMax);

      await videoTrack.applyConstraints({ advanced: [{ zoom: targetZoom }] } as any);
    } catch (error) {
      console.log('Zoom not supported:', error);
    }
  };

  const getCameraStream = async ({
    facingMode,
    withAudio,
  }: {
    facingMode: 'user' | 'environment';
    withAudio: boolean;
  }) => {
    const preferredDeviceId = null;
    const audioConstraints = withAudio
      ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : false;

    const mediaStream = await requestCameraStreamWithFallbacks({
      audioConstraints,
      facingMode,
      preferredDeviceId,
    });

    return mediaStream;
  };

  // Check and request permissions
  const checkPermissions = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        setPermissionStatus('prompt');
        return;
      }

      // Check if we're on HTTPS (required for camera access on mobile)
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      if (!isSecure) {
        setPermissionStatus('denied');
        toast({
          title: "Secure connection required",
          description: "Camera access requires HTTPS. Please use a secure connection.",
          variant: "destructive",
        });
        return;
      }

      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionStatus('denied');
        toast({
          title: "Camera not available",
          description: "Camera access is not available on this device.",
          variant: "destructive",
        });
        return;
      }

      // Try to check permission status via Permissions API (not all browsers support this)
      try {
        const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        
        if (cameraPermission.state === 'granted' && micPermission.state === 'granted') {
          setPermissionStatus('granted');
        } else if (cameraPermission.state === 'denied' || micPermission.state === 'denied') {
          setPermissionStatus('denied');
        } else {
          setPermissionStatus('prompt');
        }
      } catch {
        // Permissions API not supported, we'll try direct access
        setPermissionStatus('prompt');
      }
    } catch (error) {
      console.error('Permission check error:', error);
      setPermissionStatus('prompt');
    }
  };

  // Request all permissions with better error handling for mobile
  const requestAllPermissions = async () => {
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not available');
      }

      const mediaStream = await requestCameraStreamWithFallbacks({
        audioConstraints: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        facingMode: currentFacingMode,
        preferredDeviceId: null,
      });
      mediaStream.getTracks().forEach(track => track.stop());
      setPermissionStatus('granted');
      toast({
        title: "Permissions granted",
        description: "Camera and microphone access enabled!",
      });
      // Now start the preview camera
      startPreviewCamera();
    } catch (error: any) {
      console.error('Permission request error:', error);
      setPermissionStatus('denied');
      
      // Provide specific error messages based on the error type
      let errorMessage = "Please enable camera and microphone access.";
      let errorTitle = "Permission denied";
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorTitle = "Camera access blocked";
        errorMessage = Capacitor.isNativePlatform()
          ? "Camera permission was denied. Open your phone app settings, allow Camera and Microphone for Muv'it, then try again."
          : "Camera permission was denied. Allow Camera and Microphone, then try again.";
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorTitle = "No camera found";
        errorMessage = "No camera or microphone detected on your device.";
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorTitle = "Camera in use";
        errorMessage = "Your camera might be in use by another app. Close other apps using the camera and try again.";
      } else if (error.name === 'OverconstrainedError') {
        errorTitle = "Camera error";
        errorMessage = "This camera did not provide a portrait live feed. Please rotate the phone upright and try again.";
      } else if (error.name === 'SecurityError') {
        errorTitle = "Security error";
        errorMessage = "Camera access is not allowed on this connection.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Start camera for preview with better error handling for mobile
  const startPreviewCamera = async () => {
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionStatus('denied');
        toast({
          title: "Camera not available",
          description: "Camera access is not available on this device.",
          variant: "destructive",
        });
        return;
      }

      // Stop existing stream first
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      const mediaStream = await getCameraStream({
        facingMode: currentFacingMode,
        withAudio: false,
      });

      setStream(mediaStream);
      setPermissionStatus('granted');

      await attachStreamToVideoElement(previewVideoRef.current, mediaStream);
    } catch (error: any) {
      console.error('Camera preview error:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
        toast({
          title: "Camera access blocked",
          description: "Please allow camera access in your browser settings, then refresh the page.",
          variant: "destructive",
        });
      } else if (error.name === 'NotFoundError') {
        setPermissionStatus('denied');
        toast({
          title: "No camera found",
          description: "Could not detect a camera on this device.",
          variant: "destructive",
        });
      } else if (error.name === 'NotReadableError') {
        toast({
          title: "Camera in use",
          description: "Your camera may be in use by another app. Please close other apps and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Camera error",
          description: "Could not access camera. Please check your device settings.",
          variant: "destructive",
        });
      }
    }
  };

  // Check permissions on mount and start camera preview when setup step is shown
  useEffect(() => {
    if (isOpen) {
      checkPermissions();
    }
    if (step === 'setup' && isOpen && !stream) {
      startPreviewCamera();
    }
  }, [step, isOpen]);

  const startActualLive = async () => {
    try {
      const previewVideoTrack = stream?.getVideoTracks()[0] ?? null;
      let microphoneStream: MediaStream | null = null;
      try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (micError) {
        console.warn('Microphone unavailable, starting live without audio:', micError);
        toast({
          title: 'Microphone unavailable',
          description: 'Starting live with camera only. Check microphone permission for sound.',
        });
      }

      let liveVideoTrack = previewVideoTrack;

      if (!liveVideoTrack) {
        const fallbackCameraStream = await getCameraStream({
          facingMode: currentFacingMode,
          withAudio: false,
        });

        liveVideoTrack = fallbackCameraStream.getVideoTracks()[0] ?? null;
      }

      if (!liveVideoTrack) {
        microphoneStream?.getTracks().forEach((track) => track.stop());
        throw new Error('No video track available for live stream');
      }

      await enforcePortraitTrackConstraints(liveVideoTrack);

      const mediaStream = new MediaStream([
        liveVideoTrack,
        ...(microphoneStream?.getAudioTracks() ?? []),
      ]);

      // Create live stream record in database
      const sessionId = `live_${authUser!.id}_${Date.now()}`;
      const streamTitle = liveTitle.trim() || `${currentUser?.displayName || 'Muvit user'} is live`;

      const { error } = await supabase
        .from('live_streams')
        .insert({
          user_id: authUser!.id,
          title: streamTitle,
          description: liveDescription.trim() || null,
          session_id: sessionId,
          is_active: true,
          status: 'live',
          last_heartbeat_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error creating live stream:', error);
        throw error;
      }

      setLiveSessionId(sessionId);
      setStream(mediaStream);
      setStep('live');
      setIsLive(true);
      setLiveStartTime(new Date());

      // Start recording after the live session is already active so recording
      // support can never block the stream from starting.
      try {
        if (!isMobile && 'MediaRecorder' in window) {
          let mimeType = 'video/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/mp4';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = '';
            }
          }

          const options = mimeType ? { mimeType } : undefined;
          const mediaRecorder = new MediaRecorder(mediaStream, options);
          mediaRecorderRef.current = mediaRecorder;
          recordedChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.start(3000);
        }
      } catch (recordingErr) {
        console.warn('Live recording disabled for this device:', recordingErr);
      }

      // Notify followers in-app that this user just went live (respects each follower's `live_alerts` preference)
      try {
      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', authUser!.id)
        .limit(500);
        const followerIds = (followers ?? []).map((f: { follower_id: string }) => f.follower_id);
        if (followerIds.length > 0) {
          // Exclude followers who disabled live alerts
          const { data: optedOut } = await supabase
            .from('notification_preferences')
            .select('user_id')
            .in('user_id', followerIds)
            .eq('live_alerts', false);
          const optedOutSet = new Set((optedOut ?? []).map((p: { user_id: string }) => p.user_id));
          const allowedIds = followerIds.filter((id) => !optedOutSet.has(id));
          await Promise.allSettled(
            allowedIds.map((followerId) =>
              sendLiveStartNotification(followerId, authUser!.id, sessionId, streamTitle)
            )
          );
        }
      } catch (notifyErr) {
        console.error('Failed to notify followers about live:', notifyErr);
      }

      toast({
        title: "You're live!",
        description: "Real viewers will appear when they join your stream.",
      });
    } catch (error: any) {
      console.error('Camera access error:', error);
      toast({
        title: "Camera access required",
        description: "Please allow camera and microphone access to go live.",
        variant: "destructive",
      });
      setStep('setup');
      setIsLive(false);
      setLiveSessionId(null);
    }
  };

  const handleGoLive = async () => {
    if (isStartingLive) return;

    if (!authUser) {
      toast({
        title: "Sign in required",
        description: "Please sign in to go live.",
        variant: "destructive",
      });
      return;
    }

    setIsStartingLive(true);
    try {
      // Check for existing active live streams from this user and end them
      const { data: existingLives } = await supabase
        .from('live_streams')
        .select('id, session_id')
        .eq('user_id', authUser.id)
        .eq('is_active', true);

      if (existingLives && existingLives.length > 0) {
        await supabase
          .from('live_streams')
          .update({ is_active: false, ended_at: new Date().toISOString() })
          .eq('user_id', authUser.id)
          .eq('is_active', true);
      }

      await startActualLive();
    } finally {
      setIsStartingLive(false);
    }
  };

  const handleEndLive = async () => {
    // Broadcast live-ended event to all viewers FIRST
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'live-ended', payload: {} });
      // Small delay to ensure broadcast is sent before cleanup
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Stop recording
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    // Clean up realtime channel
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Mark live stream as ended in database
    if (liveSessionId) {
      await supabase
        .from('live_streams')
        .update({ 
          is_active: false, 
          status: 'ended',
          ended_at: new Date().toISOString(),
          viewer_count: viewerCount,
          likes_count: likeCount,
        })
        .eq('session_id', liveSessionId);
    }

    // Persist a "stream_ended" alert in followers' notifications (respects live_alerts pref)
    try {
      if (authUser) {
        const { data: followers } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', authUser.id)
          .limit(500);
        const followerIds = (followers ?? []).map((f: { follower_id: string }) => f.follower_id);
        if (followerIds.length > 0) {
          const { data: optedOut } = await supabase
            .from('notification_preferences')
            .select('user_id')
            .in('user_id', followerIds)
            .eq('live_alerts', false);
          const optedOutSet = new Set((optedOut ?? []).map((p: { user_id: string }) => p.user_id));
          const allowedIds = followerIds.filter((id) => !optedOutSet.has(id));
          if (allowedIds.length > 0) {
            const rows = allowedIds.map((followerId) => ({
              user_id: followerId,
              from_user_id: authUser.id,
              type: 'stream_ended',
              message: `ended their live${liveTitle?.trim() ? `: ${liveTitle.trim()}` : ''}`,
            }));
            await supabase.from('notifications').insert(rows);
          }
        }
      }
    } catch (err) {
      console.error('Failed to persist stream_ended notifications:', err);
    }
    
    setStream(null);
    setIsLive(false);
    setShowAREffects(false);
    setShowFilters(false);
    setPinnedMsg(null);
    setGiftAnimation(null);
    recordedChunksRef.current = [];
    reachedMilestones.current.clear();
    setStep('ended');
    
    toast({
      title: "Live ended",
      description: "Your live stream has ended.",
    });
  };

  // Touch-to-toggle comments visibility (3s hold)
  const handleTouchStart = useCallback(() => {
    touchTimerRef.current = setTimeout(() => {
      setCommentsVisible(prev => !prev);
    }, 3000);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }, []);

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    recordedChunksRef.current = [];
    reachedMilestones.current.clear();
    setStep('setup');
    setLiveTitle('');
    setLiveDescription('');
    setComments([]);
    setAllComments([]); // Reset all comments history
    setViewers(new Map());
    setLikeCount(0);
    setLiveDuration(0);
    setLiveStartTime(null);
    setLiveSessionId(null);
    setPinnedMsg(null);
    setGiftAnimation(null);
    setGiftLeaderboard([]);
    setShowDeleteConfirm(false);
    setShowAREffects(false);
    setShowFilters(false);
    setCommentsVisible(true);
    setIsMuted(false);
    setIsCameraOn(true);
    setSelectedAREffect(0); // Reset AR effect
    setSelectedFilter(0); // Reset filter
    setCurrentFacingMode('user');
    onClose();
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOn(!isCameraOn);
    }
  };

  const flipCamera = async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    try {
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      const newStream = await getCameraStream({
        facingMode: newFacingMode,
        withAudio: step === 'live',
      });

      setStream(newStream);
      setCurrentFacingMode(newFacingMode);
      
      if (step === 'live' && liveVideoRef.current) {
        await attachStreamToVideoElement(liveVideoRef.current, newStream);
      } else if ((step === 'setup' || step === 'live') && previewVideoRef.current) {
        await attachStreamToVideoElement(previewVideoRef.current, newStream);
      }
      
      toast({
        title: "Camera switched",
        description: newFacingMode === 'user' ? "Front camera" : "Back camera",
      });
    } catch (error) {
      console.error('Error flipping camera:', error);
      toast({
        title: "Camera switch failed",
        description: "Could not switch camera. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLive = async () => {
    if (liveSessionId) {
      await supabase
        .from('live_streams')
        .delete()
        .eq('session_id', liveSessionId);
      
      toast({
        title: "Live deleted",
        description: "Your live stream has been removed.",
      });
    }
    setShowDeleteConfirm(false);
    handleClose();
  };

  const sendComment = () => {
    if (newComment.trim() && currentUser && channelRef.current) {
      const now = Date.now();
      if (now - lastCommentAtRef.current < 1200) {
        toast({ title: 'Slow down', description: 'Give the chat a moment before sending again.' });
        return;
      }
      lastCommentAtRef.current = now;

      const comment: Comment = {
        id: Date.now().toString(),
        username: currentUser.username,
        text: newComment.trim(),
        timestamp: new Date(),
        avatarUrl: currentUser.avatarUrl,
      };
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'comment',
        payload: comment,
      });

      if (liveSessionId && authUser) {
        supabase.from('live_comments').insert({
          live_id: liveSessionId,
          user_id: authUser.id,
          message: comment.text,
        }).then(({ error }) => {
          if (error) console.error('Failed to persist live comment:', error);
        });
      }
      
      // Store in both arrays for history scrolling
      setAllComments(prev => [...prev, comment]);
      setComments(prev => [...prev.slice(-20), comment]);
      setNewComment('');
      
      // Auto-scroll to latest
      setTimeout(() => {
        if (commentsContainerRef.current) {
          commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  // DESKTOP BLOCK - can only watch, not broadcast
  if (!isMobile && step === 'setup') {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-[360px] rounded-2xl p-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Monitor className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold">Mobile Only</h2>
            <p className="text-sm text-muted-foreground">
              Going live is only available on mobile devices. Please use your phone to start a live stream.
            </p>
            <p className="text-xs text-muted-foreground">
              You can still watch live streams on desktop.
            </p>
            <Button variant="outline" className="w-full rounded-xl" onClick={handleClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // SETUP SCREEN
  if (step === 'setup') {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="fixed inset-0 !left-0 !top-0 h-[100dvh] w-screen max-w-none !translate-x-0 !translate-y-0 !transform-none !animate-none rounded-none border-0 bg-black p-0 !duration-0">
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
            <div className={cameraStageClassName} style={portraitStageStyle}>
              <div className="absolute inset-0" style={{ filter: BEAUTY_FILTERS[selectedFilter].class }}>
                {stream ? (
                  <>
                    <div className="absolute inset-0 overflow-hidden">
                      <div style={cameraViewportStyle}>
                        {showCameraBackdrop && (
                          <video
                            ref={setupBackdropRef}
                            autoPlay
                            playsInline
                            muted
                            webkit-playsinline="true"
                            aria-hidden="true"
                            style={cameraBackdropStyle}
                          />
                        )}
                        <video
                          ref={previewVideoRef}
                          autoPlay
                          playsInline
                          muted
                          webkit-playsinline="true"
                          className="w-full h-full object-contain"
                          style={cameraVideoStyle}
                        />
                      </div>
                    </div>
                    {/* AR Effect Overlay */}
                    {AR_EFFECTS[selectedAREffect].overlay && (
                      <div className="absolute inset-0 flex items-start justify-center pt-8 pointer-events-none">
                        <span className="text-6xl animate-bounce drop-shadow-lg">
                          {AR_EFFECTS[selectedAREffect].overlay}
                        </span>
                      </div>
                    )}
                  </>
                ) : permissionStatus === 'denied' ? (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900/20 to-red-950/30">
                    <div className="text-center px-4">
                      <Camera className="w-10 h-10 text-red-400 mx-auto mb-2" />
                      <p className="text-base font-semibold mb-1 text-red-400">Permission Denied</p>
                      <p className="text-white/60 text-xs mb-2">Camera access was blocked</p>
                      <p className="text-xs text-white/50">Please enable it in your browser settings:</p>
                      <p className="text-xs text-pink-400 mt-1">Settings → Privacy → Camera & Microphone</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3"
                        onClick={requestAllPermissions}
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-900/10 to-purple-900/10">
                    <div className="text-center px-4">
                      <div className="relative">
                        <Camera className="w-12 h-12 text-pink-500 mx-auto mb-3" />
                        <Mic className="w-6 h-6 text-purple-500 absolute -right-1 -bottom-1" />
                      </div>
                      <p className="text-base font-semibold mb-1 text-white">Enable Camera & Mic</p>
                      <p className="text-white/60 text-xs mb-3">Allow access to go live with your followers</p>
                      <Button 
                        className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                        onClick={requestAllPermissions}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Allow Permissions
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 pointer-events-none" />

              <div className="absolute top-0 left-0 right-0 z-10 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white">Go Live</h2>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full w-8 h-8" onClick={handleClose}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <Input
                  placeholder="Add a title for your live..."
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  className="rounded-xl text-sm bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
                <Input
                  placeholder="Optional description..."
                  value={liveDescription}
                  onChange={(e) => setLiveDescription(e.target.value)}
                  className="mt-2 rounded-xl text-sm bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />

                {stream && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                      <Radio className="w-3 h-3 text-pink-500" />
                      <span className="text-white text-xs font-medium">Preview</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 rounded-full w-8 h-8 ${showAREffects ? 'ring-2 ring-pink-400' : ''}`}
                        onClick={() => { setShowAREffects(!showAREffects); setShowFilters(false); }}
                      >
                        <span className="text-sm">🎭</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 rounded-full w-8 h-8 ${showFilters ? 'ring-2 ring-pink-400' : ''}`}
                        onClick={() => { setShowFilters(!showFilters); setShowAREffects(false); }}
                      >
                        <Sparkles className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 rounded-full w-8 h-8"
                        onClick={flipCamera}
                      >
                        <SwitchCamera className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {stream && showAREffects && (
                <div className="absolute bottom-24 left-2 right-2 z-10 bg-black/70 backdrop-blur-md rounded-xl p-2">
                  <p className="text-white text-xs font-medium mb-2 text-center">🎭 AR Effects</p>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {AR_EFFECTS.map((effect, index) => (
                      <button
                        key={effect.name}
                        onClick={() => setSelectedAREffect(index)}
                        className={`flex flex-col items-center min-w-[48px] p-1.5 rounded-lg transition-all ${
                          selectedAREffect === index
                            ? 'bg-pink-500/50 ring-1 ring-pink-400'
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        <span className="text-lg">{effect.emoji}</span>
                        <span className="text-[10px] text-white/80">{effect.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {stream && showFilters && (
                <div className="absolute bottom-24 left-2 right-2 z-10 bg-black/70 backdrop-blur-md rounded-xl p-2">
                  <p className="text-white text-xs font-medium mb-2 text-center">✨ Beauty Filters</p>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {BEAUTY_FILTERS.map((filter, index) => (
                      <button
                        key={filter.name}
                        onClick={() => setSelectedFilter(index)}
                        className={`flex flex-col items-center min-w-[48px] p-1.5 rounded-lg transition-all ${
                          selectedFilter === index
                            ? 'bg-pink-500/50 ring-1 ring-pink-400'
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        <span className="text-lg">{filter.icon}</span>
                        <span className="text-[10px] text-white/80">{filter.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 z-10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] space-y-2 bg-gradient-to-t from-black via-black/85 to-transparent">
                <Button 
                  className="w-full rounded-xl bg-pink-500 hover:bg-pink-600 h-10"
                  onClick={handleGoLive}
                  disabled={isStartingLive}
                >
                  <Radio className="w-4 h-4 mr-2" />
                  {isStartingLive ? 'Starting live...' : 'Go Live'}
                </Button>
                
                <Button 
                  variant="outline"
                  className="w-full rounded-xl h-9 border-white/20 text-white hover:bg-white/10"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ENDED SCREEN
  if (step === 'ended') {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="w-[90vw] max-w-[360px] rounded-2xl bg-gradient-to-br from-background via-background to-pink-500/5 border-pink-500/20 p-4">
          <div className="relative">
            <div className="absolute -top-2 -right-2 w-16 h-16 bg-pink-500/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-purple-500/20 rounded-full blur-xl" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                    <Radio className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-lg font-bold">Live Ended</h2>
                </div>
              </div>

              <div className="space-y-4">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 rounded-xl p-3 text-center border border-pink-500/20">
                    <div className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                      {viewerCount}
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Peak Viewers</span>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 rounded-xl p-3 text-center border border-red-500/20">
                    <div className="text-2xl font-bold text-red-500 flex items-center justify-center gap-1">
                      <Heart className="w-5 h-5 fill-red-500" />
                      {likeCount}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Likes</span>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl p-3 text-center border border-blue-500/20">
                    <div className="text-2xl font-bold text-blue-500 flex items-center justify-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      {comments.length}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Comments</span>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl p-3 text-center border border-purple-500/20">
                    <div className="text-2xl font-bold text-purple-500">
                      {formatDuration(liveDuration)}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Duration</span>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-xl p-2 text-center">
                  <p className="text-xs text-muted-foreground">Stream title</p>
                  <p className="font-medium text-sm truncate">{liveTitle}</p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 h-10"
                    onClick={handleClose}
                  >
                    Done
                  </Button>
                  <Button 
                    variant="outline"
                    className="rounded-xl h-10 border-red-500/50 text-red-500 hover:bg-red-500/10"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>

                {showDeleteConfirm && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 space-y-2">
                    <p className="text-sm text-center">Delete this live stream permanently?</p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        className="flex-1 h-8 text-sm"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        className="flex-1 h-8 text-sm bg-red-500 hover:bg-red-600"
                        onClick={handleDeleteLive}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // LIVE SCREEN
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="fixed inset-0 !left-0 !top-0 h-[100dvh] w-screen max-w-none !translate-x-0 !translate-y-0 !transform-none !animate-none rounded-none border-0 bg-black p-0 !duration-0">
        <div 
          className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
        >
          <div className={cameraStageClassName} style={portraitStageStyle}>
            {/* Confetti Burst for milestones */}
            <ConfettiBurst trigger={confettiTrigger} milestone={currentMilestone} />

            {/* Video Preview - centered portrait stage */}
            <div 
              className="absolute inset-0"
              style={{ filter: BEAUTY_FILTERS[selectedFilter].class }}
            >
              <div className="absolute inset-0 overflow-hidden bg-black">
                <div style={cameraViewportStyle}>
                  {showCameraBackdrop && (
                    <video
                      ref={liveBackdropRef}
                      autoPlay
                      playsInline
                      muted
                      aria-hidden="true"
                      style={cameraBackdropStyle}
                    />
                  )}
                  <video
                    ref={liveVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                    style={cameraVideoStyle}
                  />
                </div>
              </div>
              {AR_EFFECTS[selectedAREffect].overlay && (
                <div className="absolute inset-0 flex items-start justify-center pt-16 pointer-events-none">
                  <span className="text-5xl animate-bounce drop-shadow-lg">
                    {AR_EFFECTS[selectedAREffect].overlay}
                  </span>
                </div>
              )}
            </div>

            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

            {/* Top Bar - compact */}
            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/50 to-transparent z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <div className="absolute inset-0 bg-pink-500 rounded-full blur-md opacity-50 animate-pulse" />
                  <div className="relative bg-gradient-to-r from-pink-500 to-red-500 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-xs font-bold">LIVE</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
                  <Users className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-medium">{viewerCount}</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
                  <span className="text-white text-xs font-medium">{formatDuration(liveDuration)}</span>
                </div>
              </div>
              
              <Button
                className="bg-red-500 hover:bg-red-600 text-white rounded-full px-3 h-8 flex items-center gap-1.5 font-semibold text-xs"
                onClick={handleEndLive}
              >
                <Power className="w-3.5 h-3.5" />
                End
              </Button>
            </div>
            
            <div className="mt-2 bg-white/5 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/5">
              <p className="text-white font-medium text-sm truncate">{liveTitle}</p>
            </div>
          </div>

            {/* Viewer avatars */}
            {viewerCount > 0 && (
              <div className="absolute top-24 left-3 flex -space-x-1.5 z-10">
              {Array.from(viewers.values()).slice(0, 5).map((viewer, idx) => (
                <div
                  key={viewer.oderId}
                  className="w-7 h-7 rounded-full border-2 border-pink-500/50 bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center overflow-hidden shadow-lg"
                  style={{ zIndex: 5 - idx }}
                >
                  {viewer.avatarUrl ? (
                    <img src={viewer.avatarUrl} alt={viewer.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-[10px] font-bold">{viewer.username[0]?.toUpperCase()}</span>
                  )}
                </div>
              ))}
              {viewerCount > 5 && (
                <div className="w-7 h-7 rounded-full border-2 border-white/20 bg-black/70 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">+{viewerCount - 5}</span>
                </div>
              )}
              </div>
            )}

            {/* Comments Section - toggleable via long press */}
            {commentsVisible && (
              <div 
                ref={commentsContainerRef}
                className="absolute bottom-32 left-0 right-16 max-h-40 overflow-y-auto px-3 scrollbar-hide"
                style={{ scrollBehavior: 'smooth' }}
              >
                {allComments.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10">
                    <span className="text-white/70 text-xs">✨ Waiting for viewers...</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {allComments.map((comment) => (
                      <div 
                        key={comment.id} 
                        className="bg-white/10 backdrop-blur-md rounded-xl px-2.5 py-1.5 border border-white/5 flex items-start gap-1.5"
                      >
                        {comment.avatarUrl ? (
                          <img src={comment.avatarUrl} alt="" className="w-5 h-5 rounded-full border border-white/20 flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-[8px] font-bold">{comment.username[0]?.toUpperCase()}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-pink-400 font-semibold text-[11px]">@{comment.username} </span>
                          <span className="text-white/90 text-xs break-words">{comment.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pinned Message */}
            {pinnedMsg && (
              <div className="absolute top-[6.5rem] left-0 right-0 z-10">
                <PinnedMessage
                  username={pinnedMsg.username}
                  content={pinnedMsg.content}
                  canUnpin={true}
                  onUnpin={() => {
                    setPinnedMsg(null);
                    channelRef.current?.send({ type: 'broadcast', event: 'unpin', payload: {} });
                  }}
                />
              </div>
            )}

            <GiftAnimation trigger={giftAnimation} />

            {giftLeaderboard.length > 0 && (
              <div className="absolute top-[6.5rem] left-3 right-3 z-10 flex justify-center">
                <GiftLeaderboard entries={giftLeaderboard} />
              </div>
            )}

            <FloatingHearts trigger={likeTrigger} />

            {/* Bottom Controls - compact, no comment input for broadcaster */}
            <div className="absolute bottom-0 left-0 right-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/80 to-transparent">
            {/* Control Buttons - smaller */}
            <div className="flex items-center justify-center gap-2.5">
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full w-10 h-10 backdrop-blur-md border border-white/10 transition-all ${isMuted ? 'bg-red-500/80 hover:bg-red-600/80' : 'bg-white/10 hover:bg-white/20'}`}
                onClick={toggleMute}
              >
                {isMuted ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full w-10 h-10 backdrop-blur-md border border-white/10 transition-all ${!isCameraOn ? 'bg-red-500/80 hover:bg-red-600/80' : 'bg-white/10 hover:bg-white/20'}`}
                onClick={toggleCamera}
              >
                {isCameraOn ? <Camera className="w-4 h-4 text-white" /> : <CameraOff className="w-4 h-4 text-white" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10"
                onClick={flipCamera}
              >
                <SwitchCamera className="w-4 h-4 text-white" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full w-10 h-10 backdrop-blur-md border border-white/10 transition-all ${showAREffects ? 'bg-pink-500/50 ring-2 ring-pink-400' : 'bg-white/10 hover:bg-white/20'}`}
                onClick={() => { setShowAREffects(!showAREffects); setShowFilters(false); }}
              >
                <span className="text-base">🎭</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full w-10 h-10 backdrop-blur-md border border-white/10 transition-all ${showFilters ? 'bg-pink-500/50 ring-2 ring-pink-400' : 'bg-white/10 hover:bg-white/20'}`}
                onClick={() => { setShowFilters(!showFilters); setShowAREffects(false); }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </Button>
            </div>
            
            {/* AR Effects Panel */}
            {showAREffects && (
              <div className="mt-2 bg-black/70 backdrop-blur-md rounded-xl p-2">
                <p className="text-white text-[10px] font-medium mb-1.5 text-center">🎭 AR Effects</p>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {AR_EFFECTS.map((effect, index) => (
                    <button
                      key={effect.name}
                      onClick={() => setSelectedAREffect(index)}
                      className={`flex flex-col items-center min-w-[40px] p-1 rounded-lg transition-all ${
                        selectedAREffect === index 
                          ? 'bg-pink-500/50 ring-1 ring-pink-400' 
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <span className="text-sm">{effect.emoji}</span>
                      <span className="text-[8px] text-white/80">{effect.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Beauty Filters Panel */}
            {showFilters && (
              <div className="mt-2 bg-black/70 backdrop-blur-md rounded-xl p-2">
                <p className="text-white text-[10px] font-medium mb-1.5 text-center">✨ Beauty Filters</p>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {BEAUTY_FILTERS.map((filter, index) => (
                    <button
                      key={filter.name}
                      onClick={() => setSelectedFilter(index)}
                      className={`flex flex-col items-center min-w-[40px] p-1 rounded-lg transition-all ${
                        selectedFilter === index 
                          ? 'bg-pink-500/50 ring-1 ring-pink-400' 
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <span className="text-sm">{filter.icon}</span>
                      <span className="text-[8px] text-white/80">{filter.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoLiveModal;
