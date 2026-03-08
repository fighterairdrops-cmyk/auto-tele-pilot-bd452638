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

// ─── Telegram helpers ───

async function sendMessage(botToken: string, chatId: string | number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const result = await res.json();
  if (!result.ok) console.error("sendMessage failed:", JSON.stringify(result));
  return result;
}

async function deleteMessage(botToken: string, chatId: string | number, messageId: number) {
  await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
}

// ─── DB helpers ───

async function getSystemByToken(botToken: string) {
  const { data } = await supabase.from("systems").select("*").eq("bot_token", botToken).single();
  return data;
}

async function isAdmin(systemId: string, userId: number): Promise<boolean> {
  const { data } = await supabase
    .from("allowed_users")
    .select("is_admin")
    .eq("system_id", systemId)
    .eq("telegram_user_id", userId.toString());
  return data ? data.some((u: any) => u.is_admin) : false;
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

async function getUserChannelAccess(systemId: string, userId: number): Promise<string[]> {
  const { data } = await supabase
    .from("user_channel_access")
    .select("channel_username")
    .eq("system_id", systemId)
    .eq("telegram_user_id", userId.toString());
  return data ? data.map((c: any) => c.channel_username) : [];
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

// ─── Duration parser ───

function parseDuration(s: string): number | null {
  const match = s.match(/^(\d+)(m|h|d)$/);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2];
  if (unit === "m") return n * 60;
  if (unit === "h") return n * 3600;
  if (unit === "d") return n * 86400;
  return null;
}

function parseDelay(delay: string): number {
  const map: Record<string, number> = {
    "1m": 60000, "5m": 300000, "15m": 900000,
    "1h": 3600000, "6h": 21600000, "24h": 86400000,
  };
  return map[delay] || 300000;
}

// ─── Auto-delete ───

async function handleAutoDelete(botToken: string, systemId: string, chatId: number, messageId: number) {
  const rules = await getAutoDeleteRules(systemId, chatId);
  if (rules.length > 0) {
    const delay = parseDelay(rules[0].delay);
    if (delay <= 60000) {
      setTimeout(() => deleteMessage(botToken, chatId, messageId), delay);
    }
  }
}

// ─── Command: /start ───

async function handleStart(botToken: string, systemLabel: string, chatId: number, userId: number, systemId: string) {
  const admin = await isAdmin(systemId, userId);

  let text = `👋 <b>Welcome to ${systemLabel}!</b>\n\n`;
  text += `📋 <b>User Commands:</b>\n`;
  text += `/start - Show this message\n`;
  text += `/id - Get chat/user ID\n`;
  text += `/post every(1h) time(3) - Schedule post (reply to a message)\n`;
  text += `/myposts - View your scheduled posts\n`;
  text += `/stop &lt;post_id&gt; - Cancel a scheduled post\n`;
  text += `/channels - List all channels\n`;
  text += `/myaccess - Show channels you can post to\n`;
  text += `/help - Show this message\n`;

  if (admin) {
    text += `\n🔑 <b>Admin Commands:</b>\n`;
    text += `/access @ch1 @ch2 - Grant channel access (reply to user)\n`;
    text += `/remove @ch1 - Remove channel access (reply to user)\n`;
    text += `/addadmin - Make user admin (reply to user)\n`;
    text += `/removeadmin - Remove admin (reply to user)\n`;
    text += `/allposts - View all scheduled posts\n`;
    text += `/stopall - Cancel all scheduled posts\n`;
  }

  await sendMessage(botToken, chatId, text);
}

// ─── Command: /access (admin only) ───

async function handleAccess(botToken: string, systemId: string, chatId: number, userId: number, args: string[], replyToMessage: any) {
  const admin = await isAdmin(systemId, userId);
  if (!admin) {
    await sendMessage(botToken, chatId, "❌ Only admins can grant access.");
    return;
  }

  if (!replyToMessage || !replyToMessage.from) {
    await sendMessage(botToken, chatId, "❌ Reply to a user's message with /access @channel1 @channel2");
    return;
  }

  if (args.length === 0) {
    await sendMessage(botToken, chatId, "❌ Specify channels: /access @channel1 @channel2");
    return;
  }

  const targetUserId = replyToMessage.from.id.toString();
  const targetName = replyToMessage.from.first_name || targetUserId;
  const channels = args.map(a => a.replace(/^@/, "").toUpperCase());

  // Verify channels exist in system
  const systemChannels = await getChannels(systemId);
  const systemChannelsUpper = systemChannels.map(c => c.toUpperCase());
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const ch of channels) {
    if (systemChannelsUpper.includes(ch)) {
      valid.push(ch);
    } else {
      invalid.push(ch);
    }
  }

  // Ensure user is in allowed_users
  const userExists = await isUserAllowed(systemId, parseInt(targetUserId));
  if (!userExists) {
    await supabase.from("allowed_users").insert({
      system_id: systemId,
      telegram_user_id: targetUserId,
      is_admin: false,
    });
  }

  // Grant access
  let granted = 0;
  for (const ch of valid) {
    const { error } = await supabase.from("user_channel_access").upsert({
      system_id: systemId,
      telegram_user_id: targetUserId,
      channel_username: ch,
      granted_by: userId.toString(),
    }, { onConflict: "system_id,telegram_user_id,channel_username" });
    if (!error) granted++;
  }

  let msg = `✅ Granted <b>${targetName}</b> access to ${granted} channel(s): ${valid.map(c => `@${c}`).join(", ")}`;
  if (invalid.length > 0) {
    msg += `\n⚠️ Unknown channels: ${invalid.map(c => `@${c}`).join(", ")}`;
  }
  await sendMessage(botToken, chatId, msg);
}

