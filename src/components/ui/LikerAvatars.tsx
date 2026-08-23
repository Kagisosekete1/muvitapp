import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

interface LikerAvatarsProps {
  reelId: string;
  count: number;
  refreshKey?: number;
}

interface Liker {
  user_id: string;
  avatar_url: string | null;
  username: string;
  isMutual: boolean;
}

/**
 * Facebook-style stack of small avatars showing who liked a Muv.
 * Prefers mutual followers (people you follow that also liked).
 */
const LikerAvatars: React.FC<LikerAvatarsProps> = ({ reelId, count, refreshKey }) => {
  const { authUser } = useUser();
  const [likers, setLikers] = useState<Liker[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!reelId || count <= 0) {
      setLikers([]);
      return;
    }

    (async () => {
      // Pull most recent 30 likers
      const { data: likes } = await supabase
        .from('likes')
        .select('user_id, created_at')
        .eq('reel_id', reelId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (cancelled || !likes?.length) {
        setLikers([]);
        return;
      }

      const likerIds = [...new Set(likes.map(l => l.user_id))];

      // Who do I follow among the likers? (mutual-friend hint)
      let mutualSet = new Set<string>();
      if (authUser) {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', authUser.id)
          .in('following_id', likerIds);
        mutualSet = new Set((follows || []).map(f => f.following_id));
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, avatar_url, username')
        .in('user_id', likerIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      // Mutual first, then most recent — cap 3
      const ranked: Liker[] = likerIds
        .map(id => {
          const p = profileMap.get(id);
          if (!p) return null;
          return {
            user_id: id,
            avatar_url: p.avatar_url,
            username: p.username,
            isMutual: mutualSet.has(id),
          };
        })
        .filter(Boolean) as Liker[];

      ranked.sort((a, b) => Number(b.isMutual) - Number(a.isMutual));

      if (!cancelled) setLikers(ranked.slice(0, 3));
    })();

    return () => {
      cancelled = true;
    };
  }, [reelId, count, refreshKey, authUser?.id]);

  if (!likers.length) return null;

  return (
    <div className="flex -space-x-1.5 mt-0.5" aria-label="Recent likers">
      {likers.map((l, i) => (
        <img
          key={l.user_id}
          src={l.avatar_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=60&h=60&fit=crop&crop=face'}
          alt={l.username}
          title={l.isMutual ? `${l.username} (following)` : l.username}
          className={`w-3.5 h-3.5 rounded-full object-cover border border-white ${
            l.isMutual ? 'ring-1 ring-primary' : ''
          }`}
          style={{ zIndex: 10 - i }}
        />
      ))}
    </div>
  );
};

export default LikerAvatars;
