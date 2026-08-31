import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
import { consumePreviousRoute, getCurrentRoutePath } from '@/hooks/useRouteMemory';

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
      const currentRoute = getCurrentRoutePath(location);
      const previousRoute = consumePreviousRoute(currentRoute);

      if (previousRoute && previousRoute !== currentRoute) {
        navigate(previousRoute, { replace: true });
        return;
      }

      if (location.pathname !== '/') {
        navigate('/', { replace: true });
        return;
      }

      try {
        App.minimizeApp();
      } catch {
        navigate('/', { replace: true });
      }
    };

    // Listen for hardware back button
    const listener = App.addListener('backButton', handleBackButton);

    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate, location]);
};
