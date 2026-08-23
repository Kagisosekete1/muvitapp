import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import ReelCard from '@/components/ui/ReelCard';
import CommentsModal from '@/components/CommentsModal';
import DesktopCommentsPanel from '@/components/DesktopCommentsPanel';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface NotificationReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  reelId: string;
  notificationType?: string;
  openCommentsOnLoad?: boolean;
}

interface ReelData {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  description?: string;
  user: {
    id: string;
    profileId: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    verified: boolean;
  };
  stats: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
}

const NotificationReelModal: React.FC<NotificationReelModalProps> = ({
  isOpen,
  onClose,
  reelId,
  notificationType,
  openCommentsOnLoad = false,
}) => {
  const { authUser } = useUser();
  const isMobile = useIsMobile();
  const [reel, setReel] = useState<ReelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [showComments, setShowComments] = useState(false);
  const [showDesktopComments, setShowDesktopComments] = useState(false);

  useEffect(() => {
    if (isOpen && reelId) {
      fetchReel();
      if (authUser) fetchFollowing();
    }
    if (!isOpen) {
      setReel(null);
      setShowComments(false);
      setShowDesktopComments(false);
    }
  }, [isOpen, reelId, authUser]);

  // Auto-open comments for comment/reply notifications
  useEffect(() => {
    if (isOpen && reel && (notificationType === 'comment' || notificationType === 'comment_reply' || openCommentsOnLoad)) {
      const timer = setTimeout(() => {
        if (isMobile) {
          setShowComments(true);
        } else {
          setShowDesktopComments(true);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, reel, notificationType, openCommentsOnLoad, isMobile]);

  const fetchReel = async () => {
    setLoading(true);
    const { data: reelData } = await supabase
      .from('reels')
      .select('*')
      .eq('id', reelId)
      .single();

    if (reelData) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_id, username, display_name, avatar_url, verified')
        .eq('user_id', reelData.user_id)
        .single();

      setReel({
        id: reelData.id,
        videoUrl: reelData.video_url,
        thumbnailUrl: reelData.thumbnail_url || '',
        title: reelData.title,
        description: reelData.description || '',
        user: {
          id: reelData.user_id,
          profileId: profile?.id || reelData.user_id,
          username: profile?.username || 'user',
          displayName: profile?.display_name || profile?.username || 'User',
          avatarUrl: profile?.avatar_url || '',
          verified: profile?.verified || false,
        },
        stats: {
          likes: reelData.likes_count || 0,
          comments: reelData.comments_count || 0,
          shares: reelData.shares_count || 0,
          views: reelData.views_count || 0,
        },
      });
    }
    setLoading(false);
  };

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
    const isFollowing = followingIds.has(targetUserId);
    
    if (isFollowing) {
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

  const handleOpenDesktopComments = useCallback(() => {
    setShowDesktopComments(true);
  }, []);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    // Only close if clicking the overlay background itself
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Custom overlay — no Radix Dialog, no pointer-event trapping */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in-0 duration-200"
        onClick={handleOverlayClick}
      >
        <div className="relative max-w-md w-full h-[85vh] bg-black rounded-3xl overflow-hidden">
          {/* Back button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 z-50 text-white bg-black/50 hover:bg-black/70 rounded-full"
            onClick={onClose}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reel ? (
            <div className="relative w-full h-full">
              <ReelCard
                reel={reel}
                followingIds={followingIds}
                toggleFollow={toggleFollow}
                isActive={true}
                isOwner={authUser?.id === reel.user.id}
                autoAdvance={false}
                onOpenDesktopComments={handleOpenDesktopComments}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              <p>Reel not found</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Comments Modal */}
      {reel && (
        <CommentsModal
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          reelId={reel.id}
          reelOwnerId={reel.user.id}
        />
      )}

      {/* Desktop Comments Panel */}
      {reel && showDesktopComments && (
        <DesktopCommentsPanel
          isOpen={showDesktopComments}
          onClose={() => setShowDesktopComments(false)}
          reelId={reel.id}
          reelOwnerId={reel.user.id}
        />
      )}
    </>
  );
};

export default NotificationReelModal;
