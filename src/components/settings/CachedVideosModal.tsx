import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Trash2, Video, HardDrive, Wifi, WifiOff } from 'lucide-react';
import { useOfflineVideoCache } from '@/hooks/useOfflineVideoCache';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface CachedVideosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CachedVideosModal: React.FC<CachedVideosModalProps> = ({ isOpen, onClose }) => {
  const { 
    cachedVideos, 
    cacheSize, 
    maxCacheSize, 
    clearVideoCache, 
    removeCachedVideo,
    isOnline 
  } = useOfflineVideoCache();
  const { toast } = useToast();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleClearCache = async () => {
    await clearVideoCache();
    toast({
      title: "Cache Cleared",
      description: "All cached videos have been removed.",
    });
  };

  const handleRemoveVideo = async (reelId: string) => {
    await removeCachedVideo(reelId);
    toast({
      title: "Video Removed",
      description: "Video has been removed from cache.",
    });
  };

  const usagePercentage = (cacheSize / maxCacheSize) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto bg-card border-border rounded-3xl">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Cached Muv'z
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Online Status */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/30">
          {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Online - Videos will stream normally</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-destructive" />
                <span className="text-sm text-muted-foreground">Offline - Playing from cache only</span>
              </>
            )}
          </div>

          {/* Cache Usage */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-foreground">Cache Usage</span>
              <span className="text-sm text-muted-foreground">
                {formatBytes(cacheSize)} / {formatBytes(maxCacheSize)}
              </span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {cachedVideos.length} Muv'z cached for offline viewing
            </p>
          </div>

          {/* Clear All Button */}
          {cachedVideos.length > 0 && (
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              onClick={handleClearCache}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Cached Muv'z
            </Button>
          )}

          {/* Cached Videos List */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Cached Muv'z</h3>
            
            {cachedVideos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No videos cached yet</p>
                <p className="text-xs mt-1">Watched videos will be automatically cached for offline viewing</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cachedVideos.map((video) => (
                  <div 
                    key={video.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Video className="w-8 h-8 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          Muv #{video.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(video.size)} • {formatDistanceToNow(video.cachedAt, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveVideo(video.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-xl bg-secondary/20">
            <p>• Videos are cached automatically when watched</p>
            <p>• Maximum 20 videos or 500MB stored</p>
            <p>• Oldest videos are removed when limit is reached</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CachedVideosModal;
