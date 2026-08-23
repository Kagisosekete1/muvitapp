import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Pause, Play } from 'lucide-react';

interface Story {
  id: number;
  username: string;
  avatarUrl: string;
  videoUrl: string;
}

interface StoryViewerModalProps {
  story: Story;
  onClose: () => void;
}

const StoryViewerModal: React.FC<StoryViewerModalProps> = ({ story, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play();
    }
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progress);
    }
  };

  const handleVideoEnd = () => {
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] h-[680px] p-0 bg-black border-none overflow-hidden rounded-3xl shadow-2xl">
        <div className="relative h-full w-full">
          {/* Progress Bar */}
          <div className="absolute top-4 left-4 right-4 z-20">
            <div className="w-full bg-white/20 rounded-full h-1 backdrop-blur-sm">
              <div 
                className="bg-gradient-to-r from-primary to-accent h-1 rounded-full transition-all duration-100 shadow-lg"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Header */}
          <div className="absolute top-8 left-4 right-4 z-20 flex items-center justify-between">
            <div className="flex items-center space-x-3 backdrop-blur-md bg-black/30 rounded-2xl px-4 py-2">
              <img
                src={story.avatarUrl}
                alt={story.username}
                className="w-9 h-9 rounded-full border-2 border-white/30 shadow-md"
              />
              <span className="text-white font-semibold drop-shadow-lg">{story.username}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 backdrop-blur-md rounded-xl shadow-md"
              onClick={onClose}
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </Button>
          </div>

          {/* Video */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            src={story.videoUrl}
            autoPlay
            muted
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnd}
            onClick={togglePlay}
          />

          {/* Play/Pause Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20">
              <Button
                variant="ghost"
                size="lg"
                className="backdrop-blur-md bg-white/20 rounded-full p-6 hover:scale-110 transition-transform shadow-xl"
                onClick={togglePlay}
              >
                <Play className="w-8 h-8 text-white drop-shadow-lg" fill="currentColor" strokeWidth={0} />
              </Button>
            </div>
          )}

          {/* Tap Areas for Navigation */}
          <div className="absolute inset-0 flex">
            <div className="flex-1" onClick={onClose} />
            <div className="flex-1" onClick={onClose} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StoryViewerModal;