import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BottomNavigation } from '@/components/BottomNavigation';
import DesktopSidebar from '@/components/DesktopSidebar';
import { Button } from '@/components/ui/button';
import { Settings, Grid3X3, Video, Bookmark, ArrowLeft, Trophy, Sparkles, BarChart3, Users, Repeat2, Clapperboard } from 'lucide-react';
import { useSavedAccounts } from '@/hooks/useSavedAccounts';
import VideoThumbnail from '@/components/ui/VideoThumbnail';
import { useUser } from '@/contexts/UserContext';
import EditProfileModal from '@/components/EditProfileModal';
import SettingsModal from '@/components/SettingsModal';
import NotificationsModal from '@/components/settings/NotificationsModal';
import ShareProfileModal from '@/components/ShareProfileModal';
import CreateReelModal from '@/components/CreateReelModal';
import FollowersModal from '@/components/FollowersModal';
import ReelsModal from '@/components/ReelsModal';
import ProfileReelViewer from '@/components/ProfileReelViewer';
import MilestoneBadges from '@/components/MilestoneBadges';
import VideoAnalyticsModal from '@/components/VideoAnalyticsModal';
import CreatorOnboardingModal from '@/components/CreatorOnboardingModal';
import CreatorDashboardModal from '@/components/CreatorDashboardModal';
import CreatorProgressWidget from '@/components/CreatorProgressWidget';
import MobileViewWrapper from '@/components/MobileViewWrapper';
import MuviiAssistant from '@/components/MuviiAssistant';
import SwitchAccountsModal from '@/components/settings/SwitchAccountsModal';
import { supabase } from '@/integrations/supabase/client';
import { ProfileHeaderSkeleton, ProfileGridSkeleton } from '@/components/ui/ProfileSkeleton';

interface ReelData {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url: string | null;
  views_count: number;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  user_id: string;
}

