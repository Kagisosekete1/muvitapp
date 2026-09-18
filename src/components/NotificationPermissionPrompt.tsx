import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, ShieldCheck, Heart, MessageCircle } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { getOneSignalPermissionStatus, requestOneSignalPermissionAndRegister } from '@/services/oneSignalService';

const PROMPT_KEY = 'reelit_notif_permission_prompted_v1';

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

  const hasPrompted = useMemo(() => {
    try {
      return localStorage.getItem(PROMPT_KEY) === 'true';
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
    if (hasPrompted) return;

    // Slight delay to avoid jank on first render
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [authUser, enabled, isSupported, isEnabled, hasPrompted]);

  const markPrompted = () => {
    try {
      localStorage.setItem(PROMPT_KEY, 'true');
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

  if (!enabled || !isSupported || isEnabled || hasPrompted) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleNotNow())}>
      <DialogContent className="sm:max-w-[520px] rounded-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
              <Bell className="h-5 w-5 text-foreground" />
            </span>
            Turn on notifications?
          </DialogTitle>
          <DialogDescription className="text-sm">
            Get real-time alerts so you don’t miss important activity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-secondary/30 p-4">
            <ul className="space-y-3 text-sm text-foreground/90">
              <li className="flex items-start gap-3">
                <Heart className="mt-0.5 h-4 w-4 text-primary" />
                <span>Instant alerts when someone likes your reel.</span>
              </li>
              <li className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-4 w-4 text-primary" />
                <span>Know when people comment or follow you.</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <span>You can change this anytime in your phone settings.</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-2xl" onClick={handleNotNow}>
              Not now
            </Button>
            <Button className="flex-1 rounded-2xl" onClick={handleEnable}>
              Enable
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationPermissionPrompt;
