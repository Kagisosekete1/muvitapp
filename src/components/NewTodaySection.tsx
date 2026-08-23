import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';

interface NewReel {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  user_id: string;
  likes_count: number;
  views_count: number;
  profile?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface NewTodaySectionProps {
  onReelClick?: (reelId: string) => void;
}

const NewTodaySection: React.FC<NewTodaySectionProps> = ({ onReelClick }) => {
  const navigate = useNavigate();
  const [reels, setReels] = useState<NewReel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNewReels();
  }, []);

  const fetchNewReels = async () => {
    setLoading(true);
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: reelsData } = await supabase
        .from('reels')
        .select('*')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      if (reelsData && reelsData.length > 0) {
        const userIds = [...new Set(reelsData.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url')
          .in('user_id', userIds);

        const reelsWithProfiles = reelsData.map(reel => ({
          ...reel,
          profile: profiles?.find(p => p.user_id === reel.user_id)
        }));

        setReels(reelsWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching new reels:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (reels.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          <h2 className="font-semibold text-foreground">New Today</h2>
          <span className="text-xs bg-yellow-500/20 text-yellow-600 px-2 py-0.5 rounded-full font-medium">
            {reels.length} fresh
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-primary text-sm"
          onClick={() => navigate('/trending')}
        >
          See All
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {reels.map((reel) => (
          <div
            key={reel.id}
            onClick={() => onReelClick?.(reel.id)}
            className="flex-shrink-0 w-32 cursor-pointer group"
          >
            <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-secondary mb-2">
              {reel.thumbnail_url ? (
                <img
                  src={reel.thumbnail_url}
                  alt={reel.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={reel.video_url}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
              )}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <Play className="w-8 h-8 text-white opacity-80 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 text-white text-[10px]">
                <span>❤️ {reel.likes_count || 0}</span>
              </div>
              {/* New badge */}
              <div className="absolute top-1 right-1 bg-yellow-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                NEW
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Avatar className="w-5 h-5">
                <AvatarImage src={reel.profile?.avatar_url || ''} />
                <AvatarFallback className="text-[8px]">
                  {reel.profile?.display_name?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <p className="text-xs text-muted-foreground truncate">
                @{reel.profile?.username || 'user'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewTodaySection;
