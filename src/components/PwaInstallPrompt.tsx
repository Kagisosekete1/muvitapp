import { useEffect, useMemo, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISSED_KEY = 'muvit_pwa_install_prompt_dismissed_at';
const DISMISS_DAYS = 7;

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIosSafari = () => {
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
  return isIos && isSafari;
};

const wasRecentlyDismissed = () => {
  const value = localStorage.getItem(DISMISSED_KEY);
  if (!value) return false;
  const dismissedAt = Number(value);
  if (!Number.isFinite(dismissedAt)) return false;
  return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
};

export const PwaInstallPrompt = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const iosSafari = useMemo(() => (typeof window !== 'undefined' ? isIosSafari() : false), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone() || wasRecentlyDismissed()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setVisible(false);
      localStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    if (iosSafari) {
      const timer = window.setTimeout(() => setVisible(true), 1500);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.removeEventListener('appinstalled', onAppInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [iosSafari]);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
    } else {
      dismiss();
    }
    setInstallEvent(null);
  };

  if (!visible || installed || isStandalone()) return null;
  if (!installEvent && !iosSafari) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-[80] mx-auto max-w-md lg:bottom-6">
      <div className="rounded-2xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          <img
            src="/icons/android/icon-192x192.png"
            alt="Muv'it"
            className="h-11 w-11 shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Install Muv'it</p>
            {iosSafari ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Tap <Share className="inline h-3.5 w-3.5 align-[-2px]" /> then Add to Home Screen.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Open faster from your home screen.</p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Close install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!iosSafari && (
          <Button onClick={install} className="mt-3 h-10 w-full gap-2 rounded-xl">
            <Download className="h-4 w-4" />
            Install
          </Button>
        )}
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
