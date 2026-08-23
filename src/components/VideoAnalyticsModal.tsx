import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2, 
  TrendingUp,
  Calendar,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface VideoAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reelId: string;
  reelTitle: string;
}

interface AnalyticsData {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  createdAt: string;
  dailyViews: { date: string; views: number }[];
}

const VideoAnalyticsModal: React.FC<VideoAnalyticsModalProps> = ({
  isOpen,
  onClose,
  reelId,
  reelTitle,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && reelId) {
      fetchAnalytics();
    }
  }, [isOpen, reelId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data: reelData } = await supabase
        .from('reels')
        .select('views_count, likes_count, comments_count, shares_count, created_at')
        .eq('id', reelId)
        .maybeSingle();

      if (reelData) {
        // Generate mock daily views data (in real app, you'd track this in a separate table)
        const dailyViews = generateDailyViews(reelData.views_count || 0, reelData.created_at);
        
        setAnalytics({
          views: reelData.views_count || 0,
          likes: reelData.likes_count || 0,
          comments: reelData.comments_count || 0,
          shares: reelData.shares_count || 0,
          createdAt: reelData.created_at,
          dailyViews,
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateDailyViews = (totalViews: number, createdAt: string) => {
    const days = Math.min(7, Math.ceil((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)));
    const data = [];
    let remainingViews = totalViews;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const views = i === 0 ? remainingViews : Math.floor(Math.random() * (remainingViews / (i + 1)));
      remainingViews -= views;
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: Math.max(0, views),
      });
    }

    return data;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const engagementRate = analytics 
    ? ((analytics.likes + analytics.comments + analytics.shares) / Math.max(analytics.views, 1) * 100).toFixed(2)
    : '0';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-card border-border rounded-3xl">
        <DialogHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <DialogTitle className="text-lg font-semibold truncate flex-1">{reelTitle}</DialogTitle>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : analytics ? (
          <div className="space-y-6 py-4">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Views</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(analytics.views)}</p>
              </div>
              <div className="bg-secondary/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  <span className="text-sm text-muted-foreground">Likes</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(analytics.likes)}</p>
              </div>
              <div className="bg-secondary/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Comments</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(analytics.comments)}</p>
              </div>
              <div className="bg-secondary/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Share2 className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">Shares</span>
                </div>
                <p className="text-2xl font-bold">{formatNumber(analytics.shares)}</p>
              </div>
            </div>

            {/* Engagement Rate */}
            <div className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span className="font-medium">Engagement Rate</span>
                </div>
                <span className="text-2xl font-bold text-primary">{engagementRate}%</span>
              </div>
            </div>

            {/* Views Chart */}
            <div className="bg-secondary/30 rounded-2xl p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Views Over Time
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.dailyViews}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="views" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Published Date */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Published {new Date(analytics.createdAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No analytics available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VideoAnalyticsModal;
