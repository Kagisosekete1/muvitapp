import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CacheConfig {
  key: string;
  ttl?: number; // Time to live in milliseconds
}

interface OfflineState {
  isOnline: boolean;
  isOfflineMode: boolean;
}

// Simple in-memory cache with localStorage persistence
class OfflineCache {
  private static instance: OfflineCache;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly STORAGE_KEY = 'reelit_offline_cache';

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): OfflineCache {
    if (!OfflineCache.instance) {
      OfflineCache.instance = new OfflineCache();
    }
    return OfflineCache.instance;
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          this.cache.set(key, value);
        });
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveToStorage() {
    try {
      const obj: Record<string, any> = {};
      this.cache.forEach((value, key) => {
        obj[key] = value;
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore storage errors (quota exceeded, etc.)
    }
  }

  set(key: string, data: any, ttl: number = 3600000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    this.saveToStorage();
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      this.saveToStorage();
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.saveToStorage();
  }

  clear(): void {
    this.cache.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((value, key) => {
      if (now - value.timestamp > value.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
    if (keysToDelete.length > 0) {
      this.saveToStorage();
    }
  }
}

export const offlineCache = OfflineCache.getInstance();

export function useOfflineSupport(): OfflineState & {
  cacheData: <T>(key: string, data: T, ttl?: number) => void;
  getCachedData: <T>(key: string) => T | null;
  clearCache: () => void;
} {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsOfflineMode(false);
      toast({
        title: "You're back online!",
        description: "Your connection has been restored.",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsOfflineMode(true);
      toast({
        title: "You're offline",
        description: "Some features may be limited. We'll sync when you're back online.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup expired cache entries periodically
    const cleanupInterval = setInterval(() => {
      offlineCache.cleanup();
    }, 60000); // Every minute

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(cleanupInterval);
    };
  }, [toast]);

  const cacheData = useCallback(<T,>(key: string, data: T, ttl?: number) => {
    offlineCache.set(key, data, ttl);
  }, []);

  const getCachedData = useCallback(<T,>(key: string): T | null => {
    return offlineCache.get<T>(key);
  }, []);

  const clearCache = useCallback(() => {
    offlineCache.clear();
    toast({
      title: "Cache cleared",
      description: "All cached data has been removed.",
    });
  }, [toast]);

  return {
    isOnline,
    isOfflineMode,
    cacheData,
    getCachedData,
    clearCache,
  };
}

// Wrapper for fetch with offline fallback
export async function fetchWithOfflineSupport<T>(
  url: string,
  cacheKey: string,
  options?: RequestInit,
  ttl?: number
): Promise<T | null> {
  const cache = OfflineCache.getInstance();

  // If online, try to fetch
  if (navigator.onLine) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      cache.set(cacheKey, data, ttl);
      return data;
    } catch {
      // Fall back to cache on network error
      return cache.get<T>(cacheKey);
    }
  }

  // Offline - return cached data
  return cache.get<T>(cacheKey);
}

// Hook for network-aware actions with retry
export function useNetworkAction() {
  const { isOnline } = useOfflineSupport();
  const { toast } = useToast();
  const [pendingActions, setPendingActions] = useState<Array<() => Promise<void>>>([]);

  const executeAction = useCallback(async (
    action: () => Promise<void>,
    offlineMessage?: string
  ) => {
    if (isOnline) {
      try {
        await action();
      } catch (error) {
        toast({
          title: "Action failed",
          description: "Please try again later.",
          variant: "destructive",
        });
      }
    } else {
      // Queue action for later
      setPendingActions(prev => [...prev, action]);
      toast({
        title: "Saved for later",
        description: offlineMessage || "This action will complete when you're back online.",
      });
    }
  }, [isOnline, toast]);

  // Execute pending actions when back online
  useEffect(() => {
    if (isOnline && pendingActions.length > 0) {
      const executePending = async () => {
        for (const action of pendingActions) {
          try {
            await action();
          } catch {
            // Ignore individual failures
          }
        }
        setPendingActions([]);
        toast({
          title: "Synced",
          description: "Your pending actions have been completed.",
        });
      };
      executePending();
    }
  }, [isOnline, pendingActions, toast]);

  return { executeAction, pendingCount: pendingActions.length };
}
