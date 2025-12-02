// Edge function to proxy BOFH episode reads without exposing keys to the frontend.
// Env vars required: PROJECT_URL, SERVICE_ROLE_KEY.
// Optional: ALLOWED_ORIGIN (defaults to "*").

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

const SUPABASE_URL = Deno.env.get("PROJECT_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

export const config = {
  // Public access (no JWT required); the function itself uses the service role key.
  verifyJwt: false,
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing PROJECT_URL or SERVICE_ROLE_KEY env vars");
}

const baseHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: string | Record<string, unknown>, init?: ResponseInit) {
  const status = init?.status ?? 200;
  const noBody = status === 204 || status === 205 || status === 304;
  const payload = noBody ? undefined : typeof body === "string" ? body : JSON.stringify(body);
  return new Response(payload, {
    ...init,
    headers: { "Content-Type": "application/json", ...baseHeaders, ...(init?.headers || {}) },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, { status: 405 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid JSON body" }, { status: 400 });
  }

  const page = Math.max(0, Number(body?.page) || 0);
  const pageSize = Math.min(100, Math.max(5, Number(body?.pageSize) || 12));

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error, count } = await supabase
    .from("bofh_episodes")
    .select("id,pub_date,summary,clean_html", { count: "exact" })
    .order("pub_date", { ascending: false })
    .range(from, to);

  if (error) {
    return respond({ error: error.message }, { status: 500 });
  }

  return respond({ data: data || [], count: typeof count === "number" ? count : null });
});
