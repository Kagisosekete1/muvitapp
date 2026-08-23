# Firebase Cloud Messaging Setup Guide

This guide explains how to set up real Firebase Cloud Messaging (FCM) for native push notifications.

## Prerequisites

1. A Firebase project (create one at https://console.firebase.google.com)
2. Your app registered in Firebase Console
3. Xcode (for iOS) and Android Studio (for Android)

## Android Setup

### Step 1: Add Firebase to Android

1. In Firebase Console, go to Project Settings → General
2. Click "Add app" and select Android
3. Enter your package name: `app.lovable.0e307399f618441f97e8f5e125d8d23f`
4. Download `google-services.json`
5. Place it in `android/app/google-services.json`

### Step 2: Configure Gradle

Add to `android/build.gradle`:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

Add to `android/app/build.gradle`:
```gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

### Step 3: Install Capacitor Push Notifications

```bash
npm install @capacitor/push-notifications
npx cap sync android
```

## iOS Setup

### Step 1: Add Firebase to iOS

1. In Firebase Console, go to Project Settings → General
2. Click "Add app" and select iOS
3. Enter your bundle ID: `app.lovable.0e307399f618441f97e8f5e125d8d23f`
4. Download `GoogleService-Info.plist`
5. Place it in `ios/App/App/GoogleService-Info.plist`

### Step 2: Enable Push Notifications Capability

1. Open Xcode project (`ios/App/App.xcworkspace`)
2. Select your target → Signing & Capabilities
3. Click "+ Capability" → Add "Push Notifications"
4. Add "Background Modes" → Check "Remote notifications"

### Step 3: Configure APNs

1. In Apple Developer Portal, create an APNs Key
2. Download the .p8 file
3. In Firebase Console → Project Settings → Cloud Messaging
4. Upload the APNs Key under "Apple app configuration"

### Step 4: Install Capacitor Push Notifications

```bash
npm install @capacitor/push-notifications
npx cap sync ios
```

## Backend Token Storage

To send push notifications from your backend, you need to:

1. Create a database table to store FCM tokens:

```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tokens"
ON push_tokens FOR ALL
USING (auth.uid() = user_id);
```

2. Create an Edge Function to send notifications:

```typescript
// supabase/functions/send-push/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { userId, title, body, data } = await req.json()
  
  // Get user's FCM token from database
  // Send notification via FCM HTTP v1 API
  
  return new Response(JSON.stringify({ success: true }))
})
```

## Testing

1. Build and run on a real device (emulators have limited push support)
2. Check Firebase Console → Cloud Messaging → Send test message
3. Use the FCM token logged in your console

## Troubleshooting

- **Android**: Check logcat for FCM-related errors
- **iOS**: Check Xcode console for APNs errors
- **Token not generated**: Ensure network connectivity and Firebase config is correct
- **Notifications not received**: Check notification permissions in device settings
