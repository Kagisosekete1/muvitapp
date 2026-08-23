import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Send, Check, CheckCheck, Trash2, ImagePlus, Video, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import MentionInput from '@/components/ui/MentionInput';
import { notifyMentions } from '@/lib/mentions';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  otherUser: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  conversationStatus?: 'pending' | 'accepted';
  requestedBy?: string | null;
  onAccepted?: () => void;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  media_url?: string | null;
  media_type?: 'image' | 'video' | null;
}

const MAX_VIDEO_SECONDS = 60;

const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  conversationId,
  otherUser,
  conversationStatus = 'accepted',
  requestedBy = null,
  onAccepted,
}) => {
  const { authUser } = useUser();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [localStatus, setLocalStatus] = useState(conversationStatus);
  const isPending = localStatus === 'pending';
  const canAccept = isPending && !!authUser && requestedBy !== authUser.id;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalStatus(conversationStatus);
  }, [conversationStatus, conversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen || !conversationId) return;

    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        setMessages([]);
      } else {
        setMessages((data || []).filter(msg => msg && msg.id) as Message[]);
      }
      setLoading(false);
    };

    fetchMessages();

    if (authUser) {
      supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', authUser.id);
    }

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages(prev => prev.some(m => m.id === (payload.new as any).id) ? prev : [...prev, payload.new as Message]);
          if (authUser && (payload.new as any).sender_id !== authUser.id) {
            supabase.from('messages').update({ is_read: true }).eq('id', (payload.new as any).id);
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages(prev => prev.map(msg =>
            msg.id === (payload.new as any).id ? { ...msg, is_read: (payload.new as Message).is_read } : msg
          ));
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages(prev => prev.filter(msg => msg.id !== (payload.old as any).id));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOpen, conversationId, authUser]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessageRow = async (row: {
    content: string;
    media_url?: string | null;
    media_type?: 'image' | 'video' | null;
  }) => {
    if (!authUser) return;
    if (isPending) {
      toast({ title: 'Chat request pending', description: 'Messages unlock after this chat is accepted.' });
      return false;
    }
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: authUser.id,
      content: row.content,
      media_url: row.media_url ?? null,
      media_type: row.media_type ?? null,
    });
    if (error) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
      return false;
    }
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);
    return true;
  };

  const handleAcceptChat = async () => {
    if (!authUser || !canAccept) return;
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() } as any)
      .eq('id', conversationId);

    if (error) {
      toast({ title: 'Error', description: 'Could not accept this chat', variant: 'destructive' });
      return;
    }

    setLocalStatus('accepted');
    onAccepted?.();
    toast({ title: 'Chat accepted', description: `You can now message @${otherUser.username}` });
  };

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !authUser) return;
    setNewMessage('');
    const ok = await sendMessageRow({ content: text });
    if (!ok) { setNewMessage(text); return; }
    // mention notifications + DM notification
    void notifyMentions({ text, fromUserId: authUser.id, context: 'message' });
  };

  const getVideoDuration = (file: File): Promise<number> =>
    new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => { resolve(v.duration); URL.revokeObjectURL(v.src); };
      v.onerror = () => reject(new Error('Unable to read video'));
      v.src = URL.createObjectURL(file);
    });

  const uploadAndSend = async (file: File, kind: 'image' | 'video') => {
    if (!authUser) return;
    try {
      setUploading(true);
      if (kind === 'video') {
        const dur = await getVideoDuration(file).catch(() => 0);
        if (dur && dur > MAX_VIDEO_SECONDS + 0.5) {
          toast({ title: 'Video too long', description: `Muv'z clips must be ${MAX_VIDEO_SECONDS}s or less.`, variant: 'destructive' });
          return;
        }
      }
      const ext = file.name.split('.').pop() || (kind === 'image' ? 'jpg' : 'mp4');
      const path = `${authUser.id}/dm/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('reels').upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(path);
      await sendMessageRow({ content: '', media_url: publicUrl, media_type: kind });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Try again', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleDeleteMessage = async (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Message removed.' });
    }
  };

  const handleDeleteConversation = async () => {
    if (!authUser) return;
    try {
      await supabase.from('messages').delete().eq('conversation_id', conversationId);
      await supabase.from('conversations').delete().eq('id', conversationId);
      toast({ title: 'Chat deleted' });
      setMessages([]);
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete chat', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b flex flex-row items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="w-10 h-10">
              <AvatarImage src={otherUser.avatar_url || ''} />
              <AvatarFallback>{otherUser.display_name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold truncate">{otherUser.display_name}</DialogTitle>
              <p className="text-xs text-muted-foreground truncate">@{otherUser.username}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.confirm('Delete this entire chat for both users? This cannot be undone.')) {
                handleDeleteConversation();
              }
            }}
            aria-label="Delete chat"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isPending && (
            <div className="rounded-2xl border border-border bg-secondary/70 p-3 text-center">
              <p className="text-sm font-medium">
                {canAccept ? `${otherUser.display_name} wants to chat` : 'Chat request sent'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {canAccept ? 'Accept before messages can continue.' : 'Waiting for them to accept before inbox messages unlock.'}
              </p>
              {canAccept && (
                <Button className="mt-3 rounded-full" size="sm" onClick={handleAcceptChat}>
                  Accept chat
                </Button>
              )}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-center">No messages yet.<br />Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMe = message.sender_id === authUser?.id;
              return (
                <div key={message.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group select-none`}>
                  <div className={`flex items-end gap-1 ${isMe ? 'flex-row-reverse' : 'flex-row'} max-w-[85%]`}>
                    <div
                      className={`px-3 py-2 rounded-2xl overflow-hidden ${
                        isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary text-foreground rounded-bl-sm'
                      }`}
                    >
                      {message.media_url && message.media_type === 'image' && (
                        <img src={message.media_url} alt="" className="rounded-lg max-w-[240px] max-h-[320px] object-cover mb-1" loading="lazy" />
                      )}
                      {message.media_url && message.media_type === 'video' && (
                        <video src={message.media_url} controls playsInline className="rounded-lg max-w-[240px] max-h-[360px] mb-1" />
                      )}
                      {message.content && <p className="text-sm break-words">{message.content}</p>}
                      <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[10px] opacity-70">{formatTime(message.created_at)}</span>
                        {isMe && (message.is_read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3 opacity-70" />)}
                      </div>
                    </div>
                    {isMe && (
                      <button
                        onClick={() => {
                          if (window.confirm('Delete this message for both users?')) handleDeleteMessage(message.id);
                        }}
                        aria-label="Delete message"
                        className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-70"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t flex items-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0], 'image')}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0], 'video')}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={uploading || isPending}
            onClick={() => imageInputRef.current?.click()}
            aria-label="Send image"
          >
            <ImagePlus className="w-5 h-5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={uploading || isPending}
            onClick={() => videoInputRef.current?.click()}
            aria-label="Send Muv'z clip (max 60s)"
          >
            <Video className="w-5 h-5" />
          </Button>
          <MentionInput
            value={newMessage}
            onChange={setNewMessage}
            onSubmit={handleSend}
            disabled={isPending || uploading}
            placeholder={uploading ? 'Uploading…' : 'Type a message...'}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button onClick={handleSend} disabled={!newMessage.trim() || uploading || isPending}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatModal;
