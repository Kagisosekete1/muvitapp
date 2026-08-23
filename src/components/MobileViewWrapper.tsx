import React from 'react';

interface MobileViewWrapperProps {
  children: React.ReactNode;
  enabled?: boolean;
}

/**
 * Wraps content in a tablet-sized container when on desktop.
 * Creates a TikTok-like experience with black sidebars on larger screens.
 * Desktop uses tablet sizing (wider) with rounded corners.
 */
const MobileViewWrapper: React.FC<MobileViewWrapperProps> = ({ 
  children, 
  enabled = true 
}) => {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100dvh] bg-black flex items-center justify-center">
      {/* Container - full width on mobile, tablet-like on desktop with rounded corners */}
      <div className="w-full h-[100dvh] lg:w-[768px] lg:h-[95vh] lg:max-h-[920px] lg:my-auto lg:rounded-[2.5rem] lg:border lg:border-border/30 relative bg-background flex flex-col overflow-hidden safe-screen">
        {children}
      </div>
    </div>
  );
};

export default MobileViewWrapper;
