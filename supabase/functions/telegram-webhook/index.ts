import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function sendMessage(botToken: string, chatId: string | number, text: string, parseMode = "HTML") {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
}

async function deleteMessage(botToken: string, chatId: string | number, messageId: number) {
  await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
}

async function getSystemByToken(botToken: string) {
  const { data } = await supabase.from("systems").select("*").eq("bot_token", botToken).single();
  return data;
}

async function isUserAllowed(systemId: string, userId: number): Promise<boolean> {
  const { data } = await supabase
    .from("allowed_users")
    .select("id")
    .eq("system_id", systemId)
    .eq("telegram_user_id", userId.toString());
  return (data && data.length > 0) || false;
}

async function isChatAllowed(systemId: string, chatId: number): Promise<boolean> {
  const { data } = await supabase
    .from("allowed_groups")
    .select("id")
    .eq("system_id", systemId)
    .eq("telegram_chat_id", chatId.toString());
  return (data && data.length > 0) || false;
}

async function getChannels(systemId: string): Promise<string[]> {
  const { data } = await supabase.from("channels").select("username").eq("system_id", systemId);
  return data ? data.map((c: any) => c.username) : [];
}

async function getAutoDeleteRules(systemId: string, chatId: number) {
  const { data } = await supabase
    .from("auto_delete_rules")
    .select("*")
    .eq("system_id", systemId)
    .eq("chat_id", chatId.toString())
    .eq("enabled", true);
  return data || [];
}

function parseDelay(delay: string): number {
  const map: Record<string, number> = {
    "1m": 60000, "5m": 300000, "15m": 900000,
    "1h": 3600000, "6h": 21600000, "24h": 86400000,
  };
  return map[delay] || 300000;
}

async function handleAutoDelete(botToken: string, systemId: string, chatId: number, messageId: number) {
  const rules = await getAutoDeleteRules(systemId, chatId);
  if (rules.length > 0) {
    const delay = parseDelay(rules[0].delay);
    // Schedule deletion via setTimeout (edge function will handle it inline for short delays)
    if (delay <= 60000) {
      setTimeout(() => deleteMessage(botToken, chatId, messageId), delay);
    }
    // For longer delays, we'd need a cron job - skip for now
  }
}

async function handlePost(botToken: string, systemId: string, args: string[], chatId: number) {
  // /post <message> - posts to all configured channels
  if (args.length === 0) {
    await sendMessage(botToken, chatId, "Usage: /post <message>\nPosts to all configured channels.");
    return;
  }
  const message = args.join(" ");
  const channels = await getChannels(systemId);
  if (channels.length === 0) {
    await sendMessage(botToken, chatId, "❌ No channels configured. Add channels in the dashboard.");
    return;
  }
  let success = 0;
  let failed = 0;
  for (const ch of channels) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: `@${ch}`, text: message, parse_mode: "HTML" }),
      });
      const result = await res.json();
      if (result.ok) success++; else failed++;
    } catch { failed++; }
  }
  await sendMessage(botToken, chatId, `✅ Posted to ${success} channel(s)${failed > 0 ? `, ❌ ${failed} failed` : ""}.`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Extract bot token from URL path: /telegram-webhook/<bot_token>
    const pathParts = url.pathname.split("/");
    const botToken = pathParts[pathParts.length - 1];

    if (!botToken || botToken === "telegram-webhook") {
      return new Response(JSON.stringify({ error: "Bot token required in URL path" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update = await req.json();
    const message = update.message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = await getSystemByToken(botToken);
    if (!system) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const text = message.text || "";
    const messageId = message.message_id;

    // Auto-delete check
    await handleAutoDelete(botToken, system.id, chatId, messageId);

    // Check if it's a command
    if (!text.startsWith("/")) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parts = text.split(/\s+/);
    const command = parts[0].split("@")[0].toLowerCase(); // Remove @botname
    const args = parts.slice(1);

    // Check access control
    const { data: allUsers } = await supabase
      .from("allowed_users")
      .select("id")
      .eq("system_id", system.id);
    
    const hasAccessControl = allUsers && allUsers.length > 0;
    
    if (hasAccessControl) {
      const userAllowed = await isUserAllowed(system.id, userId);
      const chatAllowed = await isChatAllowed(system.id, chatId);
      if (!userAllowed && !chatAllowed) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    switch (command) {
      case "/start":
        await sendMessage(botToken, chatId,
          `👋 Hello! I'm <b>${system.label}</b>.\n\nAvailable commands:\n/id - Get chat/user ID\n/post <message> - Post to channels\n/channels - List configured channels\n/help - Show this message`
        );
        break;

      case "/id":
        await sendMessage(botToken, chatId,
          `This chat's ID is:\n<code>${chatId}</code>\n\nYour user ID is:\n<code>${userId}</code>`
        );
        break;

      case "/post":
        await handlePost(botToken, system.id, args, chatId);
        break;

      case "/channels":
        const channels = await getChannels(system.id);
        if (channels.length === 0) {
          await sendMessage(botToken, chatId, "No channels configured.");
        } else {
          await sendMessage(botToken, chatId,
            `📢 Configured channels:\n${channels.map((c) => `• @${c}`).join("\n")}`
          );
        }
        break;

      case "/help":
        await sendMessage(botToken, chatId,
          `📋 <b>Commands</b>\n\n/start - Welcome message\n/id - Get chat/user ID\n/post <message> - Post to all channels\n/channels - List channels\n/help - This message`
        );
        break;

      default:
        // Unknown command, ignore
        break;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
