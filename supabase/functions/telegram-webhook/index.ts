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

async function sendTelegramMessage(botToken: string, chatId: string | number, text: string, mediaFileId?: string | null, mediaType?: string | null) {
  let result: any;
  try {
    // If there's media, send it with caption
    if (mediaFileId && mediaType) {
      result = await sendMedia(botToken, chatId, mediaFileId, mediaType, text);
    } else {
      // Text-only message
      result = await sendTextMessage(botToken, chatId, text);
    }
  } catch (err) {
    console.error("sendTelegramMessage error:", err);
    // Ultimate fallback: plain text no formatting
    try {
      const plain = text.replace(/<[^>]*>/g, '');
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: plain }),
      });
      result = await res.json();
    } catch (e2) {
      console.error("Final fallback also failed:", e2);
      return { ok: false };
    }
  }

  // Queue bot's own sent message for auto-deletion if rules exist
  if (result?.ok && result?.result?.message_id) {
    try {
      await queueBotMessageForDeletion(botToken, chatId, result.result.message_id);
    } catch (e) {
      // Don't fail the send if auto-delete queueing fails
      console.error("Failed to queue bot message for deletion:", e);
    }
  }

  return result;
}

async function sendTextMessage(botToken: string, chatId: string | number, text: string) {
  // Try HTML first
  let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  let result = await res.json();
  if (result.ok) return result;

  // Fallback: plain text
  console.error("HTML send failed, retrying plain:", result.description);
  const plain = text.replace(/<[^>]*>/g, '');
  res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: plain }),
  });
  return await res.json();
}

