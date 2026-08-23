import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

interface NotificationBadgeProps {
  className?: string;
  showDotOnly?: boolean;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ 
  className = '', 
  showDotOnly = false 
}) => {
  const { authUser } = useUser();
  const [counts, setCounts] = useState({ notifications: 0, messages: 0 });

  useEffect(() => {
    if (!authUser) return;

    const fetchCounts = async () => {
      // Get unread notifications count
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id)
        .eq('is_read', false);

      // Get unread messages count
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_one.eq.${authUser.id},participant_two.eq.${authUser.id}`);

      let msgCount = 0;
      if (convs && convs.length > 0) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', convs.map(c => c.id))
          .neq('sender_id', authUser.id)
          .eq('is_read', false);
        msgCount = count || 0;
      }

      setCounts({ notifications: notifCount || 0, messages: msgCount });
    };

    fetchCounts();

    // Real-time subscription for notifications
    const notifChannel = supabase
      .channel('badge-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${authUser.id}` },
        () => fetchCounts()
      )
      .subscribe();

    // Real-time subscription for messages
    const msgChannel = supabase
      .channel('badge-messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [authUser]);

  const total = counts.notifications + counts.messages;
  
  if (total === 0) return null;

  if (showDotOnly) {
    return (
      <div className={`w-2.5 h-2.5 bg-primary rounded-full animate-pulse ${className}`} />
    );
  }

  return (
    <div className={`min-w-[18px] h-[18px] px-1 bg-primary rounded-full flex items-center justify-center ${className}`}>
      <span className="text-[10px] font-bold text-primary-foreground">
        {total > 99 ? '99+' : total}
      </span>
    </div>
  );
};

export const useNotificationCountsDetailed = () => {
  const { authUser } = useUser();
  const [counts, setCounts] = useState({ notifications: 0, messages: 0 });

  useEffect(() => {
    if (!authUser) return;

    const fetchCounts = async () => {
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id)
        .eq('is_read', false);

      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_one.eq.${authUser.id},participant_two.eq.${authUser.id}`);

      let msgCount = 0;
      if (convs && convs.length > 0) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', convs.map(c => c.id))
          .neq('sender_id', authUser.id)
          .eq('is_read', false);
        msgCount = count || 0;
      }

      setCounts({ notifications: notifCount || 0, messages: msgCount });
    };

    fetchCounts();

    const channel = supabase
      .channel('split-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${authUser.id}` }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser]);

  return { counts };
};

export const useNotificationCounts = () => {
  const { authUser } = useUser();
  const [counts, setCounts] = useState({ notifications: 0, messages: 0 });

  useEffect(() => {
    if (!authUser) return;

    const fetchCounts = async () => {
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id)
        .eq('is_read', false);

      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_one.eq.${authUser.id},participant_two.eq.${authUser.id}`);

      let msgCount = 0;
      if (convs && convs.length > 0) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', convs.map(c => c.id))
          .neq('sender_id', authUser.id)
          .eq('is_read', false);
        msgCount = count || 0;
      }

      setCounts({ notifications: notifCount || 0, messages: msgCount });
    };

    fetchCounts();

    const channel = supabase
      .channel('hook-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${authUser.id}` }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser]);

  return counts;
};
