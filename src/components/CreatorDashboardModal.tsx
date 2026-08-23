import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  Users, 
  Clock, 
  TrendingUp, 
  Star,
  CheckCircle,
  XCircle,
  Info,
  ArrowLeft,
  Eye,
  Heart,
  Video,
  Gift,
  Trophy,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface CreatorDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CreatorStats {
  followers: number;
  totalWatchHours: number;
  totalViews: number;
  totalLikes: number;
  totalReels: number;
  avgEngagement: number;
  weeklyUploads: number;
  isEligible: boolean;
  weeklyStats: { day: string; views: number; likes: number }[];
  reelPerformance: { title: string; views: number; likes: number }[];
}

const FOLLOWER_GOAL = 6000;
const WATCH_HOURS_GOAL = 2000000;

const CreatorDashboardModal: React.FC<CreatorDashboardModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, authUser } = useUser();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (isOpen && authUser) {
      fetchCreatorStats();
    }
  }, [isOpen, authUser]);

  const fetchCreatorStats = async () => {
    if (!authUser) return;
    setLoading(true);

    try {
      // Fetch all user's reels
      const { data: reels } = await supabase
        .from('reels')
        .select('id, title, views_count, likes_count, comments_count, shares_count, created_at')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });

      const totalViews = reels?.reduce((sum, r) => sum + (r.views_count || 0), 0) || 0;
      const totalLikes = reels?.reduce((sum, r) => sum + (r.likes_count || 0), 0) || 0;
      const totalComments = reels?.reduce((sum, r) => sum + (r.comments_count || 0), 0) || 0;
      const totalShares = reels?.reduce((sum, r) => sum + (r.shares_count || 0), 0) || 0;
      
      // Calculate watch hours (assuming avg 30 second videos, convert to hours)
      const totalWatchHours = Math.floor((totalViews * 30) / 3600);
      
      // Calculate avg engagement
      const avgEngagement = totalViews > 0 
        ? ((totalLikes + totalComments + totalShares) / totalViews * 100) 
        : 0;

      // Calculate weekly uploads
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weeklyUploads = reels?.filter(r => new Date(r.created_at) > oneWeekAgo).length || 0;

      // Generate weekly stats
      const weeklyStats = generateWeeklyStats(reels || []);
      
      // Top performing reels
      const reelPerformance = (reels || [])
        .slice(0, 5)
        .map(r => ({
          title: r.title.length > 20 ? r.title.substring(0, 20) + '...' : r.title,
          views: r.views_count || 0,
          likes: r.likes_count || 0,
        }));

      const followers = currentUser?.stats?.followers || 0;
      const isEligible = followers >= FOLLOWER_GOAL && totalWatchHours >= WATCH_HOURS_GOAL;

      setStats({
        followers,
        totalWatchHours,
        totalViews,
        totalLikes,
        totalReels: reels?.length || 0,
        avgEngagement,
        weeklyUploads,
        isEligible,
        weeklyStats,
        reelPerformance,
      });
    } catch (error) {
      console.error('Error fetching creator stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateWeeklyStats = (reels: any[]) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const stats = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayName = days[date.getDay()];
      
      // Simulate daily distribution from reels
      const dayReels = reels.filter(r => {
        const reelDate = new Date(r.created_at);
        return reelDate.toDateString() === date.toDateString();
      });

      const views = dayReels.reduce((sum, r) => sum + (r.views_count || 0), 0);
      const likes = dayReels.reduce((sum, r) => sum + (r.likes_count || 0), 0);

      stats.push({ day: dayName, views, likes });
    }

    return stats;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const followerProgress = stats ? Math.min((stats.followers / FOLLOWER_GOAL) * 100, 100) : 0;
  const watchHoursProgress = stats ? Math.min((stats.totalWatchHours / WATCH_HOURS_GOAL) * 100, 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card border-border rounded-3xl p-0">
        <DialogHeader className="p-4 pb-2 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <DialogTitle className="text-lg font-semibold">Creator Dashboard</DialogTitle>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : stats ? (
          <div className="p-4 space-y-6">
            {/* Monetization Status Banner */}
            <div className={`rounded-2xl p-4 ${stats.isEligible ? 'bg-green-500/20 border border-green-500/30' : 'bg-primary/10 border border-primary/20'}`}>
              <div className="flex items-center gap-3 mb-3">
                {stats.isEligible ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <DollarSign className="w-6 h-6 text-primary" />
                )}
                <div>
                  <h3 className="font-bold">
                    {stats.isEligible ? 'You\'re eligible for monetization!' : 'Path to Monetization'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {stats.isEligible ? 'Apply now to start earning' : 'Keep growing to unlock earnings'}
                  </p>
                </div>
              </div>
              
              {!stats.isEligible && (
                <div className="space-y-4">
                  {/* Followers Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Followers
                      </span>
                      <span className="font-medium">{formatNumber(stats.followers)} / {formatNumber(FOLLOWER_GOAL)}</span>
                    </div>
                    <Progress value={followerProgress} className="h-2" />
                  </div>
                  
                  {/* Watch Hours Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Public Watch Hours
                      </span>
                      <span className="font-medium">{formatNumber(stats.totalWatchHours)} / {formatNumber(WATCH_HOURS_GOAL)}</span>
                    </div>
                    <Progress value={watchHoursProgress} className="h-2" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-secondary/30 rounded-xl p-3 text-center">
                <Eye className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{formatNumber(stats.totalViews)}</p>
                <p className="text-xs text-muted-foreground">Total Views</p>
              </div>
              <div className="bg-secondary/30 rounded-xl p-3 text-center">
                <Heart className="w-5 h-5 mx-auto mb-1 text-red-500" />
                <p className="text-lg font-bold">{formatNumber(stats.totalLikes)}</p>
                <p className="text-xs text-muted-foreground">Total Likes</p>
              </div>
              <div className="bg-secondary/30 rounded-xl p-3 text-center">
                <Video className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <p className="text-lg font-bold">{stats.totalReels}</p>
                <p className="text-xs text-muted-foreground">Muv'z</p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-3 rounded-xl">
                <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
                <TabsTrigger value="earnings" className="rounded-lg">Earnings</TabsTrigger>
                <TabsTrigger value="tips" className="rounded-lg">Tips</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                {/* Engagement & Uploads */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      <span className="text-sm text-muted-foreground">Engagement</span>
                    </div>
                    <p className="text-xl font-bold">{stats.avgEngagement.toFixed(1)}%</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      <span className="text-sm text-muted-foreground">Weekly Uploads</span>
                    </div>
                    <p className="text-xl font-bold">{stats.weeklyUploads}/5</p>
                    <p className="text-xs text-muted-foreground">Recommended</p>
                  </div>
                </div>

                {/* Weekly Performance Chart */}
                <div className="bg-secondary/30 rounded-xl p-4">
                  <h4 className="font-semibold mb-3">Weekly Performance</h4>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.weeklyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="views" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Performing Content */}
                {stats.reelPerformance.length > 0 && (
                  <div className="bg-secondary/30 rounded-xl p-4">
                    <h4 className="font-semibold mb-3">Top Performing Muv'z</h4>
                    <div className="space-y-2">
                      {stats.reelPerformance.map((reel, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium">{reel.title}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {formatNumber(reel.views)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              {formatNumber(reel.likes)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="earnings" className="mt-4 space-y-4">
                {/* How Creators Earn */}
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    How You Earn on Muv'it
                  </h4>
                  
                  <div className="bg-secondary/30 rounded-xl p-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h5 className="font-medium">Watch-Time Revenue Pool</h5>
                        <p className="text-sm text-muted-foreground">Earn based on total public watch hours and engagement (likes, shares, replays)</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                        <Gift className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div>
                        <h5 className="font-medium">Sponsored Dance Challenges</h5>
                        <p className="text-sm text-muted-foreground">Brands sponsor challenges. Earn bonuses based on your performance</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <h5 className="font-medium">Performance Bonuses</h5>
                        <p className="text-sm text-muted-foreground">Weekly/monthly rewards for trending, most-watched, or original dance content</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Eligibility Requirements */}
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4">
                  <h4 className="font-semibold mb-3">Monetization Requirements</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      {stats.followers >= FOLLOWER_GOAL ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      Minimum 6,000 followers
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      {stats.totalWatchHours >= WATCH_HOURS_GOAL ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      Minimum 2,000,000 public watch hours
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      {stats.weeklyUploads >= 3 ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      Frequent uploads (3-5 videos/week)
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Info className="w-4 h-4 text-muted-foreground" />
                      Follow community & copyright rules
                    </li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="tips" className="mt-4 space-y-4">
                <div className="bg-secondary/30 rounded-xl p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    How to Start Earning on Muv'it
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    To start earning on Muv'it, grow your followers, increase your watch hours, and upload consistently.
                    Once you reach 6,000 followers and 2 million public watch hours, you can apply for monetization.
                    The more people watch and engage with your dances, the more you earn.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="p-3 bg-background rounded-lg">
                      <h5 className="font-medium text-sm mb-1">📱 Post Consistently</h5>
                      <p className="text-xs text-muted-foreground">Upload 3-5 dance videos per week to stay relevant</p>
                    </div>
                    <div className="p-3 bg-background rounded-lg">
                      <h5 className="font-medium text-sm mb-1">🎵 Use Trending Sounds</h5>
                      <p className="text-xs text-muted-foreground">Jump on trending music and challenges early</p>
                    </div>
                    <div className="p-3 bg-background rounded-lg">
                      <h5 className="font-medium text-sm mb-1">💬 Engage With Community</h5>
                      <p className="text-xs text-muted-foreground">Reply to comments and collaborate with other creators</p>
                    </div>
                    <div className="p-3 bg-background rounded-lg">
                      <h5 className="font-medium text-sm mb-1">🎯 Create Original Content</h5>
                      <p className="text-xs text-muted-foreground">Original dances and tutorials perform better</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Unable to load creator stats
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreatorDashboardModal;
