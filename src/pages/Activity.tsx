import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BottomNavigation } from '@/components/BottomNavigation';
import DesktopSidebar from '@/components/DesktopSidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Search, MessageCircle, Heart, UserPlus, Radio, CheckCheck, Gift, DollarSign, ShieldAlert, Swords, Repeat2, AtSign } from 'lucide-react';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { useToast } from '@/hooks/use-toast';
import CreateReelModal from '@/components/CreateReelModal';
import SettingsModal from '@/components/SettingsModal';
import NotificationReelModal from '@/components/NotificationReelModal';
import InboxSearch from '@/components/InboxSearch';
import MobileViewWrapper from '@/components/MobileViewWrapper';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefresh';
import { deduplicateNotifications } from '@/lib/notificationDeduplication';
import { getPreviousRoute, popRouteFromHistory } from '@/hooks/useRouteMemory';

interface Notification {
  id: string;
  type: string;
  from_user_id: string;
  reel_id: string | null;
  conversation_id?: string | null;
  live_session_id?: string | null;
  battle_id?: string | null;
  title?: string | null;
  body?: string | null;
  message: string | null;
  actor_avatar_url?: string | null;
  deep_link?: string | null;
  is_read: boolean;
  created_at: string;
  from_user?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
    verified?: boolean | null;
  };
  followStatus?: 'follows_you' | 'mutual' | null;
}

type ViewState = 
  | { type: 'list' }
  | { type: 'reel'; reelId: string; notificationType?: string };

interface Conversation {
  id: string;
  participant_one: string;
  participant_two: string;
  last_message_at: string;
  other_user?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  last_message?: string;
  unread_count?: number;
}

