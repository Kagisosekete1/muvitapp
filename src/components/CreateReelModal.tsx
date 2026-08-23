import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Clock, Trash2, Radio } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReelUploadModal from './ReelUploadModal';
import GoLiveModal from './GoLiveModal';

interface Draft {
  id: string;
  file: File;
  title: string;
  thumbnail: string;
  createdAt: Date;
}

interface CreateReelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateReelModal: React.FC<CreateReelModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  // Load drafts from localStorage
  useEffect(() => {
    const savedDrafts = localStorage.getItem('reelDrafts');
    if (savedDrafts) {
      try {
        const parsed = JSON.parse(savedDrafts);
        setDrafts(parsed.map((d: any) => ({
          ...d,
          createdAt: new Date(d.createdAt)
        })));
      } catch (e) {
        console.error('Error loading drafts:', e);
      }
    }
  }, [isOpen]);

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/quicktime,video/webm';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Check if video is portrait
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          if (video.videoHeight > video.videoWidth) {
            setSelectedFile(file);
            setShowUploadModal(true);
          } else {
            toast({
              title: "Invalid orientation",
              description: "Please upload a portrait Muv (vertical)",
              variant: "destructive",
            });
          }
          URL.revokeObjectURL(video.src);
        };
        video.src = URL.createObjectURL(file);
      }
    };
    input.click();
  };

  const handleUploadModalClose = () => {
    setShowUploadModal(false);
    setSelectedFile(null);
    onClose();
  };

  const handleDeleteDraft = (draftId: string) => {
    const updatedDrafts = drafts.filter(d => d.id !== draftId);
    setDrafts(updatedDrafts);
    localStorage.setItem('reelDrafts', JSON.stringify(updatedDrafts));
    toast({
      title: "Draft deleted",
      description: "The draft has been permanently removed.",
    });
  };

  const handleContinueDraft = (draft: Draft) => {
    // For now, show toast - in full implementation would restore the draft
    toast({
      title: "Continue editing",
      description: `Continuing with "${draft.title || 'Untitled'}"...`,
    });
  };

  const handleGoLive = () => {
    setShowGoLiveModal(true);
  };

  const handleGoLiveClose = () => {
    setShowGoLiveModal(false);
    onClose();
  };

  const options = [
    {
      icon: Upload,
      title: 'Upload from Gallery',
      description: 'Choose a portrait Muv from your device',
      color: 'bg-primary',
      action: handleUpload,
    },
    {
      icon: Radio,
      title: 'Go Live',
      description: 'Start a live stream with your followers',
      color: 'bg-destructive',
      action: handleGoLive,
    },
  ];

  if (showGoLiveModal) {
    return <GoLiveModal isOpen={showGoLiveModal} onClose={handleGoLiveClose} />;
  }

  if (showUploadModal && selectedFile) {
    return (
      <ReelUploadModal
        isOpen={showUploadModal}
        onClose={handleUploadModalClose}
        videoFile={selectedFile}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle>Create Muv</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground px-1">
            Portrait Muv'z only (vertical orientation)
          </p>
          
          {options.map((option, idx) => (
            <Button
              key={idx}
              variant="outline"
              className="w-full h-auto py-4 justify-start rounded-2xl"
              onClick={option.action}
            >
              <div className={`w-10 h-10 rounded-lg ${option.color} flex items-center justify-center mr-3`}>
                <option.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold">{option.title}</p>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
            </Button>
          ))}

          {/* Drafts Section */}
          {drafts.length > 0 && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Drafts</p>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl"
                  >
                    <Button
                      variant="ghost"
                      className="flex-1 justify-start p-0 h-auto hover:bg-transparent"
                      onClick={() => handleContinueDraft(draft)}
                    >
                      <div className="w-12 h-16 bg-muted rounded-lg mr-3 overflow-hidden">
                        {draft.thumbnail && (
                          <img src={draft.thumbnail} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">{draft.title || 'Untitled'}</p>
                        <p className="text-xs text-muted-foreground">
                          {draft.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteDraft(draft.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReelModal;