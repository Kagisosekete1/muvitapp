import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Film, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import VideoThumbnail from '@/components/ui/VideoThumbnail';

interface ReelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  count: number;
  isOwnProfile?: boolean;
}

interface ReelItem {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
}

const ReelsModal: React.FC<ReelsModalProps> = ({ isOpen, onClose, userId, count, isOwnProfile = false }) => {
  const { toast } = useToast();
  const { authUser } = useUser();
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    if (isOpen && count > 0) {
      fetchReels();
    } else {
      setLoading(false);
    }
  }, [isOpen, userId]);

  const fetchReels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reels')
        .select('id, title, video_url, thumbnail_url, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReels(data || []);
    } catch (error) {
      console.error('Error fetching reels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reelId: string) => {
    try {
      const { error } = await supabase
        .from('reels')
        .delete()
        .eq('id', reelId);

      if (error) throw error;

      setReels(prev => prev.filter(r => r.id !== reelId));
      toast({
        title: "Reel deleted",
        description: "Your reel has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete reel",
        variant: "destructive",
      });
    }
  };

  const handleEditTitle = async (reelId: string) => {
    if (!editTitle.trim()) return;

    try {
      const { error } = await supabase
        .from('reels')
        .update({ title: editTitle.trim() })
        .eq('id', reelId);

      if (error) throw error;

      setReels(prev => prev.map(r =>
        r.id === reelId ? { ...r, title: editTitle.trim() } : r
      ));
      setEditingId(null);
      setEditTitle('');
      toast({
        title: "Title updated",
        description: "Your reel title has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update title",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Muv'z</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="py-4 overflow-y-auto max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : count === 0 || reels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
                <Film className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No Muv'z yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {reels.map((reel) => (
                <div key={reel.id} className="relative group rounded-xl overflow-hidden bg-secondary">
                  <VideoThumbnail
                    videoUrl={reel.video_url}
                    thumbnailUrl={reel.thumbnail_url}
                    className="rounded-xl"
                  />

                  {/* Title */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80">
                    {editingId === reel.id ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleEditTitle(reel.id)}
                        onKeyPress={(e) => e.key === 'Enter' && handleEditTitle(reel.id)}
                        className="w-full bg-transparent text-white text-xs border-b border-white/50 focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <p className="text-white text-xs truncate">{reel.title}</p>
                    )}
                  </div>

                  {/* Actions for own profile */}
                  {isOwnProfile && authUser?.id === userId && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 bg-black/50 hover:bg-black/70 rounded-full"
                        onClick={() => {
                          setEditingId(reel.id);
                          setEditTitle(reel.title);
                        }}
                      >
                        <Edit2 className="w-3 h-3 text-white" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 bg-black/50 hover:bg-destructive rounded-full"
                        onClick={() => handleDelete(reel.id)}
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReelsModal;

