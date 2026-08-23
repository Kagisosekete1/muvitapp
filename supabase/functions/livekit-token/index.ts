import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const encoder = new TextEncoder();

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signHs256(payload: Record<string, unknown>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  return `${body}.${base64Url(signature)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const livekitUrl = Deno.env.get('LIVEKIT_URL');
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!livekitUrl || !apiKey || !apiSecret || !supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and Supabase service secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const {
      roomName,
      identity,
      name,
      canPublish = false,
    } = await req.json();

    if (!roomName || !identity) {
      return new Response(
        JSON.stringify({ error: 'roomName and identity are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    const user = userData?.user;

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (String(identity) !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Token identity must match the authenticated user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: liveStream, error: streamError } = await supabase
      .from('live_streams')
      .select('user_id, is_active')
      .eq('session_id', String(roomName))
      .maybeSingle();

    if (streamError) {
      console.error('LiveKit stream lookup failed:', streamError);
      return new Response(
        JSON.stringify({ error: 'Could not verify live room' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!liveStream?.is_active) {
      return new Response(
        JSON.stringify({ error: 'Live room is not active' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (canPublish && liveStream.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only the streamer can publish to this live' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: apiKey,
      sub: String(identity),
      name: name ? String(name) : String(identity),
      iat: now,
      nbf: now - 5,
      exp: now + 60 * 60 * 6,
      video: {
        room: String(roomName),
        roomJoin: true,
        canSubscribe: true,
        canPublish: Boolean(canPublish),
        canPublishData: true,
      },
    };

    const token = await signHs256(payload, apiSecret);

    return new Response(
      JSON.stringify({ token, url: livekitUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('livekit-token error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create LiveKit token' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
