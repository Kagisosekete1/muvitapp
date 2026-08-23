import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Trash2, Heart, Reply, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import ProfileLink from '@/components/ui/ProfileLink';
import { sendCommentNotification, sendCommentReplyNotification } from '@/services/notificationService';
import MentionInput from '@/components/ui/MentionInput';
import { notifyMentions } from '@/lib/mentions';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  reply_to_id: string | null;
  reply_to_username: string | null;
  likes_count: number;
  profile?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  isLiked?: boolean;
}

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reelId: string;
  reelOwnerId?: string;
  onCommentCountChange?: (count: number) => void;
}

const CommentsModal: React.FC<CommentsModalProps> = ({
  isOpen,
  onClose,
  reelId,
  reelOwnerId,
  onCommentCountChange,
}) => {
  const { authUser, currentUser } = useUser();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string; userId: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && reelId) {
      fetchComments();
      
      // Subscribe to real-time comments
      const channel = supabase
        .channel(`comments-${reelId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'comments',
            filter: `reel_id=eq.${reelId}`,
          },
          () => {
            fetchComments();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, reelId]);

  // Focus input when replying
  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  const fetchComments = async () => {
    const { data: commentsData } = await supabase
      .from('comments')
      .select('*')
      .eq('reel_id', reelId)
      .order('created_at', { ascending: true });

    if (commentsData && commentsData.length > 0) {
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const commentIds = commentsData.map(c => c.id);
      
      // Fetch profiles and user's likes in parallel
      const [profilesResult, likesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, username, display_name, avatar_url')
          .in('user_id', userIds),
        authUser
          ? supabase
              .from('comment_likes')
              .select('comment_id')
              .eq('user_id', authUser.id)
              .in('comment_id', commentIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map(profilesResult.data?.map(p => [p.user_id, p]) || []);
      const likedCommentIds = new Set(likesResult.data?.map(l => l.comment_id) || []);
      
      const commentsWithProfiles = commentsData.map(c => ({
        ...c,
        profile: profileMap.get(c.user_id),
        isLiked: likedCommentIds.has(c.id),
      }));

      setComments(commentsWithProfiles);
      onCommentCountChange?.(commentsWithProfiles.length);
    } else {
      setComments([]);
      onCommentCountChange?.(0);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newComment.trim() || !authUser) return;

    setLoading(true);
    const commentText = newComment.trim();
    
    const insertData: {
      reel_id: string;
      user_id: string;
      content: string;
      reply_to_id?: string;
      reply_to_username?: string;
    } = {
      reel_id: reelId,
      user_id: authUser.id,
      content: commentText,
    };

    if (replyingTo) {
      insertData.reply_to_id = replyingTo.id;
      insertData.reply_to_username = replyingTo.username;
    }

    const { data: insertedComment, error } = await supabase
      .from('comments')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to post comment',
        variant: 'destructive',
      });
    } else {
      const savedReplyingTo = replyingTo; // Save before clearing
      if (insertedComment) {
        const optimisticComment: Comment = {
          ...insertedComment,
          profile: {
            username: currentUser?.username || 'user',
            display_name: currentUser?.displayName || 'User',
            avatar_url: currentUser?.avatarUrl || null,
          },
          isLiked: false,
        };
        setComments(prev => {
          const next = [...prev, optimisticComment];
          onCommentCountChange?.(next.length);
          return next;
        });
        // Fire-and-forget @mention notifications
        void notifyMentions({ text: commentText, fromUserId: authUser.id, context: 'comment', reelId });
      }
      setNewComment('');
      setReplyingTo(null);
      void fetchComments();
      
      // Update reel comments_count and get owner id
      const { data: reel } = await supabase
        .from('reels')
        .select('comments_count, user_id')
        .eq('id', reelId)
        .single();
      
      await supabase
        .from('reels')
        .update({ comments_count: (reel?.comments_count || 0) + 1 })
        .eq('id', reelId);

      // Send notifications
      const ownerId = reelOwnerId || reel?.user_id;
      
      // If this is a reply, notify the original commenter
      if (savedReplyingTo && savedReplyingTo.userId !== authUser.id) {
        void sendCommentReplyNotification(savedReplyingTo.userId, authUser.id, reelId, commentText);
      }
      
      // Also notify reel owner if different from replier and original commenter
      if (ownerId && ownerId !== authUser.id && (!savedReplyingTo || ownerId !== savedReplyingTo.userId)) {
        void sendCommentNotification(ownerId, authUser.id, reelId, commentText);
      }
      
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
    setLoading(false);
  };

  const handleDelete = async (commentId: string) => {
    // Optimistic UI
    const previous = comments;
    const next = comments.filter(c => c.id !== commentId);
    setComments(next);
    onCommentCountChange?.(next.length);

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      setComments(previous);
      onCommentCountChange?.(previous.length);
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
      return;
    }

    // Update reel comments_count (best effort)
    const { data: reel } = await supabase
      .from('reels')
      .select('comments_count')
      .eq('id', reelId)
      .single();

    await supabase
      .from('reels')
      .update({ comments_count: Math.max(0, (reel?.comments_count || 1) - 1) })
      .eq('id', reelId);

    toast({ title: 'Deleted', description: 'Comment removed.' });
  };

  const handleLikeComment = async (comment: Comment) => {
    if (!authUser) {
      toast({ title: 'Sign in required', description: 'Please sign in to like comments' });
      return;
    }

    const wasLiked = comment.isLiked;
    const newLikeCount = wasLiked ? Math.max(0, comment.likes_count - 1) : comment.likes_count + 1;

    // Optimistic update
    setComments(prev =>
      prev.map(c =>
        c.id === comment.id
          ? { ...c, isLiked: !wasLiked, likes_count: newLikeCount }
          : c
      )
    );

    try {
      if (wasLiked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', comment.id)
          .eq('user_id', authUser.id);
        
        await supabase
          .from('comments')
          .update({ likes_count: newLikeCount })
          .eq('id', comment.id);
      } else {
        await supabase
          .from('comment_likes')
          .insert({ comment_id: comment.id, user_id: authUser.id });
        
        await supabase
          .from('comments')
          .update({ likes_count: newLikeCount })
          .eq('id', comment.id);
      }
    } catch {
      // Revert on error
      setComments(prev =>
        prev.map(c =>
          c.id === comment.id
            ? { ...c, isLiked: wasLiked, likes_count: comment.likes_count }
            : c
        )
      );
    }
  };

  const handleReply = (comment: Comment) => {
    setReplyingTo({
      id: comment.id,
      username: comment.profile?.username || 'user',
      userId: comment.user_id,
    });
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setNewComment('');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  // Render username mentions as clickable links
  const renderCommentContent = (content: string, replyToUsername: string | null) => {
    const parts: React.ReactNode[] = [];
    
    // If this is a reply, show the @mention at the start
    if (replyToUsername) {
      parts.push(
        <ProfileLink key="reply-mention" username={replyToUsername} className="inline">
          <span className="text-primary font-semibold">@{replyToUsername}</span>
        </ProfileLink>,
        ' '
      );
    }

    // Parse @mentions in the content
    const mentionRegex = /@(\w+)/g;
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      
      // Add the clickable mention
      const username = match[1];
      parts.push(
        <ProfileLink key={`mention-${match.index}`} username={username} className="inline">
          <span className="text-primary font-semibold">@{username}</span>
        </ProfileLink>
      );
      
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={true}>
      <DialogContent 
        className="comments-modal-content max-w-md h-[70vh] flex flex-col p-0 rounded-t-3xl data-[state=open]:animate-slide-up data-[state=closed]:animate-slide-down"
        style={{
          animation: isOpen ? 'slideUp 0.3s ease-out' : 'slideDown 0.3s ease-in',
          zIndex: 100001,
          position: 'fixed',
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="text-center">{comments.length} Comments</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No comments yet</p>
              <p className="text-sm">Be the first to comment!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div 
                key={comment.id} 
                className={`flex gap-3 animate-fade-in ${comment.reply_to_id ? 'ml-8' : ''}`}
              >
                <ProfileLink username={comment.profile?.username || 'user'}>
                  <img
                    src={comment.profile?.avatar_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=120&h=120&fit=crop&crop=face'}
                    alt={comment.profile?.username || 'User'}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                </ProfileLink>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <ProfileLink username={comment.profile?.username || 'user'}>
                      <span className="font-semibold text-sm hover:underline">
                        @{comment.profile?.username || 'user'}
                      </span>
                    </ProfileLink>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm break-words">
                    {renderCommentContent(comment.content, comment.reply_to_username)}
                  </p>
                  
                  {/* Comment actions: Reply and Like */}
                  <div className="flex items-center gap-4 mt-1">
                    <button
                      onClick={() => handleReply(comment)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      <Reply className="w-3 h-3" />
                      Reply
                    </button>
                    <button
                      onClick={() => handleLikeComment(comment)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      <Heart
                        className={`w-3 h-3 transition-all ${
                          comment.isLiked ? 'text-destructive fill-destructive' : ''
                        }`}
                      />
                      {comment.likes_count > 0 && (
                        <span className={comment.isLiked ? 'text-destructive' : ''}>
                          {comment.likes_count}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                
                {authUser?.id === comment.user_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1 h-auto hover:bg-destructive/20 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(comment.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))
          )}
          <div ref={commentsEndRef} />
        </div>

        {authUser && (
          <div className="border-t border-border">
            {/* Reply indicator */}
            {replyingTo && (
              <div className="px-4 py-2 bg-secondary/50 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Replying to <span className="text-primary font-semibold">@{replyingTo.username}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                  onClick={cancelReply}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="p-4 flex gap-2">
              <MentionInput
                ref={inputRef as any}
                value={newComment}
                onChange={setNewComment}
                onSubmit={() => handleSubmit()}
                placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Add a comment...'}
                disabled={loading}
                className="w-full rounded-full bg-background border border-input px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newComment.trim() || loading}
                className="rounded-full px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}
      </DialogContent>

      <style>{`
        /* Ensure CommentsModal portal overlay sits above all parent dialogs */
        [data-radix-portal]:has(.comments-modal-content) > [data-radix-dialog-overlay] {
          z-index: 100000 !important;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100%); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </Dialog>
  );
};

export default CommentsModal;