import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_ONESIGNAL_APP_ID = "0b049171-0951-40ba-b90e-38fe7e06ae21";
const APP_LOGO_URL =
  Deno.env.get("APP_LOGO_URL") ||
  "https://storage.googleapis.com/gpt-engineer-file-uploads/3IJdB71tehaMuxKUHI9gI6WMXsq1/uploads/1768602440644-Muv%27it.png";

type PushType =
  | "like"
  | "comment"
  | "comment_reply"
  | "follow"
  | "new_reel"
  | "saved"
  | "message"
  | "mention"
  | "repost"
  | "live"
  | "live_start"
  | "live_started"
  | "stream_ended"
  | "battle_challenge"
  | "battle_win"
  | "battle_loss"
  | "upload_ready"
  | "upload_failed"
  | "earnings"
  | "announcement";

interface PushPayload {
  userId: string;
  type: PushType;
  fromUserId: string;
  reelId?: string;
  conversationId?: string;
  liveSessionId?: string;
  commentId?: string;
  battleId?: string;
  message?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const buildEventKey = (payload: PushPayload) =>
  [
    payload.type,
    payload.userId,
    payload.fromUserId,
    payload.reelId || "",
    payload.conversationId || "",
    payload.liveSessionId || "",
    payload.message ? payload.message.slice(0, 64) : "",
  ].join(":");

const buildDeepLink = (payload: PushPayload, actorUsername?: string | null) => {
  if (payload.type === "message" && payload.conversationId) return `/inbox?conversation=${payload.conversationId}`;
  if ((payload.type === "live" || payload.type === "live_start" || payload.type === "live_started") && payload.liveSessionId) return `/live?session=${payload.liveSessionId}`;
  if (payload.reelId) return `/activity?reel=${payload.reelId}&type=${payload.type}`;
  if (payload.type === "follow" && actorUsername) return `/user/${actorUsername}`;
  if (payload.type.startsWith("battle_")) return "/battles";
  return "/activity";
};

const preferenceFieldFor = (type: PushType) => {
  const prefMap: Partial<Record<PushType, string>> = {
    like: "likes",
    saved: "likes",
    comment: "comments",
    follow: "follows",
    comment_reply: "replies",
    mention: "mentions",
    message: "messages",
    new_reel: "new_reels",
    repost: "reposts",
    live: "live_alerts",
    live_start: "live_alerts",
    live_started: "live_alerts",
    stream_ended: "live_alerts",
    battle_challenge: "battles",
    battle_win: "battles",
    battle_loss: "battles",
    upload_ready: "uploads",
    upload_failed: "uploads",
    earnings: "earnings",
    announcement: "announcements",
  };
  return prefMap[type];
};

const bodyFor = (type: PushType, senderName: string, message?: string) => {
  switch (type) {
    case "like":
      return { title: "New Like", body: `${senderName} liked your Reel` };
    case "comment":
      return { title: "New Comment", body: message ? `${senderName}: "${message}"` : `${senderName} commented on your Reel` };
    case "comment_reply":
      return { title: "New Reply", body: message ? `${senderName}: "${message}"` : `${senderName} replied to your comment` };
    case "follow":
      return { title: "New Follower", body: `${senderName} started following you` };
    case "new_reel":
      return { title: "New Muv", body: `${senderName} posted a new Muv` };
    case "saved":
      return { title: "Muv Saved", body: `${senderName} saved your Reel` };
    case "message":
      return { title: "New Message", body: message ? `${senderName}: "${message}"` : `${senderName} sent you a message` };
    case "mention":
      return { title: "New Mention", body: message ? `${senderName} ${message}` : `${senderName} mentioned you` };
    case "repost":
      return { title: "New Repost", body: `${senderName} reposted your Reel` };
    case "live":
    case "live_start":
    case "live_started":
      return { title: "Muv'it Live", body: `${senderName} is live now` };
    case "stream_ended":
      return { title: "Live Ended", body: `${senderName}'s live has ended` };
    case "battle_challenge":
      return { title: "Battle Challenge", body: `${senderName} challenged you to a dance battle` };
    case "battle_win":
      return { title: "Battle Won", body: "Your battle result is ready" };
    case "battle_loss":
      return { title: "Battle Result", body: "Your battle result is ready" };
    case "upload_ready":
      return { title: "Muv'z Ready", body: "Your Muv'z is ready to watch and share" };
    case "upload_failed":
      return { title: "Upload Needs Attention", body: "Your Muv'z could not finish processing. Please try again." };
    case "earnings":
      return { title: "Muv'it Earnings", body: message || "Your monetization update is ready" };
    case "announcement":
      return { title: "Muv'it", body: message || "There is a new Muv'it announcement" };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID") || DEFAULT_ONESIGNAL_APP_ID;
    const oneSignalRestKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const payload: PushPayload = await req.json();
    if (!payload.userId || !payload.fromUserId || !payload.type) return json({ error: "Missing notification fields" }, 400);
    if (payload.fromUserId !== user.id) return json({ error: "Cannot send notifications as another user" }, 403);
    if (payload.userId === payload.fromUserId) return json({ success: true, skipped: "self-notification" });

    const { count: recentCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("from_user_id", user.id)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if ((recentCount ?? 0) > 30) return json({ error: "Rate limit exceeded" }, 429);

    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", payload.userId)
      .maybeSingle();
    const prefField = preferenceFieldFor(payload.type);
    if (prefs && (prefs as any).push_enabled === false) return json({ success: true, skipped: "push-disabled" });
    if (prefs && prefField && (prefs as any)[prefField] === false) return json({ success: true, skipped: "type-disabled" });

    const { data: fromUser } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("user_id", payload.fromUserId)
      .single();
    const senderName = fromUser?.display_name || fromUser?.username || "Someone";
    const senderAvatar = fromUser?.avatar_url || APP_LOGO_URL;
    const { title, body } = bodyFor(payload.type, senderName, payload.message);
    const eventKey = buildEventKey(payload);
    const deepLink = buildDeepLink(payload, fromUser?.username);

    let notificationId: string | null = null;
    if (payload.type !== "message") {
      const { data: row, error: insertError } = await supabase
        .from("notifications")
        .upsert({
          user_id: payload.userId,
          from_user_id: payload.fromUserId,
          type: payload.type,
          reel_id: payload.reelId || null,
          comment_id: payload.commentId || null,
          battle_id: payload.battleId || null,
          live_session_id: payload.liveSessionId || null,
          message: body,
          event_key: eventKey,
          deep_link: deepLink,
          actor_avatar_url: senderAvatar,
          push_status: "pending",
        }, { onConflict: "event_key", ignoreDuplicates: true })
        .select("id")
        .maybeSingle();

      if (insertError) {
        console.error("Notification event insert failed", insertError);
        return json({ error: "Could not create notification event" }, 500);
      }

      notificationId = row?.id || null;
      if (!notificationId) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("event_key", eventKey)
          .maybeSingle();
        return json({ success: true, duplicate: true, notificationId: existing?.id || null });
      }
    }

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("subscription_id")
      .eq("user_id", payload.userId)
      .eq("provider", "onesignal")
      .eq("is_active", true)
      .eq("permission_status", "granted");
    const subscriptionIds = [...new Set((subscriptions || []).map((s: any) => s.subscription_id).filter(Boolean))];

    let pushDelivered = false;
    if (oneSignalAppId && oneSignalRestKey) {
      const additionalData: Record<string, unknown> = {
        type: payload.type,
        from_user_id: payload.fromUserId,
        actor_username: fromUser?.username || null,
        notification_id: notificationId,
        url: deepLink,
      };
      if (payload.reelId) additionalData.reel_id = payload.reelId;
      if (payload.commentId) additionalData.comment_id = payload.commentId;
      if (payload.battleId) additionalData.battle_id = payload.battleId;
      if (payload.conversationId) additionalData.conversation_id = payload.conversationId;
      if (payload.liveSessionId) additionalData.live_session_id = payload.liveSessionId;

      const notification = {
        app_id: oneSignalAppId,
        ...(subscriptionIds.length
          ? { include_subscription_ids: subscriptionIds }
          : { include_aliases: { external_id: [payload.userId] } }),
        target_channel: "push",
        headings: { en: title },
        contents: { en: body },
        large_icon: senderAvatar,
        chrome_web_icon: senderAvatar,
        firefox_icon: senderAvatar,
        big_picture: senderAvatar,
        chrome_web_image: senderAvatar,
        small_icon: "ic_stat_onesignal_default",
        chrome_web_badge: APP_LOGO_URL,
        data: additionalData,
      };

      try {
        const resp = await fetch("https://api.onesignal.com/notifications?c=push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Key ${oneSignalRestKey}`,
          },
          body: JSON.stringify(notification),
        });
        const respBody = await resp.text();
        console.log("OneSignal response", resp.status, respBody);
        pushDelivered = resp.ok;
      } catch (err) {
        console.error("OneSignal send failed", err);
      }
    } else {
      console.warn("OneSignal env vars missing - skipping push delivery");
    }

    if (notificationId) {
      await supabase
        .from("notifications")
        .update({
          push_status: pushDelivered ? "sent" : "not_sent",
          push_sent_at: pushDelivered ? new Date().toISOString() : null,
        })
        .eq("id", notificationId);
    }

    return json({ success: true, pushDelivered, notificationId, title, body });
  } catch (error) {
    console.error("Push notification error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
