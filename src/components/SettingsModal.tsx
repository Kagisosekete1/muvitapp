import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  User, 
  Lock, 
  Bell, 
  HelpCircle, 
  Info,
  Moon,
  Globe,
  LogOut,
  ChevronRight,
  DollarSign,
  Wifi,
  HardDrive,
  Bug,
  Settings,
  X
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useDebug } from '@/contexts/DebugContext';
import AccountInfoModal from './settings/AccountInfoModal';
import PrivacySecurityModal from './settings/PrivacySecurityModal';
import NotificationsModal from './settings/NotificationsModal';
import LanguageModal from './settings/LanguageModal';
import HelpCenterModal from './settings/HelpCenterModal';
import CreatorDashboardModal from './CreatorDashboardModal';
import VideoQualityModal from './settings/VideoQualityModal';
import EarningsModal from './EarningsModal';
import CachedVideosModal from './settings/CachedVideosModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useUser();
  const { showVideoDebug, setShowVideoDebug } = useDebug();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [openModal, setOpenModal] = useState<string | null>(null);

  const handleLogout = async () => {
    await signOut();
    onClose();
    navigate('/auth');
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleVideoDebug = () => {
    setShowVideoDebug(!showVideoDebug);
  };

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Account Information', action: () => setOpenModal('account') },
        { icon: Lock, label: 'Privacy & Security', action: () => setOpenModal('privacy') },
        { icon: Bell, label: 'Notifications', action: () => setOpenModal('notifications') },
      ],
    },
    {
      title: 'Creator',
      items: [
        { icon: DollarSign, label: 'Creator Dashboard & Earnings', action: () => setOpenModal('creator') },
        { icon: DollarSign, label: 'Earnings & Payouts', action: () => setOpenModal('earnings') },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { icon: Moon, label: 'Dark Mode', toggle: true, value: darkMode, onChange: toggleDarkMode },
        { icon: Wifi, label: 'Video Quality', action: () => setOpenModal('video-quality') },
        { icon: HardDrive, label: 'Cached Muv\'z', action: () => setOpenModal('cached-videos') },
        { icon: Globe, label: 'Language', action: () => setOpenModal('language') },
        { icon: Bug, label: 'Video Debug Overlay', toggle: true, value: showVideoDebug, onChange: toggleVideoDebug },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: HelpCircle, label: 'Help Center', action: () => setOpenModal('help') },
        { icon: Info, label: 'About', action: () => { onClose(); navigate('/about', { state: { from: location.pathname } }); } },
        { icon: Lock, label: 'Terms & Policies', action: () => { onClose(); navigate('/terms', { state: { from: location.pathname } }); } },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />
      
      {/* Floating Settings Bubble */}
      <div 
        className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[420px] max-h-[85vh] bg-card/95 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden transition-all duration-500 ease-out ${
          isOpen 
            ? 'scale-100 opacity-100' 
            : 'scale-95 opacity-0 pointer-events-none'
        }`}
        style={{
          zIndex: 9999,
          boxShadow: isOpen ? '0 25px 80px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1) inset' : 'none',
        }}
      >
        {/* Header with gradient */}
        <div className="relative p-5 flex items-center justify-between bg-gradient-to-b from-background/80 to-transparent border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Settings</h2>
              <p className="text-xs text-muted-foreground">Manage your preferences</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-180px)] px-4 py-4">
          <div className="space-y-6">
            {settingsSections.map((section, idx) => (
              <div key={idx}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                  {section.title}
                </h3>
                <div className="space-y-1 bg-secondary/30 rounded-2xl overflow-hidden">
                  {section.items.map((item, itemIdx) => (
                    <Button
                      key={itemIdx}
                      variant="ghost"
                      className="w-full justify-between h-auto py-4 px-4 rounded-none hover:bg-secondary/50 text-foreground"
                      onClick={item.action}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5 text-muted-foreground" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      {item.toggle ? (
                        <Switch checked={item.value} onCheckedChange={item.onChange} />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logout Button - Fixed at bottom */}
        <div className="p-4 border-t border-border/50 bg-background/50 backdrop-blur-xl">
          <Button
            variant="destructive"
            className="w-full rounded-2xl h-12"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </div>
      </div>

      {/* Sub-modals */}
      <AccountInfoModal isOpen={openModal === 'account'} onClose={() => setOpenModal(null)} />
      <PrivacySecurityModal isOpen={openModal === 'privacy'} onClose={() => setOpenModal(null)} />
      <NotificationsModal isOpen={openModal === 'notifications'} onClose={() => setOpenModal(null)} />
      <LanguageModal isOpen={openModal === 'language'} onClose={() => setOpenModal(null)} />
      <VideoQualityModal isOpen={openModal === 'video-quality'} onClose={() => setOpenModal(null)} />
      <CachedVideosModal isOpen={openModal === 'cached-videos'} onClose={() => setOpenModal(null)} />
      <HelpCenterModal isOpen={openModal === 'help'} onClose={() => setOpenModal(null)} />
      <CreatorDashboardModal isOpen={openModal === 'creator'} onClose={() => setOpenModal(null)} />
      <EarningsModal isOpen={openModal === 'earnings'} onClose={() => setOpenModal(null)} />
    </>
  );
};

export default SettingsModal;
