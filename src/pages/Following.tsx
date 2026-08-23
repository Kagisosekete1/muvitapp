import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import ReelCard from '@/components/ui/ReelCard';

interface ReelData {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  user_id: string;
  created_at: string;
  profile?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    verified: boolean;
  };
}

const BATCH_SIZE = 10;
const FOLLOWING_CACHE_PREFIX = 'muvit-following-reels';

const Following: React.FC = () => {
  const navigate = useNavigate();
  const { authUser } = useUser();
  const [reels, setReels] = useState<ReelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0);
  const cacheKey = authUser ? `${FOLLOWING_CACHE_PREFIX}:${authUser.id}` : '';

  useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return;
    }

    try {
      const cached = sessionStorage.getItem(`${FOLLOWING_CACHE_PREFIX}:${authUser.id}`);
      if (cached) {
        const cachedReels = JSON.parse(cached) as ReelData[];
        if (Array.isArray(cachedReels) && cachedReels.length > 0) {
          setReels(cachedReels);
          setLoading(false);
        }
      }
    } catch {
      sessionStorage.removeItem(`${FOLLOWING_CACHE_PREFIX}:${authUser.id}`);
    }

    fetchInitialFeed();
  }, [authUser]);

  // Realtime subscription for follows
  useEffect(() => {
    if (!authUser) return;

    const channel = supabase
      .channel('following-feed-follows')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${authUser.id}` },
        () => {
          fetchInitialFeed();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser]);

  const fetchFollowingIds = async () => {
    if (!authUser) return new Set<string>();

    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', authUser.id);

    const ids = new Set((follows || []).map(f => f.following_id));
    setFollowingIds(ids);
    return ids;
  };

  const fetchInitialFeed = async () => {
    const ids = await fetchFollowingIds();
    await fetchReels(true, ids);
  };

  const fetchReels = async (reset = false, idsOverride?: Set<string>) => {
    const ids = idsOverride ?? followingIds;
    if (!authUser || ids.size === 0) {
      if (reset) {
        setReels([]);
        setHasMore(false);
      }
      setLoading(false);
      return;
    }

    if (reset) {
      pageRef.current = 0;
      setHasMore(true);
    }

    const offset = pageRef.current * BATCH_SIZE;
    setLoadingMore(!reset);

    const { data: reelsData, error } = await supabase
      .from('reels')
      .select('*')
      .in('user_id', Array.from(ids))
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching following reels:', error);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    if (reelsData && reelsData.length > 0) {
      const userIds = [...new Set(reelsData.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, username, display_name, avatar_url, verified')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const reelsWithProfiles = reelsData.map(r => ({
        ...r,
        profile: profileMap.get(r.user_id)
      }));

      if (reset) {
        setReels(reelsWithProfiles as ReelData[]);
        if (cacheKey) {
          sessionStorage.setItem(cacheKey, JSON.stringify(reelsWithProfiles));
        }
      } else {
        setReels(prev => [...prev, ...reelsWithProfiles as ReelData[]]);
      }

      setHasMore(reelsData.length === BATCH_SIZE);
      pageRef.current += 1;
    } else {
      setHasMore(false);
      if (reset) setReels([]);
      if (reset && cacheKey) sessionStorage.removeItem(cacheKey);
    }

    setLoading(false);
    setLoadingMore(false);
  };

  const toggleFollow = async (targetUserId: string) => {
    if (!authUser || !targetUserId) return;

    const wasFollowing = followingIds.has(targetUserId);
    setFollowingIds(prev => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(targetUserId);
      else next.add(targetUserId);
      return next;
    });

    if (wasFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', authUser.id)
        .eq('following_id', targetUserId);
    } else {
      const { data: existing } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', authUser.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (!existing) {
        await supabase
          .from('follows')
          .insert({ follower_id: authUser.id, following_id: targetUserId });
      }
    }
  };

  // Intersection observer for infinite scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const last = entries[0];
        if (last?.isIntersecting && hasMore && !loadingMore) {
          fetchReels(false);
        }
      },
      { root: container, threshold: 0.1 }
    );

    const lastItem = container.querySelector('[data-reel-item="true"]:last-child');
    if (lastItem) observer.observe(lastItem);

    return () => observer.disconnect();
  }, [reels.length, hasMore, loadingMore]);

  // Active reel detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = Array.from(container.querySelectorAll<HTMLElement>('[data-reel-item="true"]'));
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];

        if (!best?.target) return;
        const idx = Number((best.target as HTMLElement).dataset.reelIndex);
        if (!Number.isFinite(idx)) return;
        setActiveReelIndex(prev => (prev === idx ? prev : idx));
      },
      { root: container, threshold: [0.6, 0.75, 0.9] }
    );

    items.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [reels.length]);

  const goToReel = useCallback((index: number) => {
    if (containerRef.current && index >= 0 && index < reels.length) {
      const itemHeight = containerRef.current.clientHeight;
      containerRef.current.scrollTo({ top: index * itemHeight, behavior: 'smooth' });
      setActiveReelIndex(index);
    }
  }, [reels.length]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const nextIndex = e.key === 'ArrowDown' ? activeReelIndex + 1 : activeReelIndex - 1;
      goToReel(nextIndex);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeReelIndex, goToReel]);

  if (!authUser) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black text-white p-8">
        <h2 className="text-xl font-semibold mb-4">Sign in to see your Following feed</h2>
        <Button onClick={() => navigate('/auth')}>Sign In</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center p-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-white font-semibold text-lg ml-2">Following</h1>
      </div>

      {reels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2 text-white">No reels from followed users</h2>
          <p className="text-white/60 text-center text-sm mb-4">Follow some creators to see their reels here!</p>
          <Button onClick={() => navigate('/')}>Discover Reels</Button>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide overscroll-none"
          style={{ scrollSnapStop: 'always' }}
        >
          {reels.map((reel, index) => (
            <div
              key={reel.id}
              className="relative h-full w-full snap-start snap-always"
              data-reel-item="true"
              data-reel-index={index}
              style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
            >
              <ReelCard
                reel={{
                  id: reel.id,
                  videoUrl: reel.video_url,
                  thumbnailUrl: reel.thumbnail_url || '',
                  title: reel.title,
                  description: reel.description || '',
                  user: {
                    id: reel.user_id,
                    profileId: reel.profile?.id || '',
                    username: reel.profile?.username || 'user',
                    displayName: reel.profile?.display_name || 'User',
                    avatarUrl: reel.profile?.avatar_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=120&h=120&fit=crop&crop=face',
                    verified: reel.profile?.verified || false,
                  },
                  stats: {
                    likes: reel.likes_count || 0,
                    comments: reel.comments_count || 0,
                    shares: reel.shares_count || 0,
                    views: reel.views_count || 0,
                  },
                  isLiked: false,
                }}
                followingIds={followingIds}
                toggleFollow={toggleFollow}
                isActive={index === activeReelIndex}
                isOwner={authUser.id === reel.user_id}
              />
            </div>
          ))}
          {loadingMore && (
            <div className="h-20 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Following;
