/**
 * OneSignal integration for Muv'it.
 *
 * - Web: uses the OneSignal Web SDK v16 loaded in `index.html`.
 * - Native (Capacitor Android/iOS): uses `onesignal-cordova-plugin` when available.
 *
 * Responsibilities:
 *   1. Initialize the SDK (web only – native init happens once the Capacitor app boots).
 *   2. Log the user in via their Supabase user id (External User ID) so backend
 *      pushes can target by user_id instead of a per-device player id.
 *   3. Persist each device subscription in `push_subscriptions`.
 *   4. Route notification-click deep links (live streams, inbox threads, reels).
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

const ONESIGNAL_APP_ID = '0b049171-0951-40ba-b90e-38fe7e06ae21';

type Deferred = (OneSignal: any) => void | Promise<void>;

declare global {
  interface Window {
    OneSignalDeferred?: Deferred[];
    OneSignal?: any;
    plugins?: { OneSignal?: any };
  }
}

const isNative = () => Capacitor.isNativePlatform();

const getNativePushSubscription = (plugin: any) =>
  plugin?.User?.pushSubscription || plugin?.User?.PushSubscription;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getDeviceId = () => {
  const key = 'muvit_push_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
};

const getPlatform = () => (Capacitor.getPlatform?.() || (isNative() ? 'native' : 'web'));

const waitForDeviceReady = () =>
  new Promise<void>((resolve) => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }

    if ((window as any).cordova || document.readyState === 'complete') {
      resolve();
      return;
    }

    const timeout = window.setTimeout(resolve, 2500);
    document.addEventListener(
      'deviceready',
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });

const getNativePlugin = async () => {
  await waitForDeviceReady();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const plugin = window.plugins?.OneSignal;
    if (plugin) return plugin;
    await wait(500);
  }
  return null;
};

const getPermissionStatus = async (provider: any) => {
  try {
    const asyncPermission = await provider?.Notifications?.getPermissionAsync?.();
    if (typeof asyncPermission === 'boolean') return asyncPermission ? 'granted' : 'denied';

    const permission = provider?.Notifications?.permission;
    if (typeof permission === 'boolean') return permission ? 'granted' : 'denied';

    const hasPermission = provider?.Notifications?.hasPermission?.();
    if (typeof hasPermission === 'boolean') return hasPermission ? 'granted' : 'denied';

    const nativePermission = await provider?.Notifications?.permissionNative?.();
    if (typeof nativePermission === 'number') {
      if (nativePermission === 2 || nativePermission === 3 || nativePermission === 4) return 'granted';
      if (nativePermission === 1) return 'denied';
    }

    const canRequest = await provider?.Notifications?.canRequestPermission?.();
    return canRequest === false ? 'denied' : 'unknown';
  } catch {
    return 'unknown';
  }
};

const getNativeSubscriptionId = async (plugin: any) => {
  const pushSubscription = getNativePushSubscription(plugin);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const id =
        (await pushSubscription?.getIdAsync?.()) ||
        pushSubscription?.id;
      if (id) return id;

      const optedIn = await pushSubscription?.getOptedInAsync?.();
      if (optedIn === false) {
        pushSubscription?.optIn?.();
      }
    } catch {
      // OneSignal can need a moment after init/login before the native id exists.
    }
    await wait(500);
  }
  return null;
};

export async function getOneSignalPermissionStatus() {
  if (typeof window === 'undefined') return 'unsupported';

  if (isNative()) {
    const plugin = window.plugins?.OneSignal;
    if (!plugin) return 'unavailable';
    return getPermissionStatus(plugin);
  }

  let status = 'unsupported';
  await new Promise<void>((resolve) => {
    withWebSDK(async (OneSignal) => {
      status = await getPermissionStatus(OneSignal);
      resolve();
    });
    setTimeout(resolve, 1500);
  });
  return status;
}

/** Push a callback that runs once the OneSignal Web SDK is ready. */
const withWebSDK = (cb: Deferred) => {
  if (typeof window === 'undefined') return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(cb);
};

/** Handle a notification-click payload by navigating to the right in-app screen. */
export function handleNotificationOpen(data: Record<string, any> | undefined | null) {
  if (!data) return;
  try {
    // Common fields we set on outbound pushes
    const type: string | undefined = data.type;
    const url: string | undefined = data.url;
    const liveSessionId: string | undefined = data.live_session_id;
    const conversationId: string | undefined = data.conversation_id;
    const reelId: string | undefined = data.reel_id;
    const fromUserId: string | undefined = data.from_user_id;
    const actorUsername: string | undefined = data.actor_username;

    let target = '/';
    if (url) {
      target = url;
    } else if ((type === 'message' || type === 'message_request') && conversationId) {
      target = `/inbox?conversation=${conversationId}`;
    } else if ((type === 'live' || type === 'live_start' || type === 'live_started') && liveSessionId) {
      target = `/live?session=${liveSessionId}`;
    } else if (reelId) {
      target = `/activity?reel=${reelId}${type ? `&type=${type}` : ''}`;
    } else if (type === 'follow' && actorUsername) {
      target = `/user/${actorUsername}`;
    } else if (type === 'follow' && fromUserId) {
      target = '/activity';
    } else if (type?.startsWith('battle_')) {
      target = '/battles';
    } else if (
      type === 'like' ||
      type === 'comment' ||
      type === 'comment_reply' ||
      type === 'saved' ||
      type === 'new_reel' ||
      type === 'repost' ||
      type === 'share' ||
      type === 'mention' ||
      type === 'tag' ||
      type === 'upload_ready' ||
      type === 'upload_failed' ||
      type === 'earnings' ||
      type === 'gift' ||
      type === 'stars' ||
      type === 'verification' ||
      type === 'moderation' ||
      type === 'announcement'
    ) {
      target = '/activity';
    } else if (type === 'message') {
      target = '/inbox';
    }

    // Use SPA navigation when available, otherwise fall back to a hard nav.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('onesignal:navigate', { detail: target }));
      // Fallback if no listener handled it within a tick
      setTimeout(() => {
        if (window.location.pathname + window.location.search !== target) {
          window.location.href = target;
        }
      }, 250);
    }
  } catch (err) {
    console.warn('[OneSignal] click handler error', err);
  }
}

/** Persist the current subscription id for this device. */
async function syncPlayerIdWithBackend(playerId: string | null | undefined, userId: string, permissionStatus = 'unknown') {
  if (!playerId || !userId) return;
  try {
    await supabase
      .from('profiles')
      .update({ onesignal_player_id: playerId })
      .eq('user_id', userId);

    await (supabase as any)
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        device_id: getDeviceId(),
        provider: 'onesignal',
        subscription_id: playerId,
        platform: getPlatform(),
        permission_status: permissionStatus,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id,provider' });
  } catch (err) {
    console.warn('[OneSignal] failed to sync subscription id', err);
  }
}

async function markCurrentDeviceInactive() {
  try {
    await (supabase as any)
      .from('push_subscriptions')
      .update({
        is_active: false,
        permission_status: 'denied',
        updated_at: new Date().toISOString(),
      })
      .eq('device_id', getDeviceId())
      .eq('provider', 'onesignal');
  } catch {
    // best effort only
  }
}

/** Initialize the SDK. Safe to call multiple times. */
export async function initOneSignal() {
  if (typeof window === 'undefined') return;

  if (isNative()) {
    // Native (Android/iOS) initialization via onesignal-cordova-plugin
    const plugin = await getNativePlugin();
    if (!plugin) return; // plugin only present in a real device build
    try {
      plugin.initialize?.(ONESIGNAL_APP_ID);
      let permission = await getPermissionStatus(plugin);
      if (permission !== 'granted') {
        await plugin.Notifications?.requestPermission?.(true);
        permission = await getPermissionStatus(plugin);
      }
      getNativePushSubscription(plugin)?.optIn?.();
      plugin.Notifications?.addEventListener?.('click', (event: any) => {
        handleNotificationOpen(event?.notification?.additionalData);
      });
      plugin.Notifications?.addEventListener?.('foregroundWillDisplay', (event: any) => {
        event?.notification?.display?.();
      });
    } catch (err) {
      console.warn('[OneSignal] native init failed', err);
    }
    return;
  }

  // Web SDK is initialized in index.html; here we just register listeners.
  withWebSDK(async (OneSignal) => {
    try {
      OneSignal.Notifications?.addEventListener?.('click', (event: any) => {
        handleNotificationOpen(event?.notification?.additionalData);
      });
    } catch (err) {
      console.warn('[OneSignal] web listener registration failed', err);
    }
  });
}

