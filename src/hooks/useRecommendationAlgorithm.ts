import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ReelData {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  user_id: string;
  created_at: string;
  category?: string;
  is_tutorial?: boolean;
}

interface WatchHistory {
  reel_id: string;
  watch_duration_seconds: number;
  total_video_duration_seconds: number | null;
}

interface EngagementScore {
  reelId: string;
  score: number;
  recencyBoost: number;
  engagementRate: number;
  trendingScore: number;
  personalScore: number;
}

// Weights for the recommendation algorithm
const WEIGHTS = {
  LIKES: 1.0,
  COMMENTS: 2.0,
  SHARES: 3.0,
  VIEWS: 0.1,
  RECENCY_DECAY: 0.95, // per day
  WATCH_COMPLETION: 5.0,
  CATEGORY_MATCH: 2.0,
  CREATOR_FOLLOW: 3.0,
  TRENDING_THRESHOLD: 0.8, // 80th percentile
};

export function useRecommendationAlgorithm(userId: string | null) {
  const [recommendedReels, setRecommendedReels] = useState<ReelData[]>([]);
  const [trendingReels, setTrendingReels] = useState<ReelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPreferences, setUserPreferences] = useState<{
    likedCategories: Map<string, number>;
    followedCreators: Set<string>;
    watchedReels: Set<string>;
  }>({
    likedCategories: new Map(),
    followedCreators: new Set(),
    watchedReels: new Set(),
  });

  // Fetch user's engagement history for personalization
  const fetchUserEngagement = useCallback(async () => {
    if (!userId) return;

    try {
      const [likesRes, followsRes, watchRes] = await Promise.all([
        supabase
          .from('likes')
          .select('reel_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId),
        supabase
          .from('watch_sessions')
          .select('reel_id, watch_duration_seconds, total_video_duration_seconds')
          .eq('viewer_id', userId)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      const likedReelIds = likesRes.data?.map(l => l.reel_id) || [];
      const followedIds = new Set(followsRes.data?.map(f => f.following_id) || []);
      const watchedReels = new Set(watchRes.data?.map(w => w.reel_id) || []);

      // Fetch categories of liked reels
      if (likedReelIds.length > 0) {
        const { data: likedReels } = await supabase
          .from('reels')
          .select('category')
          .in('id', likedReelIds);

        const categoryCount = new Map<string, number>();
        likedReels?.forEach(r => {
          const cat = r.category || 'other';
          categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
        });

        setUserPreferences({
          likedCategories: categoryCount,
          followedCreators: followedIds,
          watchedReels,
        });
      }
    } catch (error) {
      console.error('Error fetching user engagement:', error);
    }
  }, [userId]);

  // Calculate engagement score for a reel
  const calculateEngagementScore = useCallback((
    reel: ReelData,
    preferences: typeof userPreferences
  ): EngagementScore => {
    const now = new Date();
    const createdAt = new Date(reel.created_at);
    const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // Base engagement metrics
    const engagementTotal = 
      (reel.likes_count * WEIGHTS.LIKES) +
      (reel.comments_count * WEIGHTS.COMMENTS) +
      (reel.shares_count * WEIGHTS.SHARES) +
      (reel.views_count * WEIGHTS.VIEWS);

    // Engagement rate (engagement per view)
    const engagementRate = reel.views_count > 0 
      ? engagementTotal / reel.views_count 
      : 0;

    // Recency boost (newer content gets priority)
    const recencyBoost = Math.pow(WEIGHTS.RECENCY_DECAY, daysSinceCreation);

    // Trending score (high engagement in short time)
    const hoursOld = Math.max(daysSinceCreation * 24, 1);
    const trendingScore = engagementTotal / hoursOld;

    // Personal relevance score
    let personalScore = 0;
    
    // Boost for followed creators
    if (preferences.followedCreators.has(reel.user_id)) {
      personalScore += WEIGHTS.CREATOR_FOLLOW;
    }
    
    // Boost for preferred categories
    const categoryWeight = preferences.likedCategories.get(reel.category || 'other') || 0;
    personalScore += categoryWeight * WEIGHTS.CATEGORY_MATCH;

    // Penalty for already watched
    if (preferences.watchedReels.has(reel.id)) {
      personalScore -= 2;
    }

    // Final score
    const score = (engagementTotal * recencyBoost) + personalScore + (trendingScore * 0.5);

    return {
      reelId: reel.id,
      score,
      recencyBoost,
      engagementRate,
      trendingScore,
      personalScore,
    };
  }, []);

  // Fetch and rank reels
  const fetchRecommendations = useCallback(async () => {
    setLoading(true);

    try {
      // Fetch recent reels with good performance
      const { data: reels, error } = await supabase
        .from('reels')
        .select(`
          id,
          title,
          description,
          video_url,
          thumbnail_url,
          likes_count,
          comments_count,
          shares_count,
          views_count,
          user_id,
          created_at,
          category,
          is_tutorial
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (!reels || reels.length === 0) {
        setRecommendedReels([]);
        setTrendingReels([]);
        return;
      }

      // Calculate scores for all reels
      const scoredReels = reels.map(reel => ({
        reel,
        scores: calculateEngagementScore(reel, userPreferences),
      }));

      // Sort by overall score for recommendations
      const sortedByScore = [...scoredReels].sort((a, b) => b.scores.score - a.scores.score);
      
      // Sort by trending score for trending section
      const sortedByTrending = [...scoredReels].sort((a, b) => b.scores.trendingScore - a.scores.trendingScore);

      // Get top trending (80th percentile threshold)
      const trendingThreshold = scoredReels.length > 0
        ? sortedByTrending[Math.floor(sortedByTrending.length * 0.2)]?.scores.trendingScore || 0
        : 0;

      const trending = sortedByTrending
        .filter(r => r.scores.trendingScore >= trendingThreshold)
        .slice(0, 20)
        .map(r => r.reel);

      // Recommendations with some diversity
      // Mix: 60% personalized, 30% trending, 10% random discovery
      const personalized = sortedByScore.slice(0, 30);
      const trendingMix = sortedByTrending.slice(0, 15);
      const randomDiscovery = [...scoredReels]
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);

      // Combine and deduplicate
      const combinedMap = new Map<string, ReelData>();
      
      personalized.forEach(r => combinedMap.set(r.reel.id, r.reel));
      trendingMix.forEach(r => {
        if (!combinedMap.has(r.reel.id)) {
          combinedMap.set(r.reel.id, r.reel);
        }
      });
      randomDiscovery.forEach(r => {
        if (!combinedMap.has(r.reel.id)) {
          combinedMap.set(r.reel.id, r.reel);
        }
      });

      // Final shuffle for natural feel
      const recommended = Array.from(combinedMap.values())
        .sort(() => Math.random() - 0.3);

      setRecommendedReels(recommended);
      setTrendingReels(trending);

    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  }, [userPreferences, calculateEngagementScore]);

  // Initialize
  useEffect(() => {
    fetchUserEngagement();
  }, [fetchUserEngagement]);

  // Fetch recommendations when preferences are loaded
  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Refresh recommendations
  const refresh = useCallback(async () => {
    await fetchUserEngagement();
    await fetchRecommendations();
  }, [fetchUserEngagement, fetchRecommendations]);

  return {
    recommendedReels,
    trendingReels,
    loading,
    refresh,
    userPreferences,
  };
}

// Helper function to get trending score for external use
export function calculateTrendingScore(reel: {
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  created_at: string;
}): number {
  const now = new Date();
  const createdAt = new Date(reel.created_at);
  const hoursOld = Math.max(
    (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60),
    1
  );

  const engagementTotal = 
    (reel.likes_count * WEIGHTS.LIKES) +
    (reel.comments_count * WEIGHTS.COMMENTS) +
    (reel.shares_count * WEIGHTS.SHARES) +
    (reel.views_count * WEIGHTS.VIEWS);

  return engagementTotal / hoursOld;
}
