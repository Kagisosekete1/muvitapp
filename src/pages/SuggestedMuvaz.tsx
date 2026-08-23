import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, UserCheck, ArrowLeft, Loader2, Users } from 'lucide-react';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { sendFollowNotification } from '@/services/notificationService';
import { BottomNavigation } from '@/components/BottomNavigation';

interface SuggestedProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean;
  followers_count: number;
  bio: string | null;
}

const SuggestedMuvaz = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser } = useUser();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<SuggestedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [pendingFollow, setPendingFollow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('tutorials');

  useEffect(() => {
    const init = async () => {
      if (authUser) {
        await fetchFollowing();
      }
      await fetchSuggestedAccounts();
    };
    init();
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

  const fetchSuggestedAccounts = async () => {
    setLoading(true);

    try {
      // Get current following list first
      let currentFollowing = new Set<string>();
      if (authUser) {
        const { data: followData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', authUser.id);
        if (followData) {
          currentFollowing = new Set(followData.map(f => f.following_id));
          setFollowingIds(currentFollowing);
        }
      }

      let query = supabase
        .from('profiles')
        .select('*')
        .order('followers_count', { ascending: false })
        .limit(50);

      if (authUser) {
        query = query.neq('user_id', authUser.id);
      }

      const { data } = await query;

      if (data) {
        // Filter out already followed users
        const filtered = data.filter(p => !currentFollowing.has(p.user_id));
        setAccounts(filtered);
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

        sendFollowNotification(userId, authUser.id);
      }
    } catch (error) {
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

  return (
    <div className="relative h-screen overflow-hidden bg-background">
      <div className="pt-4 pb-20 h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Suggested Muva'z</h1>
          </div>
        </div>

        {/* Description */}
        <p className="text-muted-foreground text-sm px-4 mb-6">
          Discover talented creators to follow and get inspired by their dance moves!
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No suggestions available</p>
            <p className="text-muted-foreground text-sm">Check back later for new creators!</p>
          </div>
        ) : (
          <div className="px-4 space-y-3">
            {accounts.map((account) => {
              const isFollowing = followingIds.has(account.user_id);
              const isPending = pendingFollow === account.user_id;

              return (
                <div
                  key={account.id}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <Avatar
                    className="w-14 h-14 cursor-pointer"
                    onClick={() => handleProfileClick(account.username)}
                  >
                    <AvatarImage src={account.avatar_url || ''} />
                    <AvatarFallback>{account.display_name[0]}</AvatarFallback>
                  </Avatar>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleProfileClick(account.username)}
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold truncate">{account.display_name}</p>
                      {account.verified && (
                        <VerifiedBadge size="sm" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">@{account.username}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCount(account.followers_count || 0)} followers
                    </p>
                    {account.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{account.bio}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={isFollowing ? 'outline' : 'default'}
                    className="rounded-full h-9 px-5"
                    onClick={() => handleFollow(account.user_id)}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <UserCheck className="w-4 h-4 mr-1.5" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-1.5" />
                        Follow
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};

export default SuggestedMuvaz;