// ─── Command: /revoke (admin only) ───

async function handleRevoke(botToken: string, systemId: string, chatId: number, userId: number, args: string[], replyToMessage: any) {
  const admin = await isAdmin(systemId, userId);
  if (!admin) {
    await sendMessage(botToken, chatId, "❌ Only admins can revoke access.");
    return;
  }

  if (!replyToMessage || !replyToMessage.from) {
    await sendMessage(botToken, chatId, "❌ Reply to a user's message with /revoke @channel1");
    return;
  }

  const targetUserId = replyToMessage.from.id.toString();
  const targetName = replyToMessage.from.first_name || targetUserId;
  const channels = args.map(a => a.replace(/^@/, "").toUpperCase());

  let revoked = 0;
  for (const ch of channels) {
    const { error } = await supabase
      .from("user_channel_access")
      .delete()
      .eq("system_id", systemId)
      .eq("telegram_user_id", targetUserId)
      .eq("channel_username", ch);
    if (!error) revoked++;
  }

  await sendMessage(botToken, chatId, `✅ Revoked ${revoked} channel(s) from <b>${targetName}</b>.`);
}

// ─── Command: /addadmin & /removeadmin ───

async function handleAdminToggle(botToken: string, systemId: string, chatId: number, userId: number, makeAdmin: boolean, replyToMessage: any) {
  const admin = await isAdmin(systemId, userId);
  if (!admin) {
    await sendMessage(botToken, chatId, "❌ Only admins can do this.");
    return;
  }

  if (!replyToMessage || !replyToMessage.from) {
    await sendMessage(botToken, chatId, "❌ Reply to a user's message.");
    return;
  }

  const targetUserId = replyToMessage.from.id.toString();
  const targetName = replyToMessage.from.first_name || targetUserId;

  // Ensure user exists
  const userExists = await isUserAllowed(systemId, parseInt(targetUserId));
  if (!userExists) {
    await supabase.from("allowed_users").insert({
      system_id: systemId,
      telegram_user_id: targetUserId,
      is_admin: makeAdmin,
    });
  } else {
    await supabase
      .from("allowed_users")
      .update({ is_admin: makeAdmin })
      .eq("system_id", systemId)
      .eq("telegram_user_id", targetUserId);
  }

  const action = makeAdmin ? "promoted to admin" : "removed from admin";
  await sendMessage(botToken, chatId, `✅ <b>${targetName}</b> has been ${action}.`);
}

// ─── Command: /post every() time() ───

