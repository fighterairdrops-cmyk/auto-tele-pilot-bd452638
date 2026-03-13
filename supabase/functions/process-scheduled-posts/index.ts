import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ─── Send media or text to a channel ───

type SendResult = {
  ok: boolean;
  messageId: number | null;
};

function parseDelay(delay: string): number {
  const map: Record<string, number> = {
    "1m": 60000,
    "5m": 300000,
    "15m": 900000,
    "30m": 1800000,
    "1h": 3600000,
    "2h": 7200000,
    "3h": 10800000,
    "4h": 14400000,
    "6h": 21600000,
    "12h": 43200000,
    "24h": 86400000,
  };
  return map[delay] || 300000;
}

function normalizeChatKey(chatId: string): string {
  const trimmed = chatId.trim();
  return trimmed.startsWith("@") ? trimmed.slice(1).toLowerCase() : trimmed.toLowerCase();
}

function resolveAutoDeleteDelay(rules: Array<{ chat_id: string; delay: string }>, channelChatId: string): number | null {
  if (!rules || rules.length === 0) return null;

  const normalizedChannel = normalizeChatKey(channelChatId);

  const exact = rules.find((rule) => normalizeChatKey(rule.chat_id) === normalizedChannel);
  if (exact) return parseDelay(exact.delay);

  const wildcard = rules.find((rule) => {
    const key = normalizeChatKey(rule.chat_id);
    return key === "*" || key === "all";
  });
  if (wildcard) return parseDelay(wildcard.delay);

  // Fallback: if only one enabled rule exists, treat it as system default duration
  if (rules.length === 1) {
    return parseDelay(rules[0].delay);
  }

  return null;
}

async function queuePendingDeletion(botToken: string, chatId: string, messageId: number, delayMs: number) {
  const deleteAt = new Date(Date.now() + delayMs).toISOString();

  const { error } = await supabase.from("pending_deletions").insert({
    bot_token: botToken,
    chat_id: chatId,
    message_id: messageId,
    delete_at: deleteAt,
  });

  if (error) {
    console.error(`Failed to queue deletion for ${chatId}/${messageId}:`, error);
  }
}

async function sendToChannel(botToken: string, chatId: string, text: string, mediaFileId?: string | null, mediaType?: string | null): Promise<SendResult> {
  try {
    if (mediaFileId && mediaType) {
      return await sendMedia(botToken, chatId, mediaFileId, mediaType, text);
    }
    return await sendText(botToken, chatId, text);
  } catch (err) {
    console.error(`sendToChannel error for ${chatId}:`, err);
    return { ok: false, messageId: null };
  }
}

async function sendText(botToken: string, chatId: string, text: string): Promise<SendResult> {
  // Try HTML
  let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  let result = await res.json();
  if (result.ok) {
    return { ok: true, messageId: result.result?.message_id ?? null };
  }

  // Fallback plain
  console.error(`HTML failed for ${chatId}: ${result.description}, retrying plain`);
  const plain = text.replace(/<[^>]*>/g, '');
  res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: plain }),
  });
  result = await res.json();
  if (result.ok) {
    return { ok: true, messageId: result.result?.message_id ?? null };
  }
  console.error(`Plain also failed for ${chatId}:`, result.description);
  return { ok: false, messageId: null };
}

async function sendMedia(botToken: string, chatId: string, fileId: string, mediaType: string, caption?: string): Promise<SendResult> {
  const methodMap: Record<string, string> = {
    photo: "sendPhoto", video: "sendVideo", document: "sendDocument",
    audio: "sendAudio", voice: "sendVoice", video_note: "sendVideoNote",
    animation: "sendAnimation", sticker: "sendSticker",
  };
  const fieldMap: Record<string, string> = {
    photo: "photo", video: "video", document: "document",
    audio: "audio", voice: "voice", video_note: "video_note",
    animation: "animation", sticker: "sticker",
  };

  const method = methodMap[mediaType] || "sendDocument";
  const field = fieldMap[mediaType] || "document";
  const body: any = { chat_id: chatId, [field]: fileId };

  if (caption && mediaType !== "sticker" && mediaType !== "video_note") {
    body.caption = caption;
    body.parse_mode = "HTML";
  }

  let res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let result = await res.json();

  // If HTML caption fails, retry plain
  if (!result.ok && caption && body.parse_mode) {
    console.error(`Media caption HTML failed for ${chatId}: ${result.description}`);
    body.caption = caption.replace(/<[^>]*>/g, '');
    delete body.parse_mode;
    res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    result = await res.json();
  }

  if (!result.ok) {
    console.error(`sendMedia ${method} failed for ${chatId}:`, result.description);
    return { ok: false, messageId: null };
  }
  return { ok: true, messageId: result.result?.message_id ?? null };
}

serve(async (req) => {
  try {
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

      // Determine channels to post to
      let channels: string[];

      if (post.target_channels && (post.target_channels as string[]).length > 0) {
        // Use specific target channels stored with the post
        channels = post.target_channels as string[];
      } else {
        // Fall back to user's accessible channels
        const isAdminResult = await supabase
          .from("allowed_users")
          .select("is_admin")
          .eq("system_id", post.system_id)
          .eq("telegram_user_id", post.telegram_user_id);

        const userIsAdmin = isAdminResult.data?.some((u: any) => u.is_admin);

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
      }

      // Send to channels
      let success = 0;
      for (const ch of channels) {
        const ok = await sendToChannel(botToken, `@${ch}`, post.message_text, post.media_file_id, post.media_type);
        if (ok) success++;
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

      // Notify user
      if (success > 0) {
        const notifyText = `📤 Post ${newTimesSent}/${post.total_times} sent to ${success} channel(s).${isComplete ? " ✅ Complete!" : ""}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: post.chat_id, text: notifyText }),
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
