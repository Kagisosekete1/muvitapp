import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import muvitLogo from '@/assets/muvit-logo.png';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Supabase emits PASSWORD_RECOVERY after the user lands from the email link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // If already in a recovery session (or hash present), allow it.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    if (window.location.hash.includes('type=recovery')) setReady(true);
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: 'Could not update password', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden shadow-lg">
            <img src={muvitLogo} alt="Muv'it Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Set a new password</h1>
          <p className="text-muted-foreground text-sm">
            {ready ? 'Choose a new password for your account.' : 'Waiting for recovery link...'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-8 space-y-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="pl-10 rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input id="confirm" type="password" placeholder="••••••••" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} className="pl-10 rounded-xl" />
              </div>
            </div>
            <Button type="submit" className="w-full rounded-xl" disabled={loading || !ready}>
              {loading ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
