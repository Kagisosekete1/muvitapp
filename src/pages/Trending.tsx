import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Flame, Eye, Heart, Share2, Loader2, X, Clock, Play, Video } from 'lucide-react';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { BottomNavigation } from '@/components/BottomNavigation';
import VideoThumbnail from '@/components/ui/VideoThumbnail';
import ReelCard from '@/components/ui/ReelCard';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefresh';
import { useContinueWatching } from '@/hooks/useContinueWatching';

interface TrendingReel {
  id: string;
  title: string;
  description?: string | null;
  video_url: string;
  thumbnail_url: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  user_id: string;
  engagement_score: number;
  profile?: {
    id?: string;
    username: string;
    display_name?: string;
    avatar_url: string | null;
    verified?: boolean;
  };
}

const Trending = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser } = useUser();
  const [trendingReels, setTrendingReels] = useState<TrendingReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('tutorials');
  const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(null);
  const [currentViewerIndex, setCurrentViewerIndex] = useState(0);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const { continueWatching, getResumeTime } = useContinueWatching();

  const handleRefresh = useCallback(async () => {
    await fetchTrendingReels();
    if (authUser) await fetchFollowing();
  }, [authUser]);

  const { containerRef, pullDistance, isRefreshing, handlers } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  useEffect(() => {
    fetchTrendingReels();
    if (authUser) fetchFollowing();
  }, [authUser]);

  const fetchFollowing = async () => {
    if (!authUser) return;
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', authUser.id);

    if (data) {
      setFollowingIds(new Set(data.map(f => f.following_id)));
    }
  };

  const toggleFollow = async (targetUserId: string) => {
    if (!authUser) return;

    const isCurrentlyFollowing = followingIds.has(targetUserId);

    if (isCurrentlyFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', authUser.id)
        .eq('following_id', targetUserId);
      setFollowingIds(prev => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    } else {
      await supabase.from('follows').insert({
        follower_id: authUser.id,
        following_id: targetUserId,
      });
      setFollowingIds(prev => new Set([...prev, targetUserId]));
    }
  };

  const fetchTrendingReels = async () => {
    setLoading(true);
    try {
      // Prioritize reels from the last 24 hours for freshness
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      let { data: reelsData } = await supabase
        .from('reels')
        .select('*')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(50);

      // Fallback to recent reels if no 24h content
      if (!reelsData || reelsData.length < 5) {
        const { data: fallbackData } = await supabase
          .from('reels')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        reelsData = fallbackData;
      }

      if (reelsData && reelsData.length > 0) {
        const uniqueReels = Array.from(
          new Map(reelsData.map(r => [r.id, r])).values()
        );

        const userIds = [...new Set(uniqueReels.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, user_id, username, display_name, avatar_url, verified')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const reelsWithScore = uniqueReels.map(reel => {
          const views = reel.views_count || 0;
          const likes = reel.likes_count || 0;
          const comments = reel.comments_count || 0;
          const shares = reel.shares_count || 0;

          const engagementScore = views > 0
            ? ((likes + comments * 2 + shares * 3) / views) * 100 + (views / 100)
            : likes + comments * 2 + shares * 3;

          return {
            ...reel,
            engagement_score: engagementScore,
            profile: profileMap.get(reel.user_id),
          };
        });

        reelsWithScore.sort((a, b) => b.engagement_score - a.engagement_score);
        setTrendingReels(reelsWithScore);
      }
    } catch (error) {
      console.error('Error fetching trending reels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case 'home': navigate('/', { state: { from: location.pathname } }); break;
      case 'tutorials': navigate('/tutorials', { state: { from: location.pathname } }); break;
      case 'inbox': navigate('/inbox', { state: { from: location.pathname } }); break;
      case 'profile': navigate('/profile', { state: { from: location.pathname } }); break;
    }
  };

  const formatCount = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const handleReelClick = (index: number) => {
    setSelectedReelIndex(index);
    setCurrentViewerIndex(index);
  };

  const closeReelViewer = () => {
    setSelectedReelIndex(null);
  };

  // Handle scroll in reel viewer
  const handleViewerScroll = useCallback(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);

    if (newIndex !== currentViewerIndex && newIndex >= 0 && newIndex < trendingReels.length) {
      setCurrentViewerIndex(newIndex);
    }
  }, [currentViewerIndex, trendingReels.length]);

  // Scroll to initial reel when opening viewer (must be deterministic or audio/video mismatch happens)
  useEffect(() => {
    if (selectedReelIndex === null || !viewerContainerRef.current) return;

    const container = viewerContainerRef.current;

    // Sync viewer index with selected index
    setCurrentViewerIndex(selectedReelIndex);

    // Ensure DOM layout is settled before computing height/scrolling.
    // Using scrollTop avoids non-standard scrollTo behaviors (e.g. "instant").
    const t = window.setTimeout(() => {
      const itemHeight = container.clientHeight;
      container.scrollTop = selectedReelIndex * itemHeight;
    }, 0);

    return () => window.clearTimeout(t);
  }, [selectedReelIndex]);
  if (selectedReelIndex !== null) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-3 right-4 z-50 text-white bg-black/50 hover:bg-black/70 rounded-full"
          onClick={closeReelViewer}
        >
          <X className="w-5 h-5" />
        </Button>

        <div
          ref={viewerContainerRef}
          className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
          onScroll={handleViewerScroll}
        >
          {trendingReels.map((reel, index) => {
            const formattedReel = {
              id: reel.id,
              videoUrl: reel.video_url,
              thumbnailUrl: reel.thumbnail_url || '',
              title: reel.title,
              description: reel.description || '',
              user: {
                id: reel.user_id,
                profileId: reel.profile?.id || reel.user_id,
                username: reel.profile?.username || 'user',
                displayName: reel.profile?.display_name || reel.profile?.username || 'User',
                avatarUrl: reel.profile?.avatar_url || '',
                verified: reel.profile?.verified || false,
              },
              stats: {
                likes: reel.likes_count || 0,
                comments: reel.comments_count || 0,
                shares: reel.shares_count || 0,
                views: reel.views_count || 0,
              },
            };

            return (
              <div
                key={reel.id}
                className="h-full w-full snap-start snap-always"
                style={{ scrollSnapAlign: 'start' }}
              >
                <ReelCard
                  reel={formattedReel}
                  followingIds={followingIds}
                  toggleFollow={toggleFollow}
                  isActive={index === currentViewerIndex}
                  isOwner={authUser?.id === reel.user_id}
                  autoAdvance={false}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-background">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div
        ref={containerRef}
        className="pt-4 pb-20 h-full overflow-y-auto"
        {...handlers}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-bold">Trending Muv'z</h1>
          </div>
        </div>

        {/* Continue Watching Section */}
        {continueWatching.length > 0 && (
          <div className="px-4 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Continue Watching</h2>
            </div>
            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
              {continueWatching.map((item) => (
                <div 
                  key={item.reelId} 
                  className="flex-shrink-0 w-32 relative cursor-pointer group"
                  onClick={() => {
                    const index = trendingReels.findIndex(r => r.id === item.reelId);
                    if (index >= 0) {
                      handleReelClick(index);
                    }
                  }}
                >
                  <div className="relative aspect-[9/16] bg-secondary rounded-xl overflow-hidden">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <Video className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                      <div 
                        className="h-full bg-primary"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                  </div>
                  {item.profile && (
                    <div className="flex items-center space-x-1 mt-2">
                      <img 
                        src={item.profile.avatar_url || ''} 
                        alt={item.profile.username}
                        className="w-4 h-4 rounded-full"
                      />
                      <span className="text-xs text-muted-foreground truncate">@{item.profile.username}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="px-4 mb-6">
          <p className="text-muted-foreground text-sm">
            Muv'z ranked by engagement rate, views, and shares. Create viral content to appear here!
          </p>
        </div>

        {/* Stats Legend */}
        <div className="flex items-center gap-4 px-4 mb-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            <span>Views</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" />
            <span>Likes</span>
          </div>
          <div className="flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5" />
            <span>Shares</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span>Engagement</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : trendingReels.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Flame className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No trending Muv'z yet</p>
            <p className="text-muted-foreground text-sm">Be the first to go viral!</p>
          </div>
        ) : (
          <div className="px-4 space-y-4">
            {trendingReels.map((reel, index) => (
              <div
                key={reel.id}
                className="flex gap-3 p-3 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                onClick={() => handleReelClick(index)}
              >
                {/* Rank Badge */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-sm font-bold text-primary-foreground">#{index + 1}</span>
                </div>

                {/* Thumbnail */}
                <div className="flex-shrink-0 w-20 h-28 rounded-xl overflow-hidden">
                  <VideoThumbnail
                    videoUrl={reel.video_url}
                    thumbnailUrl={reel.thumbnail_url}
                    className="rounded-xl"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-1">
                  <p className="font-medium line-clamp-2 mb-1">{reel.title}</p>

                  {reel.profile && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <img
                        src={reel.profile.avatar_url || ''}
                        alt={reel.profile.username}
                        className="w-4 h-4 rounded-full"
                      />
                      <span className="text-xs text-muted-foreground">@{reel.profile.username}</span>
                      {reel.profile.verified && (
                        <VerifiedBadge size="sm" />
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>{formatCount(reel.views_count)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      <span>{formatCount(reel.likes_count)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Share2 className="w-3 h-3" />
                      <span>{formatCount(reel.shares_count)}</span>
                    </div>
                  </div>

                  {/* Engagement Score */}
                  <div className="flex items-center gap-1 mt-1.5">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    <span className="text-xs font-medium text-primary">
                      {reel.engagement_score.toFixed(1)}% engagement
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};

export default Trending;
