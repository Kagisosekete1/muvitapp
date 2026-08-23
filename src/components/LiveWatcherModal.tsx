import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Heart, Send, Users, Radio, Power, Gift, Pin, Coins, Timer, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { useAudio } from '@/contexts/AudioContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useLiveKitViewer } from '@/hooks/useLiveKitStream';
import FloatingHearts from '@/components/ui/FloatingHearts';
import ProfileLink from '@/components/ui/ProfileLink';
import GiftPanel, { GIFTS, type GiftDefinition } from '@/components/live/GiftPanel';
import GiftAnimation from '@/components/live/GiftAnimation';
import GiftLeaderboard from '@/components/live/GiftLeaderboard';
import PinnedMessage from '@/components/live/PinnedMessage';

interface LiveWatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveStream: {
    id: string;
    session_id: string;
    title: string;
    user_id: string;
    broadcaster?: {
      username: string;
      display_name: string;
      avatar_url: string | null;
    };
  };
}

interface Comment {
  id: string;
  username: string;
  text: string;
  timestamp: Date;
  avatarUrl?: string;
}

interface AnimatedGiftEvent {
  id: number;
  emoji: string;
  name: string;
  senderName: string;
  animation: string;
}

interface LeaderboardEntry {
  username: string;
  avatarUrl?: string;
  totalCoins: number;
}

const QUICK_EMOJIS = ['❤️', '🔥', '😍', '👏', '😂', '🎉', '💯', '🙌'];

