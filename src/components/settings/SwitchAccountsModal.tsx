import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Plus, X, UserCheck, LogIn, LogOut } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useSavedAccounts, SavedAccount } from '@/hooks/useSavedAccounts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SwitchAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SwitchAccountsModal: React.FC<SwitchAccountsModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, authUser } = useUser();
  const { accounts, saveAccount, removeAccount, clearAllAccounts, isFull, autoSave, setAutoSave } = useSavedAccounts();
  const { toast } = useToast();
  const [saveLogin, setSaveLogin] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  // Save current account to the saved list
  const handleSaveCurrentAccount = async () => {
    if (!authUser || !currentUser) return;

    const { data } = await supabase.auth.getSession();
    if (!data.session?.refresh_token) {
      toast({ title: 'Unable to save session', variant: 'destructive' });
      return;
    }

    const account: SavedAccount = {
      userId: authUser.id,
      email: authUser.email || '',
      username: currentUser.username,
      displayName: currentUser.displayName,
      avatarUrl: currentUser.avatarUrl,
      refreshToken: data.session.refresh_token,
      savedAt: Date.now(),
    };

    saveAccount(account);
    toast({ title: 'Account saved', description: 'You can now switch back anytime.' });
  };

  const handleSwitchAccount = async (account: SavedAccount) => {
    if (account.userId === authUser?.id) return; // Already on this account
    setSwitching(account.userId);

    try {
      // If saveLogin is on, save current account before switching
      if (saveLogin && authUser && currentUser) {
        const { data: currentSession } = await supabase.auth.getSession();
        if (currentSession.session?.refresh_token) {
          saveAccount({
            userId: authUser.id,
            email: authUser.email || '',
            username: currentUser.username,
            displayName: currentUser.displayName,
            avatarUrl: currentUser.avatarUrl,
            refreshToken: currentSession.session.refresh_token,
            savedAt: Date.now(),
          });
        }
      }

      // Restore saved session via refresh token (no sign-out first — let refresh handle it)
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: account.refreshToken,
      });

      if (error || !data.session) {
        toast({
          title: 'Session expired',
          description: 'Please log in again for this account.',
          variant: 'destructive',
        });
        removeAccount(account.userId);
      } else {
        // Update the saved refresh token with the fresh one
        saveAccount({
          ...account,
          refreshToken: data.session.refresh_token,
          savedAt: Date.now(),
        });
        toast({ title: `Switched to @${account.username}` });
        onClose();
      }
    } catch {
      toast({ title: 'Failed to switch account', variant: 'destructive' });
    } finally {
      setSwitching(null);
    }
  };

  const handleAddNewAccount = async () => {
    // Save current account first if toggle is on
    if (saveLogin && authUser && currentUser) {
      const { data: currentSession } = await supabase.auth.getSession();
      if (currentSession.session?.refresh_token) {
        saveAccount({
          userId: authUser.id,
          email: authUser.email || '',
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl,
          refreshToken: currentSession.session.refresh_token,
          savedAt: Date.now(),
        });
      }
    }

    // Sign out and redirect to auth
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  const isCurrentAccountSaved = accounts.some((a) => a.userId === authUser?.id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full p-0 bg-background border border-border rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold">Switch Accounts</h2>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Current Account */}
          {currentUser && authUser && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Account</p>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-primary/10 border border-primary/20">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={currentUser.avatarUrl} alt={currentUser.username} />
                  <AvatarFallback>{currentUser.displayName?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{currentUser.displayName}</p>
                  <p className="text-sm text-muted-foreground truncate">@{currentUser.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{authUser.email}</p>
                </div>
                <UserCheck className="w-5 h-5 text-primary shrink-0" />
              </div>

              {/* Save login toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-card border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Save Login</p>
                  <p className="text-xs text-muted-foreground">Remember this session when switching</p>
                </div>
                <Switch checked={saveLogin} onCheckedChange={setSaveLogin} />
              </div>

              {/* Auto-save toggle */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-card border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-Save Logins</p>
                  <p className="text-xs text-muted-foreground">Automatically save every account you log into</p>
                </div>
                <Switch checked={autoSave} onCheckedChange={setAutoSave} />
              </div>

              {!isCurrentAccountSaved && (
                <Button
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={handleSaveCurrentAccount}
                  disabled={isFull}
                >
                  {isFull ? 'Max 4 accounts saved' : 'Save This Account'}
                </Button>
              )}
            </div>
          )}

          {/* Saved Accounts */}
          {accounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Saved Accounts ({accounts.length}/4)
              </p>
              {accounts.map((account) => {
                const isCurrent = account.userId === authUser?.id;
                const isLoading = switching === account.userId;

                return (
                  <div
                    key={account.userId}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                      isCurrent
                        ? 'bg-primary/5 border-primary/20 opacity-60'
                        : 'bg-card border-border hover:bg-accent/50 cursor-pointer'
                    }`}
                    onClick={() => !isCurrent && !isLoading && handleSwitchAccount(account)}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={account.avatarUrl} alt={account.username} />
                      <AvatarFallback>{account.displayName?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{account.displayName}</p>
                      <p className="text-sm text-muted-foreground truncate">@{account.username}</p>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs text-primary font-medium">Active</span>
                    ) : isLoading ? (
                      <span className="text-xs text-muted-foreground animate-pulse">Switching...</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <LogIn className="w-4 h-4 text-muted-foreground" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAccount(account.userId);
                            toast({ title: 'Account removed' });
                          }}
                        >
                          <X className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add New Account */}
          {!isFull && (
            <button
              onClick={handleAddNewAccount}
              className="w-full flex items-center gap-3 p-3 rounded-2xl border border-dashed border-border hover:bg-accent/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Add Another Account</p>
                <p className="text-sm text-muted-foreground">Log in with a different account</p>
              </div>
            </button>
          )}

          {/* Log Out of All Accounts */}
          {accounts.length > 0 && (
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              onClick={async () => {
                clearAllAccounts();
                await supabase.auth.signOut();
                toast({ title: 'Logged out of all accounts' });
                window.location.href = '/auth';
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log Out of All Accounts
            </Button>
          )}

          {/* Info */}
          <p className="text-xs text-muted-foreground text-center pt-2">
            You can save up to 4 accounts. Turn on "Save Login" to switch without re-entering your password.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SwitchAccountsModal;
