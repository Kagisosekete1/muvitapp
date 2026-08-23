import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { UserProvider } from "@/contexts/UserContext";
import { AudioProvider } from "@/contexts/AudioContext";
import { VideoQualityProvider } from "@/contexts/VideoQualityContext";
import { DebugProvider } from "@/contexts/DebugContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import OfflineIndicator from "@/components/OfflineIndicator";
import { useNativeBackHandler } from "@/hooks/useNativeBackHandler";
import { useRouteMemory } from "@/hooks/useRouteMemory";
import Index from "./pages/Index";
import Profile from "./pages/Profile";
import Inbox from "./pages/Inbox";
import Activity from "./pages/Activity";
import UserProfile from "./pages/UserProfile";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import About from "./pages/About";
import Following from "./pages/Following";
import Search from "./pages/Search";
import SuggestedMuvaz from "./pages/SuggestedMuvaz";
import Trending from "./pages/Trending";
import NotificationPreferencesPage from "./components/settings/NotificationPreferencesPage";
import NotFound from "./pages/NotFound";
import AdminPayouts from "./pages/AdminPayouts";
import MonetizationAnalytics from "./pages/MonetizationAnalytics";
import Settings from "./pages/Settings";
import LiveDiscovery from "./pages/LiveDiscovery";
import Studio from "./pages/Studio";
import Battles from "./pages/Battles";
import SharedReel from "./pages/SharedReel";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

// Inner component that uses router hooks
const AppRoutes = () => {
  // Handle native back button
  useNativeBackHandler();
  // Persist and restore route across restarts
  useRouteMemory();
  const navigate = useNavigate();

  // OneSignal notification-click deep-link handler (SPA navigation)
  useEffect(() => {
    const onNavigate = (evt: Event) => {
      const target = (evt as CustomEvent<string>).detail;
      if (typeof target === 'string' && target.startsWith('/')) {
        const normalizedTarget = target.startsWith('/?live=')
          ? `/live?session=${new URLSearchParams(target.slice(2)).get('live') || ''}`
          : target;
        navigate(normalizedTarget);
      }
    };
    window.addEventListener('onesignal:navigate', onNavigate);
    return () => window.removeEventListener('onesignal:navigate', onNavigate);
  }, [navigate]);

  // Supabase email confirmation / recovery deep links from the native app.
  useEffect(() => {
    const handleAuthUrl = async (rawUrl: string) => {
      try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'muvit:' || parsed.hostname !== 'auth') return;

        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const code = parsed.searchParams.get('code') || hashParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.warn('[auth] confirmation code exchange failed', error);
        }

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) console.warn('[auth] token session restore failed', error);
        }

        const path = parsed.pathname || '/callback';
        navigate(path.includes('reset-password') ? '/reset-password' : '/', { replace: true });
      } catch (error) {
        console.warn('[auth] failed to handle deep link', error);
      }
    };

    CapacitorApp.getLaunchUrl().then((launch) => {
      if (launch?.url) handleAuthUrl(launch.url);
    });

    const sub = CapacitorApp.addListener('appUrlOpen', ({ url }) => handleAuthUrl(url));
    return () => {
      sub.then((listener) => listener.remove());
    };
  }, [navigate]);


  return (
    <div className="bg-background min-h-screen">
      <Routes>
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Index />} />
        <Route path="/following" element={
          <ProtectedRoute>
            <Following />
          </ProtectedRoute>
        } />
        <Route path="/tutorials" element={
          <ProtectedRoute>
            <Search />
          </ProtectedRoute>
        } />
        <Route path="/suggested-muvaz" element={
          <ProtectedRoute>
            <SuggestedMuvaz />
          </ProtectedRoute>
        } />
        <Route path="/trending" element={
          <ProtectedRoute>
            <Trending />
          </ProtectedRoute>
        } />
        <Route path="/inbox" element={
          <ProtectedRoute>
            <Inbox />
          </ProtectedRoute>
        } />
        <Route path="/activity" element={
          <ProtectedRoute>
            <Activity />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/settings/notifications" element={
          <ProtectedRoute>
            <NotificationPreferencesPage />
          </ProtectedRoute>
        } />
        <Route path="/@:username" element={<UserProfile />} />
        <Route path="/user/:username" element={<UserProfile />} />
        <Route path="/reel/:reelId" element={<SharedReel />} />
        <Route path="/search" element={<Search />} />
        <Route path="/battles" element={<Battles />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/about" element={<About />} />
        <Route path="/admin/payouts" element={
          <ProtectedRoute>
            <AdminPayouts />
          </ProtectedRoute>
        } />
        <Route path="/monetization-analytics" element={
          <ProtectedRoute>
            <MonetizationAnalytics />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/live" element={
          <ProtectedRoute>
            <LiveDiscovery />
          </ProtectedRoute>
        } />
        <Route path="/studio" element={
          <ProtectedRoute>
            <Studio />
          </ProtectedRoute>
        } />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <AudioProvider>
          <VideoQualityProvider>
            <DebugProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <OfflineIndicator />
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
              </TooltipProvider>
            </DebugProvider>
          </VideoQualityProvider>
        </AudioProvider>
      </UserProvider>
    </QueryClientProvider>
  );
};

export default App;
