import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPER_ADMIN_ID = "8097688741";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function sendDM(botToken: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  return await res.json();
}

serve(async () => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: systems } = await supabase
      .from("systems")
      .select("id, label, bot_token")
      .eq("type", "bot");

    if (!systems) return new Response(JSON.stringify({ ok: true, sent: 0 }));

    let sent = 0;
    for (const sys of systems as any[]) {
      if (!sys.bot_token) continue;

      const { data: posts } = await supabase
        .from("scheduled_posts")
        .select("id, times_sent, total_times, active, post_kind, telegram_user_id, target_channels, created_at")
        .eq("system_id", sys.id)
        .gte("created_at", since);

      const { count: deletedCount } = await supabase
        .from("pending_deletions")
        .select("id", { count: "exact", head: true })
        .eq("bot_token", sys.bot_token)
        .gte("created_at", since);

      const created = posts?.length || 0;
      const active = posts?.filter((p: any) => p.active).length || 0;
      const completed = posts?.filter((p: any) => !p.active).length || 0;
      const rposts = posts?.filter((p: any) => p.post_kind === "rpost").length || 0;
      const uniqueUsers = new Set((posts || []).map((p: any) => p.telegram_user_id)).size;
      const totalSends = (posts || []).reduce((s: number, p: any) => s + (p.times_sent || 0), 0);

      const text =
        `📊 <b>Daily Summary — ${new Date().toUTCString().slice(0, 16)}</b>\n` +
        `🤖 System: <b>${sys.label}</b>\n\n` +
        `📝 Posts created: <b>${created}</b> (${rposts} rotations)\n` +
        `🟢 Still active: <b>${active}</b>\n` +
        `✅ Completed: <b>${completed}</b>\n` +
        `📤 Total cycles sent: <b>${totalSends}</b>\n` +
        `👥 Unique posters: <b>${uniqueUsers}</b>\n` +
        `🗑 Messages queued for deletion: <b>${deletedCount ?? 0}</b>`;

      const r = await sendDM(sys.bot_token, SUPER_ADMIN_ID, text);
      if (r.ok) sent++;
      else console.error(`DM failed for ${sys.label}:`, r.description);
    }

    return new Response(JSON.stringify({ ok: true, sent }));
  } catch (err) {
    console.error("daily-summary error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