async function handlePost(botToken: string, systemId: string, chatId: number, userId: number, text: string, replyToMessage: any) {
  // Parse: /post every(5m) time(3)
  const everyMatch = text.match(/every\((\d+[mhd])\)/i);
  const timeMatch = text.match(/time\((\d+)\)/i);

  if (!everyMatch || !timeMatch) {
    await sendMessage(botToken, chatId,
      "📝 <b>Usage:</b> Reply to a message with:\n<code>/post every(5m) time(3)</code>\n\nDurations: 1m, 5m, 15m, 1h, 6h, 24h, 1d\nTimes: how many times to post");
    return;
  }

  if (!replyToMessage) {
    await sendMessage(botToken, chatId, "❌ Reply to a message to schedule it for posting.");
    return;
  }

  const intervalSeconds = parseDuration(everyMatch[1]);
  if (!intervalSeconds) {
    await sendMessage(botToken, chatId, "❌ Invalid duration. Use: 1m, 5m, 15m, 1h, 6h, 24h, 1d");
    return;
  }

  const totalTimes = parseInt(timeMatch[1]);
  if (totalTimes < 1 || totalTimes > 100) {
    await sendMessage(botToken, chatId, "❌ Times must be between 1 and 100.");
    return;
  }

  // Check what channels user can post to
  const adminStatus = await isAdmin(systemId, userId);
  let channels: string[];

  if (adminStatus) {
    channels = await getChannels(systemId);
  } else {
    channels = await getUserChannelAccess(systemId, userId);
  }

  if (channels.length === 0) {
    await sendMessage(botToken, chatId, "❌ You don't have access to any channels. Ask an admin to grant you access with /access.");
    return;
  }

  const messageText = replyToMessage.text || replyToMessage.caption || "";
  if (!messageText) {
    await sendMessage(botToken, chatId, "❌ The replied message has no text content.");
    return;
  }

  // Save scheduled post
  const { data, error } = await supabase.from("scheduled_posts").insert({
    system_id: systemId,
    chat_id: chatId.toString(),
    message_text: messageText,
    telegram_user_id: userId.toString(),
    interval_seconds: intervalSeconds,
    total_times: totalTimes,
    times_sent: 0,
    next_run_at: new Date(Date.now() + intervalSeconds * 1000).toISOString(),
    active: true,
  }).select().single();

  if (error) {
    console.error("Error creating scheduled post:", error);
    await sendMessage(botToken, chatId, "❌ Failed to schedule post.");
    return;
  }

  const chList = channels.map(c => `@${c}`).join(", ");
  await sendMessage(botToken, chatId,
    `✅ <b>Post Scheduled!</b>\n\n📝 "${messageText.substring(0, 50)}${messageText.length > 50 ? "..." : ""}"\n📢 Channels: ${chList}\n⏱ Every ${everyMatch[1]}, ${totalTimes} time(s)\n🆔 Post ID: <code>${data.id.substring(0, 8)}</code>`
  );
}

// ─── Command: /myposts ───

async function handleMyPosts(botToken: string, systemId: string, chatId: number, userId: number) {
  const { data } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("system_id", systemId)
    .eq("telegram_user_id", userId.toString())
    .eq("active", true);

  if (!data || data.length === 0) {
    await sendMessage(botToken, chatId, "📭 No active scheduled posts.");
    return;
  }

  let text = "📋 <b>Your Scheduled Posts:</b>\n\n";
  for (const p of data) {
    text += `🆔 <code>${p.id.substring(0, 8)}</code>\n`;
    text += `📝 "${p.message_text.substring(0, 40)}..."\n`;
    text += `📊 ${p.times_sent}/${p.total_times} sent\n`;
    text += `⏱ Every ${p.interval_seconds}s\n\n`;
  }
  text += "Use /stop &lt;post_id&gt; to cancel.";
  await sendMessage(botToken, chatId, text);
}

// ─── Command: /stop ───

async function handleStop(botToken: string, systemId: string, chatId: number, userId: number, args: string[]) {
  if (args.length === 0) {
    await sendMessage(botToken, chatId, "Usage: /stop &lt;post_id&gt;");
    return;
  }

  const postIdPrefix = args[0];
  const { data } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("system_id", systemId)
    .eq("telegram_user_id", userId.toString())
    .eq("active", true);

  const post = data?.find((p: any) => p.id.startsWith(postIdPrefix));
  if (!post) {
    await sendMessage(botToken, chatId, "❌ Post not found or not yours.");
    return;
  }

  await supabase.from("scheduled_posts").update({ active: false }).eq("id", post.id);
  await sendMessage(botToken, chatId, `✅ Post <code>${post.id.substring(0, 8)}</code> cancelled.`);
}

// ─── Command: /myaccess ───

async function handleMyAccess(botToken: string, systemId: string, chatId: number, userId: number) {
  const admin = await isAdmin(systemId, userId);
  if (admin) {
    const channels = await getChannels(systemId);
    await sendMessage(botToken, chatId, `🔑 You're an <b>admin</b>. You can post to all channels:\n${channels.map(c => `• @${c}`).join("\n") || "No channels configured."}`);
    return;
  }

  const channels = await getUserChannelAccess(systemId, userId);
  if (channels.length === 0) {
    await sendMessage(botToken, chatId, "❌ You don't have access to any channels. Ask an admin.");
    return;
  }

  await sendMessage(botToken, chatId, `📢 <b>Your channel access:</b>\n${channels.map(c => `• @${c}`).join("\n")}`);
}

