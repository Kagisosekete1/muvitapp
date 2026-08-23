import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ConfettiBurst from '@/components/ui/ConfettiBurst';
import { 
  Heart, 
  Eye, 
  Users, 
  Video, 
  Award,
  Lock,
  TrendingUp,
  Flame,
  Star,
  Zap,
  Crown,
  Diamond,
  Gem,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';

interface Badge {
  type: 'likes' | 'views' | 'followers' | 'uploads';
  milestone: number;
  achieved: boolean;
  achievedAt?: string;
}

interface MilestoneBadgesProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

const MILESTONES = {
  likes: [1000, 10000, 50000, 100000, 200000, 500000, 1000000, 5000000, 10000000, 20000000],
  views: [1000, 10000, 50000, 100000, 200000, 500000, 1000000, 5000000, 10000000, 20000000],
  followers: [1000, 10000, 50000, 100000, 200000, 500000, 1000000, 5000000, 10000000, 20000000],
  uploads: [500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
};

const BADGE_CONFIG = {
  likes: {
    icon: Heart,
    label: 'Likes',
    gradient: 'from-rose-500 to-pink-600',
    bgGradient: 'from-rose-500/10 to-pink-600/10',
    ringColor: 'ring-rose-500/30',
    textColor: 'text-rose-500',
  },
  views: {
    icon: Eye,
    label: 'Views',
    gradient: 'from-sky-500 to-blue-600',
    bgGradient: 'from-sky-500/10 to-blue-600/10',
    ringColor: 'ring-sky-500/30',
    textColor: 'text-sky-500',
  },
  followers: {
    icon: Users,
    label: 'Followers',
    gradient: 'from-violet-500 to-purple-600',
    bgGradient: 'from-violet-500/10 to-purple-600/10',
    ringColor: 'ring-violet-500/30',
    textColor: 'text-violet-500',
  },
  uploads: {
    icon: Video,
    label: 'Uploads',
    gradient: 'from-emerald-500 to-green-600',
    bgGradient: 'from-emerald-500/10 to-green-600/10',
    ringColor: 'ring-emerald-500/30',
    textColor: 'text-emerald-500',
  },
};

const getTierIcon = (milestone: number) => {
  if (milestone >= 10000000) return Diamond;
  if (milestone >= 1000000) return Crown;
  if (milestone >= 500000) return Gem;
  if (milestone >= 100000) return Star;
  if (milestone >= 10000) return Flame;
  return Zap;
};

const getTierLabel = (milestone: number) => {
  if (milestone >= 10000000) return 'Legendary';
  if (milestone >= 1000000) return 'Elite';
  if (milestone >= 500000) return 'Master';
  if (milestone >= 100000) return 'Expert';
  if (milestone >= 10000) return 'Rising';
  return 'Starter';
};

const formatMilestone = (num: number): string => {
  if (num >= 1000000) return `${num / 1000000}M`;
  if (num >= 1000) return `${num / 1000}K`;
  return num.toString();
};

const MilestoneBadges: React.FC<MilestoneBadgesProps> = ({ isOpen, onClose, userId }) => {
  const { authUser, currentUser } = useUser();
  const { toast } = useToast();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [achievedCount, setAchievedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCategory, setActiveCategory] = useState<'likes' | 'views' | 'followers' | 'uploads'>('likes');
  const [userStats, setUserStats] = useState({ totalLikes: 0, totalViews: 0, followers: 0, uploads: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Confetti burst trigger (increment to play)
  const [confettiTrigger, setConfettiTrigger] = useState(0);


  const targetUserId = userId || authUser?.id;

  useEffect(() => {
    if (isOpen && targetUserId) {
      fetchBadges();
      fetchUserStats();
    }
  }, [isOpen, targetUserId]);

  const fetchUserStats = async () => {
    if (!targetUserId) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('followers_count, reels_count')
      .eq('user_id', targetUserId)
      .single();

    const { data: reels } = await supabase
      .from('reels')
      .select('likes_count, views_count')
      .eq('user_id', targetUserId);

    const totalLikes = reels?.reduce((sum, r) => sum + (r.likes_count || 0), 0) || 0;
    const totalViews = reels?.reduce((sum, r) => sum + (r.views_count || 0), 0) || 0;

    setUserStats({
      totalLikes,
      totalViews,
      followers: profile?.followers_count || 0,
      uploads: profile?.reels_count || 0,
    });
  };

  const fetchBadges = async () => {
    if (!targetUserId) return;

    const { data: achievedBadges } = await supabase
      .from('user_badges')
      .select('*')
      .eq('user_id', targetUserId);

    const achievedSet = new Set(
      achievedBadges?.map(b => `${b.badge_type}-${b.milestone}`) || []
    );

    const allBadges: Badge[] = [];
    
    Object.entries(MILESTONES).forEach(([type, milestones]) => {
      milestones.forEach(milestone => {
        const key = `${type}-${milestone}`;
        const achieved = achievedSet.has(key);
        const achievedBadge = achievedBadges?.find(
          b => b.badge_type === type && b.milestone === milestone
        );
        
        allBadges.push({
          type: type as Badge['type'],
          milestone,
          achieved,
          achievedAt: achievedBadge?.achieved_at,
        });
      });
    });

    setBadges(allBadges);
    setAchievedCount(allBadges.filter(b => b.achieved).length);
    setTotalCount(allBadges.length);
  };

  const checkAndAwardBadges = async () => {
    if (!authUser) return;

    const badgesToAward: { badge_type: string; milestone: number }[] = [];

    MILESTONES.likes.forEach(milestone => {
      if (userStats.totalLikes >= milestone && 
          !badges.find(b => b.type === 'likes' && b.milestone === milestone && b.achieved)) {
        badgesToAward.push({ badge_type: 'likes', milestone });
      }
    });

    MILESTONES.views.forEach(milestone => {
      if (userStats.totalViews >= milestone && 
          !badges.find(b => b.type === 'views' && b.milestone === milestone && b.achieved)) {
        badgesToAward.push({ badge_type: 'views', milestone });
      }
    });

    MILESTONES.followers.forEach(milestone => {
      if (userStats.followers >= milestone && 
          !badges.find(b => b.type === 'followers' && b.milestone === milestone && b.achieved)) {
        badgesToAward.push({ badge_type: 'followers', milestone });
      }
    });

    MILESTONES.uploads.forEach(milestone => {
      if (userStats.uploads >= milestone && 
          !badges.find(b => b.type === 'uploads' && b.milestone === milestone && b.achieved)) {
        badgesToAward.push({ badge_type: 'uploads', milestone });
      }
    });

    let awardedCount = 0;
    let lastError: string | null = null;

    for (const badge of badgesToAward) {
      const { data, error } = await supabase.rpc('award_badge_if_earned', {
        _badge_type: badge.badge_type,
        _milestone: badge.milestone,
      });

      if (error) {
        lastError = error.message;
        continue;
      }
      if (data === true) awardedCount += 1;
    }

    if (awardedCount > 0) {
      // Celebrate once per awarding batch (even if multiple badges unlock at once)
      setConfettiTrigger((t) => t + 1);
      fetchBadges();
    } else if (lastError && badgesToAward.length > 0) {
      toast({
        title: 'Could not award badge',
        description: lastError,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (badges.length > 0 && authUser?.id === targetUserId) {
      checkAndAwardBadges();
    }
  }, [userStats, badges.length]);

  const categoryBadges = badges.filter(b => b.type === activeCategory);
  const config = BADGE_CONFIG[activeCategory];
  const CategoryIcon = config.icon;

  const getCurrentProgress = () => {
    switch (activeCategory) {
      case 'likes': return userStats.totalLikes;
      case 'views': return userStats.totalViews;
      case 'followers': return userStats.followers;
      case 'uploads': return userStats.uploads;
    }
  };

  const getNextMilestone = () => {
    const current = getCurrentProgress();
    return MILESTONES[activeCategory].find(m => m > current) || null;
  };

  const progressPercentage = () => {
    const next = getNextMilestone();
    if (!next) return 100;
    const current = getCurrentProgress();
    const prevMilestones = MILESTONES[activeCategory].filter(m => m < next);
    const prev = prevMilestones.length > 0 ? prevMilestones[prevMilestones.length - 1] : 0;
    return Math.min(((current - prev) / (next - prev)) * 100, 100);
  };

  const downloadAchievementImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = 1000;
    const h = 1000;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(0.5, '#16213e');
    grad.addColorStop(1, '#0f3460');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Decorative circles
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.arc(w * 0.85, h * 0.15, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.15, h * 0.85, 180, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // User avatar
    const avatarUrl = currentUser?.avatarUrl;
    let avatarY = 100;
    if (avatarUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = avatarUrl;
        });
        
        const avatarSize = 160;
        const avatarX = (w - avatarSize) / 2;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
        
        // Avatar ring
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
      } catch {
        // Skip avatar if loading fails
      }
    }

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`@${currentUser?.username || 'user'}`, w / 2, 310);

    // Achievement title
    ctx.font = 'bold 48px sans-serif';
    const achieveGrad = ctx.createLinearGradient(w * 0.2, 380, w * 0.8, 380);
    achieveGrad.addColorStop(0, '#e94560');
    achieveGrad.addColorStop(1, '#ff6b9d');
    ctx.fillStyle = achieveGrad;
    ctx.fillText('🏆 ACHIEVEMENTS', w / 2, 390);

    // Stats
    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${achievedCount} Badges Unlocked`, w / 2, 450);

    // Category stats - 2x2 grid for square layout
    const stats = [
      { label: '❤️ Likes', value: formatMilestone(userStats.totalLikes) },
      { label: '👁️ Views', value: formatMilestone(userStats.totalViews) },
      { label: '👥 Followers', value: formatMilestone(userStats.followers) },
      { label: '🎬 Uploads', value: formatMilestone(userStats.uploads) },
    ];

    const gridStartY = 500;
    const cellW = 400;
    const cellH = 80;
    const gapX = 40;
    const gapY = 20;

    stats.forEach((stat, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cellX = (w - (cellW * 2 + gapX)) / 2 + col * (cellW + gapX);
      const cellY = gridStartY + row * (cellH + gapY);
      
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(cellX, cellY, cellW, cellH, 16);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(stat.label, cellX + 20, cellY + 48);
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(stat.value, cellX + cellW - 20, cellY + 48);
    });

    ctx.textAlign = 'center';

    // Muv'it logo at the bottom
    ctx.font = 'bold 44px sans-serif';
    const logoGrad = ctx.createLinearGradient(w * 0.3, h - 120, w * 0.7, h - 120);
    logoGrad.addColorStop(0, '#e94560');
    logoGrad.addColorStop(1, '#ff6b9d');
    ctx.fillStyle = logoGrad;
    ctx.fillText("Muv'it", w / 2, h - 100);

    ctx.font = '20px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Share your moves with the world', w / 2, h - 60);

    // Download
    const link = document.createElement('a');
    link.download = `muvit-achievements-${currentUser?.username || 'user'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    toast({
      title: '🎉 Achievement card downloaded!',
      description: 'Share it on social media',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden bg-background border-border">
        {/* Confetti celebration when a new badge is awarded */}
        <ConfettiBurst trigger={confettiTrigger} />

        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Achievements
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(85vh-100px)] pr-1">
          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{achievedCount}</p>
              <p className="text-xs text-muted-foreground">Unlocked</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-muted-foreground">{totalCount - achievedCount}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 mb-5 p-1 bg-secondary/30 rounded-xl">
            {(Object.keys(BADGE_CONFIG) as Array<keyof typeof BADGE_CONFIG>).map((cat) => {
              const catConfig = BADGE_CONFIG[cat];
              const CatIcon = catConfig.icon;
              const catAchieved = badges.filter(b => b.type === cat && b.achieved).length;
              
              return (
                <Button
                  key={cat}
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveCategory(cat)}
                  className={`flex-1 h-10 rounded-lg gap-1.5 transition-all ${
                    activeCategory === cat 
                      ? `bg-gradient-to-r ${catConfig.gradient} text-white shadow-sm` 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CatIcon className="w-4 h-4" />
                  <span className="text-xs font-medium hidden sm:inline">{catConfig.label}</span>
                  {catAchieved > 0 && (
                    <span className={`text-[10px] ${activeCategory === cat ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {catAchieved}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>

          {/* Current Progress */}
          <div className={`bg-gradient-to-r ${config.bgGradient} rounded-xl p-4 mb-5 ring-1 ${config.ringColor}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${config.gradient} flex items-center justify-center`}>
                  <CategoryIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{formatMilestone(getCurrentProgress())}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </div>
              </div>
              {getNextMilestone() && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Next</p>
                  <p className={`text-sm font-semibold ${config.textColor}`}>{formatMilestone(getNextMilestone()!)}</p>
                </div>
              )}
            </div>
            {getNextMilestone() && (
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
                  style={{ width: `${progressPercentage()}%` }}
                />
              </div>
            )}
          </div>

          {/* Badges List */}
          <div className="space-y-2.5">
            {categoryBadges.map((badge) => {
              const TierIcon = getTierIcon(badge.milestone);
              const tierLabel = getTierLabel(badge.milestone);
              
              return (
                <div
                  key={`${badge.type}-${badge.milestone}`}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    badge.achieved 
                      ? `bg-gradient-to-r ${config.bgGradient} ring-1 ${config.ringColor}` 
                      : 'bg-secondary/30 opacity-60'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    badge.achieved 
                      ? `bg-gradient-to-r ${config.gradient} shadow-lg` 
                      : 'bg-secondary'
                  }`}>
                    {badge.achieved ? (
                      <TierIcon className="w-5 h-5 text-white" />
                    ) : (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${badge.achieved ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {formatMilestone(badge.milestone)} {config.label}
                      </span>
                      {badge.achieved && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded bg-gradient-to-r ${config.gradient} text-white`}>
                          {tierLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {badge.achieved 
                        ? `Achieved ${badge.achievedAt ? new Date(badge.achievedAt).toLocaleDateString() : 'recently'}`
                        : `${formatMilestone(Math.max(0, badge.milestone - getCurrentProgress()))} more to unlock`
                      }
                    </p>
                  </div>

                  {badge.achieved && (
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${config.gradient} flex items-center justify-center`}>
                      <TrendingUp className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Download Achievement Image */}
          {achievedCount > 0 && (
            <Button
              variant="outline"
              className="w-full rounded-xl mt-3 gap-2"
              onClick={downloadAchievementImage}
            >
              <Download className="w-4 h-4" />
              Download Achievement Card
            </Button>
          )}

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center mt-5 pb-2">
            Keep creating to unlock more achievements
          </p>

          {/* Hidden canvas for image generation */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MilestoneBadges;
