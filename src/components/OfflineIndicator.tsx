import React from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import { useOfflineSupport } from '@/hooks/useOfflineSupport';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className }) => {
  const { isOnline, isOfflineMode } = useOfflineSupport();

  if (isOnline) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium animate-slide-down",
        className
      )}
    >
      <WifiOff className="w-4 h-4" />
      <span>You're offline</span>
      <Loader2 className="w-3 h-3 animate-spin ml-1" />
    </div>
  );
};

export default OfflineIndicator;
