import React, { useState, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Flame, Heart, Play, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PopularReel {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  likes_count: number;
  views_count: number;
  user_id: string;
  created_at: string;
  profile?: {
    username: string;
    display_name: string;
    avatar_url: string;
  };
}

interface MostPopularWeekProps {
  limit?: number;
  onReelClick?: (reelId: string, allReels: PopularReel[]) => void;
}

const MostPopularWeek: React.FC<MostPopularWeekProps> = ({ limit = 10, onReelClick }) => {
  const [reels, setReels] = useState<PopularReel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPopularReels();
  }, []);

  const fetchPopularReels = async () => {
    setLoading(true);
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { data: reelsData } = await supabase
        .from('reels')
        .select('*')
        .gte('created_at', oneWeekAgo.toISOString())
        .order('likes_count', { ascending: false })
        .limit(limit);

      if (reelsData && reelsData.length > 0) {
        // Fetch profiles for all reels
        const userIds = [...new Set(reelsData.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const reelsWithProfiles = reelsData.map(reel => ({
          ...reel,
          likes_count: reel.likes_count || 0,
          views_count: reel.views_count || 0,
          profile: profileMap.get(reel.user_id)
        }));

        setReels(reelsWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching popular reels:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const handleReelClick = (reelId: string) => {
    if (onReelClick) {
      onReelClick(reelId, reels);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">Most Popular This Week</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (reels.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-foreground">Most Popular This Week</h3>
        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
          🔥 Hot
        </Badge>
      </div>

      {/* Horizontal scroll layout matching Trending/Tutorial Muv'z */}
      <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
        {reels.map((reel, index) => (
          <div
            key={reel.id}
            className="flex-shrink-0 w-32 relative cursor-pointer group"
            onClick={() => handleReelClick(reel.id)}
          >
            {/* Rank Badge */}
            <div className={`absolute -top-1 -left-1 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              index === 0 ? 'bg-primary text-primary-foreground' :
              index === 1 ? 'bg-secondary text-secondary-foreground' :
              index === 2 ? 'bg-accent text-accent-foreground' :
              'bg-muted text-muted-foreground'
            }`}>
              #{index + 1}
            </div>
            
            {/* Thumbnail - same size as Trending/Tutorial Muv'z */}
            <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-secondary">
              {reel.thumbnail_url ? (
                <img
                  src={reel.thumbnail_url}
                  alt={reel.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Play className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              
              {/* Stats overlay */}
              <div className="absolute bottom-2 left-2 right-2">
                <div className="flex items-center gap-1">
                  <Heart className="w-3 h-3 text-destructive fill-destructive" />
                  <span className="text-xs text-white font-semibold">
                    {formatNumber(reel.likes_count)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Creator Info - matching other sections */}
            {reel.profile && (
              <div className="flex items-center space-x-1 mt-2">
                <Avatar className="w-4 h-4">
                  <AvatarImage src={reel.profile.avatar_url} />
                  <AvatarFallback className="text-[8px]">
                    {reel.profile.display_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate">
                  @{reel.profile.username}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MostPopularWeek;
