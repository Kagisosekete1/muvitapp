import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Search, Swords, Upload, Video, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { getVideoDuration, uploadBattleVideo } from '@/lib/battleUtils';
import type { Battle, BattleProfile } from '@/types/battle';

interface BattleUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'respond';
  battle?: Battle | null;
  onComplete: () => void;
}

const MAX_BATTLE_SECONDS = 15.5;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const BattleUploadDialog: React.FC<BattleUploadDialogProps> = ({ open, onOpenChange, mode, battle, onComplete }) => {
  const { authUser, currentUser } = useUser();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<BattleProfile[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<BattleProfile | null>(null);
  const [title, setTitle] = useState('Dance Battle');
  const [prompt, setPrompt] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const isResponding = mode === 'respond';
  const canSubmit = useMemo(() => {
    if (!authUser || !file || busy) return false;
    if (duration === null || duration > MAX_BATTLE_SECONDS) return false;
    if (isResponding) return Boolean(battle?.id);
    return Boolean(selectedOpponent && title.trim());
  }, [authUser, file, busy, duration, isResponding, battle?.id, selectedOpponent, title]);

  useEffect(() => {
    if (!open) return;
    setTitle(battle?.title || 'Dance Battle');
    setPrompt(battle?.prompt || '');
    setCaption('');
    setFile(null);
    setPreviewUrl('');
    setDuration(null);
    setProgress(0);
    if (!isResponding) setSelectedOpponent(null);
  }, [open, isResponding, battle?.id]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      setDuration(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    getVideoDuration(file)
      .then(setDuration)
      .catch(() => {
        setDuration(null);
        toast({ title: 'Video error', description: 'Could not read this video.', variant: 'destructive' });
      });

    return () => URL.revokeObjectURL(url);
  }, [file, toast]);

  useEffect(() => {
    if (!open || isResponding) return;
    const handle = setTimeout(async () => {
      const term = query.trim();
      let builder = supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url, verified')
        .neq('user_id', authUser?.id || '')
        .limit(12);

      if (term) builder = builder.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
      const { data } = await builder;
      setProfiles((data || []).filter(p => p.user_id) as BattleProfile[]);
    }, 250);

    return () => clearTimeout(handle);
  }, [query, open, isResponding, authUser?.id]);

  const handlePickFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/quicktime,video/webm';
    input.onchange = () => {
      const picked = input.files?.[0];
      if (picked) setFile(picked);
    };
    input.click();
  };

  const handleSubmit = async () => {
    if (!authUser || !file) return;
    setBusy(true);
    setProgress(8);

    try {
      const { videoUrl, thumbnailUrl } = await uploadBattleVideo(file, authUser.id);
      setProgress(72);

      if (isResponding && battle) {
        const { error } = await supabase.rpc('submit_battle_response', {
          _battle_id: battle.id,
          _video_url: videoUrl,
          _thumbnail_url: thumbnailUrl,
          _caption: caption.trim() || null,
        });
        if (error) throw error;
        toast({ title: 'Battle joined', description: 'Your 15-second response is live.' });
      } else {
        const { error } = await supabase.from('battles').insert({
          title: title.trim() || 'Dance Battle',
          prompt: prompt.trim() || null,
          challenger_id: authUser.id,
          opponent_id: selectedOpponent?.user_id || null,
          challenger_video_url: videoUrl,
          challenger_thumbnail_url: thumbnailUrl,
          challenger_caption: caption.trim() || null,
        });
        if (error) throw error;
        toast({ title: 'Challenge sent', description: `${selectedOpponent?.username || 'Opponent'} can now answer with their Muv.` });
      }

      setProgress(100);
      onComplete();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({ title: 'Battle upload failed', description: getErrorMessage(error, 'Please try again.'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            {isResponding ? 'Answer Battle' : 'Start Dance Battle'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isResponding && (
            <>
              <div className="space-y-2">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Battle title" className="rounded-2xl" />
                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={120} rows={2} placeholder="Move, song, or challenge prompt" className="rounded-2xl" />
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Choose challenger" className="pl-9 rounded-2xl" />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {profiles.map((profile) => (
                    <button
                      key={profile.user_id}
                      type="button"
                      onClick={() => setSelectedOpponent(profile)}
                      className={`w-full flex items-center gap-3 p-2 rounded-2xl text-left transition-colors ${
                        selectedOpponent?.user_id === profile.user_id ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-secondary'
                      }`}
                    >
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={profile.avatar_url || ''} />
                        <AvatarFallback>{profile.username?.[0]?.toUpperCase() || 'M'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">@{profile.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{profile.display_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {isResponding && battle && (
            <div className="flex items-center justify-between rounded-2xl bg-secondary p-3">
              <div>
                <p className="font-semibold">{battle.title}</p>
                <p className="text-xs text-muted-foreground">Against @{battle.challenger?.username}</p>
              </div>
              <Badge variant="secondary">15 sec max</Badge>
            </div>
          )}

          <div className="space-y-3">
            <Button type="button" variant="outline" className="w-full rounded-2xl justify-start h-auto py-4" onClick={handlePickFile}>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mr-3">
                <Video className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Upload 15-second Muv</p>
                <p className="text-xs text-muted-foreground">Portrait battle clips work best</p>
              </div>
            </Button>

            {previewUrl && (
              <div className="relative rounded-2xl overflow-hidden bg-video aspect-[9/16] max-h-72 mx-auto">
                <video src={previewUrl} className="w-full h-full object-contain" controls playsInline />
                <button type="button" onClick={() => setFile(null)} className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-md">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {duration !== null && (
              <div className={`text-xs ${duration > MAX_BATTLE_SECONDS ? 'text-destructive' : 'text-muted-foreground'}`}>
                Clip length: {duration.toFixed(1)}s / 15s
              </div>
            )}

            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={80} rows={2} placeholder="Caption your battle Muv" className="rounded-2xl" />
          </div>

          {busy && <Progress value={progress} className="h-2" />}

          <Button className="w-full rounded-2xl" onClick={handleSubmit} disabled={!canSubmit}>
            <Upload className="w-4 h-4" />
            {isResponding ? 'Post Battle Response' : 'Send Challenge'}
          </Button>

          {!authUser && <p className="text-center text-sm text-muted-foreground">Sign in to battle.</p>}
          {currentUser && !isResponding && <p className="text-center text-xs text-muted-foreground">Posting as @{currentUser.username}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BattleUploadDialog;
