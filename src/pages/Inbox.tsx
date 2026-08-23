import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNavigation } from '@/components/BottomNavigation';
import DesktopSidebar from '@/components/DesktopSidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Search, MessageCircle, Heart, UserPlus, Play, ArrowLeft, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CreateReelModal from '@/components/CreateReelModal';
import SettingsModal from '@/components/SettingsModal';
import NotificationsModal from '@/components/settings/NotificationsModal';
import ChatModal from '@/components/ChatModal';
import NotificationReelModal from '@/components/NotificationReelModal';
import NotificationProfileView from '@/components/NotificationProfileView';
import InboxSearch from '@/components/InboxSearch';
import MobileViewWrapper from '@/components/MobileViewWrapper';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefresh';
import { useNotificationCountsDetailed } from '@/components/ui/NotificationBadge';
import { deduplicateNotifications } from '@/lib/notificationDeduplication';

interface Notification {
  id: string;
  type: string;
  from_user_id: string;
  reel_id: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
  from_user?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface Conversation {
  id: string;
  participant_one: string;
  participant_two: string;
  last_message_at: string;
  status?: 'pending' | 'accepted';
  requested_by?: string | null;
  accepted_at?: string | null;
  other_user?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  last_message?: string;
  unread_count?: number;
}

type ViewState = 
  | { type: 'list' }
  | { type: 'profile'; userId: string }
  | { type: 'reel'; reelId: string };

const Inbox = () => {
  const [activeTab, setActiveTab] = useState('inbox');
  const [inboxTab, setInboxTab] = useState('messages');
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({ type: 'list' });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { authUser } = useUser();
  const { counts } = useNotificationCountsDetailed();

  const fetchData = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    
    if (inboxTab === 'notifications') {
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
          .select('user_id, username, display_name, avatar_url')
          .in('user_id', userIds);

        const enrichedNotifs = notifs.map(n => ({
          ...n,
          from_user: profiles?.find(p => p.user_id === n.from_user_id)
        }));
        setNotifications(enrichedNotifs);
      }
    } else {
      const { data: convs, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_one.eq.${authUser.id},participant_two.eq.${authUser.id}`)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
      } else if (convs) {
        const otherUserIds = convs.map(c => 
          c.participant_one === authUser.id ? c.participant_two : c.participant_one
        );
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url')
          .in('user_id', otherUserIds);

        const enrichedConvs = await Promise.all(convs.map(async (c) => {
          const otherUserId = c.participant_one === authUser.id ? c.participant_two : c.participant_one;
          const profile = profiles?.find(p => p.user_id === otherUserId);
          
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, media_type')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', c.id)
            .eq('is_read', false)
            .neq('sender_id', authUser.id);

          return {
            ...c,
            other_user: profile ? { id: otherUserId, ...profile } : undefined,
            last_message: lastMsg?.content || (lastMsg?.media_type === 'image' ? '📷 Photo' : lastMsg?.media_type === 'video' ? "🎬 Muv'z clip" : ''),
            unread_count: count || 0
          };
        }));

        setConversations(enrichedConvs);
      }
    }
    setLoading(false);
  }, [authUser, inboxTab]);

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
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${authUser.id}`
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, avatar_url')
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

    const msgChannel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          if (inboxTab === 'messages') {
            fetchData();
          }
        }
      )
      .subscribe();


    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [authUser, inboxTab, fetchData]);

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case 'follow': return 'New Follower';
      case 'like': return 'New Like';
      case 'comment': return 'New Comment';
      case 'mention': return 'New Mention';
      case 'repost': return 'New Repost';
      case 'battle_challenge': return 'Battle Challenge';
      case 'battle_win': return 'You Won! 🏆';
      case 'battle_loss': return 'Battle Ended';
      default: return 'Notification';
    }
  };

  const getNotificationAction = (type: string) => {
    switch (type) {
      case 'follow': return 'started following you';
      case 'like': return 'liked your Muv';
      case 'comment': return 'commented on your Muv';
      case 'mention': return 'mentioned you';
      case 'repost': return 'reposted your Muv';
      case 'battle_challenge': return 'challenged you to a battle';
      case 'battle_win': return 'you won the battle';
      case 'battle_loss': return 'battle ended';
      default: return 'interacted with you';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow': return <UserPlus className="w-4 h-4 text-primary" />;
      case 'like': return <Heart className="w-4 h-4 text-destructive fill-destructive" />;
      case 'comment':
      case 'mention': return <MessageCircle className="w-4 h-4 text-primary" />;
      default: return <Heart className="w-4 h-4" />;
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
      case 'notifications': navigate('/activity'); break;
      case 'inbox': break;
      case 'dashboard': navigate('/monetization-analytics'); break;
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
    if (notif.reel_id) {
      // Open reel modal
      setViewState({ type: 'reel', reelId: notif.reel_id });
    } else if (notif.type === 'follow' && notif.from_user_id) {
      // Show profile view within notification sheet
      setViewState({ type: 'profile', userId: notif.from_user_id });
    }
  };

  const handleConversationClick = (conv: Conversation) => {
    if (conv.other_user) {
      setSelectedConversation(conv);
      setIsChatOpen(true);
    }
  };

  const handleAcceptConversation = async (conv: Conversation) => {
    if (!authUser) return;
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() } as any)
      .eq('id', conv.id);

    if (error) {
      toast({ title: 'Error', description: 'Could not accept this chat', variant: 'destructive' });
      return;
    }

    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, status: 'accepted', accepted_at: new Date().toISOString() } : c));
    toast({ title: 'Chat accepted', description: `You can now message @${conv.other_user?.username}` });
  };

  const handleSearchClick = () => {
    setIsSearchOpen(!isSearchOpen);
  };

  const handleSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Filter conversations and notifications based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => 
      c.other_user?.display_name?.toLowerCase().includes(q) ||
      c.other_user?.username?.toLowerCase().includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const filteredNotifications = useMemo(() => {
    // First deduplicate notifications
    const deduplicated = deduplicateNotifications(notifications);
    
    if (!searchQuery.trim()) return deduplicated;
    const q = searchQuery.toLowerCase();
    return deduplicated.filter(n => 
      n.from_user?.display_name?.toLowerCase().includes(q) ||
      n.from_user?.username?.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q)
    );
  }, [notifications, searchQuery]);

  const handleDeleteConversation = async (conversationId: string) => {
    if (!authUser) return;
    
    const confirmed = window.confirm('Delete this entire chat? All messages will be removed.');
    if (!confirmed) return;

    try {
      await supabase.from('messages').delete().eq('conversation_id', conversationId);
      await supabase.from('conversations').delete().eq('id', conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      toast({ title: 'Chat deleted', description: 'The conversation has been removed.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete chat', variant: 'destructive' });
    }
  };

  const handleBackToList = () => {
    setViewState({ type: 'list' });
  };

  const handleProfileReelClick = (reelId: string) => {
    setViewState({ type: 'reel', reelId });
  };

  // Profile view within notifications
  if (viewState.type === 'profile') {
    return (
      <div className="min-h-screen bg-background">
        <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="lg:pl-[72px] xl:pl-[244px]">
          <div className="relative h-screen overflow-hidden bg-background">
            <NotificationProfileView
              userId={viewState.userId}
              onBack={handleBackToList}
              onReelClick={handleProfileReelClick}
            />
            <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        </div>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <NotificationsModal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
      </div>
    );
  }

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
            searchType={inboxTab as 'messages' | 'notifications'}
            onSearch={handleSearchQuery}
          />
        ) : (
          <div className="flex items-center justify-between px-4 mb-6">
            <h1 className="text-xl font-bold text-foreground">Inbox</h1>
            <Button variant="ghost" size="sm" onClick={handleSearchClick}>
              <Search className="w-5 h-5 text-foreground" />
            </Button>
          </div>
        )}

        {/* Tab switcher - only show on mobile, hide on tablet/desktop */}
        <div className="flex px-4 mb-6 lg:hidden">
          <div className="flex space-x-1 bg-secondary rounded-xl p-1 w-full">
            <Button
              variant="ghost"
              size="sm"
              className={`flex-1 rounded-lg relative ${
                inboxTab === 'messages'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
              onClick={() => setInboxTab('messages')}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Messages
              {counts.messages > 0 && (
                <span className="ml-1.5 min-w-[18px] h-[18px] px-1 bg-primary rounded-full text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                  {counts.messages > 99 ? '99+' : counts.messages}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`flex-1 rounded-lg relative ${
                inboxTab === 'notifications'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
              onClick={() => setInboxTab('notifications')}
            >
              <Heart className="w-4 h-4 mr-2" />
              Activity
              {counts.notifications > 0 && (
                <span className="ml-1.5 min-w-[18px] h-[18px] px-1 bg-primary rounded-full text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                  {counts.notifications > 99 ? '99+' : counts.notifications}
                </span>
              )}
            </Button>
          </div>
        </div>
        
        {/* Desktop title for messages only */}
        <div className="hidden lg:block px-4 mb-4">
          <h2 className="text-lg font-semibold">Messages</h2>
        </div>

        <div className="px-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : inboxTab === 'messages' ? (
            conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold mb-2">No messages yet</h2>
                <p className="text-muted-foreground text-center text-sm">
                  When you receive messages, they will appear here.
                </p>
              </div>
            ) : (
            <div className="space-y-2">
                {filteredConversations.map((conv) => {
                  const isPending = conv.status === 'pending';
                  const canAccept = isPending && conv.requested_by !== authUser?.id;
                  return (
                  <div
                    key={conv.id}
                    className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors select-none"
                  >
                    <div
                      onClick={() => handleConversationClick(conv)}
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={conv.other_user?.avatar_url || ''} />
                        <AvatarFallback>{conv.other_user?.display_name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold truncate">{conv.other_user?.display_name}</p>
                          <span className="text-xs text-muted-foreground shrink-0">{formatTime(conv.last_message_at)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {isPending
                            ? canAccept
                              ? 'Chat request - accept to reply'
                              : 'Waiting for chat accept'
                            : conv.last_message || 'No messages'}
                        </p>
                      </div>
                      {(conv.unread_count ?? 0) > 0 && (
                        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs text-primary-foreground font-bold">{conv.unread_count}</span>
                        </div>
                      )}
                    </div>
                    {canAccept && (
                      <Button
                        size="sm"
                        className="shrink-0 rounded-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptConversation(conv);
                        }}
                      >
                        Accept
                      </Button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                      aria-label="Delete chat"
                      className="shrink-0 p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
                })}
              </div>
            )
          ) : (
            notifications.length === 0 ? (
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
                {filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                      notif.is_read ? 'bg-secondary/30' : 'bg-secondary/70'
                    } hover:bg-secondary`}
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={notif.from_user?.avatar_url || ''} />
                        <AvatarFallback>{notif.from_user?.display_name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center">
                        {getNotificationIcon(notif.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{notif.from_user?.display_name || 'Someone'}</span>
                        {' '}{getNotificationAction(notif.type)}
                      </p>
                      <span className="text-xs text-muted-foreground">{formatTime(notif.created_at)}</span>
                    </div>
                    {notif.reel_id && <div className="w-10 h-14 bg-secondary rounded" />}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
      
      <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      
      <CreateReelModal isOpen={isCreateReelOpen} onClose={() => setIsCreateReelOpen(false)} />
      
      {selectedConversation?.other_user && (
        <ChatModal
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setSelectedConversation(null);
          }}
          conversationId={selectedConversation.id}
          conversationStatus={selectedConversation.status || 'accepted'}
          requestedBy={selectedConversation.requested_by || null}
          onAccepted={() => {
            setSelectedConversation(prev => prev ? { ...prev, status: 'accepted' } : prev);
            fetchData();
          }}
          otherUser={selectedConversation.other_user}
        />
      )}
      {/* Notification Reel Modal */}
      {viewState.type === 'reel' && (
        <NotificationReelModal
          isOpen={true}
          onClose={handleBackToList}
          reelId={viewState.reelId}
        />
      )}
          </div>
        </MobileViewWrapper>
      </div>
      
      {/* Modals */}
      <CreateReelModal isOpen={isCreateReelOpen} onClose={() => setIsCreateReelOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <NotificationsModal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
    </div>
  );
};

export default Inbox;
