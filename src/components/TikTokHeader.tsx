import React from 'react';

export const TikTokHeader: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50 shadow-sm lg:hidden">
      <div className="flex items-center justify-center px-5 pb-3.5 pt-[calc(env(safe-area-inset-top)+0.875rem)]">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-md" style={{fontFamily: "'Inter', sans-serif"}}>
            M
          </div>
          <span className="text-2xl font-bold text-foreground" style={{fontFamily: "'Inter', sans-serif", fontWeight: 800}}>Muv'it</span>
        </div>
      </div>
    </header>
  );
};
