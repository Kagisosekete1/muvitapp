const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://wvtbqmdizkpcikniysgu.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_aCpYyTYFwdkGqd0-s2Lyow_3wmhXx1r';
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://muvit.site';
const APP_IMAGE = process.env.PUBLIC_MUVIT_SHARE_IMAGE || `${SITE_URL}/muvit-logo.png`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fetchJson = async <T>(path: string): Promise<T | null> => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!response.ok) return null;
  return response.json() as Promise<T>;
};

export default async function handler(req: any, res: any) {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const reelId = String(id || '').trim();
  const reelUrl = `${SITE_URL}/reel/${encodeURIComponent(reelId)}`;

  let title = "Watch this Muv'z on Muv'it";
  let description = "Dance, create, connect and compete on Muv'it.";
  let image = APP_IMAGE;
  let videoUrl = '';
  let username = 'muvit';

  if (reelId) {
    const reelRows = await fetchJson<Array<{
      id: string;
      user_id: string;
      title: string | null;
      description: string | null;
      thumbnail_url: string | null;
      video_url: string | null;
    }>>(
      `reels?select=id,user_id,title,description,thumbnail_url,video_url&id=eq.${encodeURIComponent(reelId)}&limit=1`,
    );
    const reel = reelRows?.[0];

    if (reel) {
      const profileRows = await fetchJson<Array<{
        username: string | null;
        display_name: string | null;
        avatar_url: string | null;
      }>>(
        `profiles?select=username,display_name,avatar_url&user_id=eq.${encodeURIComponent(reel.user_id)}&limit=1`,
      );
      const profile = profileRows?.[0];
      username = profile?.username || 'muvit';
      title = reel.title ? `${reel.title} | Muv'it` : `Watch @${username}'s Muv'z on Muv'it`;
      description =
        reel.description ||
        `Watch @${username}'s dance Muv'z. Create, move, connect and compete on Muv'it.`;
      image = reel.thumbnail_url || profile?.avatar_url || APP_IMAGE;
      videoUrl = reel.video_url || '';
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(reelUrl)}">
    <meta property="og:type" content="${videoUrl ? 'video.other' : 'website'}">
    <meta property="og:site_name" content="Muv'it">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:secure_url" content="${escapeHtml(image)}">
    <meta property="og:url" content="${escapeHtml(reelUrl)}">
    ${videoUrl ? `<meta property="og:video" content="${escapeHtml(videoUrl)}">` : ''}
    ${videoUrl ? `<meta property="og:video:secure_url" content="${escapeHtml(videoUrl)}">` : ''}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, Arial, sans-serif; background: #050505; color: white; }
      main { width: min(92vw, 420px); text-align: center; }
      img { width: 100%; aspect-ratio: 9 / 16; object-fit: cover; border-radius: 24px; background: #111; }
      a { display: inline-flex; margin-top: 18px; padding: 14px 22px; border-radius: 999px; background: #168ff0; color: white; text-decoration: none; font-weight: 800; }
      p { color: rgba(255,255,255,.72); line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <a href="${escapeHtml(reelUrl)}">Open in Muv'it</a>
    </main>
  </body>
</html>`);
}
