import { lazy, Suspense, useEffect } from "react";
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
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import { useNativeBackHandler } from "@/hooks/useNativeBackHandler";
import { useRouteMemory } from "@/hooks/useRouteMemory";
import { supabase } from "@/integrations/supabase/client";

// Keep the first app load focused on the screen the user actually opened.
// Large feature areas (live, battles, inbox, etc.) are fetched on demand.
const Index = lazy(() => import("./pages/Index"));
const Profile = lazy(() => import("./pages/Profile"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Activity = lazy(() => import("./pages/Activity"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const About = lazy(() => import("./pages/About"));
const Following = lazy(() => import("./pages/Following"));
const Search = lazy(() => import("./pages/Search"));
const SuggestedMuvaz = lazy(() => import("./pages/SuggestedMuvaz"));
const Trending = lazy(() => import("./pages/Trending"));
const NotificationPreferencesPage = lazy(() => import("./components/settings/NotificationPreferencesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminPayouts = lazy(() => import("./pages/AdminPayouts"));
const MonetizationAnalytics = lazy(() => import("./pages/MonetizationAnalytics"));
const Settings = lazy(() => import("./pages/Settings"));
const LiveDiscovery = lazy(() => import("./pages/LiveDiscovery"));
const Studio = lazy(() => import("./pages/Studio"));
const Battles = lazy(() => import("./pages/Battles"));
const SharedReel = lazy(() => import("./pages/SharedReel"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteLoadingFallback = () => (
  <div className="min-h-screen bg-background" aria-busy="true" />
);

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

  // Supabase email confirmation / recovery deep links from web and the native app.
  useEffect(() => {
    const handleAuthUrl = async (rawUrl: string) => {
      try {
        const parsed = new URL(rawUrl);
        const isNativeAuthUrl = parsed.protocol === 'muvit:' && parsed.hostname === 'auth';
        const isWebAuthUrl = parsed.pathname === '/auth/callback' || parsed.pathname === '/auth/reset-password';
        if (!isNativeAuthUrl && !isWebAuthUrl) return;

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

        const flowType = parsed.searchParams.get('type') || hashParams.get('type');
        const path = parsed.pathname || '/callback';
        const isRecovery = path.includes('reset-password') || flowType === 'recovery';
        navigate(isRecovery ? '/reset-password' : '/', { replace: true });
      } catch (error) {
        console.warn('[auth] failed to handle deep link', error);
      }
    };

    handleAuthUrl(window.location.href);

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
      <Suspense fallback={<RouteLoadingFallback />}>
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
        <Route path="/auth/reset-password" element={<ResetPassword />} />
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
      </Suspense>
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
                <PwaInstallPrompt />
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