const LiveWatcherModal: React.FC<LiveWatcherModalProps> = ({ isOpen, onClose, liveStream }) => {
  const { toast } = useToast();
  const { currentUser, authUser } = useUser();
  const { forceCleanupAll } = useAudio();
  const isMobile = useIsMobile();
  const [viewerCount, setViewerCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [likeTrigger, setLikeTrigger] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [hasLiked, setHasLiked] = useState(false);
  const [isEndingLive, setIsEndingLive] = useState(false);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);
  const [giftAnimation, setGiftAnimation] = useState<AnimatedGiftEvent | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<{ username: string; content: string } | null>(null);
  const [liveEnded, setLiveEnded] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [slowModeCooldown, setSlowModeCooldown] = useState(0);
  const [isFollower, setIsFollower] = useState(false);
  const [totalGiftCoins, setTotalGiftCoins] = useState(0);
  const [commentsVisible, setCommentsVisible] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const slowModeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedNotifiedRef = useRef(false);
  const lastCommentAtRef = useRef(0);

  const isOwner = !!authUser && authUser.id === liveStream.user_id;

  const notifyStreamEnded = useCallback(() => {
    if (endedNotifiedRef.current || isOwner) {
      setLiveEnded(true);
      return;
    }
    endedNotifiedRef.current = true;
    toast({
      title: 'Stream ended',
      description: `${liveStream.broadcaster?.display_name || 'The host'} ended the live.`,
    });
    setLiveEnded(true);
  }, [isOwner, liveStream.broadcaster?.display_name, toast]);
  const livekitIdentity = useMemo(
    () => authUser
      ? {
          id: authUser.id,
          name: currentUser?.displayName || authUser.email || authUser.id,
        }
      : null,
    [authUser?.email, authUser?.id, currentUser?.displayName],
  );
  const showBlurredBackdrop = false;
  const remoteVideoStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '100%',
    height: '100%',
    maxWidth: 'none',
    objectFit: 'contain',
    objectPosition: 'center center',
    transform: 'translate(-50%, -50%)',
    WebkitTransform: 'translate(-50%, -50%)',
    transformOrigin: 'center center',
    zIndex: 1,
    background: 'transparent',
  };
  const remoteBackdropStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    filter: 'blur(40px) saturate(140%)',
    WebkitFilter: 'blur(40px) saturate(140%)',
    transform: 'scale(1.15)',
    WebkitTransform: 'scale(1.15)',
    opacity: 0.55,
    pointerEvents: 'none',
    zIndex: 0,
  };

  // LiveKit viewer - connect to broadcaster's low-latency portrait video.
  const { remoteStream, connectionState } = useLiveKitViewer({
    roomName: isOpen && !isOwner ? liveStream.session_id : null,
    identity: livekitIdentity,
    enabled: isOpen && !isOwner && !!livekitIdentity,
  });

  const remoteBackdropRef = useRef<HTMLVideoElement>(null);

  // Attach remote stream to video element
  useEffect(() => {
    const playVideo = (video: HTMLVideoElement | null, muted: boolean) => {
      if (!remoteStream || !video) return;
      if (video.srcObject !== remoteStream) video.srcObject = remoteStream;
      video.muted = muted;
      video.playsInline = true;
      video.play().catch(console.log);
    };

    playVideo(remoteVideoRef.current, false);
    playVideo(remoteBackdropRef.current, true);
  }, [remoteStream]);

  useEffect(() => {
    if (!remoteStream || !isOpen || isOwner) return;

    const restartPlayback = () => {
      remoteVideoRef.current?.play().catch(console.log);
      remoteBackdropRef.current?.play().catch(console.log);
    };

    const interval = window.setInterval(() => {
      const video = remoteVideoRef.current;
      if (!video) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.paused) {
        restartPlayback();
      }
    }, 2500);

    const onStalled = () => restartPlayback();
    const video = remoteVideoRef.current;
    video?.addEventListener('stalled', onStalled);
    video?.addEventListener('waiting', onStalled);
    video?.addEventListener('pause', onStalled);

    return () => {
      window.clearInterval(interval);
      video?.removeEventListener('stalled', onStalled);
      video?.removeEventListener('waiting', onStalled);
      video?.removeEventListener('pause', onStalled);
    };
  }, [remoteStream, isOpen, isOwner]);

  // Mute background audio
  useEffect(() => {
    if (isOpen) forceCleanupAll();
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

  // Check if viewer is a follower of the broadcaster
  useEffect(() => {
    if (!isOpen || !authUser || isOwner) return;
    const checkFollow = async () => {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', authUser.id)
        .eq('following_id', liveStream.user_id)
        .maybeSingle();
      setIsFollower(!!data);
    };
    checkFollow();
  }, [isOpen, authUser?.id, liveStream.user_id, isOwner]);

  // Load coin balance
  useEffect(() => {
    if (!isOpen || !authUser) return;
    const loadCoins = async () => {
      const { data } = await supabase
        .from('user_coins')
        .select('balance')
        .eq('user_id', authUser.id)
        .maybeSingle();
      if (data) {
        setCoinBalance(data.balance);
      } else {
        await supabase.from('user_coins').insert({ user_id: authUser.id, balance: 1000 });
        setCoinBalance(1000);
      }
    };
    loadCoins();
  }, [isOpen, authUser?.id]);

  // Listen for live stream ending
  useEffect(() => {
    if (!isOpen) return;
    endedNotifiedRef.current = false;
    setLiveEnded(false);
  }, [isOpen, liveStream.session_id]);

  useEffect(() => {
    if (!isOpen || isOwner) return;
    const channel = supabase
      .channel(`live-end-watch:${liveStream.session_id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `session_id=eq.${liveStream.session_id}` },
        (payload) => {
          if (payload.new && (payload.new as any).is_active === false) {
            notifyStreamEnded();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOpen, liveStream.session_id, isOwner]);

  // Realtime channel for presence, chat, gifts, pins
  useEffect(() => {
    if (!isOpen || !liveStream.session_id || !authUser) return;

    const channel = supabase.channel(`live:${liveStream.session_id}`, {
      config: { presence: { key: authUser.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const rawCount = Object.keys(state).length;
        setViewerCount(isOwner ? Math.max(0, rawCount - 1) : rawCount);
      })
      .on('broadcast', { event: 'like' }, () => {
        setLikeCount(prev => prev + 1);
        setLikeTrigger(prev => prev + 1);
      })
      .on('broadcast', { event: 'comment' }, ({ payload }) => {
        setComments(prev => [...prev.slice(-50), payload as Comment]);
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .on('broadcast', { event: 'gift' }, ({ payload }) => {
        const g = payload as { senderName: string; emoji: string; name: string; animation: string; cost: number };
        setGiftAnimation({ id: Date.now(), ...g });
        setTotalGiftCoins(prev => prev + g.cost);
        // Update leaderboard
        setLeaderboard(prev => {
          const existing = prev.find(e => e.username === g.senderName);
          if (existing) {
            return prev.map(e => e.username === g.senderName ? { ...e, totalCoins: e.totalCoins + g.cost } : e)
              .sort((a, b) => b.totalCoins - a.totalCoins);
          }
          return [...prev, { username: g.senderName, totalCoins: g.cost }].sort((a, b) => b.totalCoins - a.totalCoins);
        });
      })
      .on('broadcast', { event: 'pin' }, ({ payload }) => {
        setPinnedMessage(payload as { username: string; content: string });
      })
      .on('broadcast', { event: 'unpin' }, () => {
        setPinnedMessage(null);
      })
      .on('broadcast', { event: 'slow-mode' }, ({ payload }) => {
        setSlowMode((payload as any).enabled);
      })
      .on('broadcast', { event: 'live-ended' }, () => {
        notifyStreamEnded();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            username: currentUser?.username || 'Anonymous',
            avatarUrl: currentUser?.avatarUrl,
            online_at: new Date().toISOString(),
          });
          if (!isOwner) {
            toast({
              title: 'Joined live',
              description: `You're watching ${liveStream.broadcaster?.display_name || 'this live'}`,
            });
          }
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [isOpen, liveStream.session_id, authUser?.id, isOwner]);

  // Slow mode cooldown timer
  useEffect(() => {
    if (slowModeCooldown > 0) {
      slowModeTimerRef.current = setInterval(() => {
        setSlowModeCooldown(prev => {
          if (prev <= 1) {
            if (slowModeTimerRef.current) clearInterval(slowModeTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (slowModeTimerRef.current) clearInterval(slowModeTimerRef.current); };
    }
  }, [slowModeCooldown]);

  // Anyone signed in can like, react with emojis, and comment.
  // Gifts remain restricted to followers via canSendGift below.
  const canInteract = !!authUser;
  const canSendGift = isOwner || isFollower;

  const handleLike = useCallback(() => {
    if (!channelRef.current || hasLiked || !canInteract) return;
    channelRef.current.send({ type: 'broadcast', event: 'like', payload: { userId: authUser?.id } });
    setHasLiked(true);
    setLikeCount(prev => prev + 1);
    setLikeTrigger(prev => prev + 1);
    setTimeout(() => setHasLiked(false), 2000);
  }, [hasLiked, authUser?.id, canInteract]);

  const handleEmojiClick = useCallback((emoji: string) => {
    if (!currentUser || !channelRef.current || !canInteract) return;
    if (slowMode && slowModeCooldown > 0 && !isOwner) {
      toast({ title: `Slow mode: wait ${slowModeCooldown}s` });
      return;
    }
    const comment: Comment = {
      id: Date.now().toString(),
      username: currentUser.username,
      text: emoji,
      timestamp: new Date(),
      avatarUrl: currentUser.avatarUrl,
    };
    channelRef.current.send({ type: 'broadcast', event: 'comment', payload: comment });
    if (authUser) {
      supabase.from('live_comments').insert({
        live_id: liveStream.session_id,
        user_id: authUser.id,
        message: emoji,
      }).then(({ error }) => {
        if (error) console.error('Failed to persist live reaction comment:', error);
      });
    }
    setComments(prev => [...prev.slice(-50), comment]);
    if (emoji === '❤️') handleLike();
    if (slowMode && !isOwner) setSlowModeCooldown(5);
  }, [currentUser, handleLike, canInteract, slowMode, slowModeCooldown, isOwner]);

  const sendComment = useCallback(() => {
    if (!newComment.trim() || !currentUser || !channelRef.current || !canInteract) return;
    if (slowMode && slowModeCooldown > 0 && !isOwner) {
      toast({ title: `Slow mode: wait ${slowModeCooldown}s` });
      return;
    }
    const now = Date.now();
    if (now - lastCommentAtRef.current < 1200 && !isOwner) {
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
    channelRef.current.send({ type: 'broadcast', event: 'comment', payload: comment });
    if (authUser) {
      supabase.from('live_comments').insert({
        live_id: liveStream.session_id,
        user_id: authUser.id,
        message: comment.text,
      }).then(({ error }) => {
        if (error) console.error('Failed to persist live comment:', error);
      });
    }
    setComments(prev => [...prev.slice(-50), comment]);
    setNewComment('');
    if (slowMode && !isOwner) setSlowModeCooldown(5);
  }, [newComment, currentUser, canInteract, slowMode, slowModeCooldown, isOwner, authUser?.id, liveStream.session_id, toast]);

  const handleSendGift = useCallback(async (gift: GiftDefinition) => {
    if (!authUser || !currentUser || !channelRef.current) return;
    if (!canSendGift) {
      toast({ title: 'Follow to send gifts', description: 'Only followers can send gifts.', variant: 'destructive' });
      return;
    }

    // Server-validated: send_live_gift RPC re-checks the gift exists in gift_catalog,
    // enforces the authoritative price, deducts coins atomically, and inserts the gift row.
    const { data, error } = await supabase.rpc('send_live_gift', {
      _session_id: liveStream.session_id,
      _gift_id: gift.id,
    });

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      const msg = error?.message || '';
      const isInsufficient = /insufficient/i.test(msg);
      const isInvalid = /invalid gift/i.test(msg);
      toast({
        title: isInsufficient ? 'Not enough coins' : isInvalid ? 'Gift unavailable' : 'Could not send gift',
        description: msg || 'Please try again in a moment.',
        variant: 'destructive',
      });
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const serverGift: GiftDefinition = {
      id: gift.id,
      name: row.gift_name,
      emoji: row.gift_emoji,
      cost: row.gift_cost,
      animation: row.gift_animation as GiftDefinition['animation'],
    };
    setCoinBalance(row.new_balance);

    channelRef.current.send({
      type: 'broadcast',
      event: 'gift',
      payload: {
        senderName: currentUser.username,
        emoji: serverGift.emoji,
        name: serverGift.name,
        animation: serverGift.animation,
        cost: serverGift.cost,
      },
    });

    setGiftAnimation({
      id: Date.now(),
      emoji: serverGift.emoji,
      name: serverGift.name,
      senderName: currentUser.username,
      animation: serverGift.animation,
    });

    setTotalGiftCoins(prev => prev + serverGift.cost);
    setLeaderboard(prev => {
      const existing = prev.find(e => e.username === currentUser.username);
      if (existing) {
        return prev.map(e => e.username === currentUser.username ? { ...e, totalCoins: e.totalCoins + serverGift.cost } : e)
          .sort((a, b) => b.totalCoins - a.totalCoins);
      }
      return [...prev, { username: currentUser.username, totalCoins: serverGift.cost }].sort((a, b) => b.totalCoins - a.totalCoins);
    });

    setShowGiftPanel(false);
    toast({ title: `${serverGift.emoji} ${serverGift.name} sent!` });
  }, [authUser, currentUser, liveStream, canSendGift]);

  const handlePinMessage = useCallback((comment: Comment) => {
    if (!isOwner || !channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'pin',
      payload: { username: comment.username, content: comment.text },
    });
    setPinnedMessage({ username: comment.username, content: comment.text });
  }, [isOwner]);

  const handleUnpin = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'unpin', payload: {} });
    setPinnedMessage(null);
  }, []);

  const toggleSlowMode = useCallback(() => {
    if (!isOwner || !channelRef.current) return;
    const newState = !slowMode;
    setSlowMode(newState);
    channelRef.current.send({ type: 'broadcast', event: 'slow-mode', payload: { enabled: newState } });
    toast({ title: newState ? '🐢 Slow mode ON (5s)' : '⚡ Slow mode OFF' });
  }, [isOwner, slowMode]);

  const handleClose = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    onClose();
  }, [onClose]);

  const handleEndLive = useCallback(async () => {
    if (!isOwner || !liveStream.session_id || isEndingLive) return;
    setIsEndingLive(true);
    try {
      // Broadcast live-ended event to all viewers
      channelRef.current?.send({ type: 'broadcast', event: 'live-ended', payload: {} });

      await supabase.from('live_streams').update({
        is_active: false,
        ended_at: new Date().toISOString(),
        viewer_count: viewerCount,
        likes_count: likeCount,
      }).eq('session_id', liveStream.session_id);
      toast({ title: 'Live ended' });
      handleClose();
    } catch {
      toast({ title: 'Failed to end live', variant: 'destructive' });
    } finally {
      setIsEndingLive(false);
    }
  }, [isOwner, liveStream.session_id, isEndingLive, viewerCount, likeCount, handleClose]);

  const hasVideo = !!remoteStream?.getVideoTracks().length;

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

  if (liveEnded && !isOwner) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="fixed inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 transform-none animate-none overflow-hidden rounded-none border-0 bg-black p-0 duration-0 lg:left-[50%] lg:top-[50%] lg:h-auto lg:w-full lg:max-w-[480px] lg:translate-x-[-50%] lg:translate-y-[-50%] lg:rounded-2xl">
          <div className="flex h-full w-full flex-col bg-black px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="flex flex-1 flex-col items-center justify-center">
              <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-destructive/10 flex items-center justify-center">
                <Power className="w-12 h-12 text-destructive" />
              </div>
              <h2 className="text-white text-2xl font-bold mb-2">Live Has Ended</h2>
              <p className="text-white/60 text-sm mb-1 text-center">
                {liveStream.broadcaster?.display_name || 'The broadcaster'} has ended this live stream.
              </p>
              <p className="text-white/40 text-xs mb-8 text-center">
                Thanks for watching! You can close this and find another live.
              </p>

              <div className="flex gap-3 w-full max-w-xs mb-6">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-pink-500 flex items-center justify-center gap-1">
                    <Heart className="w-4 h-4 fill-pink-500" />
                    {likeCount}
                  </div>
                  <span className="text-xs text-white/40">Likes</span>
                </div>
                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-yellow-500 flex items-center justify-center gap-1">
                    <Coins className="w-4 h-4" />
                    {totalGiftCoins}
                  </div>
                  <span className="text-xs text-white/40">Coins Gifted</span>
                </div>
              </div>

              {leaderboard.length > 0 && (
                <div className="w-full max-w-xs mb-6">
                  <p className="text-xs text-white/40 mb-2 flex items-center justify-center gap-1">
                    <Trophy className="w-3 h-3" /> Top Gifters
                  </p>
                  <GiftLeaderboard entries={leaderboard} />
                </div>
              )}
            </div>

            <div className="flex gap-3 w-full max-w-xs self-center">
              <Button variant="outline" className="flex-1 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 font-semibold" onClick={handleClose}>
                Close
              </Button>
              <Button className="flex-1 rounded-xl bg-primary hover:bg-primary/90 font-semibold" onClick={() => { handleClose(); window.location.href = '/live'; }}>
                Find Another Live
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="fixed inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 transform-none animate-none overflow-hidden rounded-none border-0 bg-black p-0 duration-0 lg:left-[50%] lg:top-[50%] lg:h-[90vh] lg:w-full lg:max-w-[420px] lg:translate-x-[-50%] lg:translate-y-[-50%] lg:rounded-2xl lg:flex lg:flex-row">
        {/* Main video + chat area */}
        <div 
          className="relative h-full bg-black flex flex-col lg:flex-1 lg:min-w-0"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
        >
          {/* Video Area */}
          <div
            className="flex-1 relative bg-gradient-to-br from-gray-900 to-black flex items-center justify-center overflow-hidden min-h-0 transform-none"
            style={{
              transform: 'none',
              WebkitTransform: 'none',
              filter: 'none',
              WebkitFilter: 'none',
              contain: 'layout paint size style',
              isolation: 'isolate',
            }}
          >
            {/* Remote LiveKit video */}
            {!isOwner && (
              <>
                {showBlurredBackdrop && (
                  <video
                    ref={remoteBackdropRef}
                    autoPlay
                    playsInline
                    muted
                    aria-hidden="true"
                    className={hasVideo ? 'opacity-100' : 'opacity-0'}
                    style={remoteBackdropStyle}
                  />
                )}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={hasVideo ? 'opacity-100' : 'opacity-0'}
                  style={remoteVideoStyle}
                />
              </>
            )}

            {/* Plain dark fallback while the LiveKit video track attaches. */}
            {(!hasVideo || isOwner) && (
              <div className="absolute inset-0 z-[1] bg-black" />
            )}

            {!hasVideo && !isOwner && (
              <div className="absolute bottom-28 left-4 right-4 z-10 rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-white/70 backdrop-blur-md">
                <p className="text-sm">
                  {connectionState === 'connecting' ? 'Connecting to live...' : 'Waiting for live video...'}
                </p>
              </div>
            )}

            {/* Top stats bar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-1.5">
                <div className="bg-pink-500 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Radio className="w-3 h-3 text-white animate-pulse" />
                  <span className="text-white text-xs font-semibold">LIVE</span>
                </div>
                <div className="bg-black/50 px-2 py-1 rounded-full flex items-center gap-1">
                  <Users className="w-3 h-3 text-white" />
                  <span className="text-white text-xs">{viewerCount}</span>
                </div>
                <div className="bg-black/50 px-2 py-1 rounded-full flex items-center gap-1">
                  <Heart className="w-3 h-3 text-white" />
                  <span className="text-white text-xs">{likeCount}</span>
                </div>
                {slowMode && (
                  <div className="bg-yellow-500/80 px-2 py-1 rounded-full flex items-center gap-1">
                    <Timer className="w-3 h-3 text-black" />
                    <span className="text-black text-xs font-medium">Slow</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {isOwner && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${slowMode ? 'bg-yellow-500/80 text-black' : 'bg-black/50 text-white'} hover:bg-yellow-500 rounded-full h-8 w-8 p-0`}
                      onClick={toggleSlowMode}
                      title="Toggle slow mode"
                    >
                      <Timer className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-red-500/80 text-white hover:bg-red-600 rounded-full h-8 w-8 p-0"
                      onClick={handleEndLive}
                      disabled={isEndingLive}
                    >
                      <Power className="w-4 h-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-black/50 text-white hover:bg-black/70 rounded-full h-8 w-8 p-0"
                  onClick={handleClose}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Stream Title */}
            <div className="absolute top-12 left-3 right-3 z-10">
              <p className="text-white font-medium text-sm text-center truncate">{liveStream.title}</p>
            </div>

            {/* Pinned Message */}
            {pinnedMessage && (
              <div className="absolute top-20 left-0 right-0 z-10">
                <PinnedMessage
                  username={pinnedMessage.username}
                  content={pinnedMessage.content}
                  canUnpin={isOwner}
                  onUnpin={handleUnpin}
                />
              </div>
            )}

            {/* Gift Animation */}
            <GiftAnimation trigger={giftAnimation} />

            {/* Floating Hearts */}
            <FloatingHearts trigger={likeTrigger} />
          </div>

          {/* Comments Section - toggleable via long press */}
          {commentsVisible && (
          <div className="h-36 lg:h-44 bg-black/95 px-3 py-2 overflow-hidden flex-shrink-0">
            <div className="space-y-1 max-h-full overflow-y-auto scrollbar-hide">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex items-start gap-1.5 animate-fade-in group"
                  onDoubleClick={() => handlePinMessage(comment)}
                >
                  <ProfileLink username={comment.username}>
                    <img
                      src={comment.avatarUrl || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop&crop=face'}
                      alt={comment.username}
                      className="w-5 h-5 rounded-full flex-shrink-0"
                    />
                  </ProfileLink>
                  <div className="flex-1 min-w-0">
                    <span className="text-pink-400 text-[11px] font-semibold">@{comment.username} </span>
                    <span className="text-white text-xs">{comment.text}</span>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handlePinMessage(comment)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white flex-shrink-0"
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>
          </div>
          )}


          <GiftPanel
            isOpen={showGiftPanel}
            onClose={() => setShowGiftPanel(false)}
            coinBalance={coinBalance}
            onSendGift={handleSendGift}
          />

          {/* Interaction Bar */}
          <div className="p-3 bg-black/90 flex-shrink-0">
            {/* Quick emoji reactions - only for followers */}
            {canInteract && (
              <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-hide">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 flex items-center justify-center text-sm transition-all hover:scale-110 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {!canInteract && !isOwner && (
              <p className="text-white/40 text-xs text-center mb-2">Sign in to chat and react</p>
            )}

            <div className="flex items-center gap-1.5">
              <Input
                placeholder={canInteract ? (slowModeCooldown > 0 ? `Wait ${slowModeCooldown}s...` : "Say something...") : "Sign in to chat..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                disabled={!canInteract || (slowMode && slowModeCooldown > 0 && !isOwner)}
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-full h-8 text-xs"
              />
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8" onClick={sendComment} disabled={!canInteract}>
                <Send className="w-3.5 h-3.5" />
              </Button>
              {!isOwner && canInteract && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-yellow-400 hover:bg-white/10 h-8 w-8 relative"
                  onClick={() => setShowGiftPanel(!showGiftPanel)}
                >
                  <Gift className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                    {coinBalance > 999 ? '1k' : coinBalance}
                  </span>
                </Button>
              )}
              {canInteract && (
                <Button
                  size="icon"
                  variant="ghost"
                  className={`${hasLiked ? 'text-pink-500' : 'text-white'} hover:bg-white/10 h-8 w-8`}
                  onClick={handleLike}
                >
                  <Heart className="w-4 h-4" fill={hasLiked ? 'currentColor' : 'none'} />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Gift leaderboard inline for desktop - compact */}
        {leaderboard.length > 0 && (
          <div className="hidden lg:block bg-background border-t border-border p-2 flex-shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <Trophy className="w-3 h-3 text-yellow-500 flex-shrink-0" />
              {leaderboard.slice(0, 3).map((entry, i) => (
                <span key={entry.username} className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} @{entry.username} ({entry.totalCoins})
                </span>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LiveWatcherModal;
