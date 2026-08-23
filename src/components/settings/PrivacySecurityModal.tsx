import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Lock, Eye, UserX, Shield } from 'lucide-react';

interface PrivacySecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PrivacySecurityModal: React.FC<PrivacySecurityModalProps> = ({ isOpen, onClose }) => {
  const [privateAccount, setPrivateAccount] = useState(false);
  const [showActivityStatus, setShowActivityStatus] = useState(true);
  const [allowMessages, setAllowMessages] = useState(true);

  const privacyOptions = [
    {
      icon: Lock,
      label: 'Private Account',
      description: 'Only approved followers can see your content',
      value: privateAccount,
      onChange: setPrivateAccount,
    },
    {
      icon: Eye,
      label: 'Show Activity Status',
      description: 'Let others see when you were last active',
      value: showActivityStatus,
      onChange: setShowActivityStatus,
    },
    {
      icon: UserX,
      label: 'Allow Messages',
      description: 'Allow others to send you direct messages',
      value: allowMessages,
      onChange: setAllowMessages,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border rounded-3xl">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Privacy & Security</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-1 bg-secondary/30 rounded-2xl overflow-hidden">
            {privacyOptions.map((option, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <option.icon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </div>
                <Switch checked={option.value} onCheckedChange={option.onChange} />
              </div>
            ))}
          </div>

          <div className="bg-secondary/30 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-primary" />
              <p className="font-medium text-foreground">Security Tip</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Never share your password with anyone. Muv'it will never ask for your password via email or messages.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrivacySecurityModal;