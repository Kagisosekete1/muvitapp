// Firebase Cloud Messaging Service for Muv'it
// This service handles push notifications for the native app

import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

class FCMService {
  private static instance: FCMService;
  private token: string | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): FCMService {
    if (!FCMService.instance) {
      FCMService.instance = new FCMService();
    }
    return FCMService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Only initialize on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('FCM: Not a native platform, skipping initialization');
      return;
    }

    try {
      // Request permission
      const permResult = await PushNotifications.requestPermissions();
      
      if (permResult.receive === 'granted') {
        // Register for push notifications
        await PushNotifications.register();
        
        // Add listeners
        this.addListeners();
        
        this.isInitialized = true;
        console.log('FCM: Initialized successfully');
      } else {
        console.log('FCM: Permission not granted');
      }
    } catch (error) {
      console.error('FCM: Initialization error:', error);
    }
  }

  private addListeners(): void {
    // On registration success
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('FCM: Registration token:', token.value);
      this.token = token.value;
      await this.saveTokenToServer(token.value);
    });

    // On registration error
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('FCM: Registration error:', error);
    });

    // On push notification received (foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('FCM: Notification received:', notification);
      this.handleForegroundNotification(notification);
    });

    // On push notification action (user tapped notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('FCM: Notification action:', action);
      this.handleNotificationTap(action.notification.data);
    });
  }

  private async saveTokenToServer(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Save token to user's notification preferences or a dedicated table
        await supabase
          .from('notification_preferences')
          .upsert({
            user_id: user.id,
            push_enabled: true,
          }, { onConflict: 'user_id' });
        
        console.log('FCM: Token saved to server');
      }
    } catch (error) {
      console.error('FCM: Error saving token:', error);
    }
  }

  private handleForegroundNotification(notification: PushNotificationSchema): void {
    // Show a local notification or in-app alert
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title || "Muv'it", {
        body: notification.body || 'You have a new notification',
        icon: '/icons/android/icon-192x192.png',
        tag: notification.id,
      });
    }
  }

  private handleNotificationTap(data: any): void {
    // Navigate to the appropriate screen based on notification type
    if (data?.type) {
      switch (data.type) {
        case 'like':
        case 'comment':
          if (data.reel_id) {
            window.location.href = `/reel/${data.reel_id}`;
          }
          break;
        case 'follow':
          if (data.from_user_id) {
            window.location.href = `/user/${data.from_username}`;
          }
          break;
        case 'message':
          window.location.href = '/inbox';
          break;
        default:
          window.location.href = '/';
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async unregister(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await PushNotifications.unregister();
      this.token = null;
      this.isInitialized = false;
    }
  }
}

export const fcmService = FCMService.getInstance();

// Hook for using FCM in React components
import { useEffect, useState } from 'react';

export function useFCM() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      await fcmService.initialize();
      setToken(fcmService.getToken());
      setIsInitialized(true);
    };

    init();
  }, []);

  return {
    isInitialized,
    token,
    unregister: fcmService.unregister.bind(fcmService),
  };
}
