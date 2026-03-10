import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (_req) => {
  try {
    const now = new Date().toISOString();

    const { data: pending, error } = await supabase
      .from("pending_deletions")
      .select("*")
      .lte("delete_at", now)
      .limit(100);

    if (error) {
      console.error("Error fetching pending deletions:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, deleted: 0 }));
    }

    console.log(`Processing ${pending.length} pending deletions`);
    let deleted = 0;

    for (const item of pending) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${item.bot_token}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: item.chat_id, message_id: item.message_id }),
        });
        const result = await res.json();
        
        if (result.ok) {
          deleted++;
        } else {
          console.error(`Failed to delete message ${item.message_id} in ${item.chat_id}: ${result.description}`);
        }
      } catch (err) {
        console.error(`Error deleting message ${item.message_id}:`, err);
      }

      // Remove from queue regardless (don't retry failed deletes forever)
      await supabase.from("pending_deletions").delete().eq("id", item.id);
    }

    return new Response(JSON.stringify({ ok: true, deleted, processed: pending.length }));
  } catch (err) {
    console.error("process-auto-deletes error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
