import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Facebook, Instagram, MessageCircle, BookMarked } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import ShareViaMessageModal from './ShareViaMessageModal';

interface ShareReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  reelId: string;
  reelTitle: string;
  username: string;
  videoUrl?: string;
}

// X (Twitter) icon component
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// WhatsApp icon component
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const ShareReelModal: React.FC<ShareReelModalProps> = ({ isOpen, onClose, reelId, reelTitle, username, videoUrl }) => {
  const { toast } = useToast();
  const { authUser } = useUser();
  const [isSharing, setIsSharing] = useState(false);
  const [showMessageShare, setShowMessageShare] = useState(false);
  const reelUrl = `https://muvit.site/reel/${reelId}`;
  const shareText = `Watch this Muv'z by @${username}: ${reelTitle}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(reelUrl);
    toast({
      title: "Link copied!",
      description: "Reel link copied to clipboard",
    });
  };

  const shareToStory = async () => {
    if (!authUser) {
      toast({ title: 'Sign in required', description: 'Please sign in to share to story' });
      return;
    }

    setIsSharing(true);
    try {
      // Create a story reel that references this reel
      const { error } = await supabase.from('reels').insert({
        user_id: authUser.id,
        title: `Shared: ${reelTitle}`,
        video_url: videoUrl || '',
        description: `Shared from @${username}`,
        is_portrait: true,
      });

      if (error) throw error;

      toast({
        title: "Shared to your story!",
        description: "This reel has been added to your profile",
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to share to story",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(reelUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  const shareToX = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(reelUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  const shareToInstagram = () => {
    navigator.clipboard.writeText(reelUrl);
    toast({
      title: "Link copied!",
      description: "Open Instagram and paste the link in your story or DM",
    });
  };

  const shareToWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${reelUrl}`)}`;
    window.open(url, '_blank');
  };

  const shareViaMessage = () => {
    setShowMessageShare(true);
  };

  const shareOptions = [
    { 
      icon: BookMarked, 
      label: 'Your Story', 
      action: shareToStory,
      color: 'bg-gradient-to-br from-primary to-primary/70 hover:opacity-90'
    },
    { 
      icon: Facebook, 
      label: 'Facebook', 
      action: shareToFacebook,
      color: 'bg-[#1877F2] hover:bg-[#166FE5]'
    },
    { 
      icon: XIcon, 
      label: 'X', 
      action: shareToX,
      color: 'bg-black hover:bg-gray-800'
    },
    { 
      icon: Instagram, 
      label: 'Instagram', 
      action: shareToInstagram,
      color: 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90'
    },
    { 
      icon: WhatsAppIcon, 
      label: 'WhatsApp', 
      action: shareToWhatsApp,
      color: 'bg-[#25D366] hover:bg-[#20BD5A]'
    },
    { 
      icon: MessageCircle, 
      label: 'Message', 
      action: shareViaMessage,
      color: 'bg-secondary hover:bg-secondary/90'
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border rounded-3xl">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Share Reel</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Social Share Buttons */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {shareOptions.map((option, idx) => (
              <button
                key={idx}
                className="flex flex-col items-center gap-2 disabled:opacity-50"
                onClick={option.action}
                disabled={isSharing && option.label === 'Your Story'}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${option.color}`}>
                  <option.icon className="w-5 h-5" />
                </div>
                <span className="text-xs text-muted-foreground text-center">{option.label}</span>
              </button>
            ))}
          </div>

          {/* Reel Link */}
          <div className="space-y-2 pt-2">
            <label className="text-sm font-medium text-foreground">Reel Link</label>
            <div className="flex gap-2">
              <Input value={reelUrl} readOnly className="flex-1 rounded-xl text-sm" />
              <Button onClick={copyToClipboard} className="rounded-xl">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
      <ShareViaMessageModal
        isOpen={showMessageShare}
        onClose={() => setShowMessageShare(false)}
        shareUrl={reelUrl}
        shareTitle={shareText}
      />
    </Dialog>
  );
};

export default ShareReelModal;