// ─── Command: /allposts (admin) ───

async function handleAllPosts(botToken: string, systemId: string, chatId: number, userId: number) {
  const admin = await isAdmin(systemId, userId);
  if (!admin) {
    await sendMessage(botToken, chatId, "❌ Only admins can view all posts.");
    return;
  }

  const { data } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("system_id", systemId)
    .eq("active", true);

  if (!data || data.length === 0) {
    await sendMessage(botToken, chatId, "📭 No active scheduled posts.");
    return;
  }

  let text = "📋 <b>All Scheduled Posts:</b>\n\n";
  for (const p of data) {
    text += `🆔 <code>${p.id.substring(0, 8)}</code> by user ${p.telegram_user_id}\n`;
    text += `📝 "${p.message_text.substring(0, 40)}..."\n`;
    text += `📊 ${p.times_sent}/${p.total_times} sent\n\n`;
  }
  await sendMessage(botToken, chatId, text);
}

// ─── Command: /stopall (admin) ───

async function handleStopAll(botToken: string, systemId: string, chatId: number, userId: number) {
  const admin = await isAdmin(systemId, userId);
  if (!admin) {
    await sendMessage(botToken, chatId, "❌ Only admins can stop all posts.");
    return;
  }

  const { data } = await supabase
    .from("scheduled_posts")
    .update({ active: false })
    .eq("system_id", systemId)
    .eq("active", true)
    .select();

  await sendMessage(botToken, chatId, `✅ Cancelled ${data?.length || 0} scheduled post(s).`);
}

// ─── Main handler ───

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const whIdx = pathParts.indexOf("telegram-webhook");
    let botToken = "";
    if (whIdx >= 0 && whIdx < pathParts.length - 1) {
      botToken = pathParts.slice(whIdx + 1).join("/");
    } else if (pathParts.length > 0) {
      botToken = pathParts[pathParts.length - 1];
    }

    if (!botToken || botToken === "telegram-webhook") {
      return new Response(JSON.stringify({ error: "Bot token required" }), {
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
    const replyToMessage = message.reply_to_message;

    // Auto-delete check
    await handleAutoDelete(botToken, system.id, chatId, messageId);

    if (!text.startsWith("/")) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parts = text.split(/\s+/);
    const command = parts[0].split("@")[0].toLowerCase();
    const args = parts.slice(1);

    // Access control: check if user/chat is allowed
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

    console.log(`Command: ${command} from user ${userId} in chat ${chatId}`);

    switch (command) {
      case "/start":
      case "/help":
        await handleStart(botToken, system.label, chatId, userId, system.id);
        break;

      case "/id":
        await sendMessage(botToken, chatId,
          `🆔 Chat ID: <code>${chatId}</code>\n👤 Your ID: <code>${userId}</code>`
        );
        break;

      case "/post":
        await handlePost(botToken, system.id, chatId, userId, text, replyToMessage);
        break;

      case "/myposts":
        await handleMyPosts(botToken, system.id, chatId, userId);
        break;

      case "/stop":
        await handleStop(botToken, system.id, chatId, userId, args);
        break;

      case "/myaccess":
        await handleMyAccess(botToken, system.id, chatId, userId);
        break;

      case "/access":
        await handleAccess(botToken, system.id, chatId, userId, args, replyToMessage);
        break;

      case "/revoke":
      case "/remove":
        await handleRevoke(botToken, system.id, chatId, userId, args, replyToMessage);
        break;

      case "/addadmin":
        await handleAdminToggle(botToken, system.id, chatId, userId, true, replyToMessage);
        break;

      case "/removeadmin":
        await handleAdminToggle(botToken, system.id, chatId, userId, false, replyToMessage);
        break;

      case "/channels": {
        const channels = await getChannels(system.id);
        if (channels.length === 0) {
          await sendMessage(botToken, chatId, "No channels configured.");
        } else {
          await sendMessage(botToken, chatId,
            `📢 <b>Configured channels:</b>\n${channels.map(c => `• @${c}`).join("\n")}`
          );
        }
        break;
      }

      case "/allposts":
        await handleAllPosts(botToken, system.id, chatId, userId);
        break;

      case "/stopall":
        await handleStopAll(botToken, system.id, chatId, userId);
        break;

      default:
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
