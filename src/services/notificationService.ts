import { supabase } from '@/integrations/supabase/client';

/**
 * Service to handle sending push notifications for various events
 */

interface NotificationPayload {
  userId: string;
  fromUserId: string;
  type: 'like' | 'comment' | 'follow' | 'new_reel' | 'comment_reply' | 'mention' | 'repost' | 'battle_challenge' | 'battle_win' | 'battle_loss' | 'live' | 'live_start' | 'live_started';
  reelId?: string;
  liveSessionId?: string;
  message?: string;
}

/**
 * Send a push notification to a user
 */
export const sendPushNotification = async (payload: NotificationPayload): Promise<void> => {
  try {
    if (payload.userId === payload.fromUserId) return;
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: payload,
    });

    if (error) {
      console.error('Failed to send push notification:', error);
    }
  } catch (err) {
    console.error('Error invoking push notification function:', err);
  }
};

const serverHandled = (eventName: string) => {
  if (import.meta.env.DEV) {
    console.debug(`[notifications] ${eventName} push is handled by Supabase triggers and the OneSignal dispatcher.`);
  }
};

/**
 * Check if a notification already exists to prevent duplicates
 */
const checkNotificationExists = async (
  userId: string,
  fromUserId: string,
  type: string,
  reelId?: string,
  timeWindowMs: number = 60000 // 1 minute window
): Promise<boolean> => {
  try {
    const since = new Date(Date.now() - timeWindowMs).toISOString();
    
    let query = supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('from_user_id', fromUserId)
      .eq('type', type)
      .gte('created_at', since);
    
    if (reelId) {
      query = query.eq('reel_id', reelId);
    }
    
    const { data } = await query.limit(1);
    return (data && data.length > 0);
  } catch {
    return false;
  }
};

/**
 * Send notification when someone likes a reel
 */
export const sendLikeNotification = async (
  reelOwnerId: string,
  likerId: string,
  reelId: string
): Promise<void> => {
  // Don't notify if user liked their own reel
  if (reelOwnerId === likerId) return;

  // Check for duplicate notification
  const exists = await checkNotificationExists(reelOwnerId, likerId, 'like', reelId);
  if (exists) return;

  await sendPushNotification({
    userId: reelOwnerId,
    fromUserId: likerId,
    type: 'like',
    reelId,
  });
};

/**
 * Send notification when someone comments on a reel
 */
export const sendCommentNotification = async (
  reelOwnerId: string,
  commenterId: string,
  reelId: string,
  commentText: string
): Promise<void> => {
  // Don't notify if user commented on their own reel
  if (reelOwnerId === commenterId) return;

  // Check for duplicate notification (5 second window for comments)
  const exists = await checkNotificationExists(reelOwnerId, commenterId, 'comment', reelId, 5000);
  if (exists) return;

  await sendPushNotification({
    userId: reelOwnerId,
    fromUserId: commenterId,
    type: 'comment',
    reelId,
    message: commentText.slice(0, 100), // Truncate long comments
  });
};

/**
 * Send notification when someone replies to a comment
 */
export const sendCommentReplyNotification = async (
  originalCommenterId: string,
  replierId: string,
  reelId: string,
  replyText: string
): Promise<void> => {
  // Don't notify if user replied to their own comment
  if (originalCommenterId === replierId) return;

  // Check for duplicate notification (5 second window for replies)
  const exists = await checkNotificationExists(originalCommenterId, replierId, 'comment_reply', reelId, 5000);
  if (exists) return;

  await sendPushNotification({
    userId: originalCommenterId,
    fromUserId: replierId,
    type: 'comment_reply',
    reelId,
    message: replyText.slice(0, 100),
  });
};

/**
 * Send notification when someone follows a user
 */
export const sendFollowNotification = async (
  followedUserId: string,
  followerId: string
): Promise<void> => {
  if (followedUserId === followerId) return;
  // Check for duplicate notification
  const exists = await checkNotificationExists(followedUserId, followerId, 'follow');
  if (exists) return;

  await sendPushNotification({
    userId: followedUserId,
    fromUserId: followerId,
    type: 'follow',
  });
};

export const sendMentionNotification = async (
  mentionedUserId: string,
  actorId: string,
  reelId?: string,
  message?: string
): Promise<void> => {
  if (mentionedUserId === actorId) return;

  const exists = await checkNotificationExists(mentionedUserId, actorId, 'mention', reelId, 10_000);
  if (exists) return;

  await sendPushNotification({
    userId: mentionedUserId,
    fromUserId: actorId,
    type: 'mention',
    reelId,
    message,
  });
};

export const sendRepostNotification = async (
  reelOwnerId: string,
  reposterId: string,
  reelId: string
): Promise<void> => {
  if (reelOwnerId === reposterId) return;
  const exists = await checkNotificationExists(reelOwnerId, reposterId, 'repost', reelId, 60_000);
  if (exists) return;

  await sendPushNotification({
    userId: reelOwnerId,
    fromUserId: reposterId,
    type: 'repost',
    reelId,
  });
};

/**
 * Send notification to followers when a user posts a new reel
 */
export const sendNewReelNotification = async (
  creatorId: string,
  reelId: string,
  reelTitle: string
): Promise<void> => {
  try {
    // Get all followers of the creator
    const { data: followers } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', creatorId);

    if (!followers || followers.length === 0) return;

    // Send notification to each follower (limited to first 100 for performance)
    const notificationPromises = followers.slice(0, 100).map(async (follower) => {
      // Avoid duplicates for the same "new_reel" within a short window
      const exists = await checkNotificationExists(
        follower.follower_id,
        creatorId,
        'new_reel',
        reelId,
        60000
      );
      if (exists) return;

      await sendPushNotification({
        userId: follower.follower_id,
        fromUserId: creatorId,
        type: 'new_reel',
        reelId,
        message: reelTitle,
      });
    });

    await Promise.allSettled(notificationPromises);
  } catch (err) {
    console.error('Error sending new reel notifications:', err);
  }
};

export const sendLiveStartNotification = async (
  followerId: string,
  streamerId: string,
  liveSessionId: string,
  liveTitle: string
): Promise<void> => {
  if (followerId === streamerId) return;

  const exists = await checkNotificationExists(followerId, streamerId, 'live_start', undefined, 60_000);
  if (exists) return;

  await sendPushNotification({
    userId: followerId,
    fromUserId: streamerId,
    type: 'live_start',
    liveSessionId,
    message: liveTitle,
  });
};
