import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Share2, MessageCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ShareViaMessageModal from './ShareViaMessageModal';

interface ShareProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

const ShareProfileModal: React.FC<ShareProfileModalProps> = ({ isOpen, onClose, username }) => {
  const { toast } = useToast();
  const [showMessageModal, setShowMessageModal] = useState(false);
  const profileUrl = `https://muvit.site/@${username}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profileUrl);
    toast({
      title: "Link copied!",
      description: "Profile link copied to clipboard",
    });
  };

  const handleShareViaMessage = () => {
    setShowMessageModal(true);
  };

  const handleShareViaEmail = () => {
    window.location.href = `mailto:?subject=Check out this Muv'it profile&body=Check out @${username} on Muv'it: ${profileUrl}`;
    toast({
      title: "Opening email...",
      description: "Your email app should open shortly",
    });
  };

  const handleMoreOptions = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ 
          title: `Check out @${username} on Muv'it`, 
          text: `Check out @${username}'s profile on Muv'it!`,
          url: profileUrl 
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast({
            title: "Share failed",
            description: "Could not share the profile",
            variant: "destructive",
          });
        }
      }
    } else {
      // Fallback: copy to clipboard
      copyToClipboard();
    }
  };

  const shareOptions = [
    { 
      icon: MessageCircle, 
      label: 'Share via Message', 
      action: handleShareViaMessage,
      description: 'Send to a friend on Muv\'it'
    },
    { 
      icon: Mail, 
      label: 'Share via Email', 
      action: handleShareViaEmail,
      description: 'Open your email app'
    },
    { 
      icon: Share2, 
      label: 'More options', 
      action: handleMoreOptions,
      description: 'Share to other apps'
    },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border rounded-3xl">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-xl font-semibold text-foreground">Share Profile</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Profile Link */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Profile Link</label>
              <div className="flex gap-2">
                <Input value={profileUrl} readOnly className="flex-1 rounded-xl" />
                <Button onClick={copyToClipboard} className="rounded-xl">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Share Options */}
            <div className="space-y-1 bg-secondary/30 rounded-2xl overflow-hidden">
              {shareOptions.map((option, idx) => (
                <Button
                  key={idx}
                  variant="ghost"
                  className="w-full justify-start h-auto py-4 px-4 rounded-none hover:bg-secondary/50"
                  onClick={option.action}
                >
                  <option.icon className="w-5 h-5 mr-3 text-muted-foreground" />
                  <div className="text-left">
                    <span className="text-foreground block">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ShareViaMessageModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        shareUrl={profileUrl}
        shareTitle={`Check out @${username} on Muv'it`}
      />
    </>
  );
};

export default ShareProfileModal;
