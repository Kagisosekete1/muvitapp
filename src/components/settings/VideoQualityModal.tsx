import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wifi, WifiOff, Zap, Check } from 'lucide-react';
import { useVideoQuality, VideoQuality } from '@/contexts/VideoQualityContext';

interface VideoQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VideoQualityModal: React.FC<VideoQualityModalProps> = ({ isOpen, onClose }) => {
  const { quality, setQuality, isSlowConnection } = useVideoQuality();

  const options: { value: VideoQuality; label: string; description: string; icon: React.ElementType }[] = [
    {
      value: 'auto',
      label: 'Auto',
      description: 'Adjusts quality based on your network speed',
      icon: Zap,
    },
    {
      value: 'low',
      label: 'Low (Data Saver)',
      description: 'Uses less data, loads faster on slow networks',
      icon: WifiOff,
    },
    {
      value: 'high',
      label: 'High',
      description: 'Best quality, uses more data',
      icon: Wifi,
    },
  ];

  const handleSelect = (value: VideoQuality) => {
    setQuality(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto bg-card border-border rounded-3xl shadow-2xl">
        <DialogHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose} className="p-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <DialogTitle className="text-xl font-semibold text-foreground">Video Quality</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isSlowConnection && quality === 'auto' && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm">
              <WifiOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-amber-600 dark:text-amber-400">
                Slow connection detected. Using data saver mode automatically.
              </span>
            </div>
          )}

          <div className="space-y-2">
            {options.map((option) => (
              <Button
                key={option.value}
                variant="ghost"
                className={`w-full justify-between h-auto py-4 px-4 rounded-2xl ${
                  quality === option.value 
                    ? 'bg-primary/10 border border-primary/30' 
                    : 'hover:bg-secondary/50'
                }`}
                onClick={() => handleSelect(option.value)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    quality === option.value ? 'bg-primary' : 'bg-secondary'
                  }`}>
                    <option.icon className={`w-5 h-5 ${
                      quality === option.value ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </div>
                {quality === option.value && (
                  <Check className="w-5 h-5 text-primary flex-shrink-0" />
                )}
              </Button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground px-2">
            Changes apply immediately to new videos. Lower quality uses less mobile data and loads faster.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoQualityModal;
