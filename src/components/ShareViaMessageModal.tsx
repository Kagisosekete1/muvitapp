import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Search, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';

interface ShareViaMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  shareTitle: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

const ShareViaMessageModal: React.FC<ShareViaMessageModalProps> = ({
  isOpen,
  onClose,
  shareUrl,
  shareTitle,
}) => {
  const { authUser } = useUser();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchFollowing();
    }
  }, [isOpen]);

  const fetchFollowing = async () => {
    if (!authUser) return;
    setLoading(true);

    try {
      // Get users the current user is following
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', authUser.id);

      if (follows && follows.length > 0) {
        const followingIds = follows.map(f => f.following_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, user_id, username, display_name, avatar_url')
          .in('user_id', followingIds);

        setUsers(profiles || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      fetchFollowing();
      return;
    }

    setLoading(true);
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, username, display_name, avatar_url')
        .neq('user_id', authUser?.id || '')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(20);

      setUsers(profiles || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (targetUser: UserProfile) => {
    if (!authUser) return;
    setSending(targetUser.user_id);

    try {
      // Check for existing conversation
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id, status')
        .or(`and(participant_one.eq.${authUser.id},participant_two.eq.${targetUser.user_id}),and(participant_one.eq.${targetUser.user_id},participant_two.eq.${authUser.id})`)
        .maybeSingle();

      let conversationId = existingConv?.id;
      let conversationStatus = (existingConv as any)?.status || 'accepted';

      // Create conversation if doesn't exist
      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            participant_one: authUser.id,
            participant_two: targetUser.user_id,
            status: 'pending',
            requested_by: authUser.id,
          } as any)
          .select('id, status')
          .single();

        if (convError) throw convError;
        conversationId = newConv?.id;
        conversationStatus = (newConv as any)?.status || 'pending';
      }

      if (!conversationId) throw new Error('Failed to create conversation');

      if (conversationStatus === 'pending') {
        toast({
          title: 'Chat request sent',
          description: `@${targetUser.username} must accept before messages can be delivered.`,
        });
        onClose();
        return;
      }

      // Send the message
      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: authUser.id,
        content: `${shareTitle}\n${shareUrl}`,
      });

      if (msgError) throw msgError;

      // Update last message time
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      toast({
        title: 'Sent!',
        description: `Shared with @${targetUser.username}`,
      });

      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border rounded-3xl max-h-[80vh] flex flex-col">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Share via Message
          </DialogTitle>
        </DialogHeader>

        <div className="py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? 'No users found' : 'Follow users to share with them'}
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors"
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={user.avatar_url || ''} />
                  <AvatarFallback>{user.display_name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.display_name}</p>
                  <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                </div>
                <Button
                  size="sm"
                  className="rounded-full"
                  onClick={() => handleSendMessage(user)}
                  disabled={sending === user.user_id}
                >
                  {sending === user.user_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareViaMessageModal;
