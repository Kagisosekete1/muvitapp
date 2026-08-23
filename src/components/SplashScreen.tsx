import React from 'react';
import muvitLogo from '@/assets/muvit-logo.png';

const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
      <div className="animate-fade-in">
        <img 
          src={muvitLogo} 
          alt="Muv'it Logo" 
          className="w-32 h-32 rounded-[28px] shadow-2xl"
        />
      </div>
    </div>
  );
};

export default SplashScreen;
