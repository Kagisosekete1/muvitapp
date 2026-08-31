import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-muvit-webhook-secret",
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
  | "message_request"
  | "mention"
  | "tag"
  | "repost"
  | "share"
  | "live"
  | "live_start"
  | "live_started"
  | "live_invitation"
  | "stream_ended"
  | "battle_challenge"
  | "battle_invitation"
  | "battle_started"
  | "battle_accepted"
  | "battle_declined"
  | "battle_win"
  | "battle_loss"
  | "gift"
  | "stars"
  | "upload_ready"
  | "upload_failed"
  | "earnings"
  | "verification"
  | "moderation"
  | "announcement";

interface EventPayload {
  eventId?: string;
  userId: string;
  fromUserId: string;
  type: PushType;
  reelId?: string | null;
  commentId?: string | null;
  battleId?: string | null;
  conversationId?: string | null;
  liveSessionId?: string | null;
  message?: string | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const preferenceFieldFor = (type: PushType) => {
  const prefMap: Partial<Record<PushType, string>> = {
    like: "likes",
    saved: "likes",
    comment: "comments",
    comment_reply: "replies",
    follow: "follows",
    mention: "mentions",
    tag: "mentions",
    message: "messages",
    message_request: "message_requests",
    share: "reposts",
    new_reel: "new_reels",
    repost: "reposts",
    live: "live_alerts",
    live_start: "live_alerts",
    live_started: "live_alerts",
    live_invitation: "live_invitations",
    battle_challenge: "battles",
    battle_invitation: "battles",
    battle_started: "battles",
    battle_accepted: "battles",
    battle_declined: "battles",
    battle_win: "battles",
    battle_loss: "battles",
    gift: "gifts",
    stars: "gifts",
    upload_ready: "uploads",
    upload_failed: "uploads",
    earnings: "earnings",
    verification: "verification",
    moderation: "moderation",
    announcement: "announcements",
  };
  return prefMap[type];
};

const buildEventKey = (payload: EventPayload) =>
  payload.eventId ||
  [
    payload.type,
    payload.userId,
    payload.fromUserId,
    payload.reelId || "",
    payload.commentId || "",
    payload.battleId || "",
    payload.conversationId || "",
    payload.liveSessionId || "",
    payload.message ? payload.message.slice(0, 64) : "",
  ].join(":");

const buildDeepLink = (payload: EventPayload, actorUsername?: string | null) => {
    if ((payload.type === "message" || payload.type === "message_request") && payload.conversationId) return `/inbox?conversation=${payload.conversationId}`;
  if ((payload.type === "live" || payload.type === "live_start" || payload.type === "live_started") && payload.liveSessionId) {
    return `/live?session=${payload.liveSessionId}`;
  }
  if (payload.type === "follow" && actorUsername) return `/user/${actorUsername}`;
  if (payload.battleId || payload.type.startsWith("battle_")) return `/battles${payload.battleId ? `?battle=${payload.battleId}` : ""}`;
  if (payload.reelId) return `/activity?reel=${payload.reelId}&type=${payload.type}`;
  return "/activity";
};

const bodyFor = (type: PushType, senderName: string, message?: string | null) => {
  const shortMessage = message ? message.slice(0, 120) : "";
  switch (type) {
    case "like":
      return { title: "New Like", body: `${senderName} liked your Muv'z` };
    case "comment":
      return { title: "New Comment", body: shortMessage ? `${senderName}: "${shortMessage}"` : `${senderName} commented on your Muv'z` };
    case "comment_reply":
      return { title: "New Reply", body: shortMessage ? `${senderName}: "${shortMessage}"` : `${senderName} replied to your comment` };
    case "follow":
      return { title: "New Follower", body: `${senderName} started following you` };
    case "new_reel":
      return { title: "New Muv'z", body: `${senderName} posted a new Muv'z` };
    case "saved":
      return { title: "Muv'z Saved", body: `${senderName} saved your Muv'z` };
    case "message":
      return { title: "New Message", body: shortMessage ? `${senderName}: "${shortMessage}"` : `${senderName} sent you a message` };
    case "message_request":
      return { title: "New Message Request", body: `${senderName} wants to message you` };
    case "mention":
      return { title: "New Mention", body: shortMessage ? `${senderName} ${shortMessage}` : `${senderName} mentioned you` };
    case "tag":
      return { title: "You Were Tagged", body: `${senderName} tagged you in a Muv'z` };
    case "repost":
      return { title: "New Repost", body: `${senderName} reposted your Muv'z` };
    case "share":
      return { title: "New Share", body: `${senderName} shared your Muv'z` };
    case "live":
    case "live_start":
    case "live_started":
      return { title: "Muv'it Live", body: `${senderName} is LIVE on Muv'it` };
    case "live_invitation":
      return { title: "Live Invitation", body: `${senderName} invited you to join a live` };
    case "stream_ended":
      return { title: "Live Ended", body: `${senderName}'s live has ended` };
    case "battle_challenge":
    case "battle_invitation":
      return { title: "Battle Challenge", body: `${senderName} challenged you to a dance battle` };
    case "battle_started":
      return { title: "Battle Started", body: `${senderName} started a dance battle` };
    case "battle_accepted":
      return { title: "Battle Accepted", body: `${senderName} accepted your battle invitation` };
    case "battle_declined":
      return { title: "Battle Declined", body: `${senderName} declined your battle invitation` };
    case "battle_win":
      return { title: "Battle Winner", body: "You won your dance battle" };
    case "battle_loss":
      return { title: "Battle Result", body: "Your battle result is ready" };
    case "gift":
      return { title: "New Gift", body: shortMessage || `${senderName} sent you a gift` };
    case "stars":
      return { title: "New Stars", body: shortMessage || `${senderName} sent you stars` };
    case "upload_ready":
      return { title: "Muv'z Ready", body: "Your Muv'z is ready to watch and share" };
    case "upload_failed":
      return { title: "Upload Needs Attention", body: "Your Muv'z could not finish processing. Please try again." };
    case "earnings":
      return { title: "Muv'it Earnings", body: shortMessage || "Your monetization update is ready" };
    case "verification":
      return { title: "Verification Update", body: shortMessage || "Your verification status was updated" };
    case "moderation":
      return { title: "Account Notice", body: shortMessage || "There is an important update about your account or content" };
    case "announcement":
      return { title: "Muv'it", body: shortMessage || "There is a new Muv'it announcement" };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secret = Deno.env.get("NOTIFICATION_WEBHOOK_SECRET");
    const receivedSecret = req.headers.get("x-muvit-webhook-secret");
    if (!secret || receivedSecret !== secret) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID") || DEFAULT_ONESIGNAL_APP_ID;
    const oneSignalRestKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const events: EventPayload[] = Array.isArray(body?.events) ? body.events : [body];
    const results = [];

    for (const payload of events) {
      if (!payload.userId || !payload.fromUserId || !payload.type) {
        results.push({ success: false, error: "missing-fields", payload });
        continue;
      }
      const allowSelfNotification =
        payload.type === "upload_ready" ||
        payload.type === "upload_failed" ||
        payload.type === "earnings" ||
        payload.type === "announcement";
      if (payload.userId === payload.fromUserId && !allowSelfNotification) {
        results.push({ success: true, skipped: "self-notification", type: payload.type });
        continue;
      }

      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", payload.userId)
        .maybeSingle();

      const prefField = preferenceFieldFor(payload.type);
      const pushDisabled =
        prefs && ((prefs as any).push_enabled === false || (prefField && (prefs as any)[prefField] === false));

      const { data: actor } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("user_id", payload.fromUserId)
        .maybeSingle();
      const senderName = actor?.display_name || actor?.username || "Someone";
      const senderAvatar = actor?.avatar_url || APP_LOGO_URL;
      const { title, body } = bodyFor(payload.type, senderName, payload.message);
      const eventKey = buildEventKey(payload);
      const deepLink = buildDeepLink(payload, actor?.username);

      const { data: row, error: insertError } = await supabase
        .from("notifications")
        .upsert({
          user_id: payload.userId,
          from_user_id: payload.fromUserId,
          type: payload.type,
          title,
          reel_id: payload.reelId || null,
          comment_id: payload.commentId || null,
          battle_id: payload.battleId || null,
          live_session_id: payload.liveSessionId || null,
          message: body,
          body,
          event_key: eventKey,
          deep_link: deepLink,
          actor_avatar_url: senderAvatar,
          conversation_id: payload.conversationId || null,
          push_status: pushDisabled ? "preference_skipped" : "pending",
        }, { onConflict: "event_key", ignoreDuplicates: true })
        .select("id")
        .maybeSingle();

      if (insertError) {
        console.error("[notification-dispatcher] event insert failed", insertError);
        results.push({ success: false, error: "insert-failed", type: payload.type });
        continue;
      }

      let notificationId = row?.id as string | undefined;
      if (!notificationId) {
        const { data: existing, error: existingError } = await supabase
          .from("notifications")
          .select("id, push_status")
          .eq("event_key", eventKey)
          .maybeSingle();

        if (existingError || !existing?.id) {
          results.push({ success: false, error: "existing-notification-not-found", eventKey });
          continue;
        }

        notificationId = existing.id;
        if (["sent", "preference_skipped", "disabled"].includes(existing.push_status || "")) {
          results.push({ success: true, duplicate: true, notificationId, eventKey });
          continue;
        }
      }

      if (pushDisabled) {
        await supabase
          .from("notifications")
          .update({ push_status: "preference_skipped" })
          .eq("id", notificationId);
        results.push({ success: true, notificationId, skipped: "preference-disabled" });
        continue;
      }

      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("subscription_id")
        .eq("user_id", payload.userId)
        .eq("provider", "onesignal")
        .eq("is_active", true)
        .eq("permission_status", "granted");

      const subscriptionIds = [...new Set((subscriptions || []).map((s: any) => s.subscription_id).filter(Boolean))];
      let pushStatus = "not_sent";
      let pushError: string | null = null;
      let providerResponse: unknown = null;

      if (oneSignalRestKey && oneSignalAppId) {
        const notification = {
          app_id: oneSignalAppId,
          ...(subscriptionIds.length
            ? { include_subscription_ids: subscriptionIds }
            : { include_aliases: { external_id: [payload.userId] } }),
          target_channel: "push",
          headings: { en: title },
          contents: { en: body },
          large_icon: senderAvatar,
          big_picture: senderAvatar,
          chrome_web_icon: senderAvatar,
          chrome_web_image: senderAvatar,
          small_icon: "ic_stat_onesignal_default",
          data: {
            type: payload.type,
            notification_id: notificationId,
            from_user_id: payload.fromUserId,
            actor_username: actor?.username || null,
            reel_id: payload.reelId || null,
            comment_id: payload.commentId || null,
            battle_id: payload.battleId || null,
            conversation_id: payload.conversationId || null,
            live_session_id: payload.liveSessionId || null,
            url: deepLink,
          },
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
          const responseText = await resp.text();
          try {
            providerResponse = JSON.parse(responseText);
          } catch {
            providerResponse = { raw: responseText.slice(0, 500) };
          }
          pushStatus = resp.ok ? "sent" : "failed";
          if (!resp.ok) pushError = responseText.slice(0, 500);
          console.log("[notification-dispatcher] OneSignal", resp.status, responseText);
        } catch (err) {
          pushStatus = "failed";
          pushError = err instanceof Error ? err.message : String(err);
          providerResponse = { error: pushError };
          console.error("[notification-dispatcher] OneSignal failed", err);
        }
      } else {
        pushStatus = "missing_env";
      }

      await supabase
        .from("notifications")
        .update({
          push_status: pushStatus,
          push_sent_at: pushStatus === "sent" ? new Date().toISOString() : null,
          push_error: pushError,
          delivery_attempts: 1,
          provider_response: providerResponse,
        })
        .eq("id", notificationId);

      results.push({ success: pushStatus === "sent", notificationId, pushStatus, pushError });
    }

    return json({ success: true, results });
  } catch (error) {
    console.error("[notification-dispatcher] error", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
