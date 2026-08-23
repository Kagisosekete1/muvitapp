import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const LAST_ROUTE_KEY = 'muvit_last_route';
const ROUTE_HISTORY_KEY = 'muvit_route_history';
const MAX_HISTORY_LENGTH = 50;

// Routes that should not be remembered (auth, etc.)
const EXCLUDED_ROUTES = ['/auth', '/terms', '/privacy', '/about'];

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
    if (lastRoute && lastRoute !== '/' && location.pathname === '/' && !EXCLUDED_ROUTES.includes(lastRoute)) {
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
    const currentPath = location.pathname;
    
    // Skip if this is the same path as before
    if (lastPathRef.current === currentPath) return;
    lastPathRef.current = currentPath;

    if (!EXCLUDED_ROUTES.includes(currentPath)) {
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
  }, [location.pathname]);
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

/**
 * Clear route history
 */
export const clearRouteHistory = (): void => {
  localStorage.removeItem(ROUTE_HISTORY_KEY);
  localStorage.removeItem(LAST_ROUTE_KEY);
};
