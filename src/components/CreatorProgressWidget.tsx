import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  DollarSign,
  ChevronRight,
  CheckCircle,
  Target,
  Flame,
  Star
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

interface CreatorProgressWidgetProps {
  onOpenDashboard: () => void;
  compact?: boolean;
}

interface ProgressStats {
  followers: number;
  watchHours: number;
  weeklyUploads: number;
  engagement: number;
  isEligible: boolean;
}

const FOLLOWER_GOAL = 6000;
const WATCH_HOURS_GOAL = 2000000;

const CreatorProgressWidget: React.FC<CreatorProgressWidgetProps> = ({
  onOpenDashboard,
  compact = false,
}) => {
  const { currentUser, authUser } = useUser();
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [animatedFollowers, setAnimatedFollowers] = useState(0);
  const [animatedWatchHours, setAnimatedWatchHours] = useState(0);

  useEffect(() => {
    if (authUser) {
      fetchStats();
    }
  }, [authUser]);

  // Animate progress numbers
  useEffect(() => {
    if (!stats) return;

    const followerDuration = 1000;
    const watchDuration = 1000;
    const followerStep = stats.followers / (followerDuration / 16);
    const watchStep = stats.watchHours / (watchDuration / 16);

    let followerCount = 0;
    let watchCount = 0;

    const followerInterval = setInterval(() => {
      followerCount += followerStep;
      if (followerCount >= stats.followers) {
        setAnimatedFollowers(stats.followers);
        clearInterval(followerInterval);
      } else {
        setAnimatedFollowers(Math.floor(followerCount));
      }
    }, 16);

    const watchInterval = setInterval(() => {
      watchCount += watchStep;
      if (watchCount >= stats.watchHours) {
        setAnimatedWatchHours(stats.watchHours);
        clearInterval(watchInterval);
      } else {
        setAnimatedWatchHours(Math.floor(watchCount));
      }
    }, 16);

    return () => {
      clearInterval(followerInterval);
      clearInterval(watchInterval);
    };
  }, [stats]);

  const fetchStats = async () => {
    if (!authUser) return;
    setLoading(true);

    try {
      // Fetch reels for this user
      const { data: reels } = await supabase
        .from('reels')
        .select('views_count, likes_count, comments_count, shares_count, created_at')
        .eq('user_id', authUser.id);

      const totalViews = reels?.reduce((sum, r) => sum + (r.views_count || 0), 0) || 0;
      const totalLikes = reels?.reduce((sum, r) => sum + (r.likes_count || 0), 0) || 0;
      const totalComments = reels?.reduce((sum, r) => sum + (r.comments_count || 0), 0) || 0;
      const totalShares = reels?.reduce((sum, r) => sum + (r.shares_count || 0), 0) || 0;
      
      // Calculate watch hours (assuming avg 30 second videos)
      const watchHours = Math.floor((totalViews * 30) / 3600);
      
      // Calculate engagement rate
      const engagement = totalViews > 0 
        ? ((totalLikes + totalComments + totalShares) / totalViews * 100) 
        : 0;

      // Weekly uploads
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weeklyUploads = reels?.filter(r => new Date(r.created_at) > oneWeekAgo).length || 0;

      const followers = currentUser?.stats?.followers || 0;
      const isEligible = followers >= FOLLOWER_GOAL && watchHours >= WATCH_HOURS_GOAL;

      setStats({
        followers,
        watchHours,
        weeklyUploads,
        engagement,
        isEligible,
      });
    } catch (error) {
      console.error('Error fetching creator stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading || !stats) {
    return (
      <div className="bg-secondary/30 rounded-2xl p-4 animate-pulse">
        <div className="h-20 bg-secondary/50 rounded-xl" />
      </div>
    );
  }

  const followerProgress = Math.min((stats.followers / FOLLOWER_GOAL) * 100, 100);
  const watchHoursProgress = Math.min((stats.watchHours / WATCH_HOURS_GOAL) * 100, 100);
  const overallProgress = (followerProgress + watchHoursProgress) / 2;

  if (compact) {
    return (
      <Button
        variant="outline"
        className="w-full rounded-2xl p-4 h-auto justify-between border-primary/20 bg-primary/5 hover:bg-primary/10"
        onClick={onOpenDashboard}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            {stats.isEligible ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <Target className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm">
              {stats.isEligible ? 'Monetization Active!' : 'Creator Progress'}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.isEligible ? 'You\'re earning!' : `${overallProgress.toFixed(0)}% to goal`}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10 rounded-2xl p-4 border border-primary/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {stats.isEligible ? (
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-sm">
              {stats.isEligible ? 'You\'re Monetized!' : 'Path to Monetization'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {stats.isEligible ? 'Keep creating great content' : 'Keep going, you\'re doing great!'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={onOpenDashboard}
        >
          View Details
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Progress Bars */}
      <div className="space-y-3">
        {/* Followers */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              Followers
            </span>
            <span className="font-medium">
              {formatNumber(animatedFollowers)} / {formatNumber(FOLLOWER_GOAL)}
            </span>
          </div>
          <div className="relative">
            <Progress value={followerProgress} className="h-2" />
            {followerProgress >= 100 && (
              <CheckCircle className="absolute -right-1 -top-1 w-4 h-4 text-green-500 bg-background rounded-full" />
            )}
          </div>
        </div>

        {/* Watch Hours */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Watch Hours
            </span>
            <span className="font-medium">
              {formatNumber(animatedWatchHours)} / {formatNumber(WATCH_HOURS_GOAL)}
            </span>
          </div>
          <div className="relative">
            <Progress value={watchHoursProgress} className="h-2" />
            {watchHoursProgress >= 100 && (
              <CheckCircle className="absolute -right-1 -top-1 w-4 h-4 text-green-500 bg-background rounded-full" />
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border/50">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            <span className="text-sm font-bold">{stats.weeklyUploads}</span>
          </div>
          <p className="text-xs text-muted-foreground">Weekly</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-sm font-bold">{stats.engagement.toFixed(1)}%</span>
          </div>
          <p className="text-xs text-muted-foreground">Engage</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <Star className="w-3 h-3 text-yellow-500" />
            <span className="text-sm font-bold">{overallProgress.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-muted-foreground">Progress</p>
        </div>
      </div>
    </div>
  );
};

export default CreatorProgressWidget;
