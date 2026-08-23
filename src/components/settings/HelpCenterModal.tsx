import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, Mail, FileText, Shield, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HelpCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpCenterModal: React.FC<HelpCenterModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();

  const helpOptions = [
    {
      icon: MessageCircle,
      label: 'Contact Support',
      description: 'Get help from our support team',
      action: () => {
        window.location.href = 'mailto:support@se-mogroup.com';
      },
    },
    {
      icon: Mail,
      label: 'Email Us',
      description: 'info@se-mogroup.com',
      action: () => {
        window.location.href = 'mailto:info@se-mogroup.com';
      },
    },
    {
      icon: FileText,
      label: 'Report a Problem',
      description: 'Let us know about any issues',
      action: () => {
        toast({
          title: "Report Submitted",
          description: "Thank you for your feedback!",
        });
      },
    },
    {
      icon: Shield,
      label: 'Safety Center',
      description: 'Learn about safety on Reel\'It',
      action: () => {
        toast({
          title: "Safety Center",
          description: "Visit www.se-mogroup.com for more information",
        });
      },
    },
    {
      icon: HelpCircle,
      label: 'FAQs',
      description: 'Frequently asked questions',
      action: () => {
        toast({
          title: "FAQs",
          description: "Check our About page for FAQs",
        });
      },
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border rounded-3xl">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Help Center</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-1 bg-secondary/30 rounded-2xl overflow-hidden">
            {helpOptions.map((option, idx) => (
              <Button
                key={idx}
                variant="ghost"
                className="w-full justify-start h-auto py-4 px-4 rounded-none hover:bg-secondary/50"
                onClick={option.action}
              >
                <div className="flex items-center gap-3">
                  <option.icon className="w-5 h-5 text-muted-foreground" />
                  <div className="text-left">
                    <p className="font-medium text-foreground">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HelpCenterModal;