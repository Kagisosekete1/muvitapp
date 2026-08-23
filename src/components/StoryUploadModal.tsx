import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Camera, X } from 'lucide-react';

interface StoryUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StoryUploadModal: React.FC<StoryUploadModalProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      // Handle file upload logic here
      console.log('Uploading story:', selectedFile, caption);
      onClose();
      setSelectedFile(null);
      setCaption('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] glass-card border-border/50 shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl font-bold">Add to Your Story</DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-4 top-4 hover:bg-secondary/80 rounded-xl"
            onClick={onClose}
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </Button>
        </DialogHeader>
        
        <div className="space-y-4">
          {!selectedFile ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border/50 rounded-2xl p-10 text-center hover:border-primary/50 transition-colors">
                <div className="w-16 h-16 gradient-primary rounded-2xl mx-auto mb-4 flex items-center justify-center glow-primary">
                  <Upload className="w-8 h-8 text-primary-foreground" strokeWidth={2.5} />
                </div>
                <p className="text-foreground font-medium mb-2">Upload a video</p>
                <p className="text-muted-foreground text-sm mb-6">Share your story with the world</p>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl border-border/50 hover:bg-secondary/80"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" strokeWidth={2.5} />
                    Choose File
                  </Button>
                  <Button className="w-full gradient-accent rounded-xl font-semibold shadow-md">
                    <Camera className="w-4 h-4 mr-2" strokeWidth={2.5} />
                    Record Video
                  </Button>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-5">
                <p className="text-foreground font-semibold mb-1">{selectedFile.name}</p>
                <p className="text-muted-foreground text-sm">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              
              <Input
                placeholder="Add a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="bg-secondary/50 border-border/50 rounded-xl focus:border-primary"
              />
              
              <div className="flex space-x-3">
                <Button variant="outline" className="flex-1 rounded-xl border-border/50" onClick={onClose}>
                  Cancel
                </Button>
                <Button className="flex-1 gradient-primary rounded-xl font-semibold shadow-md glow-primary" onClick={handleUpload}>
                  Share Story
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StoryUploadModal;