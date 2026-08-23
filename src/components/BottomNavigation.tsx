import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Search, Plus, User, Play, Heart } from 'lucide-react';
import { NotificationBadge, useNotificationCounts } from '@/components/ui/NotificationBadge';
import { useUser } from '@/contexts/UserContext';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  const counts = useNotificationCounts();
  const { currentUser } = useUser();
  const hasUnreadActivity = counts.notifications > 0;

  const tabs = [
    { id: 'home', icon: Play, label: "Muv'z" },
    { id: 'tutorials', icon: Search, label: 'Search' },
    { id: 'create', icon: Plus, label: 'Upload', special: true },
    { id: 'notifications', icon: Heart, label: 'Activity', badge: hasUnreadActivity },
    { id: 'profile', icon: User, label: 'Profile', isProfile: true },
  ];

  const handleTabClick = (tab: typeof tabs[0]) => {
    onTabChange(tab.id);
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md lg:hidden bottom-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="bg-card border border-border rounded-full shadow-xl flex items-center justify-around px-1 py-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors relative ${
                tab.special
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 scale-105 shadow-button'
                  : isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => handleTabClick(tab)}
            >
              {tab.isProfile && currentUser?.avatarUrl ? (
                <Avatar
                  className={`w-5 h-5 ${
                    isActive ? 'ring-2 ring-primary' : 'ring-1 ring-border'
                  }`}
                >
                  <AvatarImage src={currentUser.avatarUrl} alt="Profile" />
                  <AvatarFallback className="text-[9px]">
                    {currentUser.displayName?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <tab.icon className={`${tab.special ? 'w-6 h-6' : 'w-4 h-4'}`} strokeWidth={2} />
              )}
              {!tab.special && (
                <span className="text-[9px] font-medium">
                  {tab.label}
                </span>
              )}
              {tab.badge && (
                <NotificationBadge 
                  className="absolute -top-1 -right-1" 
                  showDotOnly={false}
                />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
