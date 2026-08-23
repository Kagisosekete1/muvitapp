import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile } from '@/types/user';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { getAutoSavePreference } from '@/hooks/useSavedAccounts';
import type { SavedAccount } from '@/hooks/useSavedAccounts';

interface UserContextType {
  currentUser: UserProfile | null;
  authUser: User | null;
  loading: boolean;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  signOut: () => Promise<void>;
  followUser: (userId: string) => void;
  unfollowUser: (userId: string) => void;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data || error) return;

    // IMPORTANT: follows.follower_id / follows.following_id store AUTH USER IDs
    const [{ count: followingCount }, { count: followersCount }, { count: reelsCount }] = await Promise.all([
      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId),
      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('reels')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    setCurrentUser({
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      bio: data.bio || '',
      verified: data.verified || false,
      stats: {
        following: followingCount || 0,
        followers: followersCount || 0,
        reels: reelsCount || 0,
      },
    });
  };

  const refreshProfile = async () => {
    if (authUser) {
      await fetchProfile(authUser.id);
    }
  };

  useEffect(() => {
    // Initialize OneSignal once. Safe to call on every mount – internal guards handle re-entry.
    import('@/services/oneSignalService').then(({ initOneSignal }) => initOneSignal());

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 0);

        // Auto-save account on sign-in if preference is enabled
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && getAutoSavePreference()) {
          setTimeout(() => {
            autoSaveCurrentSession(session);
          }, 500); // small delay to let profile load
        }

        // Register the OneSignal identity + persist player id
        import('@/services/oneSignalService').then(({ loginOneSignalUser }) =>
          loginOneSignalUser(session.user.id)
        );
      } else {
        setCurrentUser(null);
        import('@/services/oneSignalService').then(({ logoutOneSignalUser }) => logoutOneSignalUser());
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        import('@/services/oneSignalService').then(({ loginOneSignalUser }) =>
          loginOneSignalUser(session.user.id)
        );
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);


  // Auto-save the current session to localStorage
  const autoSaveCurrentSession = async (session: any) => {
    if (!session?.user || !session?.refresh_token) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!profile) return;

      const STORAGE_KEY = 'muvit_saved_accounts';
      const MAX_ACCOUNTS = 4;
      let accounts: SavedAccount[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        accounts = raw ? JSON.parse(raw) : [];
      } catch { /* empty */ }

      const newAccount: SavedAccount = {
        userId: session.user.id,
        email: session.user.email || '',
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url || '',
        refreshToken: session.refresh_token,
        savedAt: Date.now(),
      };

      const filtered = accounts.filter((a: SavedAccount) => a.userId !== session.user.id);
      const next = [newAccount, ...filtered].slice(0, MAX_ACCOUNTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // silently fail — auto-save is best-effort
    }
  };

  // Realtime: keep own Following/Followers counts in sync everywhere
  useEffect(() => {
    if (!authUser) return;

    const channel = supabase
      .channel(`profile-counts-${authUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `follower_id=eq.${authUser.id}`,
        },
        () => {
          void fetchProfile(authUser.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `following_id=eq.${authUser.id}`,
        },
        () => {
          void fetchProfile(authUser.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser?.id]);

  const updateUser = async (updates: Partial<UserProfile>) => {
    if (!authUser) return;

    const dbUpdates: Record<string, any> = {};
    if (updates.username) dbUpdates.username = updates.username;
    if (updates.displayName) dbUpdates.display_name = updates.displayName;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.avatarUrl) dbUpdates.avatar_url = updates.avatarUrl;

    await supabase.from('profiles').update(dbUpdates).eq('user_id', authUser.id);
    setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setAuthUser(null);
  };

  const followUser = async (targetUserId: string) => {
    if (!authUser || !currentUser) return;
    if (!targetUserId) return;

    try {
      // Idempotent follow
      const { data: existing } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', authUser.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: authUser.id,
            following_id: targetUserId,
          });

        if (error) return;

        setCurrentUser(prev => prev ? {
          ...prev,
          stats: { ...prev.stats, following: prev.stats.following + 1 }
        } : null);
      }
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const unfollowUser = async (targetUserId: string) => {
    if (!authUser || !currentUser) return;
    if (!targetUserId) return;

    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', authUser.id)
        .eq('following_id', targetUserId);

      if (!error) {
        setCurrentUser(prev => prev ? {
          ...prev,
          stats: { ...prev.stats, following: Math.max(0, prev.stats.following - 1) }
        } : null);
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  return (
    <UserContext.Provider value={{ currentUser, authUser, loading, updateUser, signOut, followUser, unfollowUser, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};
