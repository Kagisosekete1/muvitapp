import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { authSchema, signUpSchema } from '@/lib/validations';
import muvitLogo from '@/assets/muvit-logo.png';

const getAuthRedirectUrl = (path = '/auth/callback') => {
  const isNative = window.location.protocol === 'capacitor:';
  const publicOrigin = import.meta.env.VITE_PUBLIC_APP_URL || 'https://muvit.site';
  return isNative ? `muvit://${path.replace(/^\//, '')}` : `${publicOrigin}${path}`;
};

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [showConfirmHelp, setShowConfirmHelp] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        navigate('/');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setShowConfirmHelp(false);
    setLoading(true);

    try {
      // Validate with zod schema
      const schema = isSignUp ? signUpSchema : authSchema;
      const dataToValidate = isSignUp 
        ? { email, password, username, displayName: displayName || undefined }
        : { email, password };
      
      const result = schema.safeParse(dataToValidate);
      
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        setLoading(false);
        return;
      }

      if (isSignUp) {
        // Check if username exists
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .single();

        if (existingUser) {
          setErrors({ username: 'This username is already taken' });
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl('/auth/callback'),
            data: {
              username: username,
              display_name: displayName || 'New User',
            }
          }
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please sign in instead.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
        } else {
          toast({
            title: "Account created",
            description: "Check your email to confirm your Muv'it account.",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          const message = error.message || '';
          if (
            message.toLowerCase().includes('invalid login credentials') ||
            message.toLowerCase().includes('email not confirmed')
          ) {
            setShowConfirmHelp(true);
            toast({
              title: "Could not sign in",
              description: "Confirm your email first, then try signing in again.",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Welcome back!",
          description: "You have successfully logged in",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    const result = authSchema.shape.email.safeParse(email);
    if (!result.success) {
      setErrors({ email: 'Enter your email above first' });
      return;
    }

    setResendingConfirmation(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/auth/callback'),
      },
    });
    setResendingConfirmation(false);

    if (error) {
      toast({
        title: 'Could not resend confirmation',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Confirmation email sent',
      description: "Open the new email and confirm your Muv'it account.",
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo with bounce animation */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden shadow-lg animate-bounce-gentle">
            <img 
              src={muvitLogo} 
              alt="Muv'it Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-4xl font-bold text-foreground" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800 }}>
            Muv'it
          </h1>
          <p className="text-muted-foreground">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        {/* Auth Form */}
        <div className="bg-card border border-border rounded-3xl p-8 space-y-6 shadow-lg">
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium">
                    Username
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="yourhandle"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className={`pl-10 rounded-xl ${errors.username ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errors.username && (
                    <p className="text-xs text-destructive">{errors.username}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-sm font-medium">
                    Display Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="Your Name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={`pl-10 rounded-xl ${errors.displayName ? 'border-destructive' : ''}`}
                    />
                  </div>
                  {errors.displayName && (
                    <p className="text-xs text-destructive">{errors.displayName}</p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`pl-10 rounded-xl ${errors.email ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-10 rounded-xl ${errors.password ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full rounded-xl" disabled={loading}>
              {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>
          </form>

          {!isSignUp && showConfirmHelp && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center space-y-3">
              <p className="text-sm text-foreground">
                Your account may still need email confirmation. Open the confirmation email, then sign in again.
              </p>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={resendConfirmation}
                disabled={resendingConfirmation}
              >
                {resendingConfirmation ? 'Sending...' : 'Resend confirmation email'}
              </Button>
            </div>
          )}

          {!isSignUp && (
            <div className="text-center -mt-2">
              <Button
                type="button"
                variant="link"
                className="text-sm h-auto p-0"
                onClick={async () => {
                  const result = authSchema.shape.email.safeParse(email);
                  if (!result.success) {
                    setErrors({ email: 'Enter your email above first' });
                    return;
                  }
                  setLoading(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: getAuthRedirectUrl('/auth/reset-password'),
                  });
                  setLoading(false);
                  if (error) {
                    toast({ title: 'Could not send email', description: error.message, variant: 'destructive' });
                  } else {
                    toast({ title: 'Check your email', description: 'We sent a password reset link.' });
                  }
                }}
              >
                Forgot password?
              </Button>
            </div>
          )}

          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrors({});
              }}
              className="text-sm"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Button>
          </div>

          {/* Terms of Use */}
          <div className="text-center pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              By continuing, you agree to our{' '}
              <Link to="/terms" className="text-primary hover:underline">
                Terms of Use
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
