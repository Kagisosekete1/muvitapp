import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNavigation } from '@/components/BottomNavigation';
import DesktopSidebar from '@/components/DesktopSidebar';
import CreateReelModal from '@/components/CreateReelModal';
import SettingsModal from '@/components/SettingsModal';
import NotificationsModal from '@/components/settings/NotificationsModal';

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  showNav?: boolean;
  onTabChange?: (tab: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  activeTab = 'home',
  showNav = true,
  onTabChange
}) => {
  const navigate = useNavigate();
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    // If parent provides a handler, use it
    if (onTabChange) {
      onTabChange(tab);
      return;
    }

    // Default navigation behavior
    switch (tab) {
      case 'home':
        navigate('/');
        break;
      case 'tutorials':
        navigate('/tutorials');
        break;
      case 'create':
        setIsCreateReelOpen(true);
        break;
      case 'battles':
        navigate('/battles');
        break;
      case 'notifications':
        setIsNotificationsOpen(true);
        break;
      case 'inbox':
        navigate('/inbox');
        break;
      case 'dashboard':
        navigate('/monetization-analytics');
        break;
      case 'profile':
        navigate('/profile');
        break;
      case 'settings':
        setIsSettingsOpen(true);
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      {showNav && <DesktopSidebar activeTab={activeTab} onTabChange={handleTabChange} />}
      
      {/* Main Content - offset for sidebar on desktop */}
      <div className="lg:pl-[72px] xl:pl-[244px]">
        {children}
      </div>

      {/* Mobile Bottom Navigation - hidden on desktop */}
      {showNav && <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />}

      {/* Modals */}
      <CreateReelModal 
        isOpen={isCreateReelOpen} 
        onClose={() => setIsCreateReelOpen(false)} 
      />
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
      <NotificationsModal 
        isOpen={isNotificationsOpen} 
        onClose={() => setIsNotificationsOpen(false)} 
      />
    </div>
  );
};

export default AppLayout;
