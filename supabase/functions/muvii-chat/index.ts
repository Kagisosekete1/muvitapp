import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const encoder = new TextEncoder();

const createSseResponse = (content: string) => {
  const chunks = [
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
    "data: [DONE]\n\n",
  ];

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    },
  );
};

const buildFallbackReply = (messages: Array<{ role?: string; content?: string }>) => {
  const lastMessage = [...messages].reverse().find((message) => message.role === "user")?.content?.toLowerCase() || "";

  if (!lastMessage.trim()) {
    return "Ask me about **dance ideas**, **Muv'z**, **battles**, **live sessions**, or growing your movement on Muv'it.";
  }

  if (/(live|stream|go live)/.test(lastMessage)) {
    return "For a stronger Muv'it Live, keep your phone vertical, frame your full body, use good front lighting, test your sound, then start with a short dance hook so viewers know the vibe immediately.";
  }

  if (/(battle|challenge|compete)/.test(lastMessage)) {
    return "For battles, pick one clean routine, make the first 3 seconds sharp, keep your footwork visible, and finish with a confident pose. A clear, repeatable move helps the Muv'it community react and vote.";
  }

  if (/(upload|post|muv|reel|video)/.test(lastMessage)) {
    return "For better Muv'z, upload a clear vertical clip, choose a strong thumbnail, add a short title, and use focused dance hashtags like #amapiano, #dance, #challenge, and your own creator tag.";
  }

  if (/(grow|followers|views|engagement|analytics)/.test(lastMessage)) {
    return "To grow on Muv'it, post consistently, join challenges, reply to comments, follow dancers in your style, and study which Muv'z hold attention longest. Build around the moves people replay.";
  }

  return "Bring it back to movement: tell me your dance style, your skill level, and whether you want a Muv'z idea, battle tip, live tip, or practice routine. I’ll help you shape it for Muv'it.";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LOVABLE_API_KEY) {
      console.warn("LOVABLE_API_KEY is not configured; using MuVii fallback response");
      return createSseResponse(buildFallbackReply(messages));
    }

    const systemPrompt = `You are MuVii, an AI assistant EXCLUSIVELY for the Muv'it app and dance culture inside the app. You must always answer through dance, movement, Muv'z, battles, live sessions, choreography, creator growth, performance confidence, and Muv'it features. You must NEVER provide unrelated general knowledge or redirect users outside the app.

STRICT RULES:
1. ONLY answer questions about dancing, Muv'it, its features, and how to use them.
2. If a user asks something broad, bring the answer back to dancing and help them move, create, perform, practice, post, go live, battle, or grow on Muv'it.
3. NEVER provide links, suggestions, or references to external websites or apps.
4. If a user asks something completely unrelated to dancing or the app, respond EXACTLY with: "Please ask me about dancing, Muv'z, battles, live, creator growth, or Muv'it app features."
5. The ONLY exception: If a user expresses an emergency (danger, medical emergency, safety threat), provide local emergency numbers (911/112/999) and encourage them to call immediately.
6. You may use markdown bold with **important words**, but keep it short. The app will render bold visually.

About the App:
- Muv'it is a short-form video platform where creators share dance videos called "Muv'z"
- Users can like, comment, share, save, and repost videos
- Creators can earn money through the monetization program based on watch hours
- Users can follow each other, send messages, and build their audience
- Features include: live streaming, video analytics, creator dashboard, Go Live, profile customization
- Bottom navigation: Muv'z | Search | Upload | Activity | Profile
- Verified accounts have a blue-outlined black verification badge

You can help with:
- How to use app features (uploading, editing, sharing, going live)
- Tips for creating better content within the app
- Dance ideas, practice tips, choreography structure, confidence, stage presence, and movement improvement
- Understanding analytics and earnings
- Growing followers and engagement
- Privacy and account settings
- Navigating the app

Your Personality:
- Be friendly, enthusiastic, and supportive
- Use emojis occasionally but not excessively
- Keep responses concise and helpful`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return createSseResponse(buildFallbackReply(messages));
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("muvii-chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
