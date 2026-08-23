import React, { useState, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import { Geolocation, type Position } from '@capacitor/geolocation';
import LocationPermissionPrompt from './LocationPermissionPrompt';

interface NearbyProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  followers_count: number;
  distance: number;
}

interface NearbyMuvazProps {
  maxDistance?: number; // in km
  limit?: number;
}

const NearbyMuvaz: React.FC<NearbyMuvazProps> = ({ maxDistance = 20, limit = 10 }) => {
  const [accounts, setAccounts] = useState<NearbyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [pendingFollows, setPendingFollows] = useState<Set<string>>(new Set());
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const { authUser } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Haversine formula to calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getUserLocation = async (): Promise<{ lat: number; lng: number }> => {
    // Check if we're on native platform - use Capacitor Geolocation
    if (Capacitor.isNativePlatform()) {
      try {
        // First check/request permissions
        let permStatus = await Geolocation.checkPermissions();
        
        if (permStatus.location === 'prompt' || permStatus.location === 'prompt-with-rationale') {
          // Request permission
          permStatus = await Geolocation.requestPermissions();
        }
        
        if (permStatus.location !== 'granted') {
          throw new Error('Location permission denied. Please enable location in your device Settings > Apps > Muv\'it > Permissions.');
        }
        
        // Get current position
        const position: Position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000,
        });
        
        return {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      } catch (error: any) {
        console.error('Capacitor Geolocation error:', error);
        throw new Error(error.message || 'Location permission denied. Please enable location in your device settings.');
      }
    }

    // Web browser geolocation fallback
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error('Location permission denied. Please allow location access in your browser settings.'));
              break;
            case error.POSITION_UNAVAILABLE:
              reject(new Error('Location unavailable. Please check your device settings.'));
              break;
            case error.TIMEOUT:
              reject(new Error('Location request timed out. Please try again.'));
              break;
            default:
              reject(new Error('Unable to get location'));
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
      );
    });
  };

  const updateUserLocation = async (lat: number, lng: number) => {
    if (!authUser) return;

    try {
      await supabase
        .from('user_locations')
        .upsert({
          user_id: authUser.id,
          latitude: lat,
          longitude: lng,
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const fetchFollowing = async () => {
    if (!authUser) return new Set<string>();

    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', authUser.id);

    const ids = new Set((data || []).map(f => f.following_id));
    setFollowingIds(ids);
    return ids;
  };

  const fetchNearbyAccounts = async (
    userLat: number,
    userLng: number,
    excludedFollowingIds = followingIds
  ) => {
    try {
      const { data: nearby } = await supabase.rpc('find_nearby_users', {
        _lat: userLat,
        _lng: userLng,
        _radius_km: maxDistance,
        _limit: limit * 3,
      });

      if (!nearby || nearby.length === 0) {
        setAccounts([]);
        return;
      }

      const userIds = nearby
        .map((n: any) => n.user_id as string)
        .filter((id: string) => id !== authUser?.id && !excludedFollowingIds.has(id));

      if (userIds.length === 0) {
        setAccounts([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, username, display_name, avatar_url, followers_count')
        .in('user_id', userIds);

      const distanceMap = new Map<string, number>(
        nearby.map((n: any) => [n.user_id as string, Number(n.distance_km)])
      );

      const result: NearbyProfile[] = (profiles || [])
        .map(p => ({
          id: p.id,
          user_id: p.user_id || '',
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url || '',
          followers_count: p.followers_count || 0,
          distance: distanceMap.get(p.user_id || '') || 0,
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      setAccounts(result);
    } catch (error) {
      console.error('Error fetching nearby accounts:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const currentFollowingIds = await fetchFollowing();
        const location = await getUserLocation();
        setUserLocation(location);
        await updateUserLocation(location.lat, location.lng);
        await fetchNearbyAccounts(location.lat, location.lng, currentFollowingIds);
      } catch (error: any) {
        setLocationError(error.message);
      } finally {
        setLoading(false);
      }
    };

    init();

    // Set up realtime subscription for nearby profiles updates
    const channel = supabase
      .channel('nearby-profiles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          // Refetch nearby accounts when any profile updates
          if (userLocation) {
            fetchNearbyAccounts(userLocation.lat, userLocation.lng);
          }
        }
      )
      .subscribe();

    // Refresh location periodically (every 5 minutes)
    const locationInterval = setInterval(async () => {
      try {
        const location = await getUserLocation();
        setUserLocation(location);
        await updateUserLocation(location.lat, location.lng);
        const currentFollowingIds = await fetchFollowing();
        await fetchNearbyAccounts(location.lat, location.lng, currentFollowingIds);
      } catch {
        // Silently fail on interval refreshes
      }
    }, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(locationInterval);
    };
  }, [authUser]);

  const handleFollow = async (userId: string) => {
    if (!authUser) {
      toast({ title: 'Please sign in to follow users' });
      return;
    }

    const isFollowing = followingIds.has(userId);
    setPendingFollows(prev => new Set(prev).add(userId));

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', authUser.id)
          .eq('following_id', userId);

        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: authUser.id, following_id: userId });

        setFollowingIds(prev => new Set(prev).add(userId));
        setAccounts(prev => prev.filter(account => account.user_id !== userId));

        // Send follow notification
        await supabase.from('notifications').insert({
          user_id: userId,
          from_user_id: authUser.id,
          type: 'follow',
          message: 'started following you'
        });
      }
    } catch (error) {
      console.error('Error following user:', error);
    } finally {
      setPendingFollows(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m away`;
    }
    return `${km.toFixed(1)}km away`;
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">Nearby Muva'z</h3>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            within {maxDistance}km
          </Badge>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (locationError) {
    return (
      <>
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">Nearby Muva'z</h3>
          </div>
          <div className="text-center py-6">
            <Navigation className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">{locationError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLocationPrompt(true)}
            >
              Enable Location
            </Button>
          </div>
        </div>
        <LocationPermissionPrompt
          isOpen={showLocationPrompt}
          onClose={() => setShowLocationPrompt(false)}
          onPermissionGranted={(coords) => {
            setUserLocation(coords);
            setLocationError(null);
            updateUserLocation(coords.lat, coords.lng);
            fetchNearbyAccounts(coords.lat, coords.lng);
            setShowLocationPrompt(false);
          }}
        />
      </>
    );
  }

  if (accounts.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-foreground">Nearby Muva'z</h3>
      </div>

      <div className="space-y-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div
              className="flex items-center gap-3 flex-1 cursor-pointer"
              onClick={() => navigate(`/user/${account.username}`)}
            >
              <Avatar className="w-12 h-12 border-2 border-primary/20">
                <AvatarImage src={account.avatar_url} alt={account.display_name} />
                <AvatarFallback>{account.display_name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">
                  {account.display_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{account.username}
                </p>
                <p className="text-[11px] text-primary font-medium">
                  {formatDistance(account.distance)}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={followingIds.has(account.user_id) ? 'outline' : 'default'}
              onClick={() => handleFollow(account.user_id)}
              disabled={pendingFollows.has(account.user_id)}
              className="min-w-[80px]"
            >
              {pendingFollows.has(account.user_id) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : followingIds.has(account.user_id) ? (
                'Following'
              ) : (
                'Follow'
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NearbyMuvaz;