/** Login (associate the OneSignal identity with a Supabase user id) and sync the player id. */
export async function loginOneSignalUser(userId: string) {
  if (!userId || typeof window === 'undefined') return;

  if (isNative()) {
    const plugin = await getNativePlugin();
    if (!plugin) return;
    try {
      plugin.initialize?.(ONESIGNAL_APP_ID);
      plugin.login?.(userId);
      const permission = await getPermissionStatus(plugin);
      const pushSubscription = getNativePushSubscription(plugin);
      pushSubscription?.optIn?.();
      const state = await getNativeSubscriptionId(plugin);
      if (state) {
        const syncedPermission = permission === 'unknown'
          ? await getPermissionStatus(plugin)
          : permission;
        await syncPlayerIdWithBackend(state, userId, syncedPermission);
      } else if (permission === 'denied') {
        await markCurrentDeviceInactive();
      }
      pushSubscription?.addEventListener?.('change', (evt: any) => {
        const newId = evt?.current?.id;
        if (newId) {
          getPermissionStatus(plugin).then((status) => syncPlayerIdWithBackend(newId, userId, status));
        }
      });
    } catch (err) {
      console.warn('[OneSignal] native login failed', err);
    }
    return;
  }

  withWebSDK(async (OneSignal) => {
    try {
      await OneSignal.login(userId);
      const permission = await getPermissionStatus(OneSignal);
      // v16 exposes the current subscription id
      const playerId: string | undefined =
        OneSignal.User?.PushSubscription?.id ||
        (await OneSignal.User?.PushSubscription?.getIdAsync?.());
      if (playerId) await syncPlayerIdWithBackend(playerId, userId, permission);

      // Update on subscription changes (permission granted later, id rotated, etc.)
      OneSignal.User?.PushSubscription?.addEventListener?.('change', (evt: any) => {
        const newId = evt?.current?.id;
        if (newId) {
          getPermissionStatus(OneSignal).then((status) => syncPlayerIdWithBackend(newId, userId, status));
        }
      });
    } catch (err) {
      console.warn('[OneSignal] web login failed', err);
    }
  });
}

/** Log out on sign-out so the device stops receiving that user's pushes. */
export async function logoutOneSignalUser() {
  if (typeof window === 'undefined') return;
  if (isNative()) {
    try {
      await (supabase as any)
        .from('push_subscriptions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('device_id', getDeviceId())
        .eq('provider', 'onesignal');
      window.plugins?.OneSignal?.logout?.();
    } catch { /* noop */ }
    return;
  }
  withWebSDK(async (OneSignal) => {
    try {
      await (supabase as any)
        .from('push_subscriptions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('device_id', getDeviceId())
        .eq('provider', 'onesignal');
      await OneSignal.logout();
    } catch { /* noop */ }
  });
}

export async function requestOneSignalPermissionAndRegister(userId: string) {
  if (!userId || typeof window === 'undefined') return { supported: false, granted: false, status: 'unsupported' };

  if (isNative()) {
    const plugin = await getNativePlugin();
    if (!plugin) return { supported: false, granted: false, status: 'unavailable' };
    try {
      plugin.initialize?.(ONESIGNAL_APP_ID);
      await plugin.Notifications?.requestPermission?.(true);
      getNativePushSubscription(plugin)?.optIn?.();
      const status = await getPermissionStatus(plugin);
      await loginOneSignalUser(userId);
      if (status === 'denied') await markCurrentDeviceInactive();
      return { supported: true, granted: status === 'granted', status };
    } catch (err) {
      console.warn('[OneSignal] native permission request failed', err);
      return { supported: true, granted: false, status: 'error' };
    }
  }

  let result = { supported: false, granted: false, status: 'unsupported' };
  await new Promise<void>((resolve) => {
    withWebSDK(async (OneSignal) => {
      try {
        await OneSignal.Notifications?.requestPermission?.();
        const status = await getPermissionStatus(OneSignal);
        await loginOneSignalUser(userId);
        result = { supported: true, granted: status === 'granted', status };
      } catch (err) {
        console.warn('[OneSignal] web permission request failed', err);
        result = { supported: true, granted: false, status: 'error' };
      } finally {
        resolve();
      }
    });
    setTimeout(resolve, 3000);
  });
  return result;
}
