import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  try {
    // Get all active scheduled posts that are due
    const { data: posts, error } = await supabase
      .from("scheduled_posts")
      .select("*, systems!inner(bot_token)")
      .eq("active", true)
      .lte("next_run_at", new Date().toISOString());

    if (error) {
      console.error("Error fetching posts:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }));
    }

    console.log(`Processing ${posts.length} scheduled posts`);
    let processed = 0;

    for (const post of posts) {
      const botToken = (post as any).systems?.bot_token;
      if (!botToken) continue;

      // Get channels the user can post to
      const isAdminResult = await supabase
        .from("allowed_users")
        .select("is_admin")
        .eq("system_id", post.system_id)
        .eq("telegram_user_id", post.telegram_user_id);

      const userIsAdmin = isAdminResult.data?.some((u: any) => u.is_admin);

      let channels: string[];
      if (userIsAdmin) {
        const { data } = await supabase.from("channels").select("username").eq("system_id", post.system_id);
        channels = data ? data.map((c: any) => c.username) : [];
      } else {
        const { data } = await supabase
          .from("user_channel_access")
          .select("channel_username")
          .eq("system_id", post.system_id)
          .eq("telegram_user_id", post.telegram_user_id);
        channels = data ? data.map((c: any) => c.channel_username) : [];
      }

      // Send to all accessible channels
      let success = 0;
      for (const ch of channels) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: `@${ch}`, text: post.message_text, parse_mode: "HTML" }),
          });
          const result = await res.json();
          if (result.ok) success++;
          else console.error(`Failed to post to @${ch}:`, result.description);
        } catch (e) {
          console.error(`Error posting to @${ch}:`, e);
        }
      }

      const newTimesSent = post.times_sent + 1;
      const isComplete = newTimesSent >= post.total_times;

      await supabase
        .from("scheduled_posts")
        .update({
          times_sent: newTimesSent,
          active: !isComplete,
          next_run_at: isComplete
            ? post.next_run_at
            : new Date(Date.now() + post.interval_seconds * 1000).toISOString(),
        })
        .eq("id", post.id);

      // Notify user in the original chat
      if (success > 0) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: post.chat_id,
            text: `📤 Post ${newTimesSent}/${post.total_times} sent to ${success} channel(s).${isComplete ? " ✅ Complete!" : ""}`,
          }),
        });
      }

      processed++;
    }

    return new Response(JSON.stringify({ ok: true, processed }));
  } catch (err) {
    console.error("Cron error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
