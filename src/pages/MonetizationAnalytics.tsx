import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  DollarSign, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2,
  TrendingUp,
  Calendar,
  Filter,
  ChevronDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { BottomNavigation } from '@/components/BottomNavigation';
import { 
  calculateReelEarnings, 
  calculateCreatorEarnings,
  checkEligibility,
  formatEarnings,
  CPM_RATES,
  ELIGIBILITY
} from '@/lib/monetization';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

interface ReelEarning {
  id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  earnings: number;
  created_at: string;
}

interface DailyEarning {
  date: string;
  earnings: number;
  views: number;
}

const MonetizationAnalytics: React.FC = () => {
  const navigate = useNavigate();
  const { authUser, currentUser } = useUser();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [reelEarnings, setReelEarnings] = useState<ReelEarning[]>([]);
  const [dailyEarnings, setDailyEarnings] = useState<DailyEarning[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalEarnings: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    engagementBreakdown: {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    },
  });
  const [eligibility, setEligibility] = useState<ReturnType<typeof checkEligibility> | null>(null);
  const [countryCode, setCountryCode] = useState('US');

  useEffect(() => {
    if (authUser) {
      // Fetch user's country code from profile
      supabase
        .from('profiles')
        .select('country_code')
        .eq('user_id', authUser.id)
        .single()
        .then(({ data }) => {
          if (data?.country_code) {
            setCountryCode(data.country_code);
          }
        });
      fetchAnalytics();
    }
  }, [authUser, timeRange]);

  const fetchAnalytics = async () => {
    if (!authUser) return;
    setLoading(true);

    try {
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        case 'all':
          startDate = new Date(0); // Beginning of time
          break;
      }

      // Fetch reels with stats
      let query = supabase
        .from('reels')
        .select('id, title, views_count, likes_count, comments_count, shares_count, created_at')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });

      if (timeRange !== 'all') {
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data: reels } = await query;

      if (reels && reels.length > 0) {
        // Calculate earnings for each reel
        const reelData: ReelEarning[] = reels.map(reel => {
          const earnings = calculateReelEarnings({
            views: reel.views_count || 0,
            likes: reel.likes_count || 0,
            comments: reel.comments_count || 0,
            shares: reel.shares_count || 0,
            countryCode,
          });

          return {
            id: reel.id,
            title: reel.title,
            views: reel.views_count || 0,
            likes: reel.likes_count || 0,
            comments: reel.comments_count || 0,
            shares: reel.shares_count || 0,
            earnings: earnings.totalCreatorEarnings,
            created_at: reel.created_at,
          };
        });

        setReelEarnings(reelData.sort((a, b) => b.earnings - a.earnings));

        // Calculate totals
        const totals = reelData.reduce((acc, reel) => ({
          totalEarnings: acc.totalEarnings + reel.earnings,
          totalViews: acc.totalViews + reel.views,
          totalLikes: acc.totalLikes + reel.likes,
          totalComments: acc.totalComments + reel.comments,
          totalShares: acc.totalShares + reel.shares,
        }), { totalEarnings: 0, totalViews: 0, totalLikes: 0, totalComments: 0, totalShares: 0 });

        // Calculate engagement breakdown (percentage of earnings from each source)
        const viewsEarnings = reelData.reduce((sum, r) => sum + (r.views / 1000 * (CPM_RATES[countryCode] || CPM_RATES.DEFAULT) * 0.55), 0);
        const likesEarnings = totals.totalEarnings * 0.1;
        const commentsEarnings = totals.totalEarnings * 0.15;
        const sharesEarnings = totals.totalEarnings * 0.1;

        setTotalStats({
          ...totals,
          engagementBreakdown: {
            views: viewsEarnings,
            likes: likesEarnings,
            comments: commentsEarnings,
            shares: sharesEarnings,
          },
        });

        // Generate daily earnings data
        const dailyData = generateDailyEarnings(reelData, startDate, now);
        setDailyEarnings(dailyData);
      } else {
        setReelEarnings([]);
        setTotalStats({
          totalEarnings: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          engagementBreakdown: { views: 0, likes: 0, comments: 0, shares: 0 },
        });
        setDailyEarnings([]);
      }

      // Check eligibility
      const { data: profile } = await supabase
        .from('profiles')
        .select('followers_count, created_at')
        .eq('user_id', authUser.id)
        .single();

      const { data: financials } = await supabase
        .from('creator_financials')
        .select('total_watch_hours')
        .eq('user_id', authUser.id)
        .maybeSingle();

      const { count: reelsCount } = await supabase
        .from('reels')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUser.id);

      if (profile) {
        const eligibilityResult = checkEligibility({
          followers: profile.followers_count || 0,
          watchHours: Number(financials?.total_watch_hours) || 0,
          reelsCount: reelsCount || 0,
          accountCreatedAt: new Date(profile.created_at),
        });
        setEligibility(eligibilityResult);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateDailyEarnings = (reels: ReelEarning[], startDate: Date, endDate: Date): DailyEarning[] => {
    const days: DailyEarning[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      // Distribute earnings proportionally across days (simplified)
      const dayReels = reels.filter(r => {
        const reelDate = new Date(r.created_at);
        return reelDate.toDateString() === currentDate.toDateString();
      });

      const dayEarnings = dayReels.reduce((sum, r) => sum + r.earnings, 0);
      const dayViews = dayReels.reduce((sum, r) => sum + r.views, 0);

      days.push({
        date: dateStr,
        earnings: dayEarnings,
        views: dayViews,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days.slice(-14); // Last 14 days for chart
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(346, 77%, 49%)', 'hsl(217, 91%, 60%)', 'hsl(142, 71%, 45%)'];

  const pieData = [
    { name: 'Views', value: totalStats.engagementBreakdown.views },
    { name: 'Likes', value: totalStats.engagementBreakdown.likes },
    { name: 'Comments', value: totalStats.engagementBreakdown.comments },
    { name: 'Shares', value: totalStats.engagementBreakdown.shares },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold flex-1">Earnings Analytics</h1>
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scrollable Content - vertical + horizontal */}
      <div className="flex-1 overflow-auto pb-24 lg:pb-8">
        <div className="p-4 space-y-6 min-w-[640px] sm:min-w-0">
          {/* Eligibility Status */}
          {eligibility && !eligibility.isEligible && (
            <div className="bg-secondary/30 rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Path to Monetization
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Earnings start counting once you become eligible. Until then, your total stays at $0.00.
              </p>
              <div className="space-y-2">
                {eligibility.missingRequirements.map((req, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground">• {req}</p>
                ))}
              </div>
            </div>
          )}

        {/* Total Earnings Card */}
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">Total Earnings (USD)</span>
          </div>
          <p className="text-3xl font-bold">
            {formatEarnings(eligibility?.isEligible ? totalStats.totalEarnings : 0, 'USD')}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {eligibility?.isEligible
              ? `CPM Rate: $${CPM_RATES[countryCode] || CPM_RATES.DEFAULT}/1000 views`
              : 'Reach eligibility to start earning'}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Views</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(totalStats.totalViews)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Likes</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(totalStats.totalLikes)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Comments</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(totalStats.totalComments)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Share2 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Shares</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(totalStats.totalShares)}</p>
          </div>
        </div>

        {/* Tabs for different views */}
        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
            <TabsTrigger value="breakdown" className="flex-1">Breakdown</TabsTrigger>
            <TabsTrigger value="videos" className="flex-1">By Video</TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Earnings Over Time
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyEarnings}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Earnings']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="earnings" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* Breakdown Tab */}
          <TabsContent value="breakdown" className="mt-4">
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="font-semibold mb-4">Earnings by Engagement Type</h3>
              {pieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="h-48 w-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => `$${value.toFixed(2)}`}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {pieData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium">${item.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No earnings data yet</p>
              )}
            </div>

            {/* Revenue Split Info */}
            <div className="bg-secondary/30 rounded-2xl p-4 mt-4">
              <h4 className="font-medium mb-3">How Earnings Work</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• You receive <span className="text-foreground font-medium">55%</span> of ad revenue from your content</p>
                <p>• Views: Base earnings from CPM (${CPM_RATES[countryCode] || CPM_RATES.DEFAULT}/1000 views)</p>
                <p>• Likes: +10% bonus per like relative to views</p>
                <p>• Comments: +20% bonus per comment</p>
                <p>• Shares: +30% bonus per share</p>
              </div>
            </div>
          </TabsContent>

          {/* By Video Tab */}
          <TabsContent value="videos" className="mt-4 space-y-3">
            {reelEarnings.length > 0 ? (
              reelEarnings.map((reel) => (
                <div 
                  key={reel.id}
                  className="bg-card border border-border rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-medium line-clamp-1 flex-1 pr-2">{reel.title}</h4>
                    <span className="text-primary font-bold">{formatEarnings(reel.earnings)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {formatNumber(reel.views)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" /> {formatNumber(reel.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> {formatNumber(reel.comments)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="w-3 h-3" /> {formatNumber(reel.shares)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No videos in this time period</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
        </div>
      </div>

      <BottomNavigation activeTab="profile" onTabChange={(tab) => {
        if (tab === 'home') navigate('/');
        else if (tab === 'inbox') navigate('/inbox');
        else if (tab === 'profile') navigate('/profile');
        else if (tab === 'tutorials') navigate('/tutorials');
      }} />
    </div>
  );
};

export default MonetizationAnalytics;
