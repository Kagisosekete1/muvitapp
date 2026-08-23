# Muv'it Site Deployment

Deploy the whole project root to Vercel or another host that supports serverless functions. Do not deploy only the `dist` folder if you want WhatsApp/social previews for individual reels and profiles, because `/api/reel/[id].ts` and `/api/profile.ts` generate the preview metadata.

## Domain

Connect this domain:

```text
muvit.site
```

## Required Environment Variables

```text
PUBLIC_SITE_URL=https://muvit.site
VITE_SUPABASE_URL=https://wvtbqmdizkpcikniysgu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your Supabase publishable key>
```

Optional:

```text
PUBLIC_MUVIT_SHARE_IMAGE=https://muvit.site/muvit-logo.png
```

## Routes

- `https://muvit.site/reel/<reel-id>` creates a reel preview for WhatsApp and opens the app on Android when installed.
- `https://muvit.site/@<username>` creates a profile preview and opens the app on Android when installed.
- `https://muvit.site/.well-known/assetlinks.json` verifies Android app links for package `com.muvit.app`.

## Test After Deploy

1. Open `https://muvit.site/.well-known/assetlinks.json` and confirm JSON loads.
2. Open `https://muvit.site/reel/<real-reel-id>` in a browser and confirm the preview page shows the reel metadata.
3. Share the same link to WhatsApp. WhatsApp can cache old previews, so test with a fresh reel link if it does not update immediately.
4. Install the signed Muv'it APK, tap a `muvit.site/reel/...` link, and confirm Android opens Muv'it.
