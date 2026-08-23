import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNavigation } from '@/components/BottomNavigation';
import DesktopSidebar from '@/components/DesktopSidebar';
import CreateReelModal from '@/components/CreateReelModal';
import MobileViewWrapper from '@/components/MobileViewWrapper';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft,
  User, 
  Shield, 
  Bell, 
  HelpCircle, 
  FileText, 
  Info, 
  ChevronRight,
  LogOut,
  Video,
  BarChart3,
  Users
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import AccountInfoModal from '@/components/settings/AccountInfoModal';
import PrivacySecurityModal from '@/components/settings/PrivacySecurityModal';
import VideoQualityModal from '@/components/settings/VideoQualityModal';
import HelpCenterModal from '@/components/settings/HelpCenterModal';
import SwitchAccountsModal from '@/components/settings/SwitchAccountsModal';
const Settings = () => {
  const navigate = useNavigate();
  const { signOut } = useUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('settings');
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  
  // Sub-modal states
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showPrivacySecurity, setShowPrivacySecurity] = useState(false);
  const [showVideoQuality, setShowVideoQuality] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showSwitchAccounts, setShowSwitchAccounts] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case 'home': navigate('/'); break;
      case 'tutorials': navigate('/tutorials'); break;
      case 'create': setIsCreateReelOpen(true); break;
      case 'notifications': navigate('/activity'); break;
      case 'inbox': navigate('/inbox'); break;
      case 'dashboard': navigate('/monetization-analytics'); break;
      case 'profile': navigate('/profile'); break;
      case 'settings': break;
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast({ title: 'Logged out successfully' });
      navigate('/auth');
    } catch {
      toast({ title: 'Error logging out', variant: 'destructive' });
    }
  };

  const settingsItems = [
    { 
      icon: User, 
      label: 'Account Info', 
      description: 'Profile, email, password',
      onClick: () => setShowAccountInfo(true)
    },
    { 
      icon: Shield, 
      label: 'Privacy & Security', 
      description: 'Privacy settings, blocked users',
      onClick: () => setShowPrivacySecurity(true)
    },
    { 
      icon: Bell, 
      label: 'Notifications', 
      description: 'Push notifications, preferences',
      onClick: () => navigate('/settings/notifications')
    },
    { 
      icon: BarChart3, 
      label: 'Creator Dashboard', 
      description: 'Stats, earnings, monetization',
      onClick: () => navigate('/monetization-analytics')
    },
    { 
      icon: Users, 
      label: 'Switch Accounts', 
      description: 'Manage up to 4 saved accounts',
      onClick: () => setShowSwitchAccounts(true)
    },
    { 
      icon: Video, 
      label: 'Video Quality', 
      description: 'Playback and upload settings',
      onClick: () => setShowVideoQuality(true)
    },
    { 
      icon: HelpCircle, 
      label: 'Help Center', 
      description: 'FAQ, support, contact',
      onClick: () => setShowHelpCenter(true)
    },
    { 
      icon: FileText, 
      label: 'Terms of Service', 
      description: 'Legal terms and conditions',
      onClick: () => navigate('/terms')
    },
    { 
      icon: Info, 
      label: 'About', 
      description: 'App version, credits',
      onClick: () => navigate('/about')
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      {/* Main Content */}
      <div className="lg:pl-[72px] xl:pl-[244px]">
        <MobileViewWrapper>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate(-1)}
                  className="shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-lg font-semibold">Settings</h1>
              </div>
            </div>

            {/* Settings List */}
            <ScrollArea className="flex-1">
              <div className="p-4 pb-24 space-y-2">
                {settingsItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                  </button>
                ))}

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-colors text-left mt-6"
                >
                  <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                    <LogOut className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-destructive">Log Out</p>
                    <p className="text-sm text-destructive/70">Sign out of your account</p>
                  </div>
                </button>

                {/* App Version */}
                <div className="text-center pt-8 pb-4">
                  <p className="text-xs text-muted-foreground">Muv'it v1.0.0</p>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Mobile Bottom Navigation */}
          <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
        </MobileViewWrapper>
      </div>

      {/* Modals */}
      <CreateReelModal 
        isOpen={isCreateReelOpen} 
        onClose={() => setIsCreateReelOpen(false)} 
      />
      <AccountInfoModal 
        isOpen={showAccountInfo} 
        onClose={() => setShowAccountInfo(false)} 
      />
      <PrivacySecurityModal 
        isOpen={showPrivacySecurity} 
        onClose={() => setShowPrivacySecurity(false)} 
      />
      <VideoQualityModal 
        isOpen={showVideoQuality} 
        onClose={() => setShowVideoQuality(false)} 
      />
      <HelpCenterModal 
        isOpen={showHelpCenter} 
        onClose={() => setShowHelpCenter(false)} 
      />
      <SwitchAccountsModal 
        isOpen={showSwitchAccounts} 
        onClose={() => setShowSwitchAccounts(false)} 
      />
    </div>
  );
};

export default Settings;
