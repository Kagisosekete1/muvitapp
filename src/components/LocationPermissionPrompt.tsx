import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Settings, Smartphone, CheckCircle2, AlertCircle, Loader2, Navigation } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

interface LocationPermissionPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted?: (coords: { lat: number; lng: number }) => void;
}

type PermissionStep = 'intro' | 'requesting' | 'denied' | 'granted' | 'settings';

const LocationPermissionPrompt: React.FC<LocationPermissionPromptProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
}) => {
  const [step, setStep] = useState<PermissionStep>('intro');
  const [isLoading, setIsLoading] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isOpen) {
      setStep('intro');
      checkCurrentPermission();
    }
  }, [isOpen]);

  const checkCurrentPermission = async () => {
    if (isNative) {
      try {
        const status = await Geolocation.checkPermissions();
        if (status.location === 'granted') {
          setStep('granted');
        }
      } catch (e) {
        console.log('Permission check failed:', e);
      }
    }
  };

  const requestPermission = async () => {
    setIsLoading(true);
    setStep('requesting');

    try {
      if (isNative) {
        // Capacitor native permission request
        let permStatus = await Geolocation.checkPermissions();
        
        if (permStatus.location === 'prompt' || permStatus.location === 'prompt-with-rationale') {
          permStatus = await Geolocation.requestPermissions();
        }

        if (permStatus.location === 'granted') {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
          });
          
          setStep('granted');
          onPermissionGranted?.({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        } else {
          setStep('denied');
        }
      } else {
        // Web browser permission request
        const result = await navigator.permissions.query({ name: 'geolocation' });
        
        if (result.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setStep('granted');
              onPermissionGranted?.({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
            },
            () => setStep('denied')
          );
        } else if (result.state === 'prompt') {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setStep('granted');
              onPermissionGranted?.({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
            },
            () => setStep('denied')
          );
        } else {
          setStep('denied');
        }
      }
    } catch (error) {
      console.error('Permission request error:', error);
      setStep('denied');
    } finally {
      setIsLoading(false);
    }
  };

  const openSettings = () => {
    setStep('settings');
  };

  const getPlatformInstructions = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIOS || Capacitor.getPlatform() === 'ios') {
      return {
        title: 'Enable Location on iPhone',
        steps: [
          'Open the Settings app on your iPhone',
          'Scroll down and tap "Privacy & Security"',
          'Tap "Location Services"',
          'Make sure Location Services is turned ON',
          'Find and tap "Muv\'it" in the app list',
          'Select "While Using the App" or "Always"',
          'Return to the app and try again',
        ],
        icon: '📱',
      };
    }

    if (isAndroid || Capacitor.getPlatform() === 'android') {
      return {
        title: 'Enable Location on Android',
        steps: [
          'Open your device Settings',
          'Tap "Apps" or "Application Manager"',
          'Find and tap "Muv\'it"',
          'Tap "Permissions"',
          'Tap "Location"',
          'Select "Allow only while using the app" or "Allow all the time"',
          'Return to the app and try again',
        ],
        icon: '🤖',
      };
    }

    // Web browser
    return {
      title: 'Enable Location in Browser',
      steps: [
        'Click the lock/info icon in your browser address bar',
        'Find "Location" in the permissions list',
        'Change from "Block" to "Allow"',
        'Refresh the page and try again',
      ],
      icon: '🌐',
    };
  };

  const instructions = getPlatformInstructions();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Location Access
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {step === 'intro' && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Navigation className="w-10 h-10 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Discover Nearby Muva'z</h3>
                <p className="text-sm text-muted-foreground">
                  Allow location access to find and connect with dancers in your area. Your location is never shared publicly.
                </p>
              </div>

              <div className="bg-secondary/30 rounded-xl p-4 text-left space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Find nearby creators</p>
                    <p className="text-xs text-muted-foreground">Connect with dancers around you</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Local events & meetups</p>
                    <p className="text-xs text-muted-foreground">Discover dance events nearby</p>
                  </div>
                </div>
              </div>

              <Button className="w-full rounded-xl" onClick={requestPermission}>
                Enable Location
              </Button>
              
              <Button variant="ghost" className="w-full" onClick={onClose}>
                Maybe Later
              </Button>
            </div>
          )}

          {step === 'requesting' && (
            <div className="text-center space-y-4 py-8">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">
                Requesting location permission...
              </p>
            </div>
          )}

          {step === 'granted' && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Location Enabled!</h3>
                <p className="text-sm text-muted-foreground">
                  You can now discover nearby Muva'z and connect with dancers in your area.
                </p>
              </div>

              <Button className="w-full rounded-xl" onClick={onClose}>
                Continue
              </Button>
            </div>
          )}

          {step === 'denied' && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10 text-amber-500" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Permission Denied</h3>
                <p className="text-sm text-muted-foreground">
                  Location access was denied. You'll need to enable it in your device settings to use this feature.
                </p>
              </div>

              <Button className="w-full rounded-xl" onClick={openSettings}>
                <Settings className="w-4 h-4 mr-2" />
                View Instructions
              </Button>
              
              <Button variant="ghost" className="w-full" onClick={onClose}>
                Skip for Now
              </Button>
            </div>
          )}

          {step === 'settings' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <span className="text-4xl">{instructions.icon}</span>
                <h3 className="text-lg font-semibold mt-2">{instructions.title}</h3>
              </div>

              <div className="bg-secondary/30 rounded-xl p-4">
                <ol className="space-y-3">
                  {instructions.steps.map((stepText, index) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">{stepText}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setStep('denied')}>
                  Back
                </Button>
                <Button className="flex-1 rounded-xl" onClick={() => {
                  requestPermission();
                }}>
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationPermissionPrompt;