async function sendMedia(botToken: string, chatId: string | number, fileId: string, mediaType: string, caption?: string) {
  const methodMap: Record<string, string> = {
    photo: "sendPhoto",
    video: "sendVideo",
    document: "sendDocument",
    audio: "sendAudio",
    voice: "sendVoice",
    video_note: "sendVideoNote",
    animation: "sendAnimation",
    sticker: "sendSticker",
  };

  const method = methodMap[mediaType] || "sendDocument";
  const fieldMap: Record<string, string> = {
    photo: "photo",
    video: "video",
    document: "document",
    audio: "audio",
    voice: "voice",
    video_note: "video_note",
    animation: "animation",
    sticker: "sticker",
  };
  const field = fieldMap[mediaType] || "document";

  const body: any = { chat_id: chatId, [field]: fileId };
  
  // Add caption if available (stickers and video_notes don't support captions)
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

  // If HTML caption failed, retry without parse_mode
  if (!result.ok && caption && body.parse_mode) {
    console.error(`Media HTML caption failed: ${result.description}, retrying plain`);
    body.caption = caption.replace(/<[^>]*>/g, '');
    delete body.parse_mode;
    res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    result = await res.json();
  }

  if (!result.ok) console.error(`sendMedia ${method} failed:`, result.description);
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

async function getEnabledAutoDeleteRules(systemId: string) {
  const { data } = await supabase
    .from("auto_delete_rules")
    .select("chat_id, delay")
    .eq("system_id", systemId)
    .eq("enabled", true);
  return data || [];
}

function normalizeChatKey(chatId: string): string {
  const trimmed = chatId.trim();
  return trimmed.startsWith("@") ? trimmed.slice(1).toLowerCase() : trimmed.toLowerCase();
}

function resolveAutoDeleteDelay(rules: Array<{ chat_id: string; delay: string }>, chatId: string): number | null {
  if (!rules || rules.length === 0) return null;

  const normalizedTarget = normalizeChatKey(chatId);

  const exact = rules.find((rule) => normalizeChatKey(rule.chat_id) === normalizedTarget);
  if (exact) return parseDelay(exact.delay);

  const wildcard = rules.find((rule) => {
    const key = normalizeChatKey(rule.chat_id);
    return key === "*" || key === "all";
  });
  if (wildcard) return parseDelay(wildcard.delay);

  // If only one rule exists, treat it as default for all messages sent by this system.
  if (rules.length === 1) {
    return parseDelay(rules[0].delay);
  }

  return null;
}

// ─── Telegram entities → HTML converter ───
// Simple, safe approach: sort entities, apply non-overlapping ones, skip conflicts.

function entitiesToHtml(text: string, entities: any[] | undefined): string {
  if (!entities || entities.length === 0) return escapeHtml(text);

  try {
    // Telegram uses UTF-16 offsets. Convert text to UTF-16 code units for correct indexing.
    // Build a mapping from UTF-16 offset to code point index.
    const codePoints = [...text];
    const utf16ToCp: number[] = []; // utf16ToCp[utf16offset] = codepoint index
    let utf16Pos = 0;
    for (let i = 0; i < codePoints.length; i++) {
      const cp = codePoints[i].codePointAt(0)!;
      utf16ToCp[utf16Pos] = i;
      utf16Pos++;
      if (cp > 0xFFFF) {
        // Surrogate pair: takes 2 UTF-16 units
        utf16ToCp[utf16Pos] = i;
        utf16Pos++;
      }
    }
    // Map the "end" position (one past last char)
    utf16ToCp[utf16Pos] = codePoints.length;

    const totalUtf16 = utf16Pos;

    // Convert entity offsets from UTF-16 to code point indices
    const sorted = [...entities].sort((a, b) => a.offset - b.offset || b.length - a.length);

    const inserts: { pos: number; order: number; tag: string }[] = [];
    let entityIdx = 0;

    for (const e of sorted) {
      const tag = getTag(e);
      if (!tag) continue;
      const startUtf16 = e.offset;
      const endUtf16 = Math.min(e.offset + e.length, totalUtf16);
      const start = utf16ToCp[startUtf16] ?? codePoints.length;
      const end = utf16ToCp[endUtf16] ?? codePoints.length;
      inserts.push({ pos: start, order: entityIdx, tag: tag.open });
      inserts.push({ pos: end, order: -entityIdx, tag: tag.close });
      entityIdx++;
    }

    inserts.sort((a, b) => {
      if (a.pos !== b.pos) return a.pos - b.pos;
      return a.order - b.order;
    });

    let result = '';
    let insertIdx = 0;

    for (let i = 0; i <= codePoints.length; i++) {
      while (insertIdx < inserts.length && inserts[insertIdx].pos === i) {
        result += inserts[insertIdx].tag;
        insertIdx++;
      }
      if (i < codePoints.length) {
        result += escapeHtml(codePoints[i]);
      }
    }

    return result;
  } catch (err) {
    console.error("entitiesToHtml error, falling back to plain:", err);
    return escapeHtml(text);
  }
}

function getTag(e: any): { open: string; close: string } | null {
  switch (e.type) {
    case 'bold':            return { open: '<b>', close: '</b>' };
    case 'italic':          return { open: '<i>', close: '</i>' };
    case 'underline':       return { open: '<u>', close: '</u>' };
    case 'strikethrough':   return { open: '<s>', close: '</s>' };
    case 'spoiler':         return { open: '<tg-spoiler>', close: '</tg-spoiler>' };
    case 'code':            return { open: '<code>', close: '</code>' };
    case 'pre':             return { open: e.language ? `<pre><code class="language-${escapeHtml(e.language)}">` : '<pre>', close: e.language ? '</code></pre>' : '</pre>' };
    case 'text_link':       return { open: `<a href="${escapeHtml(e.url || '')}">`, close: '</a>' };
    case 'text_mention':    return { open: `<a href="tg://user?id=${e.user?.id || ''}">`, close: '</a>' };
    case 'blockquote':      return { open: '<blockquote>', close: '</blockquote>' };
    default: return null;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Media extractor ───

function extractMedia(msg: any): { fileId: string; type: string } | null {
  if (msg.photo && msg.photo.length > 0) {
    return { fileId: msg.photo[msg.photo.length - 1].file_id, type: "photo" };
  }
  if (msg.video) return { fileId: msg.video.file_id, type: "video" };
  if (msg.document) return { fileId: msg.document.file_id, type: "document" };
  if (msg.audio) return { fileId: msg.audio.file_id, type: "audio" };
  if (msg.voice) return { fileId: msg.voice.file_id, type: "voice" };
  if (msg.video_note) return { fileId: msg.video_note.file_id, type: "video_note" };
  if (msg.animation) return { fileId: msg.animation.file_id, type: "animation" };
  if (msg.sticker) return { fileId: msg.sticker.file_id, type: "sticker" };
  return null;
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
    "1m": 60000, "5m": 300000, "15m": 900000, "30m": 1800000,
    "1h": 3600000, "2h": 7200000, "3h": 10800000, "4h": 14400000,
    "6h": 21600000, "12h": 43200000, "24h": 86400000,
  };
  return map[delay] || 300000;
}

async function queueDeletion(botToken: string, chatId: string, messageId: number, delayMs: number) {
  const deleteAt = new Date(Date.now() + delayMs).toISOString();

  const { error } = await supabase.from("pending_deletions").insert({
    bot_token: botToken,
    chat_id: chatId,
    message_id: messageId,
    delete_at: deleteAt,
  });

  if (error) {
    console.error("Failed to queue auto-delete:", error);
  }
}

// ─── Auto-delete ───

async function handleAutoDelete(botToken: string, systemId: string, chatId: number, messageId: number) {
  try {
    const rules = await getEnabledAutoDeleteRules(systemId);
    const delayMs = resolveAutoDeleteDelay(rules, chatId.toString());
    if (!delayMs) return;

    await queueDeletion(botToken, chatId.toString(), messageId, delayMs);
  } catch (err) {
    console.error("handleAutoDelete error:", err);
  }
}

// Queue a message sent BY the bot for auto-deletion
async function queueBotMessageForDeletion(botToken: string, chatId: string | number, messageId: number) {
  const system = await getSystemByToken(botToken);
  if (!system) return;

  const rules = await getEnabledAutoDeleteRules(system.id);
  const normalizedChatId = chatId.toString();
  const delayMs = resolveAutoDeleteDelay(rules, normalizedChatId);
  if (!delayMs) return;

  await queueDeletion(botToken, normalizedChatId, messageId, delayMs);
}

// ─── Command: /start ───

async function handleStart(botToken: string, systemLabel: string, chatId: number, userId: number, systemId: string) {
  const admin = await isAdmin(systemId, userId);

  let text = `👋 <b>Welcome to ${escapeHtml(systemLabel)}!</b>\n\n`;
  text += `📋 <b>User Commands:</b>\n`;
  text += `/start - Show this message\n`;
  text += `/id - Get chat/user ID\n`;
  text += `/post every(1h) time(3) - Schedule post to all channels\n`;
  text += `/post every(1h) time(3) @ch1 @ch2 - Post to specific channels\n`;
  text += `/myposts - View your scheduled posts\n`;
  text += `/stop &lt;post_id&gt; - Cancel a scheduled post\n`;
  text += `/channels - List all channels\n`;
  text += `/myaccess - Show channels you can post to\n`;
  text += `/help - Show this message\n`;
  text += `\n💡 <b>Supports:</b> Text, photos, videos, documents, audio, voice, GIFs with formatting (bold, italic, links, etc.)`;

  if (admin) {
    text += `\n\n🔑 <b>Admin Commands:</b>\n`;
    text += `/access @ch1 @ch2 - Grant channel access (reply to user)\n`;
    text += `/remove @ch1 - Remove channel access (reply to user)\n`;
    text += `/addadmin - Make user admin (reply to user)\n`;
    text += `/removeadmin - Remove admin (reply to user)\n`;
    text += `/allposts - View all scheduled posts\n`;
    text += `/stopall - Cancel all scheduled posts\n`;
  }

  await sendTelegramMessage(botToken, chatId, text);
}

// ─── Command: /access (admin only) ───

async function handleAccess(botToken: string, systemId: string, chatId: number, userId: number, args: string[], replyToMessage: any) {
  const admin = await isAdmin(systemId, userId);
  if (!admin) {
    await sendTelegramMessage(botToken, chatId, "❌ Only admins can grant access.");
    return;
  }

  if (!replyToMessage || !replyToMessage.from) {
    await sendTelegramMessage(botToken, chatId, "❌ Reply to a user's message with /access @channel1 @channel2");
    return;
  }

  if (args.length === 0) {
    await sendTelegramMessage(botToken, chatId, "❌ Specify channels: /access @channel1 @channel2");
    return;
  }

  const targetUserId = replyToMessage.from.id.toString();
  const targetName = replyToMessage.from.first_name || targetUserId;
  const channels = args.map(a => a.replace(/^@/, "").toUpperCase());

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

  const userExists = await isUserAllowed(systemId, parseInt(targetUserId));
  if (!userExists) {
    await supabase.from("allowed_users").insert({
      system_id: systemId,
      telegram_user_id: targetUserId,
      is_admin: false,
    });
  }

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

  let msg = `✅ Granted <b>${escapeHtml(targetName)}</b> access to ${granted} channel(s): ${valid.map(c => `@${c}`).join(", ")}`;
  if (invalid.length > 0) {
    msg += `\n⚠️ Unknown channels: ${invalid.map(c => `@${c}`).join(", ")}`;
  }
  await sendTelegramMessage(botToken, chatId, msg);
}

// ─── Command: /revoke (admin only) ───

async function handleRevoke(botToken: string, systemId: string, chatId: number, userId: number, args: string[], replyToMessage: any) {
  const admin = await isAdmin(systemId, userId);
  if (!admin) {
    await sendTelegramMessage(botToken, chatId, "❌ Only admins can revoke access.");
    return;
  }

  if (!replyToMessage || !replyToMessage.from) {
    await sendTelegramMessage(botToken, chatId, "❌ Reply to a user's message with /revoke @channel1");
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

  await sendTelegramMessage(botToken, chatId, `✅ Revoked ${revoked} channel(s) from <b>${escapeHtml(targetName)}</b>.`);
}

// ─── Command: /addadmin & /removeadmin ───

async function handleAdminToggle(botToken: string, systemId: string, chatId: number, userId: number, makeAdmin: boolean, replyToMessage: any) {
  const admin = await isAdmin(systemId, userId);
  if (!admin) {
    await sendTelegramMessage(botToken, chatId, "❌ Only admins can do this.");
    return;
  }

  if (!replyToMessage || !replyToMessage.from) {
    await sendTelegramMessage(botToken, chatId, "❌ Reply to a user's message.");
    return;
  }

  const targetUserId = replyToMessage.from.id.toString();
  const targetName = replyToMessage.from.first_name || targetUserId;

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
  await sendTelegramMessage(botToken, chatId, `✅ <b>${escapeHtml(targetName)}</b> has been ${action}.`);
}

// ─── Command: /post every() time() [@channels...] ───

async function handlePost(botToken: string, systemId: string, chatId: number, userId: number, text: string, replyToMessage: any) {
  // Parse: /post every(5m) time(3) [@ch1 @ch2 ...]
  const everyMatch = text.match(/every\((\d+[mhd])\)/i);
  const timeMatch = text.match(/time\((\d+)\)/i);

  if (!everyMatch || !timeMatch) {
    await sendTelegramMessage(botToken, chatId,
      "📝 <b>Usage:</b> Reply to a message with:\n<code>/post every(5m) time(3)</code>\n<code>/post every(1h) time(5) @channel1 @channel2</code>\n\nDurations: 1m-60m, 1h-24h, 1d\nTimes: how many times to post\nChannels: optional, defaults to all your channels");
    return;
  }

  if (!replyToMessage) {
    await sendTelegramMessage(botToken, chatId, "❌ Reply to a message to schedule it for posting.");
    return;
  }

  const intervalSeconds = parseDuration(everyMatch[1]);
  if (!intervalSeconds) {
    await sendTelegramMessage(botToken, chatId, "❌ Invalid duration. Use: 1m-60m, 1h-24h, 1d");
    return;
  }

  const totalTimes = parseInt(timeMatch[1]);
  if (totalTimes < 1 || totalTimes > 100) {
    await sendTelegramMessage(botToken, chatId, "❌ Times must be between 1 and 100.");
    return;
  }

  // Parse specific channel targets from the command text
  // Extract @channel mentions that are NOT part of every() or time()
  const channelMatches = text.match(/@(\w+)/g);
  const specifiedChannels: string[] = [];
  if (channelMatches) {
    for (const m of channelMatches) {
      const name = m.slice(1); // remove @
      // Skip if it looks like a bot username in the command itself (e.g. /post@botname)
      if (text.indexOf(`/${name}`) >= 0) continue;
      specifiedChannels.push(name.toUpperCase());
    }
  }

  // Get user's accessible channels
  const adminStatus = await isAdmin(systemId, userId);
  let accessibleChannels: string[];
  if (adminStatus) {
    accessibleChannels = await getChannels(systemId);
  } else {
    accessibleChannels = await getUserChannelAccess(systemId, userId);
  }

  if (accessibleChannels.length === 0) {
    await sendTelegramMessage(botToken, chatId, "❌ You don't have access to any channels. Ask an admin to grant you access with /access.");
    return;
  }

  // Determine target channels
  let targetChannels: string[];
  if (specifiedChannels.length > 0) {
    // Validate specified channels against user's access
    const accessibleUpper = accessibleChannels.map(c => c.toUpperCase());
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const ch of specifiedChannels) {
      if (accessibleUpper.includes(ch)) {
        valid.push(ch);
      } else {
        invalid.push(ch);
      }
    }
    if (valid.length === 0) {
      await sendTelegramMessage(botToken, chatId,
        `❌ You don't have access to any of the specified channels: ${specifiedChannels.map(c => `@${c}`).join(", ")}\n\nUse /myaccess to see your channels.`);
      return;
    }
    if (invalid.length > 0) {
      await sendTelegramMessage(botToken, chatId,
        `⚠️ Skipping channels you don't have access to: ${invalid.map(c => `@${c}`).join(", ")}`);
    }
    targetChannels = valid;
  } else {
    targetChannels = accessibleChannels.map(c => c.toUpperCase());
  }

  // Extract text/caption and entities from replied message
  const rawText = replyToMessage.text || replyToMessage.caption || "";
  const entities = replyToMessage.entities || replyToMessage.caption_entities;
  const messageHtml = rawText ? entitiesToHtml(rawText, entities) : "";

  // Extract media from replied message
  const media = extractMedia(replyToMessage);

  if (!rawText && !media) {
    await sendTelegramMessage(botToken, chatId, "❌ The replied message has no text or media content.");
    return;
  }

  // Save scheduled post
  const { data, error } = await supabase.from("scheduled_posts").insert({
    system_id: systemId,
    chat_id: chatId.toString(),
    message_text: messageHtml,
    telegram_user_id: userId.toString(),
    interval_seconds: intervalSeconds,
    total_times: totalTimes,
    times_sent: 0,
    next_run_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    active: true,
    media_file_id: media?.fileId || null,
    media_type: media?.type || null,
    target_channels: targetChannels,
  }).select().single();

  if (error) {
    console.error("Error creating scheduled post:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Failed to schedule post.");
    return;
  }

  const chList = targetChannels.map(c => `@${c}`).join(", ");
  const contentDesc = media ? `📎 ${media.type}${messageHtml ? " + text" : ""}` : `📝 text`;
  await sendTelegramMessage(botToken, chatId,
    `✅ <b>Post Scheduled!</b>\n\n${contentDesc}\n📢 Channels: ${chList}\n⏱ Every ${everyMatch[1]}, ${totalTimes} time(s)\n⏳ First post in ~3 minutes\n🆔 Post ID: <code>${data.id.substring(0, 8)}</code>`
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
    await sendTelegramMessage(botToken, chatId, "📭 No active scheduled posts.");
    return;
  }

  let text = "📋 <b>Your Scheduled Posts:</b>\n\n";
  for (const p of data) {
    const hasMedia = p.media_type ? `📎 ${p.media_type}` : "📝 text";
    const channels = p.target_channels ? (p.target_channels as string[]).map((c: string) => `@${c}`).join(", ") : "all";
    text += `🆔 <code>${p.id.substring(0, 8)}</code> ${hasMedia}\n`;
    text += `📢 ${channels}\n`;
    text += `📊 ${p.times_sent}/${p.total_times} sent\n`;
    text += `⏱ Every ${p.interval_seconds >= 3600 ? `${p.interval_seconds / 3600}h` : `${p.interval_seconds / 60}m`}\n\n`;
  }
  text += "Use /stop &lt;post_id&gt; to cancel.";
  await sendTelegramMessage(botToken, chatId, text);
}

// ─── Command: /stop ───

async function handleStop(botToken: string, systemId: string, chatId: number, userId: number, args: string[]) {
  if (args.length === 0) {
    await sendTelegramMessage(botToken, chatId, "Usage: /stop &lt;post_id&gt;");
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
    await sendTelegramMessage(botToken, chatId, "❌ Post not found or not yours.");
    return;
  }

  await supabase.from("scheduled_posts").update({ active: false }).eq("id", post.id);
  await sendTelegramMessage(botToken, chatId, `✅ Post <code>${post.id.substring(0, 8)}</code> cancelled.`);
}

// ─── Command: /myaccess ───

async function handleMyAccess(botToken: string, systemId: string, chatId: number, userId: number) {
  const admin = await isAdmin(systemId, userId);
  if (admin) {
    const channels = await getChannels(systemId);
    await sendTelegramMessage(botToken, chatId, `🔑 You're an <b>admin</b>. You can post to all channels:\n${channels.map(c => `• @${c}`).join("\n") || "No channels configured."}`);
    return;
  }

  const channels = await getUserChannelAccess(systemId, userId);
  if (channels.length === 0) {
    await sendTelegramMessage(botToken, chatId, "❌ You don't have access to any channels. Ask an admin.");
    return;
  }

  await sendTelegramMessage(botToken, chatId, `📢 <b>Your channel access:</b>\n${channels.map(c => `• @${c}`).join("\n")}`);
}

// ─── Command: /allposts (admin) ───

async function handleAllPosts(botToken: string, systemId: string, chatId: number, userId: number) {
  const admin = await isAdmin(systemId, userId);
  if (!admin) {
    await sendTelegramMessage(botToken, chatId, "❌ Only admins can view all posts.");
    return;
  }

  const { data } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("system_id", systemId)
    .eq("active", true);

  if (!data || data.length === 0) {
    await sendTelegramMessage(botToken, chatId, "📭 No active scheduled posts.");
    return;
  }

  let text = "📋 <b>All Scheduled Posts:</b>\n\n";
  for (const p of data) {
    const hasMedia = p.media_type ? `📎 ${p.media_type}` : "📝 text";
    text += `🆔 <code>${p.id.substring(0, 8)}</code> by user ${p.telegram_user_id} ${hasMedia}\n`;
    text += `📊 ${p.times_sent}/${p.total_times} sent\n\n`;
  }
  await sendTelegramMessage(botToken, chatId, text);
}

// ─── Command: /stopall (admin) ───

async function handleStopAll(botToken: string, systemId: string, chatId: number, userId: number) {
  const admin = await isAdmin(systemId, userId);
  if (!admin) {
    await sendTelegramMessage(botToken, chatId, "❌ Only admins can stop all posts.");
    return;
  }

  const { data } = await supabase
    .from("scheduled_posts")
    .update({ active: false })
    .eq("system_id", systemId)
    .eq("active", true)
    .select();

  await sendTelegramMessage(botToken, chatId, `✅ Cancelled ${data?.length || 0} scheduled post(s).`);
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
    const text = message.text || message.caption || "";
    const messageId = message.message_id;
    const replyToMessage = message.reply_to_message;

    if (!userId) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Access control
    const { data: allUsers } = await supabase
      .from("allowed_users")
      .select("id")
      .eq("system_id", system.id);

    const hasAccessControl = allUsers && allUsers.length > 0;

    if (hasAccessControl) {
      const userAllowed = await isUserAllowed(system.id, userId);
      const chatAllowed = await isChatAllowed(system.id, chatId);
      console.log(`Access check: user=${userId}, userAllowed=${userAllowed}, chatAllowed=${chatAllowed}, system=${system.id}`);
      if (!userAllowed && !chatAllowed) {
        await sendTelegramMessage(botToken, chatId, "❌ You are not authorized to use this bot. Ask a main admin to add you.");
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const admin = await isAdmin(system.id, userId);
    const adminCommands = new Set(["/access", "/remove", "/revoke", "/addadmin", "/removeadmin", "/allposts", "/stopall", "/channels", "/myaccess"]);
    const userAllowedCommands = new Set(["/start", "/help", "/id", "/post", "/stop", "/myposts"]);

    if (!admin && adminCommands.has(command)) {
      await sendTelegramMessage(botToken, chatId, "❌ Only main admins can use this command.");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!admin && !userAllowedCommands.has(command)) {
      await sendTelegramMessage(botToken, chatId, "❌ You can use only /post, /stop and your own post commands.");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Command: ${command} from user ${userId} in chat ${chatId}`);

    switch (command) {
      case "/start":
      case "/help":
        await handleStart(botToken, system.label, chatId, userId, system.id);
        break;

      case "/id":
        await sendTelegramMessage(botToken, chatId,
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
          await sendTelegramMessage(botToken, chatId, "No channels configured.");
        } else {
          await sendTelegramMessage(botToken, chatId,
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
