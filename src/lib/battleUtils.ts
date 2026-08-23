import { supabase } from '@/integrations/supabase/client';
import { generateThumbnail } from '@/lib/thumbnailGenerator';
import type { Battle } from '@/types/battle';

export const isBattleActive = (battle: Pick<Battle, 'status' | 'ends_at' | 'challenger_video_url' | 'opponent_video_url'>) =>
  battle.status === 'open' &&
  Boolean(battle.challenger_video_url && battle.opponent_video_url) &&
  new Date(battle.ends_at).getTime() > Date.now();

export const formatBattleTimeLeft = (endsAt: string) => {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours <= 0) return `${minutes}m left`;
  return `${hours}h ${minutes}m left`;
};

export const getVideoDuration = (file: File): Promise<number> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration || 0;
      URL.revokeObjectURL(url);
      video.remove();
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      video.remove();
      reject(new Error('Could not read video duration'));
    };
    video.src = url;
  });

export const uploadBattleVideo = async (file: File, userId: string) => {
  const timestamp = Date.now();
  const extension = file.name.split('.').pop() || 'mp4';
  const videoPath = `${userId}/battles/${timestamp}.${extension}`;
  const { error: uploadError } = await supabase.storage.from('reels').upload(videoPath, file);
  if (uploadError) throw uploadError;

  const { data: videoPublic } = supabase.storage.from('reels').getPublicUrl(videoPath);
  let thumbnailUrl: string | null = null;

  try {
    const thumbnailBlob = await generateThumbnail(file, 1);
    const thumbPath = `${userId}/battles/${timestamp}_thumb.jpg`;
    const { error: thumbError } = await supabase.storage.from('reels').upload(thumbPath, thumbnailBlob, {
      contentType: 'image/jpeg',
    });
    if (!thumbError) {
      const { data: thumbPublic } = supabase.storage.from('reels').getPublicUrl(thumbPath);
      thumbnailUrl = thumbPublic.publicUrl;
    }
  } catch {
    thumbnailUrl = null;
  }

  return { videoUrl: videoPublic.publicUrl, thumbnailUrl };
};
