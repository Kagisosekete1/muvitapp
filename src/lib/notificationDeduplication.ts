/**
 * Utility to deduplicate notifications
 * Groups notifications by type, from_user_id, and reel_id to show only one per unique interaction
 */

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

/**
 * Creates a unique key for a notification based on its interaction type
 * For likes/comments on the same reel from the same user, only keep the latest
 */
const getNotificationKey = (notif: Notification): string => {
  // For likes and comments, group by user + reel
  if ((notif.type === 'like' || notif.type === 'comment') && notif.reel_id) {
    return `${notif.type}:${notif.from_user_id}:${notif.reel_id}`;
  }
  // For follows, group by user only
  if (notif.type === 'follow') {
    return `${notif.type}:${notif.from_user_id}`;
  }
  // For other types, use the unique id
  return notif.id;
};

/**
 * Deduplicate notifications, keeping only the most recent one per unique interaction
 * @param notifications - Array of notifications to deduplicate
 * @returns Deduplicated array of notifications
 */
export const deduplicateNotifications = (notifications: Notification[]): Notification[] => {
  const seen = new Map<string, Notification>();
  
  // Process notifications from newest to oldest (assuming they're already sorted desc)
  // Only keep the first (most recent) occurrence of each unique interaction
  for (const notif of notifications) {
    const key = getNotificationKey(notif);
    if (!seen.has(key)) {
      seen.set(key, notif);
    }
  }
  
  // Convert back to array, preserving original order (most recent first)
  return Array.from(seen.values());
};

/**
 * Count unique notifications (for badge counts)
 */
export const countUniqueNotifications = (notifications: Notification[]): number => {
  return deduplicateNotifications(notifications.filter(n => !n.is_read)).length;
};