const Activity = () => {
  const [activeTab, setActiveTab] = useState('notifications');
  const [section, setSection] = useState<'all' | 'activity' | 'liveBattles' | 'messages'>('all');
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState<ViewState>({ type: 'list' });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { authUser } = useUser();
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const fetchConversations = useCallback(async () => {
    if (!authUser) return;
    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_one.eq.${authUser.id},participant_two.eq.${authUser.id}`)
      .order('last_message_at', { ascending: false });
    if (!convs) return;
    const otherIds = convs.map(c => c.participant_one === authUser.id ? c.participant_two : c.participant_one);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, display_name, avatar_url')
      .in('user_id', otherIds);
    const enriched = await Promise.all(convs.map(async (c) => {
      const otherId = c.participant_one === authUser.id ? c.participant_two : c.participant_one;
      const profile = profiles?.find(p => p.user_id === otherId);
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, sender_id')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        ...c,
        other_user: profile ? { id: profile.user_id, ...profile } : undefined,
        last_message: lastMsg?.content ?? '',
      } as Conversation;
    }));
    setConversations(enriched);
  }, [authUser]);


  const fetchData = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    
    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
    } else if (notifs) {
      const userIds = [...new Set(notifs.map(n => n.from_user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url, verified')
        .in('user_id', userIds);

      // Check follow relationships for follow-type notifications
      const followNotifUserIds = [...new Set(notifs.filter(n => n.type === 'follow').map(n => n.from_user_id))];
      let followBackMap = new Map<string, boolean>();
      
      if (followNotifUserIds.length > 0) {
        // Check which of these users we follow back
        const { data: followBacks } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', authUser.id)
          .in('following_id', followNotifUserIds);
        
        followBacks?.forEach(f => followBackMap.set(f.following_id, true));
      }

      const enrichedNotifs = notifs.map(n => ({
        ...n,
        from_user: profiles?.find(p => p.user_id === n.from_user_id),
        followStatus: n.type === 'follow' 
          ? (followBackMap.has(n.from_user_id) ? 'mutual' as const : 'follows_you' as const) 
          : null,
      }));
      setNotifications(enrichedNotifs);
    }
    setLoading(false);
  }, [authUser]);

  const handleRefresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const { containerRef, pullDistance, isRefreshing, handlers } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  useEffect(() => {
    if (!authUser) return;

    fetchData();

    const notifChannel = supabase
      .channel('activity-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${authUser.id}`
        },
        async (payload) => {
          const notifId = payload.new.id as string;
          if (notifiedIdsRef.current.has(notifId)) return;
          notifiedIdsRef.current.add(notifId);

          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url, verified')
            .eq('user_id', payload.new.from_user_id)
            .single();

          const newNotif = {
            ...payload.new as Notification,
            from_user: profile || undefined
          };

          setNotifications(prev => [newNotif, ...prev]);
          
          toast({
            title: getNotificationTitle(payload.new.type),
            description: `${profile?.display_name || 'Someone'} ${getNotificationAction(payload.new.type)}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, [authUser, fetchData, toast]);

  useEffect(() => {
    if (section === 'messages') fetchConversations();
  }, [section, fetchConversations]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reelId = params.get('reel');
    if (reelId) {
      setViewState({ type: 'reel', reelId, notificationType: params.get('type') || undefined });
      navigate('/activity', { replace: true });
    }
  }, [location.search, navigate]);


  const getNotificationTitle = (type: string) => {
    const titles: Record<string, string> = {
      follow: 'New Follower',
      like: 'New Like',
      comment: 'New Comment',
      comment_reply: 'Reply to Comment',
      mention: 'New Mention',
      tag: 'You Were Tagged',
      repost: 'New Repost',
      share: 'New Share',
      saved: 'Saved Muv',
      new_reel: 'New Muv',
      message: 'New Message',
      message_request: 'Message Request',
      battle_challenge: 'Battle Challenge',
      battle_invitation: 'Battle Invitation',
      battle_started: 'Battle Started',
      battle_accepted: 'Battle Accepted',
      battle_declined: 'Battle Declined',
      battle_win: 'Battle Won',
      battle_loss: 'Battle Result',
      live_start: 'Live Now',
      live_started: 'Live Now',
      live_invitation: 'Live Invitation',
      stream_ended: 'Stream Ended',
      gift: 'New Gift',
      stars: 'New Stars',
      earnings: 'Earnings Update',
      verification: 'Verification Update',
      moderation: 'Account Notice',
      announcement: "Muv'it Update",
    };
    return titles[type] || 'Notification';
  };

  const getNotificationAction = (type: string) => {
    const actions: Record<string, string> = {
      follow: 'started following you',
      like: 'liked your Muv',
      comment: 'commented on your Muv',
      comment_reply: 'replied to your comment',
      mention: 'mentioned you',
      tag: 'tagged you',
      repost: 'reposted your Muv',
      share: 'shared your Muv',
      saved: 'saved your Muv',
      new_reel: 'posted a new Muv',
      message: 'sent you a message',
      message_request: 'wants to message you',
      battle_challenge: 'challenged you to a battle',
      battle_invitation: 'invited you to a battle',
      battle_started: 'started a battle',
      battle_accepted: 'accepted your battle',
      battle_declined: 'declined your battle',
      battle_win: 'won the battle',
      battle_loss: 'battle ended',
      live_start: 'is live now',
      live_started: 'is live now',
      live_invitation: 'invited you to join live',
      stream_ended: 'ended their live',
      gift: 'sent you a gift',
      stars: 'sent you stars',
      earnings: 'updated your earnings',
      verification: 'updated verification',
      moderation: 'sent an account notice',
      announcement: 'has an update',
    };
    return actions[type] || 'interacted with you';
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow': return <UserPlus className="w-4 h-4 text-primary" />;
      case 'like': return <Heart className="w-4 h-4 text-destructive fill-destructive" />;
      case 'comment':
      case 'comment_reply': return <MessageCircle className="w-4 h-4 text-primary" />;
      case 'mention':
      case 'tag': return <AtSign className="w-4 h-4 text-primary" />;
      case 'repost':
      case 'share': return <Repeat2 className="w-4 h-4 text-primary" />;
      case 'message':
      case 'message_request': return <MessageCircle className="w-4 h-4 text-primary" />;
      case 'battle_challenge':
      case 'battle_invitation':
      case 'battle_started':
      case 'battle_accepted':
      case 'battle_declined':
      case 'battle_win':
      case 'battle_loss': return <Swords className="w-4 h-4 text-primary" />;
      case 'live_start':
      case 'live_started': return <Radio className="w-4 h-4 text-destructive" />;
      case 'live_invitation': return <Radio className="w-4 h-4 text-primary" />;
      case 'stream_ended': return <Radio className="w-4 h-4 text-muted-foreground" />;
      case 'gift':
      case 'stars': return <Gift className="w-4 h-4 text-primary" />;
      case 'earnings': return <DollarSign className="w-4 h-4 text-primary" />;
      case 'moderation':
      case 'verification': return <ShieldAlert className="w-4 h-4 text-primary" />;
      default: return <Heart className="w-4 h-4" />;
    }
  };


  const handleMarkAllRead = async () => {
    if (!authUser) return;
    const hadUnread = notifications.some((n) => !n.is_read);
    if (!hadUnread) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', authUser.id)
      .eq('is_read', false);
    if (error) {
      toast({ title: 'Could not mark all as read', variant: 'destructive' });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case 'home': navigate('/'); break;
      case 'tutorials': navigate('/tutorials'); break;
      case 'create': setIsCreateReelOpen(true); break;
      case 'notifications': break;
      case 'inbox': navigate('/inbox'); break;
      case 'profile': navigate('/profile'); break;
      case 'settings': setIsSettingsOpen(true); break;
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    // Mark as read
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notif.id);

    setNotifications(prev => 
      prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
    );

    // Navigate based on type
    if (notif.deep_link) {
      navigate(notif.deep_link);
    } else if (notif.conversation_id || notif.type === 'message' || notif.type === 'message_request') {
      navigate('/inbox', { state: { openConversationId: notif.conversation_id || undefined } });
    } else if (notif.live_session_id && (notif.type === 'live_start' || notif.type === 'live_started' || notif.type === 'live_invitation')) {
      navigate(`/live?session=${notif.live_session_id}`);
    } else if (notif.reel_id) {
      setViewState({ 
        type: 'reel', 
        reelId: notif.reel_id, 
        notificationType: notif.type 
      });
    } else if (notif.type === 'mention' || notif.type === 'tag') {
      // Message mention (no reel) â†’ take user to inbox
      navigate('/inbox');
    } else if (
      (notif.type === 'follow' || notif.type === 'stream_ended') &&
      notif.from_user?.username
    ) {
      navigate(`/user/${notif.from_user.username}`);
    } else if (notif.type?.startsWith('battle_')) {
      navigate(`/battles${notif.battle_id ? `?battle=${notif.battle_id}` : ''}`);
    }
  };


  const handleSearchClick = () => {
    setIsSearchOpen(!isSearchOpen);
  };

  const handleSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Deduplicate and filter notifications based on search
  const processedNotifications = useMemo(() => {
    // First deduplicate - cast back to our enriched type
    const deduplicated = deduplicateNotifications(notifications) as Notification[];
    
    const categoryFiltered = deduplicated.filter((n) => {
      if (section === 'all') return true;
      if (section === 'messages') return n.type === 'message' || n.type === 'message_request';
      if (section === 'liveBattles') return n.type.startsWith('live') || n.type.startsWith('battle_') || n.type === 'stream_ended';
      return !(n.type === 'message' || n.type === 'message_request' || n.type.startsWith('live') || n.type.startsWith('battle_') || n.type === 'stream_ended');
    });

    // Then filter by search
    if (!searchQuery.trim()) return categoryFiltered;
    const q = searchQuery.toLowerCase();
    return categoryFiltered.filter(n => 
      n.from_user?.display_name?.toLowerCase().includes(q) ||
      n.from_user?.username?.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q)
    );
  }, [notifications, searchQuery, section]);

  const handleBackToList = useCallback(() => {
    setViewState({ type: 'list' });
  }, []);
  
  const handleGoBack = useCallback(() => {
    const prevRoute = getPreviousRoute();
    if (prevRoute && prevRoute !== '/activity') {
      popRouteFromHistory();
      navigate(prevRoute);
    } else {
      navigate('/');
    }
  }, [navigate]);

  // Handle username click - navigate to full profile
  const handleUsernameClick = (username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/user/${username}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      {/* Main Content */}
      <div className="lg:pl-[72px] xl:pl-[244px]">
        <MobileViewWrapper>
          <div className="relative h-full overflow-hidden bg-background flex flex-col">
            <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
            <div 
              ref={containerRef}
              className="pt-8 pb-20 lg:pb-4 flex-1 overflow-y-auto"
              {...handlers}
            >
              {isSearchOpen ? (
                <InboxSearch
                  isOpen={isSearchOpen}
                  onClose={() => {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  searchType="notifications"
                  onSearch={handleSearchQuery}
                />
              ) : (
                <div className="flex items-center justify-between px-4 mb-6">
                  <h1 className="text-xl font-bold text-foreground">Activity</h1>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllRead}
                      disabled={!notifications.some((n) => !n.is_read)}
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-5 h-5 text-foreground" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleSearchClick}>
                      <Search className="w-5 h-5 text-foreground" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Section tabs */}
              <div className="px-4 mb-4 lg:hidden">
                <div className="flex bg-secondary/40 rounded-full p-1">
                  {[
                    ['all', 'All'],
                    ['activity', 'Activity'],
                    ['liveBattles', 'Live & Battles'],
                    ['messages', 'Messages'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSection(key as typeof section)}
                      className={`flex-1 py-2 px-1 text-[11px] font-semibold rounded-full transition-colors ${section === key ? 'bg-background text-foreground shadow' : 'text-muted-foreground'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4">
                {section === 'messages' ? (
                  conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
                        <MessageCircle className="w-10 h-10 text-muted-foreground" />
                      </div>
                      <h2 className="text-lg font-semibold mb-2">No messages yet</h2>
                      <p className="text-muted-foreground text-center text-sm">
                        Start a conversation from someone's profile.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {conversations.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => navigate('/inbox', { state: { openConversationId: c.id } })}
                          className="flex items-center gap-3 p-3 rounded-xl cursor-pointer bg-secondary/50 hover:bg-secondary"
                        >
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={c.other_user?.avatar_url || ''} />
                            <AvatarFallback>{c.other_user?.display_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{c.other_user?.display_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.last_message || 'Say hi ðŸ‘‹'}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatTime(c.last_message_at)}</span>
                        </div>
                      ))}
                    </div>
                  )
                ) : loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
                      <Heart className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h2 className="text-lg font-semibold mb-2">No activity yet</h2>
                    <p className="text-muted-foreground text-center text-sm">
                      When someone interacts with your content, you'll see it here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {processedNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                          notif.is_read ? 'bg-secondary/30' : 'bg-secondary/70'
                        } hover:bg-secondary`}
                      >
                        <div className="relative">
                          <Avatar 
                            className="w-12 h-12 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => {
                              if (notif.from_user?.username) {
                                handleUsernameClick(notif.from_user.username, e);
                              }
                            }}
                          >
                            <AvatarImage src={notif.from_user?.avatar_url || ''} />
                            <AvatarFallback>{notif.from_user?.display_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center">
                            {getNotificationIcon(notif.type)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span 
                              className="font-semibold hover:underline cursor-pointer inline-flex items-center gap-1 align-middle"
                              onClick={(e) => {
                                if (notif.from_user?.username) {
                                  handleUsernameClick(notif.from_user.username, e);
                                }
                              }}
                            >
                              {notif.from_user?.display_name || 'Someone'}
                              {notif.from_user?.verified && <VerifiedBadge size="sm" />}
                            </span>
                            {' '}{notif.body || notif.message || getNotificationAction(notif.type)}
                            {notif.followStatus === 'mutual' && (
                              <span className="ml-1 text-xs text-primary font-medium">â€¢ Mutual</span>
                            )}
                            {notif.followStatus === 'follows_you' && (
                              <span className="ml-1 text-xs text-muted-foreground">â€¢ Follows you</span>
                            )}
                          </p>
                          <span className="text-xs text-muted-foreground">{formatTime(notif.created_at)}</span>
                        </div>
                        <Avatar className="w-10 h-10 border border-border bg-background">
                          <AvatarImage src={notif.actor_avatar_url || notif.from_user?.avatar_url || ''} />
                          <AvatarFallback>{notif.from_user?.display_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
            
            <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        </MobileViewWrapper>
      </div>
      
      {/* Modals */}
      <CreateReelModal isOpen={isCreateReelOpen} onClose={() => setIsCreateReelOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* Notification Reel Modal - open comments for comment_reply as well */}
      {viewState.type === 'reel' && (
        <NotificationReelModal
          isOpen={true}
          onClose={handleBackToList}
          reelId={viewState.reelId}
          notificationType={viewState.notificationType}
          openCommentsOnLoad={viewState.notificationType === 'comment' || viewState.notificationType === 'comment_reply'}
        />
      )}
    </div>
  );
};

export default Activity;
