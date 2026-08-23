import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Crown, Swords, Trophy, Upload, Vote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { formatBattleTimeLeft, isBattleActive } from '@/lib/battleUtils';
import type { Battle, BattleSide } from '@/types/battle';
import BattleUploadDialog from './BattleUploadDialog';

interface BattleDetailDialogProps {
  battle: Battle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

const BattleDetailDialog: React.FC<BattleDetailDialogProps> = ({ battle, open, onOpenChange, onChanged }) => {
  const { authUser } = useUser();
  const { toast } = useToast();
  const [votedSide, setVotedSide] = useState<BattleSide | null>(null);
  const [localBattle, setLocalBattle] = useState<Battle | null>(battle);
  const [busySide, setBusySide] = useState<BattleSide | null>(null);
  const [showResponseUpload, setShowResponseUpload] = useState(false);
  const [winnerCelebration, setWinnerCelebration] = useState<{ coins: number; isMe: boolean; username: string } | null>(null);


  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  useEffect(() => setLocalBattle(battle), [battle]);

  useEffect(() => {
    if (!open || !battle?.id || !authUser) {
      setVotedSide(null);
      return;
    }

    supabase
      .from('battle_votes')
      .select('voted_side')
      .eq('battle_id', battle.id)
      .eq('voter_id', authUser.id)
      .maybeSingle()
      .then(({ data }) => setVotedSide((data?.voted_side as BattleSide | undefined) || null));
  }, [open, battle?.id, authUser?.id]);

  const current = localBattle;
  const totalVotes = (current?.challenger_votes || 0) + (current?.opponent_votes || 0);
  const challengerPercent = totalVotes ? Math.round(((current?.challenger_votes || 0) / totalVotes) * 100) : 50;
  const opponentPercent = totalVotes ? 100 - challengerPercent : 50;
  const isParticipant = Boolean(authUser && current && (authUser.id === current.challenger_id || authUser.id === current.opponent_id));
  const canVote = Boolean(current && authUser && !isParticipant && !votedSide && isBattleActive(current));
  const canRespond = Boolean(current && authUser?.id === current.opponent_id && !current.opponent_video_url && current.challenger_video_url);

  const statusLabel = useMemo(() => {
    if (!current) return '';
    if (current.status === 'completed') return 'Completed';
    if (!current.opponent_video_url) return 'Waiting for response';
    return formatBattleTimeLeft(current.ends_at);
  }, [current]);

  const voteFor = async (side: BattleSide) => {
    if (!current || !authUser) {
      toast({ title: 'Sign in required', description: 'Please sign in to vote.' });
      return;
    }

    setBusySide(side);
    try {
      const { data, error } = await supabase.rpc('submit_battle_vote', {
        _battle_id: current.id,
        _voted_side: side,
      });
      if (error) throw error;
      setVotedSide(side);
      if (data) setLocalBattle({ ...current, ...(data as unknown as Partial<Battle>) });
      toast({ title: 'Vote counted', description: 'Your vote is locked in.' });
      onChanged();
    } catch (error: unknown) {
      toast({ title: 'Could not vote', description: getErrorMessage(error, 'Try again.'), variant: 'destructive' });
    } finally {
      setBusySide(null);
    }
  };

  const finalize = async () => {
    if (!current) return;
    try {
      const { data, error } = await supabase.rpc('finalize_battle', { _battle_id: current.id });
      if (error) throw error;
      const updated = data ? ({ ...current, ...(data as unknown as Partial<Battle>) }) : current;
      if (data) setLocalBattle(updated);
      const winnerProfile = updated.winner_side === 'challenger' ? updated.challenger : updated.opponent;
      setWinnerCelebration({
        coins: updated.bonus_coins,
        isMe: Boolean(authUser && updated.winner_id === authUser.id),
        username: winnerProfile?.username || 'Winner',
      });
      onChanged();
    } catch (error: unknown) {
      toast({ title: 'Results not ready', description: getErrorMessage(error, 'This battle is still active.') });
    }
  };

  if (!current) return null;

  const renderSide = (side: BattleSide) => {
    const isChallenger = side === 'challenger';
    const profile = isChallenger ? current.challenger : current.opponent;
    const videoUrl = isChallenger ? current.challenger_video_url : current.opponent_video_url;
    const caption = isChallenger ? current.challenger_caption : current.opponent_caption;
    const votes = isChallenger ? current.challenger_votes : current.opponent_votes;
    const percent = isChallenger ? challengerPercent : opponentPercent;
    const won = current.winner_side === side;

    return (
      <div className="min-w-0 flex-1 space-y-2">
        <div className={`relative aspect-[9/16] overflow-hidden rounded-2xl bg-video ${won ? 'ring-2 ring-primary' : ''}`}>
          {videoUrl ? (
            <video src={videoUrl} className="w-full h-full object-cover" controls playsInline loop />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
              <Upload className="w-8 h-8 mb-2" />
              <span className="text-xs">Waiting</span>
            </div>
          )}
          {won && (
            <div className="absolute top-2 left-2 rounded-full bg-primary text-primary-foreground px-2 py-1 text-xs font-bold flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Winner
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="w-7 h-7">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback>{profile?.username?.[0]?.toUpperCase() || 'M'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">@{profile?.username || 'open'}</p>
            <p className="text-xs text-muted-foreground truncate">{caption || (isChallenger ? 'Challenge' : 'Response')}</p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>{votes} votes</span>
            <span>{percent}%</span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>
        <Button
          className="w-full rounded-2xl"
          variant={votedSide === side ? 'default' : 'outline'}
          disabled={!canVote || busySide !== null}
          onClick={() => voteFor(side)}
        >
          <Vote className="w-4 h-4" />
          {votedSide === side ? 'Voted' : 'Vote'}
        </Button>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[94vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Swords className="w-5 h-5 text-primary" />
              {current.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {current.prompt && <p className="text-sm text-muted-foreground line-clamp-2">{current.prompt}</p>}
                <p className="text-xs text-muted-foreground">{statusLabel}</p>
              </div>
              <Badge variant={current.status === 'completed' ? 'default' : 'secondary'} className="shrink-0">
                {current.status === 'completed' ? <Trophy className="w-3 h-3 mr-1" /> : <Crown className="w-3 h-3 mr-1" />}
                {current.bonus_coins} coins
              </Badge>
            </div>

            <div className="flex gap-3 items-start">
              {renderSide('challenger')}
              <div className="pt-24 text-sm font-black text-primary">VS</div>
              {renderSide('opponent')}
            </div>

            {canRespond && (
              <Button className="w-full rounded-2xl" onClick={() => setShowResponseUpload(true)}>
                <Upload className="w-4 h-4" />
                Answer with 15-sec Muv
              </Button>
            )}

            {current.status === 'open' && new Date(current.ends_at).getTime() <= Date.now() && (
              <Button className="w-full rounded-2xl" onClick={finalize}>
                <Trophy className="w-4 h-4" />
                Crown Winner
              </Button>
            )}

            {isParticipant && current.status === 'open' && current.opponent_video_url && (
              <p className="text-center text-xs text-muted-foreground">Participants can watch results but cannot vote in their own battle.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BattleUploadDialog
        open={showResponseUpload}
        onOpenChange={setShowResponseUpload}
        mode="respond"
        battle={current}
        onComplete={() => {
          setShowResponseUpload(false);
          onChanged();
        }}
      />

      <Dialog open={!!winnerCelebration} onOpenChange={(o) => !o && setWinnerCelebration(null)}>
        <DialogContent className="max-w-sm rounded-3xl text-center">
          <DialogHeader>
            <DialogTitle className="sr-only">Battle result</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="text-7xl animate-bounce">🏆</div>
            <div>
              <p className="text-2xl font-black">
                {winnerCelebration?.isMe ? 'You won!' : `@${winnerCelebration?.username} wins!`}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {winnerCelebration?.isMe
                  ? `+${winnerCelebration?.coins} bonus coins added to your balance`
                  : `Awarded ${winnerCelebration?.coins} bonus coins`}
              </p>
            </div>
            <Button className="w-full rounded-2xl" onClick={() => setWinnerCelebration(null)}>
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BattleDetailDialog;
