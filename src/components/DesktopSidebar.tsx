import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Film, 
  Search, 
  Plus, 
  Heart, 
  MessageSquare, 
  Menu,
  Sun,
  Moon,
  AlertCircle,
  LogOut,
  BarChart3,
  Settings,
  Users,
  Clapperboard,
  Swords
} from 'lucide-react';
import { useSavedAccounts } from '@/hooks/useSavedAccounts';
import SwitchAccountsModal from '@/components/settings/SwitchAccountsModal';
import { NotificationBadge, useNotificationCounts } from '@/components/ui/NotificationBadge';
import { useUser } from '@/contexts/UserContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';

interface DesktopSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ activeTab, onTabChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const counts = useNotificationCounts();
  const { currentUser, signOut } = useUser();
  const [moreOpen, setMoreOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [switchAccountsOpen, setSwitchAccountsOpen] = useState(false);
  const { accounts } = useSavedAccounts();
  const hasMultipleAccounts = accounts.length > 1;

  const hasUnreadNotifications = counts.notifications > 0;
  const hasUnreadMessages = counts.messages > 0;

  const mainNavItems = [
    { id: 'home', icon: Film, label: "Muv'z", path: '/' },
    { id: 'tutorials', icon: Search, label: 'Search', path: '/tutorials' },
    { id: 'notifications', icon: Heart, label: 'Activity', path: '/activity', badge: hasUnreadNotifications, badgeCount: counts.notifications },
    { id: 'create', icon: Plus, label: 'Create' },
    { id: 'battles', icon: Swords, label: 'Battles', path: '/battles' },
    { id: 'inbox', icon: MessageSquare, label: 'Inbox', path: '/inbox', badge: hasUnreadMessages, badgeCount: counts.messages },
  ];

  const handleNavClick = (item: typeof mainNavItems[0]) => {
    if (item.id === 'create') {
      onTabChange('create');
      return;
    }
    
    onTabChange(item.id);
    if (item.path) {
      navigate(item.path);
    }
  };

  const handleProfileClick = () => {
    onTabChange('profile');
    navigate('/profile');
  };

  const handleSettingsClick = () => {
    onTabChange('settings');
    navigate('/settings');
  };

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    setMoreOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
    setMoreOpen(false);
  };

  const handleReportProblem = () => {
    setMoreOpen(false);
  };

  const handleDashboardFromMore = () => {
    setMoreOpen(false);
    navigate('/monetization-analytics');
  };

  const handleStudioFromMore = () => {
    setMoreOpen(false);
    navigate('/studio');
  };

  const isActive = (itemId: string, path?: string) => {
    if (path) {
      return location.pathname === path;
    }
    return activeTab === itemId;
  };

  return (
    <div className="hidden lg:flex flex-col h-screen border-r border-border bg-background fixed left-0 top-0 z-50 w-[72px] xl:w-[244px]">
      {/* Logo */}
      <div className="p-4 xl:px-6 flex items-center justify-center xl:justify-start">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center font-bold text-primary-foreground text-xl shadow-md">
          M
        </div>
        <span className="hidden xl:block ml-3 text-xl font-bold text-foreground">Muv'it</span>
      </div>

      {/* Main Navigation - Centered vertically */}
      <nav className="flex-1 px-2 xl:px-3 flex flex-col justify-center space-y-1">
        {mainNavItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              "w-full justify-center xl:justify-start gap-4 px-3 py-6 rounded-xl transition-all relative group",
              isActive(item.id, item.path)
                ? "bg-accent text-foreground font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-8 before:bg-primary before:rounded-r-full"
                : "text-foreground hover:bg-accent/50"
            )}
            onClick={() => handleNavClick(item)}
          >
            <item.icon className={cn(
              "w-6 h-6 shrink-0",
              isActive(item.id, item.path) && "stroke-[2.5px]"
            )} />
            <span className="hidden xl:block text-base">{item.label}</span>
            
            {/* Notification badge with count */}
            {item.badge && (
              <div className="absolute top-2 left-6 xl:left-auto xl:right-3">
                {item.badgeCount && item.badgeCount > 0 ? (
                  <div className="min-w-[18px] h-[18px] px-1 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-bold text-primary-foreground">
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </span>
                  </div>
                ) : (
                  <NotificationBadge showDotOnly={true} />
                )}
              </div>
            )}
          </Button>
        ))}

        {/* Profile */}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-center xl:justify-start gap-4 px-3 py-6 rounded-xl transition-all relative",
            isActive('profile', '/profile')
              ? "bg-accent text-foreground font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-8 before:bg-primary before:rounded-r-full"
              : "text-foreground hover:bg-accent/50"
          )}
          onClick={handleProfileClick}
        >
          <Avatar className="w-6 h-6 ring-2 ring-border">
            <AvatarImage src={currentUser?.avatarUrl || ''} alt="Profile" />
            <AvatarFallback className="text-xs">
              {currentUser?.displayName?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="hidden xl:block text-base">Profile</span>
        </Button>

      </nav>

      {/* More Menu at bottom */}
      <div className="p-3 border-t border-border">
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-center xl:justify-start gap-4 px-3 py-6 rounded-xl text-foreground hover:bg-accent/50"
            >
              <Menu className="w-6 h-6 shrink-0" />
              <span className="hidden xl:block text-base">More</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            side="right" 
            align="end"
            className="w-64 p-2 rounded-2xl shadow-lg"
          >
            <div className="space-y-1">
              {/* Settings */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-3 rounded-xl"
                onClick={() => { setMoreOpen(false); handleSettingsClick(); }}
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Button>

              {/* Theme Toggle */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-3 rounded-xl"
                onClick={toggleTheme}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
              </Button>

              {/* Report a Problem */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-3 rounded-xl"
                onClick={handleReportProblem}
              >
                <AlertCircle className="w-5 h-5" />
                <span>Report a Problem</span>
              </Button>

              {/* Dashboard */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-3 rounded-xl"
                onClick={handleDashboardFromMore}
              >
                <BarChart3 className="w-5 h-5" />
                <span>Dashboard</span>
              </Button>

              {/* Muv'it Studio */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-3 rounded-xl"
                onClick={handleStudioFromMore}
              >
                <Clapperboard className="w-5 h-5" />
                <span>Muv'it Studio</span>
              </Button>

              {/* Switch Accounts */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-3 rounded-xl relative"
                onClick={() => { setMoreOpen(false); setSwitchAccountsOpen(true); }}
              >
                <div className="relative">
                  <Users className="w-5 h-5" />
                  {hasMultipleAccounts && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background" />
                  )}
                </div>
                <span>Switch Accounts</span>
                {hasMultipleAccounts && (
                  <span className="ml-auto text-xs text-muted-foreground">{accounts.length}</span>
                )}
              </Button>

              <div className="h-px bg-border my-2" />

              {/* Logout */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5" />
                <span>Log Out</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <SwitchAccountsModal
        isOpen={switchAccountsOpen}
        onClose={() => setSwitchAccountsOpen(false)}
      />
    </div>
  );
};

export default DesktopSidebar;
