import React, { useMemo } from 'react';
import { Eye, Heart, MessageCircle, Share2, TrendingUp, Clock } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

export interface StudioReelAnalytics {
  id: string;
  title: string;
  thumbnail_url: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
}

interface ReelPerformanceDialogProps {
  allReels: StudioReelAnalytics[];
  isOpen: boolean;
  onClose: () => void;
  reel: StudioReelAnalytics | null;
}

const chartConfig: ChartConfig = {
  current: { label: 'This Muv', color: 'hsl(var(--primary))' },
  average: { label: 'Channel avg', color: 'hsl(var(--accent))' },
  rate: { label: 'Rate', color: 'hsl(var(--secondary-foreground))' },
};

const formatNumber = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
};

const toRate = (numerator: number, denominator: number) => {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
};

const ReelPerformanceDialog = ({ allReels, isOpen, onClose, reel }: ReelPerformanceDialogProps) => {
  const analytics = useMemo(() => {
    if (!reel) return null;

    const reelCount = Math.max(allReels.length, 1);
    const totals = allReels.reduce(
      (summary, item) => ({
        views: summary.views + (item.views_count || 0),
        likes: summary.likes + (item.likes_count || 0),
        comments: summary.comments + (item.comments_count || 0),
        shares: summary.shares + (item.shares_count || 0),
      }),
      { views: 0, likes: 0, comments: 0, shares: 0 },
    );

    const averages = {
      views: Math.round(totals.views / reelCount),
      likes: Math.round(totals.likes / reelCount),
      comments: Math.round(totals.comments / reelCount),
      shares: Math.round(totals.shares / reelCount),
    };

    const views = reel.views_count || 0;
    const likes = reel.likes_count || 0;
    const comments = reel.comments_count || 0;
    const shares = reel.shares_count || 0;
    const engagementRate = toRate(likes + comments + shares, Math.max(views, 1));

    return {
      engagementRate,
      performanceData: [
        { label: 'Views', current: views, average: averages.views },
        { label: 'Likes', current: likes, average: averages.likes },
        { label: 'Comments', current: comments, average: averages.comments },
        { label: 'Shares', current: shares, average: averages.shares },
      ],
      publishedLabel: new Date(reel.created_at).toLocaleDateString(),
      rateData: [
        { label: 'Like %', rate: toRate(likes, Math.max(views, 1)) },
        { label: 'Comment %', rate: toRate(comments, Math.max(views, 1)) },
        { label: 'Share %', rate: toRate(shares, Math.max(views, 1)) },
        { label: 'Engagement %', rate: engagementRate },
      ],
      watchHours: Math.round(views * 0.02),
    };
  }, [allReels, reel]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl border-border/60 bg-background p-0 sm:max-w-3xl">
        {reel && analytics ? (
          <div className="space-y-6 p-4 sm:p-6">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-xl font-bold">{reel.title}</DialogTitle>
              <DialogDescription>
                Detailed analytics for this Muv with a quick benchmark against your channel average.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-[180px,1fr]">
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-secondary/20">
                {reel.thumbnail_url ? (
                  <img
                    src={reel.thumbnail_url}
                    alt={`Thumbnail for ${reel.title}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[240px] items-center justify-center bg-secondary/30 px-6 text-center text-sm text-muted-foreground">
                    Add a portrait thumbnail in Studio to brand this Muv.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <Eye className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium uppercase tracking-[0.18em]">Views</span>
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(reel.views_count || 0)}</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium uppercase tracking-[0.18em]">Engagement</span>
                  </div>
                  <p className="text-2xl font-bold">{analytics.engagementRate}%</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium uppercase tracking-[0.18em]">Watch hours</span>
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(analytics.watchHours)}</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <Share2 className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium uppercase tracking-[0.18em]">Published</span>
                  </div>
                  <p className="text-sm font-semibold">{analytics.publishedLabel}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Performance vs channel average</h3>
                  <p className="text-xs text-muted-foreground">See how this Muv compares with your usual results.</p>
                </div>
                <span className="text-[11px] text-muted-foreground">{allReels.length} Muv&apos;z benchmark</span>
              </div>

              <ChartContainer config={chartConfig} className="h-[240px] w-full">
                <BarChart data={analytics.performanceData} barGap={8}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="current" fill="var(--color-current)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="average" fill="var(--color-average)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>

            <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold">Engagement breakdown</h3>
                <p className="text-xs text-muted-foreground">Rates are calculated from this reel&apos;s own views.</p>
              </div>

              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <BarChart data={analytics.rateData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="rate" fill="var(--color-rate)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>

              <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl border border-border/50 bg-background/60 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" />
                  <span>{formatNumber(reel.likes_count || 0)} likes</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <span>{formatNumber(reel.comments_count || 0)} comments</span>
                </div>
                <div className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-primary" />
                  <span>{formatNumber(reel.shares_count || 0)} shares</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default ReelPerformanceDialog;