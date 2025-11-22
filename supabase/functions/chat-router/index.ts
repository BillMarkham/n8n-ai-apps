// Edge function: Auth + quotas + logging + proxy to n8n webhooks.
// Configure N8N_WEBHOOK_* env vars in Supabase. Do NOT bundle secrets in the frontend.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const baseHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: string | null, init?: ResponseInit) {
  const status = init?.status ?? 200;
  const noBody = status === 204 || status === 205 || status === 304;
  const payload = noBody ? null : body;
  return new Response(payload, {
    ...init,
    headers: { ...baseHeaders, ...(init?.headers || {}) },
  });
}

// Map bot IDs to their n8n webhook URLs.
// In Supabase Cloud, set env vars N8N_WEBHOOK_PINECONE, N8N_WEBHOOK_SQL_ANALYST, N8N_WEBHOOK_CHAT_HTML.
const N8N_WEBHOOKS: Record<string, string> = {
  "pinecone":
    Deno.env.get("N8N_WEBHOOK_PINECONE") ||
    "https://c2a23186d2fa.ngrok-free.app/webhook/chatpine",
  "sql-analyst":
    Deno.env.get("N8N_WEBHOOK_SQL_ANALYST") ||
    "https://c2a23186d2fa.ngrok-free.app/webhook/chatsql",
  "chat-html":
    Deno.env.get("N8N_WEBHOOK_CHAT_HTML") ||
    "https://c2a23186d2fa.ngrok-free.app/webhook/chathtml",
};

const DEFAULT_DAILY_LIMIT = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return respond("ok", { status: 204 });
  }

  if (req.method !== "POST") {
    return respond("Method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/bearer\s+/i, "").trim();

  if (!jwt) return respond("Missing token", { status: 401 });

  const { data: authData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !authData?.user) return respond("Unauthorized", { status: 401 });
  const userId = authData.user.id;

  const body = await req.json().catch(() => null);
  const botId = (body?.botId as string) || "pinecone";
  const chatInput = (body?.chatInput as string) || "";

  if (!chatInput.trim()) return respond("Missing chatInput", { status: 400 });
  const webhookUrl = N8N_WEBHOOKS[botId];
  if (!webhookUrl) return respond("Unknown botId", { status: 400 });

  // Optional bot access control table; skip if not present.
  try {
    const { data: accessRows, error: accessErr } = await supabase
      .from("bot_access")
      .select("allowed")
      .eq("user_id", userId)
      .eq("bot_id", botId);
    if (!accessErr && accessRows && accessRows.length && accessRows[0].allowed === false) {
      return respond("Forbidden (bot access)", { status: 403 });
    }
  } catch (_) {
    // If table missing, continue without blocking.
  }

  // Quota check/update (daily window).
  const today = new Date().toISOString().slice(0, 10);
  let limit = DEFAULT_DAILY_LIMIT;
  let used = 0;
  let windowStart = today;

  try {
    const { data: quotaRow } = await supabase
      .from("quotas")
      .select("*")
      .eq("user_id", userId)
      .eq("bot_id", botId)
      .maybeSingle();

    if (quotaRow) {
      limit = quotaRow.daily_limit ?? limit;
      windowStart = quotaRow.window_start ?? today;
      used = quotaRow.used ?? 0;
      if (windowStart !== today) {
        used = 0;
        windowStart = today;
      }
    }

    if (used >= limit) {
      return respond("Quota exceeded", { status: 429 });
    }

    await supabase.from("quotas").upsert({
      user_id: userId,
      bot_id: botId,
      daily_limit: limit,
      window_start: windowStart,
      used: used + 1,
    });
  } catch (_) {
    // If quota table missing, allow request but continue to proxy.
  }

  const started = Date.now();
  let status = "ok";
  let responseText = "";

  try {
    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // include both chatInput and message for workflows that expect either key
      body: JSON.stringify({ chatInput, message: chatInput, botId, userId }),
    });

    responseText = await webhookRes.text();
    if (!webhookRes.ok) {
      status = `error:${webhookRes.status}`;
      return respond(responseText || "Webhook error", { status: webhookRes.status });
    }

    return respond(responseText, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    status = "error:proxy";
    return respond("Proxy error", { status: 502 });
  } finally {
    const latency = Date.now() - started;
    // Best-effort logging; ignore failures to avoid blocking responses.
    try {
      await supabase.from("chat_requests").insert({
        user_id: userId,
        bot_id: botId,
        prompt: chatInput.slice(0, 1000),
        response_summary: responseText.slice(0, 500),
        status,
        latency_ms: latency,
      });
    } catch (_) {
      // ignore
    }
  }
});
