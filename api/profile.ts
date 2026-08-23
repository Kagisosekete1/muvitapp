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

export default async function handler(req: any, res: any) {
  const rawUsername = Array.isArray(req.query.username) ? req.query.username[0] : req.query.username;
  const username = String(rawUsername || '').replace(/^@/, '').trim();
  const profileUrl = `${SITE_URL}/@${encodeURIComponent(username)}`;

  let title = username ? `@${username} on Muv'it` : "Muv'it";
  let description = "Dance, create, connect and compete on Muv'it.";
  let image = APP_IMAGE;

  if (username) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=username,display_name,bio,avatar_url&username=eq.${encodeURIComponent(username)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      },
    );
    if (response.ok) {
      const rows = await response.json();
      const profile = rows?.[0];
      if (profile) {
        title = `${profile.display_name || `@${profile.username}`} on Muv'it`;
        description = profile.bio || `Watch @${profile.username}'s Muv'z on Muv'it.`;
        image = profile.avatar_url || APP_IMAGE;
      }
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
    <link rel="canonical" href="${escapeHtml(profileUrl)}">
    <meta property="og:type" content="profile">
    <meta property="og:site_name" content="Muv'it">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:secure_url" content="${escapeHtml(image)}">
    <meta property="og:url" content="${escapeHtml(profileUrl)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, Arial, sans-serif; background: #050505; color: white; }
      main { width: min(92vw, 420px); text-align: center; }
      img { width: 140px; height: 140px; object-fit: cover; border-radius: 50%; background: #111; }
      a { display: inline-flex; margin-top: 18px; padding: 14px 22px; border-radius: 999px; background: #168ff0; color: white; text-decoration: none; font-weight: 800; }
      p { color: rgba(255,255,255,.72); line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <a href="${escapeHtml(profileUrl)}">Open in Muv'it</a>
    </main>
  </body>
</html>`);
}
