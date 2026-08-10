import http from "node:http";
import { pool, supabase } from "./db.js";
import * as webhookFn from "./generated/telegram-webhook.js";
import * as scheduledPostsFn from "./generated/process-scheduled-posts.js";
import * as autoDeletesFn from "./generated/process-auto-deletes.js";
import * as dailySummaryFn from "./generated/daily-summary.js";

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = (process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "")).replace(/\/$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const POSTS_INTERVAL_MS = Number(process.env.POSTS_INTERVAL_MS || 30_000);
const DELETES_INTERVAL_MS = Number(process.env.DELETES_INTERVAL_MS || 30_000);
const SUMMARY_HOUR_UTC = Number(process.env.SUMMARY_HOUR_UTC || 9);

// ─── helpers ───

async function toRequest(req: http.IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }
  return new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
}

async function sendResponse(res: http.ServerResponse, r: Response) {
  const text = await r.text();
  res.writeHead(r.status, Object.fromEntries(r.headers.entries()));
  res.end(text);
}

// ─── webhook registration ───

export async function registerAllWebhooks() {
  if (!PUBLIC_URL) {
    console.warn("PUBLIC_URL not set — skipping automatic setWebhook.");
    return { registered: 0 };
  }
  const { data: systems } = await supabase.from("systems").select("id, label, bot_token").eq("type", "bot");
  let registered = 0;
  for (const sys of (systems || []) as any[]) {
    if (!sys.bot_token) continue;
    const url = `${PUBLIC_URL}/telegram-webhook/${sys.bot_token}`;
    try {
      const r = await fetch(`https://api.telegram.org/bot${sys.bot_token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, allowed_updates: ["message", "edited_message", "callback_query"], drop_pending_updates: false }),
      });
      const j = await r.json();
      if (j.ok) {
        registered++;
        console.log(`webhook set for ${sys.label}`);
      } else {
        console.error(`setWebhook failed for ${sys.label}: ${j.description}`);
      }
    } catch (err: any) {
      console.error(`setWebhook error for ${sys.label}: ${err.message}`);
    }
  }
  return { registered };
}

// ─── cron loops ───

function loop(name: string, fn: () => Promise<Response>, intervalMs: number) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const res = await fn();
      const body = await res.text();
      if (body && body !== '{"ok":true,"processed":0}' && body !== '{"ok":true,"deleted":0}') {
        console.log(`[${name}] ${body}`);
      }
    } catch (err: any) {
      console.error(`[${name}] error: ${err.message}`);
    } finally {
      running = false;
    }
  };
  setInterval(tick, intervalMs);
  tick();
}

let lastSummaryDay = "";
function startDailySummaryLoop() {
  setInterval(async () => {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    if (now.getUTCHours() !== SUMMARY_HOUR_UTC || lastSummaryDay === day) return;
    lastSummaryDay = day;
    try {
      const res = await dailySummaryFn.invoke();
      console.log(`[daily-summary] ${await res.text()}`);
    } catch (err: any) {
      console.error(`[daily-summary] error: ${err.message}`);
    }
  }, 60_000);
}

// ─── http server ───

const server = http.createServer(async (req, res) => {
  try {
    const path = (req.url || "/").split("?")[0];

    if (path === "/" || path === "/health") {
      let db = "ok";
      try {
        await pool.query("SELECT 1");
      } catch (e: any) {
        db = `error: ${e.message}`;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: db === "ok", db, publicUrl: PUBLIC_URL || null, uptime: process.uptime() }));
      return;
    }

    if (path.startsWith("/telegram-webhook/")) {
      const request = await toRequest(req);
      const out = await webhookFn.getHandler()(request);
      await sendResponse(res, out);
      return;
    }

    if (path === "/admin/register-webhooks" && req.method === "POST") {
      if (!ADMIN_TOKEN || req.headers["x-admin-token"] !== ADMIN_TOKEN) {
        res.writeHead(401).end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      const result = await registerAllWebhooks();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    if (path === "/admin/run/scheduled-posts" || path === "/admin/run/auto-deletes" || path === "/admin/run/daily-summary") {
      if (!ADMIN_TOKEN || req.headers["x-admin-token"] !== ADMIN_TOKEN) {
        res.writeHead(401).end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      const fn = path.endsWith("scheduled-posts") ? scheduledPostsFn : path.endsWith("auto-deletes") ? autoDeletesFn : dailySummaryFn;
      await sendResponse(res, await fn.invoke());
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  } catch (err: any) {
    console.error("server error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(err?.message || err) }));
  }
});

server.listen(PORT, async () => {
  console.log(`Bot service listening on :${PORT}`);
  console.log(PUBLIC_URL ? `Public URL: ${PUBLIC_URL}` : "PUBLIC_URL not set");

  if (process.env.AUTO_SET_WEBHOOK !== "false") {
    await registerAllWebhooks().catch((e) => console.error("registerAllWebhooks:", e.message));
  }

  loop("scheduled-posts", () => scheduledPostsFn.invoke(), POSTS_INTERVAL_MS);
  loop("auto-deletes", () => autoDeletesFn.invoke(), DELETES_INTERVAL_MS);
  startDailySummaryLoop();
});
