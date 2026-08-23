import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Video, Eye, Heart, MessageCircle, TrendingUp, BarChart3, Users, Clock, Upload, Image as ImageIcon } from 'lucide-react';
import DesktopSidebar from '@/components/DesktopSidebar';
import { BottomNavigation } from '@/components/BottomNavigation';
import MobileViewWrapper from '@/components/MobileViewWrapper';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, LineChart, Line } from 'recharts';
import ReelPerformanceDialog from '@/components/studio/ReelPerformanceDialog';

interface ReelStats {
  id: string;
  title: string;
  thumbnail_url: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
}

const Studio = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { authUser } = useUser();
  const [activeTab, setActiveTab] = useState('studio');
  const [reels, setReels] = useState<ReelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [uploadingThumbnail, setUploadingThumbnail] = useState<string | null>(null);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [overviewStats, setOverviewStats] = useState({
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalReels: 0,
    totalWatchHours: 0,
  });
  const selectedReel = reels.find((reel) => reel.id === selectedReelId) ?? null;

  useEffect(() => {
    if (authUser) {
      fetchData();
    }
  }, [authUser]);

  const fetchData = async () => {
    if (!authUser) return;
    setLoading(true);

    const { data: reelData } = await supabase
      .from('reels')
      .select('id, title, thumbnail_url, views_count, likes_count, comments_count, shares_count, created_at')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false });

    const reelsList = (reelData || []) as ReelStats[];
    setReels(reelsList);

    const totalViews = reelsList.reduce((s, r) => s + (r.views_count || 0), 0);
    const totalLikes = reelsList.reduce((s, r) => s + (r.likes_count || 0), 0);
    const totalComments = reelsList.reduce((s, r) => s + (r.comments_count || 0), 0);
    const totalShares = reelsList.reduce((s, r) => s + (r.shares_count || 0), 0);

    setOverviewStats({
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalReels: reelsList.length,
      totalWatchHours: Math.round(totalViews * 0.02),
    });

    setLoading(false);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case 'home': navigate('/'); break;
      case 'tutorials': navigate('/tutorials'); break;
      case 'create': break;
      case 'notifications': navigate('/activity'); break;
      case 'inbox': navigate('/inbox'); break;
      case 'profile': navigate('/profile'); break;
      case 'settings': navigate('/settings'); break;
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  // Generate chart data from reels
  const getChartData = () => {
    if (reels.length === 0) return [];

    const now = new Date();
    const buckets: { label: string; views: number; likes: number; comments: number }[] = [];

    if (chartPeriod === 'weekly') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayStr = date.toLocaleDateString('en', { weekday: 'short' });
        const dateStr = date.toISOString().split('T')[0];

        const dayReels = reels.filter(r => r.created_at.startsWith(dateStr));
        buckets.push({
          label: dayStr,
          views: dayReels.reduce((s, r) => s + (r.views_count || 0), 0),
          likes: dayReels.reduce((s, r) => s + (r.likes_count || 0), 0),
          comments: dayReels.reduce((s, r) => s + (r.comments_count || 0), 0),
        });
      }
    } else {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const weekReels = reels.filter(r => {
          const d = new Date(r.created_at);
          return d >= weekStart && d <= weekEnd;
        });

        buckets.push({
          label: `W${4 - i}`,
          views: weekReels.reduce((s, r) => s + (r.views_count || 0), 0),
          likes: weekReels.reduce((s, r) => s + (r.likes_count || 0), 0),
          comments: weekReels.reduce((s, r) => s + (r.comments_count || 0), 0),
        });
      }
    }

    return buckets;
  };

  const handleThumbnailUpload = async (reelId: string, file: File) => {
    if (!authUser) return;
    setUploadingThumbnail(reelId);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `thumbnails/${authUser.id}/${reelId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('reels')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('reels').getPublicUrl(filePath);

      await supabase
        .from('reels')
        .update({ thumbnail_url: urlData.publicUrl })
        .eq('id', reelId);

      setReels(prev => prev.map(r => r.id === reelId ? { ...r, thumbnail_url: urlData.publicUrl } : r));

      toast({ title: 'Thumbnail updated!', description: 'Your custom thumbnail has been set.' });
    } catch (err) {
      console.error('Thumbnail upload error:', err);
      toast({ title: 'Upload failed', description: 'Could not upload thumbnail.', variant: 'destructive' });
    } finally {
      setUploadingThumbnail(null);
    }
  };

  const chartData = getChartData();
  const chartConfig = {
    views: { label: 'Views', color: 'hsl(199, 89%, 48%)' },
    likes: { label: 'Likes', color: 'hsl(346, 77%, 50%)' },
    comments: { label: 'Comments', color: 'hsl(160, 84%, 39%)' },
  };

  const statCards = [
    { label: 'Total Views', value: overviewStats.totalViews, icon: Eye, color: 'text-sky-500', bg: 'bg-sky-500/10' },
    { label: 'Total Likes', value: overviewStats.totalLikes, icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { label: 'Comments', value: overviewStats.totalComments, icon: MessageCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Shares', value: overviewStats.totalShares, icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { label: "Muv'z", value: overviewStats.totalReels, icon: Video, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Watch Hours', value: overviewStats.totalWatchHours, icon: Clock, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="lg:pl-[72px] xl:pl-[244px]">
        <MobileViewWrapper>
          <div className="relative h-full overflow-hidden bg-background">
            <div className="pt-4 pb-20 lg:pb-4 h-full overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 mb-5">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <h1 className="text-lg font-bold">Muv'it Studio</h1>
                </div>
              </div>

              {/* Overview Stats */}
              <div className="px-4 mb-5">
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">Channel Overview</h2>
                <div className="grid grid-cols-2 gap-2">
                  {statCards.map((stat) => (
                    <div key={stat.label} className={`${stat.bg} rounded-xl p-3 border border-border/50`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                        <span className="text-[11px] text-muted-foreground">{stat.label}</span>
                      </div>
                      <p className="text-xl font-bold">{formatNumber(stat.value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analytics Charts */}
              <div className="px-4 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">Analytics</h2>
                  <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5">
                    <button
                      onClick={() => setChartPeriod('weekly')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        chartPeriod === 'weekly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      onClick={() => setChartPeriod('monthly')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        chartPeriod === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>

                {/* Views Bar Chart */}
                <div className="bg-secondary/30 rounded-xl p-3 border border-border/50 mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Views</p>
                  <ChartContainer config={chartConfig} className="h-[140px] w-full">
                    <BarChart data={chartData}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="views" fill="var(--color-views)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>

                {/* Engagement Line Chart */}
                <div className="bg-secondary/30 rounded-xl p-3 border border-border/50">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Engagement</p>
                  <ChartContainer config={chartConfig} className="h-[140px] w-full">
                    <LineChart data={chartData}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="likes" stroke="var(--color-likes)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="comments" stroke="var(--color-comments)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ChartContainer>
                </div>
              </div>

              {/* Recent Content */}
              <div className="px-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">Your Content</h2>
                  <span className="text-xs text-muted-foreground">{reels.length} videos</span>
                </div>

                {/* Hidden file input for thumbnail upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && uploadingThumbnail) {
                      handleThumbnailUpload(uploadingThumbnail, file);
                    }
                    e.target.value = '';
                  }}
                />

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-secondary/50 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : reels.length === 0 ? (
                  <div className="text-center py-10">
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No content yet</p>
                    <Button className="mt-3 rounded-xl" size="sm" onClick={() => handleTabChange('create')}>
                      Upload your first Muv
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reels.map((reel) => (
                      <div
                        key={reel.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedReelId(reel.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedReelId(reel.id);
                          }
                        }}
                        className="flex items-center gap-3 p-2.5 bg-secondary/30 rounded-xl border border-border/50 cursor-pointer transition-colors hover:bg-secondary/50"
                      >
                        <button
                          type="button"
                          className="w-14 h-20 rounded-lg bg-muted overflow-hidden flex-shrink-0 relative group cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation();
                            setUploadingThumbnail(reel.id);
                            fileInputRef.current?.click();
                          }}
                          aria-label={`Upload thumbnail for ${reel.title}`}
                        >
                          {reel.thumbnail_url ? (
                            <img src={reel.thumbnail_url} alt={`Thumbnail for ${reel.title}`} loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          {/* Thumbnail upload overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-white" />
                          </div>
                          {uploadingThumbnail === reel.id && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{reel.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(reel.created_at).toLocaleDateString()}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <Eye className="w-3 h-3" /> {formatNumber(reel.views_count || 0)}
                            </span>
                            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <Heart className="w-3 h-3" /> {formatNumber(reel.likes_count || 0)}
                            </span>
                            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <MessageCircle className="w-3 h-3" /> {formatNumber(reel.comments_count || 0)}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[10px] text-muted-foreground">Tap for detailed analytics</p>
                        </div>
                        <BarChart3 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <ReelPerformanceDialog
                isOpen={Boolean(selectedReel)}
                onClose={() => setSelectedReelId(null)}
                reel={selectedReel}
                allReels={reels}
              />
            </div>
            <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        </MobileViewWrapper>
      </div>
    </div>
  );
};

export default Studio;
