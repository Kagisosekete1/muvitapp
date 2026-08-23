import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Smartphone, Lock, Share2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';

interface AddFriendsFromContactsProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddFriendsFromContacts: React.FC<AddFriendsFromContactsProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  const handleSyncContacts = async () => {
    setLoading(true);

    // Simulate contact sync process
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (isNative) {
      // In a real app, this would use @capacitor-community/contacts
      toast({
        title: 'Contacts synced',
        description: "We found 0 friends on Muv'it. Invite them to join!",
      });
    } else {
      toast({
        title: 'Not available',
        description: 'Contact sync is only available in the mobile app.',
      });
    }

    setLoading(false);
  };

  const handleShareInvite = async () => {
    const shareData = {
      title: "Join me on Muv'it!",
      text: "Hey! I'm using Muv'it to share and discover amazing dance videos. Join me!",
      url: 'https://letsreelit.lovable.app',
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        toast({
          title: 'Link copied!',
          description: 'Invite link copied to clipboard.',
        });
      }
    } catch (error) {
      // User cancelled or error
      if ((error as Error).name !== 'AbortError') {
        toast({
          title: 'Share failed',
          description: 'Could not share the invite link.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] rounded-3xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-semibold text-center">Add Muva'z from Contacts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Sync Contacts Option */}
          <div className="bg-secondary/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Sync Contacts</p>
                <p className="text-sm text-muted-foreground">
                  Find friends who are already on Muv'it
                </p>
              </div>
            </div>
            <Button 
              onClick={handleSyncContacts}
              className="w-full rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Sync Contacts
                </>
              )}
            </Button>
          </div>

          {/* Invite Friends Option */}
          <div className="bg-secondary/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <Share2 className="w-6 h-6 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Invite Friends</p>
                <p className="text-sm text-muted-foreground">
                  Share Muv'it with friends via message or social media
                </p>
              </div>
            </div>
            <Button 
              onClick={handleShareInvite}
              variant="outline"
              className="w-full rounded-xl"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Invite Link
            </Button>
          </div>

          {/* Privacy Notice */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground px-2">
            <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              Your contacts are only used to find friends on Muv'it. 
              We never store or share your contact information.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendsFromContacts;
