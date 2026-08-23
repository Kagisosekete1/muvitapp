import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, UserCheck, ChevronRight, Users, Loader2, Flame, MapPin } from 'lucide-react';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { sendFollowNotification } from '@/services/notificationService';

interface SuggestedProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean;
  followers_count: number;
  bio: string | null;
  isTrending?: boolean; // Has high engagement in last 24h
}

interface SuggestedAccountsProps {
  limit?: number;
  showTitle?: boolean;
  compact?: boolean;
}

const SuggestedAccounts: React.FC<SuggestedAccountsProps> = ({ 
  limit = 10, 
  showTitle = true,
  compact = false 
}) => {
  const navigate = useNavigate();
  const { authUser } = useUser();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<SuggestedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [pendingFollow, setPendingFollow] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestedAccounts();

    // Subscribe to real-time follower count updates
    const channel = supabase
      .channel('suggested-followers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows' },
        () => {
          // Refresh accounts when follows change
          fetchSuggestedAccounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser]);

  const fetchFollowing = async () => {
    if (!authUser) return new Set<string>();

    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', authUser.id);

    const ids = new Set((data || []).map(f => f.following_id));
    setFollowingIds(ids);
    return ids;
  };

  const fetchSuggestedAccounts = async () => {
    setLoading(true);

    try {
      const currentFollowingIds = await fetchFollowing();

      // Get accounts ordered by followers count (trending/famous), fetch extra to filter
      let query = supabase
        .from('profiles')
        .select('*')
        .order('followers_count', { ascending: false })
        .limit(Math.max(limit, 10) + 20);

      if (authUser) {
        query = query.neq('user_id', authUser.id);
      }

      const { data } = await query;

      // Fetch trending users (those with high engagement in last 24h)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentReels } = await supabase
        .from('reels')
        .select('user_id, likes_count, comments_count, shares_count')
        .gte('created_at', twentyFourHoursAgo);

      // Calculate engagement per user in last 24h
      const userEngagement: Record<string, number> = {};
      recentReels?.forEach(reel => {
        const engagement = (reel.likes_count || 0) + (reel.comments_count || 0) * 2 + (reel.shares_count || 0) * 3;
        userEngagement[reel.user_id] = (userEngagement[reel.user_id] || 0) + engagement;
      });

      // Mark users with engagement > 5 as trending
      const trendingUserIds = new Set(
        Object.entries(userEngagement)
          .filter(([_, eng]) => eng >= 5)
          .map(([userId]) => userId)
      );

      if (data) {
        const filtered = data
          .filter(p => p.user_id !== authUser?.id && !currentFollowingIds.has(p.user_id))
          .map(p => ({
            ...p,
            isTrending: trendingUserIds.has(p.user_id)
          }));
        const minCount = Math.max(limit, 10);
        setAccounts(filtered.slice(0, minCount));
      }
    } catch (error) {
      console.error('Error fetching suggested accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!authUser) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to follow accounts',
      });
      return;
    }

    setPendingFollow(userId);
    const isFollowing = followingIds.has(userId);

    // Optimistic update
    setFollowingIds(prev => {
      const next = new Set(prev);
      if (isFollowing) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', authUser.id)
          .eq('following_id', userId);
      } else {
        await supabase.from('follows').insert({
          follower_id: authUser.id,
          following_id: userId,
        });

        setAccounts(prev => prev.filter(account => account.user_id !== userId));
        sendFollowNotification(userId, authUser.id);
      }
    } catch (error) {
      // Revert on error
      setFollowingIds(prev => {
        const next = new Set(prev);
        if (isFollowing) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    } finally {
      setPendingFollow(null);
    }
  };

  const handleProfileClick = (username: string) => {
    navigate(`/user/${username}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return null;
  }

  return (
    <div className={compact ? '' : 'space-y-3'}>
      {showTitle && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Suggested Muva'z</h2>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary text-sm"
            onClick={() => navigate('/suggested-muvaz')}
          >
            See All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      <div className={compact ? 'flex gap-3 overflow-x-auto pb-2 scrollbar-hide' : 'space-y-2'}>
        {accounts.map((account) => {
          const isFollowing = followingIds.has(account.user_id);
          const isPending = pendingFollow === account.user_id;

          if (compact) {
            // Compact horizontal layout
            return (
              <div
                key={account.id}
                className="flex-shrink-0 w-28 bg-secondary/50 rounded-2xl p-3 flex flex-col items-center gap-2 relative"
              >
                {/* Trending badge */}
                {account.isTrending && (
                  <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-1 shadow-sm">
                    <Flame className="w-3 h-3 text-white" />
                  </div>
                )}
                <Avatar 
                  className="w-14 h-14 cursor-pointer"
                  onClick={() => handleProfileClick(account.username)}
                >
                  <AvatarImage src={account.avatar_url || ''} />
                  <AvatarFallback>{account.display_name[0]}</AvatarFallback>
                </Avatar>
                <div className="text-center w-full">
                  <p 
                    className="text-sm font-medium truncate cursor-pointer hover:text-primary"
                    onClick={() => handleProfileClick(account.username)}
                  >
                    {account.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">@{account.username}</p>
                </div>
                <Button
                  size="sm"
                  variant={isFollowing ? 'outline' : 'default'}
                  className="w-full h-7 text-xs rounded-full"
                  onClick={() => handleFollow(account.user_id)}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isFollowing ? (
                    'Following'
                  ) : (
                    'Follow'
                  )}
                </Button>
              </div>
            );
          }

          // Full layout
          return (
            <div
              key={account.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors relative"
            >
              {/* Trending badge for full layout */}
              {account.isTrending && (
                <div className="absolute -top-1 right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Hot
                </div>
              )}
              <Avatar 
                className="w-12 h-12 cursor-pointer"
                onClick={() => handleProfileClick(account.username)}
              >
                <AvatarImage src={account.avatar_url || ''} />
                <AvatarFallback>{account.display_name[0]}</AvatarFallback>
              </Avatar>
              <div 
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => handleProfileClick(account.username)}
              >
                <div className="flex items-center gap-1">
                  <p className="font-medium truncate">{account.display_name}</p>
                  {account.verified && (
                    <VerifiedBadge size="sm" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  @{account.username} · {account.followers_count || 0} followers
                </p>
                {account.bio && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{account.bio}</p>
                )}
              </div>
              <Button
                size="sm"
                variant={isFollowing ? 'outline' : 'default'}
                className="rounded-full h-8 px-4"
                onClick={() => handleFollow(account.user_id)}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4 mr-1" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-1" />
                    Follow
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SuggestedAccounts;
