import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Music2, Check } from 'lucide-react';

export type PlaceholderSong = {
  id: string;
  title: string;
  artist: string;
  duration: string;
};

interface MusicLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (song: PlaceholderSong) => void;
}

const SONGS: PlaceholderSong[] = [
  { id: 's1', title: 'Neon Steps', artist: 'Reel\'it Studio', duration: '0:30' },
  { id: 's2', title: 'Bassline Bounce', artist: 'Reel\'it Studio', duration: '0:22' },
  { id: 's3', title: 'Slow Motion Glow', artist: 'Reel\'it Studio', duration: '0:18' },
  { id: 's4', title: 'Clap & Spin', artist: 'Reel\'it Studio', duration: '0:15' },
  { id: 's5', title: 'Midnight Groove', artist: 'Reel\'it Studio', duration: '0:25' },
];

const MusicLibraryModal: React.FC<MusicLibraryModalProps> = ({ isOpen, onClose, onSelect }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music2 className="w-5 h-5" />
            Music Library
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          Placeholder tracks for now (music platforms coming soon).
        </div>

        <div className="mt-3 space-y-2">
          {SONGS.map((song) => (
            <Button
              key={song.id}
              variant="outline"
              className="w-full h-auto py-3 justify-between rounded-2xl"
              onClick={() => {
                onSelect(song);
                onClose();
              }}
            >
              <div className="text-left">
                <div className="font-semibold">{song.title}</div>
                <div className="text-xs text-muted-foreground">{song.artist}</div>
              </div>
              <div className="text-xs text-muted-foreground">{song.duration}</div>
            </Button>
          ))}
        </div>

        <div className="mt-4">
          <Button variant="secondary" className="w-full rounded-xl" onClick={onClose}>
            <Check className="w-4 h-4 mr-2" />
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MusicLibraryModal;
