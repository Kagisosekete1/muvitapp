// Push Notification Service for Muv'it
// This service handles Firebase Cloud Messaging integration for real-time alerts

import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, string>;
  tag?: string;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private permission: NotificationPermission = 'default';
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;

  private constructor() {
    this.init();
  }

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  private async init() {
    if (Capacitor.isNativePlatform()) return;

    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    this.permission = Notification.permission;

    // Register service worker for background notifications
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.ready;
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    }
  }

  async requestPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) return false;

    if (!('Notification' in window)) {
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    const result = await Notification.requestPermission();
    this.permission = result;
    return result === 'granted';
  }

  async showNotification(data: PushNotificationData): Promise<boolean> {
    if (Capacitor.isNativePlatform()) return false;

    if (this.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) return false;
    }

    try {
      if (this.serviceWorkerRegistration) {
        // Use service worker for better reliability
        await this.serviceWorkerRegistration.showNotification(data.title, {
          body: data.body,
          icon: data.icon || '/android-chrome-512x512.png',
          badge: data.badge || '/android-chrome-512x512.png',
          data: data.data,
          tag: data.tag,
          requireInteraction: false,
        } as NotificationOptions);
      } else {
        // Fallback to regular notification
        new Notification(data.title, {
          body: data.body,
          icon: data.icon || '/android-chrome-512x512.png',
          tag: data.tag,
        });
      }
      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  // Show notification for likes
  async notifyLike(username: string, reelTitle?: string) {
    await this.showNotification({
      title: 'New Like ❤️',
      body: `${username} liked your reel${reelTitle ? `: "${reelTitle}"` : ''}`,
      tag: 'like-notification',
      data: { type: 'like' },
    });
  }

  // Show notification for comments
  async notifyComment(username: string, comment: string, reelTitle?: string) {
    const truncatedComment = comment.length > 50 ? `${comment.substring(0, 47)}...` : comment;
    await this.showNotification({
      title: 'New Comment 💬',
      body: `${username}: "${truncatedComment}"`,
      tag: 'comment-notification',
      data: { type: 'comment' },
    });
  }

  // Show notification for follows
  async notifyFollow(username: string) {
    await this.showNotification({
      title: 'New Follower 👤',
      body: `${username} started following you`,
      tag: 'follow-notification',
      data: { type: 'follow' },
    });
  }

  // Show notification for profile views
  async notifyProfileView(username: string) {
    await this.showNotification({
      title: 'Profile View 👀',
      body: `${username} viewed your profile`,
      tag: 'profile-view-notification',
      data: { type: 'profile_view' },
    });
  }

  // Show notification for messages
  async notifyMessage(username: string, message: string) {
    const truncatedMessage = message.length > 50 ? `${message.substring(0, 47)}...` : message;
    await this.showNotification({
      title: 'New Message 📩',
      body: `${username}: "${truncatedMessage}"`,
      tag: 'message-notification',
      data: { type: 'message' },
    });
  }

  // Subscribe to realtime notifications for a user
  subscribeToNotifications(userId: string) {
    if (Capacitor.isNativePlatform()) return () => {};

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const notification = payload.new as any;
          
          // Fetch the from_user's profile
          const { data: fromUser } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('user_id', notification.from_user_id)
            .single();

          const username = fromUser?.username || 'Someone';

          switch (notification.type) {
            case 'like':
              this.notifyLike(username);
              break;
            case 'comment':
              this.notifyComment(username, notification.message || 'commented on your reel');
              break;
            case 'follow':
              this.notifyFollow(username);
              break;
            case 'profile_view':
              this.notifyProfileView(username);
              break;
            default:
              this.showNotification({
                title: "Muv'it",
                body: notification.message || 'You have a new notification',
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Check if notifications are supported and enabled
  isSupported(): boolean {
    return !Capacitor.isNativePlatform() && 'Notification' in window;
  }

  isEnabled(): boolean {
    return this.permission === 'granted';
  }

  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }
}

export const pushNotificationService = PushNotificationService.getInstance();

// React hook for push notifications
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';

export function usePushNotifications() {
  const { authUser } = useUser();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(pushNotificationService.isSupported());
    setIsEnabled(pushNotificationService.isEnabled());
  }, []);

  useEffect(() => {
    if (authUser && isEnabled) {
      const unsubscribe = pushNotificationService.subscribeToNotifications(authUser.id);
      return unsubscribe;
    }
  }, [authUser, isEnabled]);

  const requestPermission = useCallback(async () => {
    const granted = await pushNotificationService.requestPermission();
    setIsEnabled(granted);
    return granted;
  }, []);

  return {
    isSupported,
    isEnabled,
    requestPermission,
    notifyLike: pushNotificationService.notifyLike.bind(pushNotificationService),
    notifyComment: pushNotificationService.notifyComment.bind(pushNotificationService),
    notifyFollow: pushNotificationService.notifyFollow.bind(pushNotificationService),
    notifyProfileView: pushNotificationService.notifyProfileView.bind(pushNotificationService),
    notifyMessage: pushNotificationService.notifyMessage.bind(pushNotificationService),
  };
}
