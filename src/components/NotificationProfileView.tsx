import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, UserPlus, UserCheck, Grid3X3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import VideoThumbnail from '@/components/ui/VideoThumbnail';

interface NotificationProfileViewProps {
  userId: string;
  onBack: () => void;
  onReelClick?: (reelId: string) => void;
}

interface ProfileData {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  verified: boolean;
  followers_count: number;
  following_count: number;
  reels_count: number;
}

interface ReelData {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
}

const NotificationProfileView: React.FC<NotificationProfileViewProps> = ({
  userId,
  onBack,
  onReelClick,
}) => {
  const { authUser } = useUser();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [reels, setReels] = useState<ReelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchReels();
    if (authUser) checkFollowing();
  }, [userId, authUser]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (data) setProfile(data);
    setLoading(false);
  };

  const fetchReels = async () => {
    const { data } = await supabase
      .from('reels')
      .select('id, video_url, thumbnail_url, views_count, likes_count, comments_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) setReels(data);
  };

  const checkFollowing = async () => {
    if (!authUser) return;
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', authUser.id)
      .eq('following_id', userId)
      .maybeSingle();
    setIsFollowing(!!data);
  };

  const toggleFollow = async () => {
    if (!authUser || followPending) return;
    setFollowPending(true);

    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', authUser.id)
        .eq('following_id', userId);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert({
        follower_id: authUser.id,
        following_id: userId,
      });
      setIsFollowing(true);
    }
    setFollowPending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </Button>
        <p className="text-center text-muted-foreground mt-8">User not found</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-card/95 backdrop-blur-xl rounded-3xl border border-border/50 shadow-2xl">
      {/* Header */}
      <div className="sticky top-0 bg-card/80 backdrop-blur-lg z-10 p-4 border-b border-border/50 rounded-t-3xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-secondary">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold">@{profile.username}</h2>
        </div>
      </div>

      {/* Profile info */}
      <div className="p-4">
        <div className="flex flex-col items-center mb-6">
          <Avatar className="w-20 h-20 mb-3">
            <AvatarImage src={profile.avatar_url || ''} />
            <AvatarFallback>{profile.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-bold">{profile.display_name}</h3>
          <p className="text-sm text-muted-foreground mb-3">{profile.bio || 'No bio'}</p>

          <div className="flex items-center gap-6 mb-4">
            <div className="text-center">
              <p className="font-bold">{profile.following_count || 0}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
            <div className="text-center">
              <p className="font-bold">{profile.followers_count || 0}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="text-center">
              <p className="font-bold">{profile.reels_count || 0}</p>
              <p className="text-xs text-muted-foreground">Reels</p>
            </div>
          </div>

          {authUser?.id !== userId && (
            <Button
              className="rounded-xl w-full max-w-[200px]"
              variant={isFollowing ? 'outline' : 'default'}
              onClick={toggleFollow}
              disabled={followPending}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Follow
                </>
              )}
            </Button>
          )}
        </div>

        {/* Reels grid */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Grid3X3 className="w-4 h-4" />
            <span className="text-sm font-medium">Reels</span>
          </div>
          {reels.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No reels yet</p>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {reels.map((reel) => (
                <VideoThumbnail
                  key={reel.id}
                  videoUrl={reel.video_url}
                  thumbnailUrl={reel.thumbnail_url}
                  likesCount={reel.likes_count || 0}
                  commentsCount={reel.comments_count || 0}
                  showStats={true}
                  onClick={() => onReelClick?.(reel.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationProfileView;
