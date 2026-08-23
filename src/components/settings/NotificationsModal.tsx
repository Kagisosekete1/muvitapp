import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, ChevronRight, Settings, Smartphone } from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleOpenPreferences = () => {
    onClose();
    navigate('/settings/notifications');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border rounded-3xl">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Notifications</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Main notification preferences link */}
          <div className="space-y-1 bg-secondary/30 rounded-2xl overflow-hidden">
            <Button
              variant="ghost"
              className="w-full justify-between h-auto py-4 px-4 rounded-none hover:bg-secondary/50 text-foreground"
              onClick={handleOpenPreferences}
            >
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Notification Preferences</p>
                  <p className="text-xs text-muted-foreground">Manage push notifications & alerts</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-between h-auto py-4 px-4 rounded-none hover:bg-secondary/50 text-foreground"
              onClick={handleOpenPreferences}
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-xs text-muted-foreground">Configure device notifications</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>

          {/* Info section */}
          <div className="bg-secondary/20 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-muted-foreground mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Customize which notifications you receive for likes, comments, follows, and more.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationsModal;
