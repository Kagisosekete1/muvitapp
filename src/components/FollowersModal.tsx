import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { sendFollowNotification } from '@/services/notificationService';
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

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: 'followers' | 'following';
  count: number;
  profileId?: string;
  onCountChange?: (newCount: number) => void;
}

interface FollowUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  isFollowing: boolean;
}

const FollowersModal: React.FC<FollowersModalProps> = ({ 
  isOpen, 
  onClose, 
  userId, 
  type,
  onCountChange 
}) => {
  const navigate = useNavigate();
  const { authUser } = useUser();
  const { toast } = useToast();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingFollow, setPendingFollow] = useState<Set<string>>(new Set());
  const [unfollowUser, setUnfollowUser] = useState<FollowUser | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [isOpen, userId, type, authUser]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let userIds: string[] = [];
      
      if (type === 'followers') {
        const { data: follows } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', userId);

        if (!follows || follows.length === 0) {
          setUsers([]);
          setLoading(false);
          return;
        }

        userIds = follows.map((f) => f.follower_id);
      } else {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);

        if (!follows || follows.length === 0) {
          setUsers([]);
          setLoading(false);
          return;
        }

        userIds = follows.map((f) => f.following_id);
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .in('user_id', userIds);

      // Check which users the current user is following
      let followingSet = new Set<string>();
      if (authUser) {
        const { data: myFollows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', authUser.id)
          .in('following_id', userIds);
        
        followingSet = new Set(myFollows?.map(f => f.following_id) || []);
      }

      setUsers(
        (profiles || []).map((p: any) => ({
          id: p.user_id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          isFollowing: followingSet.has(p.user_id),
        }))
      );
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (username: string) => {
    onClose();
    navigate(`/user/${username}`);
  };

  const handleFollowToggle = async (user: FollowUser) => {
    if (!authUser || authUser.id === user.id) return;
    if (pendingFollow.has(user.id)) return;

    if (user.isFollowing) {
      // Show unfollow confirmation
      setUnfollowUser(user);
      return;
    }

    // Follow
    setPendingFollow(prev => new Set([...prev, user.id]));
    
    // Optimistic update
    setUsers(prev => prev.map(u => 
      u.id === user.id ? { ...u, isFollowing: true } : u
    ));

    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: authUser.id,
        following_id: user.id,
      });

    if (error) {
      // Revert on error
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, isFollowing: false } : u
      ));
      toast({
        title: 'Error',
        description: 'Failed to follow user',
        variant: 'destructive',
      });
    } else {
      // Send notification
      void sendFollowNotification(user.id, authUser.id);
      toast({ title: 'Following', description: `You are now following @${user.username}` });
      
      // Update parent count if following list
      if (type === 'following') {
        onCountChange?.((users.filter(u => u.isFollowing).length) + 1);
      }
    }

    setPendingFollow(prev => {
      const next = new Set(prev);
      next.delete(user.id);
      return next;
    });
  };

  const confirmUnfollow = async () => {
    if (!authUser || !unfollowUser) return;

    const user = unfollowUser;
    setUnfollowUser(null);
    
    setPendingFollow(prev => new Set([...prev, user.id]));
    
    // Optimistic update
    setUsers(prev => prev.map(u => 
      u.id === user.id ? { ...u, isFollowing: false } : u
    ));

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', authUser.id)
      .eq('following_id', user.id);

    if (error) {
      // Revert on error
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, isFollowing: true } : u
      ));
      toast({
        title: 'Error',
        description: 'Failed to unfollow user',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Unfollowed', description: `You unfollowed @${user.username}` });
    }

    setPendingFollow(prev => {
      const next = new Set(prev);
      next.delete(user.id);
      return next;
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[400px] max-h-[80vh] rounded-3xl">
          <DialogHeader>
            <DialogTitle>{type === 'followers' ? 'Followers' : 'Following'}</DialogTitle>
          </DialogHeader>

          <div className="py-4 overflow-y-auto max-h-96">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  {type === 'followers' ? 'No followers yet' : 'Not following anyone'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => {
                  const isOwnProfile = authUser?.id === user.id;
                  const isPending = pendingFollow.has(user.id);
                  
                  return (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-secondary/50 transition-colors"
                    >
                      <button
                        className="flex items-center gap-3 flex-1 text-left"
                        onClick={() => handleUserClick(user.username)}
                      >
                        <img
                          src={user.avatar_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=120&h=120&fit=crop&crop=face'}
                          alt={user.username}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{user.display_name}</p>
                          <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                        </div>
                      </button>
                      
                      {!isOwnProfile && (
                        <Button
                          size="sm"
                          variant={user.isFollowing ? "outline" : "default"}
                          className="rounded-full min-w-[90px]"
                          onClick={() => handleFollowToggle(user)}
                          disabled={isPending}
                        >
                          {isPending ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : user.isFollowing ? (
                            <>
                              <UserCheck className="w-4 h-4 mr-1" />
                              Following
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 mr-1" />
                              Follow
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Unfollow Confirmation Dialog */}
      <AlertDialog open={!!unfollowUser} onOpenChange={() => setUnfollowUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfollow @{unfollowUser?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unfollow this user?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmUnfollow} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unfollow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FollowersModal;