const Profile = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [contentTab, setContentTab] = useState('reels');
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, authUser, loading } = useUser();
  const [tutorialReels, setTutorialReels] = useState<ReelData[]>([]);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [followersModal, setFollowersModal] = useState(false);
  const [followingModal, setFollowingModal] = useState(false);
  const [reelsModal, setReelsModal] = useState(false);
  const [badgesModal, setBadgesModal] = useState(false);
  const [creatorOnboardingOpen, setCreatorOnboardingOpen] = useState(false);
  const [creatorDashboardOpen, setCreatorDashboardOpen] = useState(false);
  const [switchAccountsOpen, setSwitchAccountsOpen] = useState(false);
  const { accounts } = useSavedAccounts();
  const hasMultipleAccounts = accounts.length > 1;
  const [showOnboardingButton, setShowOnboardingButton] = useState(false);
  const [userReels, setUserReels] = useState<ReelData[]>([]);
  const [savedReels, setSavedReels] = useState<ReelData[]>([]);
  const [repostedReels, setRepostedReels] = useState<ReelData[]>([]);
  const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(null);
  const [viewingReelsList, setViewingReelsList] = useState<ReelData[]>([]);
  const [reelsLoading, setReelsLoading] = useState(true);
  const [analyticsReel, setAnalyticsReel] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (authUser) {
      fetchUserReels();
      fetchSavedReels();
      fetchTutorialReels();
      fetchRepostedReels();
      checkOnboardingStatus();
    }
  }, [authUser]);

  const checkOnboardingStatus = async () => {
    if (!authUser) return;
    
    const { data } = await supabase
      .from('creator_onboarding')
      .select('is_completed')
      .eq('user_id', authUser.id)
      .maybeSingle();
    
    // Show onboarding button if not completed
    setShowOnboardingButton(!data?.is_completed);
  };

  const fetchUserReels = async () => {
    if (!authUser) return;
    setReelsLoading(true);
    const { data } = await supabase.from('reels').select('id, title, description, video_url, thumbnail_url, views_count, likes_count, comments_count, shares_count, user_id').eq('user_id', authUser.id).order('created_at', { ascending: false });
    if (data) setUserReels(data);
    setReelsLoading(false);
  };

  const fetchSavedReels = async () => {
    if (!authUser) return;
    const { data: savedData } = await supabase.from('saved_reels').select('reel_id').eq('user_id', authUser.id).order('created_at', { ascending: false });
    if (savedData && savedData.length > 0) {
      const reelIds = savedData.map(s => s.reel_id);
      const { data: reelsData } = await supabase.from('reels').select('id, title, description, video_url, thumbnail_url, views_count, likes_count, comments_count, shares_count, user_id').in('id', reelIds);
      if (reelsData) setSavedReels(reelsData);
    } else {
      setSavedReels([]);
    }
  };

  const fetchTutorialReels = async () => {
    if (!authUser) return;
    const { data } = await supabase.from('reels').select('id, title, description, video_url, thumbnail_url, views_count, likes_count, comments_count, shares_count, user_id').eq('user_id', authUser.id).eq('is_tutorial', true).order('created_at', { ascending: false });
    if (data) setTutorialReels(data);
  };

  const fetchRepostedReels = async () => {
    if (!authUser) return;
    const { data: repostData } = await supabase.from('reposts').select('reel_id').eq('user_id', authUser.id).order('created_at', { ascending: false });
    if (repostData && repostData.length > 0) {
      const reelIds = repostData.map(r => r.reel_id);
      const { data: reelsData } = await supabase.from('reels').select('id, title, description, video_url, thumbnail_url, views_count, likes_count, comments_count, shares_count, user_id').in('id', reelIds);
      if (reelsData) setRepostedReels(reelsData);
    } else {
      setRepostedReels([]);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case 'home': navigate('/', { state: { from: location.pathname } }); break;
      case 'tutorials': navigate('/tutorials', { state: { from: location.pathname } }); break;
      case 'create': setIsCreateReelOpen(true); break;
      case 'notifications': navigate('/activity', { state: { from: location.pathname } }); break;
      case 'inbox': navigate('/inbox', { state: { from: location.pathname } }); break;
      case 'dashboard': navigate('/monetization-analytics', { state: { from: location.pathname } }); break;
      case 'profile': break;
      case 'settings': setIsSettingsOpen(true); break;
    }
  };

  const handleBack = () => navigate('/');
  const handleReelClick = (reels: ReelData[], index: number) => { setViewingReelsList(reels); setSelectedReelIndex(index); };
  const handleAnalyticsClick = (reel: ReelData) => { setAnalyticsReel({ id: reel.id, title: reel.title }); };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="lg:pl-[72px] xl:pl-[244px]">
          <MobileViewWrapper>
            <div className="relative h-full overflow-hidden bg-background">
              <div className="pt-4 pb-20 lg:pb-4 h-full overflow-y-auto px-4">
                <div className="flex items-center justify-between mb-4"><div className="w-10 h-10" /><div className="h-6 w-24 bg-muted rounded animate-pulse" /><div className="w-10 h-10" /></div>
                <ProfileHeaderSkeleton />
                <div className="border-t border-border mt-6 pt-4"><ProfileGridSkeleton count={6} /></div>
              </div>
            </div>
          </MobileViewWrapper>
        </div>
      </div>
    );
  }

  if (!currentUser) { navigate('/auth'); return null; }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      {/* Main Content */}
      <div className="lg:pl-[72px] xl:pl-[244px]">
        <MobileViewWrapper>
      <div className="relative h-full overflow-hidden bg-background">
        <div className="pt-4 pb-20 lg:pb-4 h-full overflow-y-auto">
        <div className="flex items-center justify-between px-4 mb-4">
          <Button variant="ghost" size="sm" onClick={handleBack}><ArrowLeft className="w-6 h-6" /></Button>
          <h1 className="text-lg font-semibold">@{currentUser.username}</h1>
          <div className="flex items-center gap-1">
            {/* Switch accounts only on mobile phones (< md breakpoint) */}
            <Button variant="ghost" size="sm" onClick={() => setSwitchAccountsOpen(true)} className="relative md:hidden">
              <Users className="w-5 h-5" />
              {hasMultipleAccounts && (
                <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(true)} className="lg:hidden">
              <Settings className="w-6 h-6" />
            </Button>
          </div>
        </div>

        <div className="px-4 mb-6">
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-3">
              <img src={currentUser.avatarUrl} alt="Profile" className="w-24 h-24 rounded-full object-cover border-2 border-border" />
            </div>
            <h2 className="text-xl font-bold mb-1">{currentUser.displayName}</h2>
            <p className="text-muted-foreground text-sm mb-4 text-center max-w-md whitespace-pre-wrap break-words">{currentUser.bio}</p>
            
            <div className="flex items-center gap-4 mb-4 flex-wrap justify-center">
              <Button variant="ghost" className="text-center flex flex-col items-center p-2 hover:bg-secondary/50 rounded-lg" onClick={() => setFollowingModal(true)}>
                <p className="text-lg font-bold">{currentUser.stats?.following ?? 0}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </Button>
              <Button variant="ghost" className="text-center flex flex-col items-center p-2 hover:bg-secondary/50 rounded-lg" onClick={() => setFollowersModal(true)}>
                <p className="text-lg font-bold">{currentUser.stats?.followers ?? 0}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </Button>
              <Button variant="ghost" className="text-center flex flex-col items-center p-2 hover:bg-secondary/50 rounded-lg" onClick={() => setReelsModal(true)}>
                <p className="text-lg font-bold">{currentUser.stats?.reels ?? 0}</p>
                <p className="text-xs text-muted-foreground">Muv'z</p>
              </Button>
            </div>
            
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsEditModalOpen(true)}>Edit Profile</Button>
              <Button className="flex-1 rounded-xl" onClick={() => setIsShareOpen(true)}>Share Profile</Button>
              <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setBadgesModal(true)}>
                <Trophy className="w-5 h-5 text-primary" />
              </Button>
              <Button variant="outline" size="icon" className="rounded-xl" onClick={() => navigate('/studio')}>
                <Clapperboard className="w-5 h-5 text-primary" />
              </Button>
            </div>
            
            {/* Creator Progress Widget */}
            <div className="w-full mt-3">
              <CreatorProgressWidget 
                onOpenDashboard={() => setCreatorDashboardOpen(true)} 
              />
            </div>
            
            {/* Creator Onboarding Button */}
            {showOnboardingButton && (
              <Button 
                variant="outline" 
                className="w-full mt-3 rounded-xl border-primary/50 text-primary hover:bg-primary/10"
                onClick={() => setCreatorOnboardingOpen(true)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Start Creator Journey
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-border">
          <div className="flex items-center justify-center">
            <Button variant="ghost" className={`flex-1 py-3 rounded-none ${contentTab === 'reels' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`} onClick={() => setContentTab('reels')}><Grid3X3 className="w-5 h-5" /></Button>
            <Button variant="ghost" className={`flex-1 py-3 rounded-none ${contentTab === 'tutorials' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`} onClick={() => setContentTab('tutorials')}><Video className="w-5 h-5" /></Button>
            <Button variant="ghost" className={`flex-1 py-3 rounded-none ${contentTab === 'saved' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`} onClick={() => setContentTab('saved')}><Bookmark className="w-5 h-5" /></Button>
            <Button variant="ghost" className={`flex-1 py-3 rounded-none ${contentTab === 'reposts' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`} onClick={() => setContentTab('reposts')}><Repeat2 className="w-5 h-5" /></Button>
          </div>
        </div>

        {contentTab === 'reels' && (reelsLoading ? <ProfileGridSkeleton count={6} /> : userReels.length === 0 ? (
          <div className="px-4 py-8"><div className="text-center text-muted-foreground"><p className="text-lg font-medium mb-2">No Muv'z yet</p><p className="text-sm">Your Muv'z will appear here</p><Button className="mt-4 rounded-xl" onClick={() => setIsCreateReelOpen(true)}>Create your first Muv</Button></div></div>
        ) : <div className="grid grid-cols-3 gap-0.5 px-0.5 pt-0.5">{userReels.map((reel, index) => <VideoThumbnail key={reel.id} videoUrl={reel.video_url} thumbnailUrl={reel.thumbnail_url} likesCount={reel.likes_count || 0} commentsCount={reel.comments_count || 0} showStats={true} onClick={() => handleReelClick(userReels, index)} showAnalytics={true} onAnalyticsClick={() => handleAnalyticsClick(reel)} />)}</div>)}

        {contentTab === 'tutorials' && (tutorialReels.length === 0 ? (
          <div className="px-4 py-8"><div className="text-center text-muted-foreground"><p className="text-lg font-medium mb-2">No tutorials yet</p><p className="text-sm">Your tutorials will appear here</p><Button className="mt-4 rounded-xl" onClick={() => setIsCreateReelOpen(true)}>Create your first tutorial</Button></div></div>
        ) : <div className="grid grid-cols-3 gap-0.5 px-0.5 pt-0.5">{tutorialReels.map((reel, index) => <VideoThumbnail key={reel.id} videoUrl={reel.video_url} thumbnailUrl={reel.thumbnail_url} likesCount={reel.likes_count || 0} commentsCount={reel.comments_count || 0} showStats={true} onClick={() => handleReelClick(tutorialReels, index)} showAnalytics={true} onAnalyticsClick={() => handleAnalyticsClick(reel)} />)}</div>)}

        {contentTab === 'saved' && (savedReels.length === 0 ? (
          <div className="px-4 py-8"><div className="text-center text-muted-foreground"><p className="text-lg font-medium mb-2">No saved Muv'z</p><p className="text-sm">Your saved Muv'z will appear here</p></div></div>
        ) : <div className="grid grid-cols-3 gap-0.5 px-0.5 pt-0.5">{savedReels.map((reel, index) => <VideoThumbnail key={reel.id} videoUrl={reel.video_url} thumbnailUrl={reel.thumbnail_url} likesCount={reel.likes_count || 0} commentsCount={reel.comments_count || 0} showStats={true} onClick={() => handleReelClick(savedReels, index)} />)}</div>)}

        {contentTab === 'reposts' && (repostedReels.length === 0 ? (
          <div className="px-4 py-8"><div className="text-center text-muted-foreground"><p className="text-lg font-medium mb-2">No reposts yet</p><p className="text-sm">Muv'z you repost will appear here</p></div></div>
        ) : <div className="grid grid-cols-3 gap-0.5 px-0.5 pt-0.5">{repostedReels.map((reel, index) => <VideoThumbnail key={reel.id} videoUrl={reel.video_url} thumbnailUrl={reel.thumbnail_url} likesCount={reel.likes_count || 0} commentsCount={reel.comments_count || 0} showStats={true} onClick={() => handleReelClick(repostedReels, index)} />)}</div>)}
        </div>

        {selectedReelIndex !== null && currentUser && <ProfileReelViewer reels={viewingReelsList} initialIndex={selectedReelIndex} onClose={() => setSelectedReelIndex(null)} userId={authUser?.id || ''} username={currentUser.username} displayName={currentUser.displayName} avatarUrl={currentUser.avatarUrl} verified={currentUser.verified} />}
        
        <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      
      <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ShareProfileModal isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} username={currentUser.username} />
      <CreateReelModal isOpen={isCreateReelOpen} onClose={() => setIsCreateReelOpen(false)} />
      <FollowersModal isOpen={followersModal} onClose={() => setFollowersModal(false)} userId={authUser?.id || ''} type="followers" count={currentUser.stats?.followers ?? 0} />
      <FollowersModal isOpen={followingModal} onClose={() => setFollowingModal(false)} userId={authUser?.id || ''} type="following" count={currentUser.stats?.following ?? 0} />
      <ReelsModal isOpen={reelsModal} onClose={() => setReelsModal(false)} userId={authUser?.id || ''} count={currentUser.stats?.reels ?? 0} isOwnProfile={true} />
      <MilestoneBadges isOpen={badgesModal} onClose={() => setBadgesModal(false)} userId={authUser?.id} />
        <VideoAnalyticsModal 
          isOpen={analyticsReel !== null} 
          onClose={() => setAnalyticsReel(null)} 
          reelId={analyticsReel?.id || ''} 
          reelTitle={analyticsReel?.title || ''} 
        />
        <CreatorOnboardingModal 
          isOpen={creatorOnboardingOpen} 
          onClose={() => {
            setCreatorOnboardingOpen(false);
            checkOnboardingStatus();
          }} 
        />
        <CreatorDashboardModal 
          isOpen={creatorDashboardOpen} 
          onClose={() => setCreatorDashboardOpen(false)} 
        />
        <NotificationsModal 
          isOpen={isNotificationsOpen} 
          onClose={() => setIsNotificationsOpen(false)} 
        />
        <SwitchAccountsModal
          isOpen={switchAccountsOpen}
          onClose={() => setSwitchAccountsOpen(false)}
        />
        </div>
      </MobileViewWrapper>
      
      {/* MuVii AI Assistant */}
      <MuviiAssistant />
    </div>
  </div>
  );
};

export default Profile;