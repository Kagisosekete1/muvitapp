import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { BottomNavigation } from '@/components/BottomNavigation';
import DesktopSidebar from '@/components/DesktopSidebar';
import MobileViewWrapper from '@/components/MobileViewWrapper';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MoreVertical, Grid3X3, Video, Bookmark, AlertCircle, Ban, MessageCircle, Repeat2 } from 'lucide-react';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import VideoThumbnail from '@/components/ui/VideoThumbnail';
import ChatModal from '@/components/ChatModal';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import FollowersModal from '@/components/FollowersModal';
import ProfileReelViewer from '@/components/ProfileReelViewer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { sendFollowNotification } from '@/services/notificationService';

interface UserProfileData {
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
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  user_id: string;
}

const UserProfileMenu = ({ onReport, onBlock, isOwnProfile }: { onReport: () => void; onBlock: () => void; isOwnProfile: boolean }) => {
  // Don't show menu for own profile
  if (isOwnProfile) {
    return null;
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVertical className="w-6 h-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl">
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onReport}>
          <AlertCircle className="w-4 h-4 mr-2" />
          Report
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onBlock}>
          <Ban className="w-4 h-4 mr-2" />
          Block
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const UserProfile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { currentUser, authUser } = useUser();
  const [activeTab, setActiveTab] = useState('home');
  const [contentTab, setContentTab] = useState('reels');
  const [tutorialReels, setTutorialReels] = useState<ReelData[]>([]);
  const [repostedReels, setRepostedReels] = useState<ReelData[]>([]);
  
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [userReels, setUserReels] = useState<ReelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(null);
  
  const [followersModal, setFollowersModal] = useState(false);
  const [followingModal, setFollowingModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<'pending' | 'accepted'>('accepted');
  const [conversationRequestedBy, setConversationRequestedBy] = useState<string | null>(null);

  useEffect(() => {
    if (username) {
      fetchUserProfile();
      // Track profile view (if not viewing own profile)
      trackProfileView();
    }
  }, [username, authUser]);

  const trackProfileView = async () => {
    if (!authUser || !username) return;
    
    // Get the user being viewed
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('username', username)
      .single();
    
    if (!profile || profile.user_id === authUser.id) return; // Don't track self-views
    
    // Insert profile view
    await supabase.from('profile_views').insert({
      profile_user_id: profile.user_id,
      viewer_user_id: authUser.id,
    });
    
    // Create notification
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      from_user_id: authUser.id,
      type: 'profile_view',
      message: 'viewed your profile',
    });
  };

  // Realtime subscription for follows
  useEffect(() => {
    if (!user?.user_id) return;

    const channel = supabase
      .channel(`follows-${user.user_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${user.user_id}` },
        async () => {
          // Refetch follower count
          const { count } = await supabase
            .from('follows')
            .select('id', { count: 'exact', head: true })
            .eq('following_id', user.user_id);
          
          setUser(prev => prev ? { ...prev, followers_count: count || 0 } : prev);

          // Check if current user is still following
          if (authUser) {
            const { data } = await supabase
              .from('follows')
              .select('id')
              .eq('follower_id', authUser.id)
              .eq('following_id', user.user_id)
              .maybeSingle();
            setIsFollowing(!!data);
            setFollowingIds(data ? new Set([user.user_id]) : new Set());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.user_id, authUser?.id]);

  const fetchUserProfile = async () => {
    setLoading(true);
    
    // Fetch user profile by username
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error || !profileData) {
      setLoading(false);
      return;
    }

    setUser(profileData);

    // Fetch user's reels
    const { data: reelsData } = await supabase
      .from('reels')
      .select('*')
      .eq('user_id', profileData.user_id)
      .order('created_at', { ascending: false });

    if (reelsData) {
      setUserReels(reelsData);
      setTutorialReels(reelsData.filter(r => (r as any).is_tutorial === true));
    }

    // Fetch reposts
    const { data: repostData } = await supabase
      .from('reposts')
      .select('reel_id')
      .eq('user_id', profileData.user_id)
      .order('created_at', { ascending: false });

    if (repostData && repostData.length > 0) {
      const reelIds = repostData.map(r => r.reel_id);
      const { data: repostedData } = await supabase
        .from('reels')
        .select('*')
        .in('id', reelIds);
      if (repostedData) setRepostedReels(repostedData);
    } else {
      setRepostedReels([]);
    }

    // Live follow/following counts (recalculated from follows table)
    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', profileData.user_id),
      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', profileData.user_id),
    ]);

    setUser(prev => prev ? {
      ...prev,
      followers_count: followersCount || 0,
      following_count: followingCount || 0,
    } : prev);

    // Check if current user is following this user
    if (authUser) {
      const { data: followData } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', authUser.id)
        .eq('following_id', profileData.user_id)
        .maybeSingle();

      setIsFollowing(!!followData);
      setFollowingIds(followData ? new Set([profileData.user_id]) : new Set());
    }

    setLoading(false);
  };

  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);

  const handleFollow = async () => {
    if (!authUser || !user) return;

    // If already following, show confirmation dialog
    if (isFollowing) {
      setShowUnfollowConfirm(true);
      return;
    }

    // Optimistic UI first (instant)
    setIsFollowing(true);
    setFollowingIds(new Set([user.user_id]));
    setUser(prev => prev ? {
      ...prev,
      followers_count: (prev.followers_count || 0) + 1,
    } : prev);

    // Follow (idempotent)
    const { data: existing } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', authUser.id)
      .eq('following_id', user.user_id)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: authUser.id,
          following_id: user.user_id,
        });

      if (error && error.code !== '23505') {
        setIsFollowing(false);
        setFollowingIds(new Set());
        setUser(prev => prev ? {
          ...prev,
          followers_count: Math.max(0, (prev.followers_count || 0) - 1),
        } : prev);
        console.error('Error following user:', error);
        toast({ title: 'Could not follow', description: error.message, variant: 'destructive' });
        return;
      }

      // Send in-app + push via backend (prevents duplicates)
      if (!error) void sendFollowNotification(user.user_id, authUser.id);
    }

    toast({ title: 'Following', description: `You are now following @${user.username}` });
  };

  const confirmUnfollow = async () => {
    if (!authUser || !user) return;
    
    setShowUnfollowConfirm(false);
    
    // Optimistic UI
    setIsFollowing(false);
    setFollowingIds(new Set());
    setUser(prev => prev ? {
      ...prev,
      followers_count: Math.max(0, (prev.followers_count || 0) - 1),
    } : prev);

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', authUser.id)
      .eq('following_id', user.user_id);

    if (error) {
      setIsFollowing(true);
      setFollowingIds(new Set([user.user_id]));
      setUser(prev => prev ? {
        ...prev,
        followers_count: (prev.followers_count || 0) + 1,
      } : prev);
      console.error('Error unfollowing user:', error);
      toast({ title: 'Could not unfollow', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Unfollowed', description: `You unfollowed @${user.username}` });
  };

  const toggleFollow = async (_profileId: string) => {
    await handleFollow();
  };

  const handleReport = () => {
    toast({ title: 'Report submitted', description: 'Thank you for your report. We will review it shortly.' });
  };

  const handleBlock = () => {
    toast({ title: 'User blocked', description: `@${user?.username} has been blocked.` });
    navigate(-1);
  };

  const handleMessage = async () => {
    if (!authUser || !user) {
      toast({ title: 'Sign in required', description: 'Please sign in to send messages' });
      return;
    }

    // Check for existing conversation
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, status, requested_by')
      .or(`and(participant_one.eq.${authUser.id},participant_two.eq.${user.user_id}),and(participant_one.eq.${user.user_id},participant_two.eq.${authUser.id})`)
      .maybeSingle();

    if (existingConv) {
      setConversationId(existingConv.id);
      setConversationStatus(((existingConv as any).status || 'accepted') as 'pending' | 'accepted');
      setConversationRequestedBy((existingConv as any).requested_by || null);
      setIsChatOpen(true);
      return;
    }

    // Create new conversation
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        participant_one: authUser.id,
        participant_two: user.user_id,
        status: 'pending',
        requested_by: authUser.id,
      } as any)
      .select('id, status, requested_by')
      .single();

    if (error) {
      toast({ title: 'Error', description: 'Failed to start conversation', variant: 'destructive' });
      return;
    }

    setConversationId(newConv.id);
    setConversationStatus(((newConv as any).status || 'pending') as 'pending' | 'accepted');
    setConversationRequestedBy((newConv as any).requested_by || authUser.id);
    setIsChatOpen(true);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case 'home':
        navigate('/', { state: { from: location.pathname } });
        break;
      case 'tutorials':
        navigate('/tutorials', { state: { from: location.pathname } });
        break;
      case 'inbox':
        navigate('/inbox', { state: { from: location.pathname } });
        break;
      case 'profile':
        navigate('/profile', { state: { from: location.pathname } });
        break;
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background">
        <p className="text-lg font-semibold mb-2">User not found</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  // Full screen reel viewer - Use ProfileReelViewer for consistent experience
  if (selectedReelIndex !== null && user) {
    return (
      <ProfileReelViewer
        reels={userReels}
        initialIndex={selectedReelIndex}
        onClose={() => setSelectedReelIndex(null)}
        userId={user.user_id}
        username={user.username}
        displayName={user.display_name}
        avatarUrl={user.avatar_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=120&h=120&fit=crop&crop=face'}
        verified={user.verified}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="lg:pl-[72px] xl:pl-[244px]">
        <MobileViewWrapper>
          <div className="relative h-full overflow-hidden bg-background flex flex-col">
      <div className="pt-4 pb-20 lg:pb-4 flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 mb-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-lg font-semibold">@{user.username}</h1>
          <UserProfileMenu onReport={handleReport} onBlock={handleBlock} isOwnProfile={authUser?.id === user.user_id} />
        </div>

        {/* Profile Info */}
        <div className="px-4 mb-6">
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-3">
              <img
                src={user.avatar_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=120&h=120&fit=crop&crop=face'}
                alt={user.username}
                className="w-24 h-24 rounded-full object-cover border-2 border-border"
              />
              {user.verified && (
                <VerifiedBadge size="lg" className="absolute -bottom-1 -right-1" />
              )}
            </div>
            
            <h2 className="text-xl font-bold mb-1">{user.display_name || `@${user.username}`}</h2>
            <p className="text-muted-foreground text-sm mb-4 text-center max-w-md whitespace-pre-wrap break-words">{user.bio || 'Dance Creator'}</p>
            
            {/* Stats */}
            <div className="flex items-center gap-6 mb-4">
              <Button 
                variant="ghost" 
                className="text-center flex flex-col items-center p-2 hover:bg-secondary/50 rounded-lg"
                onClick={() => setFollowingModal(true)}
              >
                <p className="text-lg font-bold">{user.following_count || 0}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </Button>
              <Button 
                variant="ghost" 
                className="text-center flex flex-col items-center p-2 hover:bg-secondary/50 rounded-lg"
                onClick={() => setFollowersModal(true)}
              >
                <p className="text-lg font-bold">{user.followers_count || 0}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </Button>
              <Button 
                variant="ghost" 
                className="text-center flex flex-col items-center p-2 hover:bg-secondary/50 rounded-lg"
                onClick={() => setContentTab('reels')}
              >
                <p className="text-lg font-bold">{userReels.length}</p>
                <p className="text-xs text-muted-foreground">Muv'z</p>
              </Button>
            </div>

            {/* Action Buttons - Only show if not own profile */}
            {authUser?.id !== user.user_id && (
              <div className="flex gap-2 w-full">
                <Button 
                  className="flex-1 rounded-xl" 
                  variant={isFollowing ? "outline" : "default"}
                  onClick={handleFollow}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
                <Button 
                  className="flex-1 rounded-xl" 
                  variant="outline"
                  onClick={handleMessage}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Message
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content Tabs */}
        <div className="border-t border-border">
          <div className="flex items-center justify-center">
            <Button
              variant="ghost"
              className={`flex-1 py-3 rounded-none ${
                contentTab === 'reels' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
              }`}
              onClick={() => setContentTab('reels')}
            >
              <Grid3X3 className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              className={`flex-1 py-3 rounded-none ${
                contentTab === 'tutorials' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
              }`}
              onClick={() => setContentTab('tutorials')}
            >
              <Video className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              className={`flex-1 py-3 rounded-none ${
                contentTab === 'reposts' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
              }`}
              onClick={() => setContentTab('reposts')}
            >
              <Repeat2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Reels Grid */}
        {contentTab === 'reels' && (
          userReels.length === 0 ? (
            <div className="px-4 py-8">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">No Muv'z yet</p>
                <p className="text-sm">This user hasn't posted any Muv'z</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 px-0.5 pt-0.5">
              {userReels.map((reel, index) => (
                <VideoThumbnail
                  key={reel.id}
                  videoUrl={reel.video_url}
                  thumbnailUrl={reel.thumbnail_url}
                  likesCount={reel.likes_count || 0}
                  commentsCount={reel.comments_count || 0}
                  showStats={true}
                  onClick={() => setSelectedReelIndex(index)}
                />
              ))}
            </div>
          )
        )}

        {contentTab === 'tutorials' && (
          tutorialReels.length === 0 ? (
            <div className="px-4 py-8">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">No tutorials yet</p>
                <p className="text-sm">This user hasn't posted any tutorials</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 px-0.5 pt-0.5">
              {tutorialReels.map((reel, index) => (
                <VideoThumbnail
                  key={reel.id}
                  videoUrl={reel.video_url}
                  thumbnailUrl={reel.thumbnail_url}
                  likesCount={reel.likes_count || 0}
                  commentsCount={reel.comments_count || 0}
                  showStats={true}
                  onClick={() => setSelectedReelIndex(userReels.findIndex(r => r.id === reel.id))}
                />
              ))}
            </div>
          )
        )}

        {contentTab === 'reposts' && (
          repostedReels.length === 0 ? (
            <div className="px-4 py-8">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">No reposts yet</p>
                <p className="text-sm">This user hasn't reposted any Muv'z</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 px-0.5 pt-0.5">
              {repostedReels.map((reel, index) => (
                <VideoThumbnail
                  key={reel.id}
                  videoUrl={reel.video_url}
                  thumbnailUrl={reel.thumbnail_url}
                  likesCount={reel.likes_count || 0}
                  commentsCount={reel.comments_count || 0}
                  showStats={true}
                  onClick={() => setSelectedReelIndex(userReels.findIndex(r => r.id === reel.id))}
                />
              ))}
            </div>
          )
        )}
      </div>
      
      <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        </MobileViewWrapper>
      </div>

      {/* Followers/Following Modals */}
      <FollowersModal
        isOpen={followersModal}
        onClose={() => setFollowersModal(false)}
        userId={user.user_id}
        type="followers"
        count={user.followers_count || 0}
        profileId={user.id}
      />
      <FollowersModal
        isOpen={followingModal}
        onClose={() => setFollowingModal(false)}
        userId={user.user_id}
        type="following"
        count={user.following_count || 0}
        profileId={user.id}
      />
      
      {conversationId && user && (
        <ChatModal
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setConversationId(null);
          }}
          conversationId={conversationId}
          conversationStatus={conversationStatus}
          requestedBy={conversationRequestedBy}
          onAccepted={() => setConversationStatus('accepted')}
          otherUser={{
            id: user.user_id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url
          }}
        />
      )}

      {/* Unfollow Confirmation Dialog */}
      <AlertDialog open={showUnfollowConfirm} onOpenChange={setShowUnfollowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfollow @{user.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unfollow this user? You won't see their Muv'z in your feed anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnfollow} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Unfollow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserProfile;
