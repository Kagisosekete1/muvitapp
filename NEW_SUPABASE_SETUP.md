# Muv'it New Supabase Setup

Use this when moving Muv'it to a fresh Supabase project.

## 1. Create the new Supabase project

After the project is created, copy:

- Project ref
- Project URL
- anon / publishable key
- service role key, only for server-side Supabase settings if needed

## 2. Update local app env

Edit `.env`:

```env
VITE_SUPABASE_PROJECT_ID="wvtbqmdizkpcikniysgu"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_aCpYyTYFwdkGqd0-s2Lyow_3wmhXx1r"
VITE_SUPABASE_URL="https://wvtbqmdizkpcikniysgu.supabase.co"
```

## 3. Link and push the database

```powershell
cd "C:\Users\MoFunk\Documents\Codex\2026-07-15\git-github-com-kagisosekete1-letsreelit-git-2\work\letsreelit"

npx supabase login
npx supabase link --project-ref wvtbqmdizkpcikniysgu
npx supabase db push
```

If the CLI is not working, open Supabase SQL Editor and run:

```text
docs/MUVIT_SUPABASE_CORE_SCHEMA.sql
```

Before running it, replace `CHANGE_ME_NOTIFICATION_WEBHOOK_SECRET` with the same `NOTIFICATION_WEBHOOK_SECRET` you set for Edge Functions.

## 4. Set Edge Function secrets

```powershell
npx supabase secrets set NOTIFICATION_WEBHOOK_SECRET="MuvIt_N0tify_8vK4pQ7xR2mL9zT5sW6aB3cD1eF7gH2jK8nP4qX6"
npx supabase secrets set ONESIGNAL_APP_ID="0b049171-0951-40ba-b90e-38fe7e06ae21"
npx supabase secrets set ONESIGNAL_REST_API_KEY="YOUR_ONESIGNAL_REST_API_KEY"
```

## 5. Deploy Edge Functions

```powershell
npx supabase functions deploy notification-dispatcher
npx supabase functions deploy process-reel-upload
npx supabase functions deploy send-push-notification
npx supabase functions deploy livekit-token
```

## 6. Configure DB trigger dispatch URL

Run this in the new Supabase SQL Editor:

```sql
update public.muvit_backend_config
set
  supabase_functions_url = 'https://wvtbqmdizkpcikniysgu.supabase.co/functions/v1',
  notification_webhook_secret = 'MuvIt_N0tify_8vK4pQ7xR2mL9zT5sW6aB3cD1eF7gH2jK8nP4qX6',
  updated_at = now()
where id = true;
```

## 7. Rebuild Android

```powershell
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleRelease bundleRelease
```
