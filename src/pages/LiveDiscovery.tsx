import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation } from '@/components/BottomNavigation';
import DesktopSidebar from '@/components/DesktopSidebar';
import MobileViewWrapper from '@/components/MobileViewWrapper';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Radio, Users, RefreshCw } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CreateReelModal from '@/components/CreateReelModal';
import LiveWatcherModal from '@/components/LiveWatcherModal';
import { useIsMobile } from '@/hooks/use-mobile';

interface LiveStream {
  id: string;
  user_id: string;
  title: string;
  session_id: string;
  started_at: string;
  viewer_count: number;
  likes_count: number;
  broadcaster?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

const LiveDiscovery = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { authUser } = useUser();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('home');
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [followingLives, setFollowingLives] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [selectedLive, setSelectedLive] = useState<LiveStream | null>(null);
  const [desktopCurrentIndex, setDesktopCurrentIndex] = useState(0);
  const desktopContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLiveStreams();

    const channel = supabase
      .channel('live-discovery')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_streams' },
        () => {
          fetchLiveStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser]);

  const fetchLiveStreams = async () => {
    setLoading(true);
    try {
      const { data: streams, error } = await supabase
        .from('live_streams')
        .select('*')
        .eq('is_active', true)
        .order('started_at', { ascending: false });

      if (error) throw error;

      if (streams && streams.length > 0) {
        const userIds = [...new Set(streams.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        const streamsWithProfiles = streams.map(s => ({
          ...s,
          broadcaster: profileMap.get(s.user_id),
        }));

        setLiveStreams(streamsWithProfiles);

        if (authUser) {
          const { data: followingData } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', authUser.id);

          const followingIds = new Set(followingData?.map(f => f.following_id) || []);
          const following = streamsWithProfiles.filter(s => followingIds.has(s.user_id));
          setFollowingLives(following);
        }
      } else {
        setLiveStreams([]);
        setFollowingLives([]);
      }
    } catch (error) {
      console.error('Error fetching live streams:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const sessionId = new URLSearchParams(location.search).get('session');
    if (!sessionId || loading || selectedLive) return;

    const matchedLive = liveStreams.find((stream) => stream.session_id === sessionId);
    if (matchedLive) {
      setSelectedLive(matchedLive);
      return;
    }

    if (!loading && liveStreams.length >= 0) {
      const loadDeepLinkedLive = async () => {
        const { data: stream, error } = await supabase
          .from('live_streams')
          .select('*')
          .eq('session_id', sessionId)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error('Error loading live deep link:', error);
          return;
        }

        if (!stream) {
          toast({ title: 'Live ended', description: 'This live is no longer active.' });
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url')
          .eq('user_id', stream.user_id)
          .maybeSingle();

        setSelectedLive({ ...stream, broadcaster: profile || undefined });
      };

      loadDeepLinkedLive();
    }
  }, [location.search, loading, liveStreams, selectedLive, toast]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case 'home':
        navigate('/', { state: { from: location.pathname } });
        break;
      case 'tutorials':
        navigate('/tutorials', { state: { from: location.pathname } });
        break;
      case 'create':
        setIsCreateReelOpen(true);
        break;
      case 'inbox':
        navigate('/inbox', { state: { from: location.pathname } });
        break;
      case 'profile':
        navigate('/profile', { state: { from: location.pathname } });
        break;
    }
  };

  const handleWatchLive = (stream: LiveStream) => {
    if (!authUser) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to watch live streams',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }
    setSelectedLive(stream);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just started';
    if (diffMins < 60) return `${diffMins}m`;
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
  };

  const handleDesktopScroll = useCallback(() => {
    const container = desktopContainerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);
    if (newIndex !== desktopCurrentIndex && newIndex >= 0 && newIndex < liveStreams.length) {
      setDesktopCurrentIndex(newIndex);
    }
  }, [desktopCurrentIndex, liveStreams.length]);

  // Desktop reel-style live card
  const renderDesktopLiveCard = (stream: LiveStream, isActive: boolean) => (
    <div className="h-full w-full flex items-center justify-center bg-black relative">
      <div className="relative w-full max-w-[400px] h-full bg-gradient-to-br from-pink-500/20 to-purple-600/20 flex flex-col items-center justify-center">
        {/* Live badge */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
          <div className="bg-pink-500 px-4 py-1.5 rounded-full flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-white animate-pulse" />
            <span className="text-white text-sm font-bold">LIVE</span>
          </div>
          <div className="bg-black/50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Users className="w-3 h-3 text-white" />
            <span className="text-white text-sm">{stream.viewer_count}</span>
          </div>
        </div>
        
        {/* Broadcaster info */}
        <img
          src={stream.broadcaster?.avatar_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=120&h=120&fit=crop&crop=face'}
          alt={stream.broadcaster?.username}
          className="w-28 h-28 rounded-full border-4 border-pink-500 mb-4 object-cover"
        />
        <p className="text-white text-xl font-bold">{stream.broadcaster?.display_name}</p>
        <p className="text-white/60 text-sm mb-4">@{stream.broadcaster?.username}</p>
        <p className="text-white/80 text-base font-medium mb-6">{stream.title}</p>
        <p className="text-white/50 text-xs mb-6">{formatTime(stream.started_at)}</p>
        
        <Button 
          className="bg-pink-500 hover:bg-pink-600 text-white rounded-full px-8 py-3 text-base font-semibold"
          onClick={() => handleWatchLive(stream)}
        >
          <Radio className="w-4 h-4 mr-2" />
          Watch Live
        </Button>
      </div>
    </div>
  );

  const mobileContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(location.state?.from || '/')}
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Radio className="w-5 h-5 text-pink-500" />
          Live Now
        </h1>
        <Button variant="ghost" size="sm" onClick={fetchLiveStreams}>
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Following Lives Section */}
      {followingLives.length > 0 && (
        <div className="mb-6 px-4">
          <h2 className="text-lg font-semibold mb-3">Following</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {followingLives.map(stream => (
              <div
                key={stream.id}
                className="flex-shrink-0 w-40 cursor-pointer"
                onClick={() => handleWatchLive(stream)}
              >
                <div className="relative aspect-[9/16] bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl overflow-hidden">
                  {stream.broadcaster?.avatar_url && (
                    <img
                      src={stream.broadcaster.avatar_url}
                      alt={stream.broadcaster.username}
                      className="w-full h-full object-cover opacity-50"
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                    <div className="bg-pink-500 px-2 py-0.5 rounded-full flex items-center gap-1 mb-2">
                      <Radio className="w-2 h-2 text-white animate-pulse" />
                      <span className="text-white text-xs font-semibold">LIVE</span>
                    </div>
                    <img
                      src={stream.broadcaster?.avatar_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=80&h=80&fit=crop&crop=face'}
                      alt={stream.broadcaster?.username}
                      className="w-12 h-12 rounded-full border-2 border-white mb-2"
                    />
                    <p className="text-white text-xs font-medium text-center line-clamp-1">
                      @{stream.broadcaster?.username}
                    </p>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full">
                      <Users className="w-3 h-3 text-white" />
                      <span className="text-white text-xs">{stream.viewer_count}</span>
                    </div>
                    <span className="text-white/80 text-xs">{formatTime(stream.started_at)}</span>
                  </div>
                </div>
                <p className="text-sm font-medium mt-2 line-clamp-1">{stream.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Lives Section */}
      <div className="px-4">
        <h2 className="text-lg font-semibold mb-3">All Live Streams</h2>
        
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-[9/16] bg-secondary rounded-xl animate-pulse" />
            ))}
          </div>
        ) : liveStreams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-secondary/30 rounded-2xl">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
              <Radio className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-2">No one is live</h3>
            <p className="text-muted-foreground text-center text-sm mb-4 px-4">
              Be the first to go live!
            </p>
            <Button className="rounded-xl" onClick={() => setIsCreateReelOpen(true)}>
              <Radio className="w-4 h-4 mr-2" />
              Go Live
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {liveStreams.map(stream => (
              <div
                key={stream.id}
                className="cursor-pointer group"
                onClick={() => handleWatchLive(stream)}
              >
                <div className="relative aspect-[9/16] bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl overflow-hidden">
                  {stream.broadcaster?.avatar_url && (
                    <img
                      src={stream.broadcaster.avatar_url}
                      alt={stream.broadcaster.username}
                      className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform"
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                    <div className="bg-pink-500 px-2 py-0.5 rounded-full flex items-center gap-1 mb-2">
                      <Radio className="w-2 h-2 text-white animate-pulse" />
                      <span className="text-white text-xs font-semibold">LIVE</span>
                    </div>
                    <img
                      src={stream.broadcaster?.avatar_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=80&h=80&fit=crop&crop=face'}
                      alt={stream.broadcaster?.username}
                      className="w-12 h-12 rounded-full border-2 border-white mb-2"
                    />
                    <p className="text-white text-xs font-medium text-center line-clamp-1">
                      @{stream.broadcaster?.username}
                    </p>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full">
                      <Users className="w-3 h-3 text-white" />
                      <span className="text-white text-xs">{stream.viewer_count}</span>
                    </div>
                    <span className="text-white/80 text-xs">{formatTime(stream.started_at)}</span>
                  </div>
                </div>
                <p className="text-sm font-medium mt-2 line-clamp-1">{stream.title}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="lg:pl-[72px] xl:pl-[244px]">
        {/* Desktop: Reel-style vertical scroll layout */}
        <div className="hidden lg:block">
          <div className="min-h-[100dvh] bg-black flex items-center justify-center">
            <div className="w-[420px] h-[95vh] max-h-[920px] rounded-[2.5rem] border border-border/30 relative bg-black overflow-hidden">
              {/* Header overlay */}
              <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white bg-black/50 hover:bg-black/70 rounded-full"
                  onClick={() => navigate(location.state?.from || '/')}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-white font-bold flex items-center gap-2">
                  <Radio className="w-4 h-4 text-pink-500" />
                  Live Now
                </h1>
                <Button variant="ghost" size="sm" className="text-white bg-black/50 hover:bg-black/70 rounded-full" onClick={fetchLiveStreams}>
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" />
                </div>
              ) : liveStreams.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                    <Radio className="w-10 h-10 text-white/50" />
                  </div>
                  <h3 className="text-white text-lg font-semibold mb-2">No one is live</h3>
                  <p className="text-white/50 text-sm mb-4">Be the first to go live!</p>
                  <Button className="bg-pink-500 hover:bg-pink-600 rounded-full" onClick={() => setIsCreateReelOpen(true)}>
                    <Radio className="w-4 h-4 mr-2" />
                    Go Live
                  </Button>
                </div>
              ) : (
                <div 
                  ref={desktopContainerRef}
                  className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
                  onScroll={handleDesktopScroll}
                >
                  {liveStreams.map((stream, index) => (
                    <div 
                      key={stream.id} 
                      className="h-full w-full snap-start snap-always flex-shrink-0"
                    >
                      {renderDesktopLiveCard(stream, index === desktopCurrentIndex)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile: Original grid layout */}
        <div className="lg:hidden">
          <MobileViewWrapper>
            <div className="relative h-full overflow-hidden bg-background flex flex-col">
              <div className="pt-4 pb-20 flex-1 overflow-y-auto">
                {mobileContent}
              </div>
              <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
            </div>
          </MobileViewWrapper>
        </div>
      </div>
      
      <CreateReelModal isOpen={isCreateReelOpen} onClose={() => setIsCreateReelOpen(false)} />
      
      {selectedLive && (
        <LiveWatcherModal
          isOpen={!!selectedLive}
          onClose={() => setSelectedLive(null)}
          liveStream={selectedLive}
        />
      )}
    </div>
  );
};

export default LiveDiscovery;
