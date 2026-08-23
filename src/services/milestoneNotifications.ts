import { supabase } from '@/integrations/supabase/client';
import { PAYOUT_THRESHOLDS, ELIGIBILITY } from '@/lib/monetization';

/**
 * Service to send push notifications for creator milestones
 */

interface MilestoneCheckResult {
  milestone: string;
  achieved: boolean;
  value: number;
  threshold: number;
}

/**
 * Check and notify for payout threshold reached
 */
export const checkPayoutThresholdMilestone = async (
  userId: string,
  currentEarnings: number,
  countryCode: string
): Promise<MilestoneCheckResult | null> => {
  const threshold = PAYOUT_THRESHOLDS[countryCode] || PAYOUT_THRESHOLDS.DEFAULT;
  
  if (currentEarnings >= threshold) {
    // Check if we've already notified for this milestone
    const { data: existingNotification } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'milestone')
      .eq('message', 'payout_threshold')
      .limit(1);
    
    if (!existingNotification || existingNotification.length === 0) {
      // Create milestone notification
      await supabase.from('notifications').insert({
        user_id: userId,
        from_user_id: userId, // Self-notification
        type: 'milestone',
        message: 'payout_threshold',
      });

      // Trigger push notification
      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId,
          fromUserId: userId,
          type: 'milestone',
          message: `🎉 Congratulations! You've reached the payout threshold of $${threshold}! Request your payout now.`,
        },
      });

      return {
        milestone: 'payout_threshold',
        achieved: true,
        value: currentEarnings,
        threshold,
      };
    }
  }
  
  return null;
};

/**
 * Check and notify for follower milestones
 */
export const checkFollowerMilestones = async (
  userId: string,
  followerCount: number
): Promise<MilestoneCheckResult | null> => {
  const milestones = [100, 500, 1000, 5000, 10000, 50000, 100000, 1000000];
  
  for (const milestone of milestones) {
    if (followerCount >= milestone) {
      const milestoneKey = `followers_${milestone}`;
      
      // Check if already notified
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'milestone')
        .eq('message', milestoneKey)
        .limit(1);
      
      if (!existingNotification || existingNotification.length === 0) {
        await supabase.from('notifications').insert({
          user_id: userId,
          from_user_id: userId,
          type: 'milestone',
          message: milestoneKey,
        });

        const formattedMilestone = milestone >= 1000000 
          ? `${milestone / 1000000}M` 
          : milestone >= 1000 
            ? `${milestone / 1000}K` 
            : milestone.toString();

        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId,
            fromUserId: userId,
            type: 'milestone',
            message: `🎉 Amazing! You've reached ${formattedMilestone} followers!`,
          },
        });

        return {
          milestone: milestoneKey,
          achieved: true,
          value: followerCount,
          threshold: milestone,
        };
      }
    }
  }
  
  return null;
};

/**
 * Check and notify for view milestones on a single reel
 */
export const checkViewMilestones = async (
  userId: string,
  reelId: string,
  viewCount: number
): Promise<MilestoneCheckResult | null> => {
  const milestones = [1000, 10000, 100000, 1000000, 10000000];
  
  for (const milestone of milestones) {
    if (viewCount >= milestone) {
      const milestoneKey = `views_${reelId}_${milestone}`;
      
      // Check if already notified
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'milestone')
        .eq('reel_id', reelId)
        .eq('message', `views_${milestone}`)
        .limit(1);
      
      if (!existingNotification || existingNotification.length === 0) {
        await supabase.from('notifications').insert({
          user_id: userId,
          from_user_id: userId,
          type: 'milestone',
          reel_id: reelId,
          message: `views_${milestone}`,
        });

        const formattedMilestone = milestone >= 1000000 
          ? `${milestone / 1000000}M` 
          : `${milestone / 1000}K`;

        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId,
            fromUserId: userId,
            type: 'milestone',
            reelId,
            message: `🔥 Your Muv just hit ${formattedMilestone} views!`,
          },
        });

        return {
          milestone: milestoneKey,
          achieved: true,
          value: viewCount,
          threshold: milestone,
        };
      }
    }
  }
  
  return null;
};

/**
 * Check and notify when user becomes eligible for monetization
 */
export const checkMonetizationEligibility = async (
  userId: string,
  followers: number,
  watchHours: number,
  reelsCount: number
): Promise<MilestoneCheckResult | null> => {
  const isEligible = 
    followers >= ELIGIBILITY.MIN_FOLLOWERS && 
    watchHours >= ELIGIBILITY.MIN_WATCH_HOURS &&
    reelsCount >= ELIGIBILITY.MIN_REELS;
  
  if (isEligible) {
    // Check if already notified
    const { data: existingNotification } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'milestone')
      .eq('message', 'monetization_eligible')
      .limit(1);
    
    if (!existingNotification || existingNotification.length === 0) {
      await supabase.from('notifications').insert({
        user_id: userId,
        from_user_id: userId,
        type: 'milestone',
        message: 'monetization_eligible',
      });

      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId,
          fromUserId: userId,
          type: 'milestone',
          message: `🎉 Congratulations! You're now eligible for monetization! Start earning from your content today.`,
        },
      });

      return {
        milestone: 'monetization_eligible',
        achieved: true,
        value: followers,
        threshold: ELIGIBILITY.MIN_FOLLOWERS,
      };
    }
  }
  
  return null;
};

/**
 * Check and notify for significant engagement (viral content)
 */
export const checkViralContentMilestone = async (
  userId: string,
  reelId: string,
  engagementRate: number // as percentage
): Promise<MilestoneCheckResult | null> => {
  // Consider content viral if engagement rate is above 10%
  const viralThreshold = 10;
  
  if (engagementRate >= viralThreshold) {
    const milestoneKey = `viral_${reelId}`;
    
    // Check if already notified
    const { data: existingNotification } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'milestone')
      .eq('reel_id', reelId)
      .eq('message', 'viral_content')
      .limit(1);
    
    if (!existingNotification || existingNotification.length === 0) {
      await supabase.from('notifications').insert({
        user_id: userId,
        from_user_id: userId,
        type: 'milestone',
        reel_id: reelId,
        message: 'viral_content',
      });

      await supabase.functions.invoke('send-push-notification', {
        body: {
          userId,
          fromUserId: userId,
          type: 'milestone',
          reelId,
          message: `🚀 Your Muv is going viral! ${engagementRate.toFixed(1)}% engagement rate!`,
        },
      });

      return {
        milestone: milestoneKey,
        achieved: true,
        value: engagementRate,
        threshold: viralThreshold,
      };
    }
  }
  
  return null;
};
