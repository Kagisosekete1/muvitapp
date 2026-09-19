import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Heart, MessageCircle } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { getOneSignalPermissionStatus, requestOneSignalPermissionAndRegister } from '@/services/oneSignalService';

const PROMPT_KEY = 'reelit_notif_permission_prompted_v1';
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type Props = {
  /** Show after splash to avoid stacking modals */
  enabled?: boolean;
};

const NotificationPermissionPrompt: React.FC<Props> = ({ enabled = true }) => {
  const { authUser } = useUser();
  const [open, setOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const isSupported = permissionStatus !== 'unsupported' && permissionStatus !== 'unavailable';
  const isEnabled = permissionStatus === 'granted';

  const hasRecentPrompt = useMemo(() => {
    try {
      const promptedAt = Number(localStorage.getItem(PROMPT_KEY));
      return Number.isFinite(promptedAt) && Date.now() - promptedAt < PROMPT_COOLDOWN_MS;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    void getOneSignalPermissionStatus().then(setPermissionStatus);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!authUser) return;
    if (!isSupported) return;
    if (isEnabled) return;
    if (hasRecentPrompt) return;

    // Slight delay to avoid jank on first render
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [authUser, enabled, isSupported, isEnabled, hasRecentPrompt]);

  const markPrompted = () => {
    try {
      localStorage.setItem(PROMPT_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  const handleNotNow = () => {
    markPrompted();
    setOpen(false);
  };

  const handleEnable = async () => {
    if (!authUser) return;
    const result = await requestOneSignalPermissionAndRegister(authUser.id);
    setPermissionStatus(result.status);
    markPrompted();
    setOpen(false);
  };

  if (!enabled || !isSupported || isEnabled || hasRecentPrompt) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleNotNow())}>
      <DialogContent className="sm:max-w-[520px] rounded-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[#1697e8]">
              <img src="/icons/android/icon-192x192.png" alt="Muv'it" className="h-full w-full object-cover" />
            </span>
            Allow Muv'it notifications?
          </DialogTitle>
          <DialogDescription className="text-sm">
            Approve the next phone prompt to receive likes, comments, follows, live alerts, and messages even after you close Muv'it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-secondary/30 p-4">
            <ul className="space-y-3 text-sm text-foreground/90">
              <li className="flex items-start gap-3">
                <Heart className="mt-0.5 h-4 w-4 text-primary" />
                <span>Likes, comments, replies, follows, reposts, and mentions.</span>
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-4 w-4 text-primary" />
                <span>Messages, battles, upload updates, and live alerts.</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <span>Choose Allow in Chrome/Android. You can change it any time in Muv'it settings.</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-2xl" onClick={handleNotNow}>
              Not now
            </Button>
            <Button className="flex-1 rounded-2xl" onClick={handleEnable}>
              Allow notifications
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationPermissionPrompt;
