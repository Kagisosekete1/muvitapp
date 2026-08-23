import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Swords, Trophy, Upload, Vote, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { formatBattleTimeLeft } from '@/lib/battleUtils';
import type { Battle, BattleProfile } from '@/types/battle';
import BattleUploadDialog from '@/components/battles/BattleUploadDialog';
import BattleDetailDialog from '@/components/battles/BattleDetailDialog';

interface LeaderboardRow {
  userId: string;
  wins: number;
  coins: number;
  votes: number;
  profile?: BattleProfile | null;
}

type BattleRow = Database['public']['Tables']['battles']['Row'];

const Battles = () => {
  const { authUser } = useUser();
  const { toast } = useToast();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBattle, setSelectedBattle] = useState<Battle | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    void refreshAll();

    const channel = supabase
      .channel('battles-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles' }, () => void refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_votes' }, () => void refreshAll())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const hydrateBattles = async (rows: BattleRow[]): Promise<Battle[]> => {
    if (!rows.length) return [];
    const userIds = [...new Set(rows.flatMap(row => [row.challenger_id, row.opponent_id, row.winner_id]).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, display_name, avatar_url, verified')
      .in('user_id', userIds);

    const profileMap = new Map((profiles || []).map(profile => [profile.user_id, profile as BattleProfile]));
    return rows.map(row => ({
      ...row,
      challenger: profileMap.get(row.challenger_id) || null,
      opponent: row.opponent_id ? profileMap.get(row.opponent_id) || null : null,
    })) as Battle[];
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('battles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      const hydrated = await hydrateBattles(data || []);
      setBattles(hydrated);
      buildLeaderboard(hydrated);
    } catch (error) {
      console.error('Battle refresh failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildLeaderboard = async (sourceBattles: Battle[]) => {
    const completed = sourceBattles.filter(battle => battle.status === 'completed' && battle.winner_id);
    const rows = new Map<string, LeaderboardRow>();

    completed.forEach((battle) => {
      const userId = battle.winner_id!;
      const votes = battle.winner_side === 'challenger' ? battle.challenger_votes : battle.opponent_votes;
      const current = rows.get(userId) || { userId, wins: 0, coins: 0, votes: 0 };
      current.wins += 1;
      current.coins += battle.bonus_coins;
      current.votes += votes;
      current.profile = battle.winner_side === 'challenger' ? battle.challenger : battle.opponent;
      rows.set(userId, current);
    });

    setLeaderboard([...rows.values()].sort((a, b) => b.wins - a.wins || b.votes - a.votes || b.coins - a.coins));
  };

  const openBattle = (battle: Battle) => {
    setSelectedBattle(battle);
    setDetailOpen(true);
  };

  const myChallenges = useMemo(() => {
    if (!authUser) return [];
    return battles.filter(battle =>
      battle.status === 'open' &&
      battle.opponent_id === authUser.id &&
      !battle.opponent_video_url
    );
  }, [battles, authUser?.id]);

  const featuredBattles = battles.filter(battle => battle.challenger_video_url);

  const startBattle = () => {
    if (!authUser) {
      toast({ title: 'Sign in required', description: 'Please sign in to start a battle.' });
      return;
    }
    setShowCreate(true);
  };

  const renderBattleCard = (battle: Battle) => {
    const totalVotes = battle.challenger_votes + battle.opponent_votes;
    const challengerPercent = totalVotes ? Math.round((battle.challenger_votes / totalVotes) * 100) : 50;
    const opponentPercent = totalVotes ? 100 - challengerPercent : 50;
    const waiting = !battle.opponent_video_url;
    const completed = battle.status === 'completed';

    return (
      <button
        key={battle.id}
        type="button"
        onClick={() => openBattle(battle)}
        className="w-full text-left rounded-3xl border border-border bg-card overflow-hidden shadow-sm hover:border-primary/50 transition-colors"
      >
        <div className="relative grid grid-cols-2 gap-px bg-border">
          {[['challenger', battle.challenger, battle.challenger_thumbnail_url, battle.challenger_video_url], ['opponent', battle.opponent, battle.opponent_thumbnail_url, battle.opponent_video_url]].map(([side, profile, thumb, video]) => {
            const isWinner = completed && battle.winner_side === side;
            return (
              <div key={side as string} className="relative aspect-[9/16] bg-video">
                {thumb ? (
                  <img src={thumb as string} alt={`${(profile as BattleProfile | null)?.username || side} battle`} className="w-full h-full object-cover" loading="lazy" />
                ) : video ? (
                  <video src={video as string} className="w-full h-full object-cover" muted playsInline />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Upload className="w-7 h-7" />
                    <span className="text-xs">Waiting</span>
                  </div>
                )}
                {isWinner && <div className="absolute top-2 left-2 text-lg">🏆</div>}
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 min-w-0">
                  <Avatar className="w-6 h-6 border border-background">
                    <AvatarImage src={(profile as BattleProfile | null)?.avatar_url || ''} />
                    <AvatarFallback>{(profile as BattleProfile | null)?.username?.[0]?.toUpperCase() || 'M'}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-bold text-primary-foreground drop-shadow truncate">@{(profile as BattleProfile | null)?.username || 'open'}</span>
                </div>
              </div>
            );
          })}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-background/90 backdrop-blur-md px-3 py-2 text-xs font-black text-primary shadow-lg">VS</div>
          </div>
        </div>

        <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base truncate">{battle.title}</h2>
              {battle.prompt && <p className="hidden sm:block text-sm text-muted-foreground line-clamp-2">{battle.prompt}</p>}
            </div>
            <Badge variant={completed ? 'default' : waiting ? 'outline' : 'secondary'} className="shrink-0 text-[10px] sm:text-xs px-1.5 py-0.5">
              {completed ? 'Winner' : waiting ? 'Pending' : formatBattleTimeLeft(battle.ends_at)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
            <div>
              <div className="flex justify-between mb-1"><span className="truncate">Challenger</span><span>{battle.challenger_votes}</span></div>
              <Progress value={challengerPercent} className="h-1.5 sm:h-2" />
            </div>
            <div>
              <div className="flex justify-between mb-1"><span className="truncate">Opponent</span><span>{battle.opponent_votes}</span></div>
              <Progress value={opponentPercent} className="h-1.5 sm:h-2" />
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <AppLayout activeTab="battles">
      <main className="min-h-screen bg-background pb-28 lg:pb-8">
        <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
          <header className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-primary font-black uppercase text-xs tracking-wider">
                <Swords className="w-4 h-4" /> Dance Battles
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">Battle Floor</h1>
            </div>
            <Button className="rounded-2xl" onClick={startBattle}>
              <Swords className="w-4 h-4" />
              Start
            </Button>
          </header>

          {myChallenges.length > 0 && (
            <section className="rounded-3xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 font-bold">
                <Crown className="w-4 h-4 text-primary" /> Your challenges
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {myChallenges.map(battle => (
                  <button key={battle.id} className="rounded-2xl bg-background border border-border p-3 text-left" onClick={() => openBattle(battle)}>
                    <p className="font-semibold truncate">{battle.title}</p>
                    <p className="text-xs text-muted-foreground">@{battle.challenger?.username} challenged you</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          <Tabs defaultValue="feed" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl h-12">
              <TabsTrigger value="feed" className="rounded-xl">Feed</TabsTrigger>
              <TabsTrigger value="leaderboard" className="rounded-xl">Leaderboard</TabsTrigger>
            </TabsList>

            <TabsContent value="feed" className="space-y-4">
              {loading ? (
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map(i => <Skeleton key={i} className="h-64 rounded-3xl" />)}
                </div>
              ) : featuredBattles.length > 0 ? (
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                  {featuredBattles.map(renderBattleCard)}
                </div>
              ) : (
                <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
                    <Swords className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="font-black text-xl">No battles yet</h2>
                  <Button className="rounded-2xl" onClick={startBattle}>Start the first battle</Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-3">
              {leaderboard.length > 0 ? leaderboard.map((row, index) => (
                <div key={row.userId} className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4">
                  <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                    {index === 0 ? <Trophy className="w-5 h-5" /> : index + 1}
                  </div>
                  <Avatar className="w-11 h-11">
                    <AvatarImage src={row.profile?.avatar_url || ''} />
                    <AvatarFallback>{row.profile?.username?.[0]?.toUpperCase() || 'M'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">@{row.profile?.username || 'winner'}</p>
                    <p className="text-xs text-muted-foreground">{row.votes} winning votes</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">{row.wins} 🏆</p>
                    <p className="text-xs text-primary font-semibold">+{row.coins} coins</p>
                  </div>
                </div>
              )) : (
                <div className="min-h-[45vh] flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
                  <Trophy className="w-10 h-10" />
                  <p>No winners crowned yet.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <BattleUploadDialog open={showCreate} onOpenChange={setShowCreate} mode="create" onComplete={refreshAll} />
      <BattleDetailDialog
        battle={selectedBattle}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onChanged={refreshAll}
      />
    </AppLayout>
  );
};

export default Battles;
