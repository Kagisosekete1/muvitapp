import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-muvit-webhook-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secret = Deno.env.get("NOTIFICATION_WEBHOOK_SECRET");
    const receivedSecret = req.headers.get("x-muvit-webhook-secret");
    if (!secret || receivedSecret !== secret) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reelId } = await req.json();
    if (!reelId) return json({ error: "Missing reelId" }, 400);

    const { data: reel, error } = await supabase
      .from("reels")
      .select("id, user_id, video_url, thumbnail_url, processing_status")
      .eq("id", reelId)
      .maybeSingle();

    if (error || !reel) return json({ error: "Reel not found" }, 404);
    if (!reel.video_url) {
      await supabase
        .from("reels")
        .update({
          processing_status: "failed",
          upload_status: "failed",
          processing_error: "Missing video_url",
        })
        .eq("id", reelId);
      return json({ error: "Missing video_url" }, 400);
    }

    // This function is the server-side processing hook. Supabase Edge runtime is
    // not an ffmpeg transcode worker, so existing playback URLs remain intact
    // while the row is advanced to ready and downstream push is server-triggered.
    await supabase
      .from("reels")
      .update({
        processing_status: "ready",
        upload_status: "ready",
        processing_completed_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq("id", reelId);

    const dispatcherUrl = `${supabaseUrl}/functions/v1/notification-dispatcher`;
    await fetch(dispatcherUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-muvit-webhook-secret": secret,
      },
      body: JSON.stringify({
        eventId: `upload_ready:${reel.id}`,
        userId: reel.user_id,
        fromUserId: reel.user_id,
        type: "upload_ready",
        reelId: reel.id,
      }),
    });

    return json({ success: true, reelId });
  } catch (error) {
    console.error("[process-reel-upload] error", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
