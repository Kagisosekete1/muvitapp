import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.muvit.app',
  appName: "Muv'it",
  webDir: 'dist',
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    }
  },
  android: {
    // Use the generated icons from public/icons/android/
    icon: 'public/icons/android/icon-512x512.png',
    adaptiveIcon: {
      foreground: 'public/icons/android/icon-512x512.png',
      backgroundColor: '#149EF2'
    },
    // FCM Configuration - place google-services.json in android/app/
    googleServicesFile: 'google-services.json'
  },
  ios: {
    // Use the generated icons from public/icons/ios/
    icon: 'public/icons/ios/icon-1024x1024.png',
    // FCM Configuration - place GoogleService-Info.plist in ios/App/App/
    // Enable push notification capability in Xcode
  }
};

export default config;
