import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const LAST_ROUTE_KEY = 'muvit_last_route';
const ROUTE_HISTORY_KEY = 'muvit_route_history';
const MAX_HISTORY_LENGTH = 50;

// Routes that should not be restored on app launch.
const EXCLUDED_ROUTES = ['/auth', '/terms', '/privacy', '/about'];

export const getCurrentRoutePath = (location: { pathname: string; search?: string; hash?: string }) =>
  `${location.pathname}${location.search || ''}${location.hash || ''}`;

const normalizeRoute = (route: string) => route.split('?')[0].split('#')[0];

/**
 * Hook that persists the current route to localStorage and restores on app launch.
 * Also maintains a navigation history for proper back navigation.
 * Call once in App.tsx to enable cross-restart route memory.
 */
export const useRouteMemory = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initializedRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);

  // On mount, restore last route (only once) - but NOT for home navigation
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const lastRoute = localStorage.getItem(LAST_ROUTE_KEY);
    
    // Only restore if we're at root, have a saved route, and it's not home
    if (lastRoute && lastRoute !== '/' && location.pathname === '/' && !EXCLUDED_ROUTES.includes(normalizeRoute(lastRoute))) {
      // Check if this is a fresh app load (not internal navigation)
      const isInternalNav = sessionStorage.getItem('muvit_app_initialized');
      if (!isInternalNav) {
        // Small delay to ensure router is ready
        const timeout = setTimeout(() => {
          navigate(lastRoute, { replace: true });
        }, 50);
        return () => clearTimeout(timeout);
      }
    }
  }, []);

  // Save current route whenever it changes and maintain history
  useEffect(() => {
    const currentPath = getCurrentRoutePath(location);
    
    // Skip if this is the same path as before
    if (lastPathRef.current === currentPath) return;
    lastPathRef.current = currentPath;

    if (!EXCLUDED_ROUTES.includes(normalizeRoute(currentPath))) {
      localStorage.setItem(LAST_ROUTE_KEY, currentPath);
      
      // Update route history for back navigation
      const historyStr = localStorage.getItem(ROUTE_HISTORY_KEY);
      const history: string[] = historyStr ? JSON.parse(historyStr) : [];
      
      // Only add if different from last entry
      if (history[history.length - 1] !== currentPath) {
        history.push(currentPath);
        
        // Keep history manageable
        if (history.length > MAX_HISTORY_LENGTH) {
          history.shift();
        }
        
        localStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(history));
      }
    }
  }, [location.pathname, location.search, location.hash]);
};

/**
 * Get the previous route from history for back navigation
 */
export const getPreviousRoute = (): string | null => {
  const historyStr = localStorage.getItem(ROUTE_HISTORY_KEY);
  if (!historyStr) return null;
  
  const history: string[] = JSON.parse(historyStr);
  
  // Need at least 2 entries to go back
  if (history.length < 2) return null;
  
  // Return second to last (previous page)
  return history[history.length - 2];
};

/**
 * Pop the current route from history (call when navigating back)
 */
export const popRouteFromHistory = (): void => {
  const historyStr = localStorage.getItem(ROUTE_HISTORY_KEY);
  if (!historyStr) return;
  
  const history: string[] = JSON.parse(historyStr);
  if (history.length > 0) {
    history.pop();
    localStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(history));
  }
};

export const consumePreviousRoute = (currentRoute?: string): string | null => {
  const historyStr = localStorage.getItem(ROUTE_HISTORY_KEY);
  if (!historyStr) return null;

  try {
    const history: string[] = JSON.parse(historyStr);
    while (history.length > 0 && currentRoute && history[history.length - 1] === currentRoute) {
      history.pop();
    }

    const previous = history.pop() || null;
    localStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(history));
    return previous;
  } catch {
    localStorage.removeItem(ROUTE_HISTORY_KEY);
    return null;
  }
};

/**
 * Clear route history
 */
export const clearRouteHistory = (): void => {
  localStorage.removeItem(ROUTE_HISTORY_KEY);
  localStorage.removeItem(LAST_ROUTE_KEY);
};
