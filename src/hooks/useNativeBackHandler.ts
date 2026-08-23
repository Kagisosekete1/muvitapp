import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook that handles hardware back button on native platforms.
 * - Navigates back through browser history if possible
 * - Exits/minimizes app when at root
 */
export const useNativeBackHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleBackButton = () => {
      // If we can go back in history, do so
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        // At root - minimize/exit app
        App.minimizeApp();
      }
    };

    // Listen for hardware back button
    const listener = App.addListener('backButton', handleBackButton);

    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate, location]);
};
