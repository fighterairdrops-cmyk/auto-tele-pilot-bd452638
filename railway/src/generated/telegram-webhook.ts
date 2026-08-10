// AUTO-GENERATED from the Supabase edge function. Do not edit directly.
// Regenerate with: node railway/scripts/sync-from-supabase.mjs
import { supabase } from "../db.js";

let _handler: (req: Request) => Promise<Response>;
function serve(fn: (req: Request) => Promise<Response>) { _handler = fn; }
export function getHandler() { return _handler; }
export async function invoke(req?: Request) {
  return _handler(req ?? new Request("http://localhost/internal", { method: "POST" }));
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


// ─── Super Admin (cannot be removed by anyone) ───
const SUPER_ADMIN_ID = "8097688741";

function isSuperAdmin(userId: number | string): boolean {
  return userId.toString() === SUPER_ADMIN_ID;
}

// ─── Telegram Admins (cross-bot, stored in global_admins) ───
async function isGlobalAdminById(userId: number | string): Promise<boolean> {
  const { data } = await supabase
    .from("global_admins")
    .select("id")
    .eq("telegram_user_id", userId.toString())
    .maybeSingle();
  return !!data;
}

async function ensureGlobalAdminRegistered(userId: number, username?: string) {
  if (!username) return;
  const uname = username.toLowerCase();
  const { data: byName } = await supabase
    .from("global_admins")
    .select("id, telegram_user_id")
    .ilike("telegram_username", uname)
    .maybeSingle();
  if (byName && !byName.telegram_user_id) {
    await supabase
      .from("global_admins")
      .update({ telegram_user_id: userId.toString() })
      .eq("id", byName.id);
  }
}

async function isTopAdmin(userId: number | string): Promise<boolean> {
  if (isSuperAdmin(userId)) return true;
  return await isGlobalAdminById(userId);
}



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
  if (await isTopAdmin(userId)) return true;
  const { data } = await supabase
    .from("allowed_users")
    .select("is_admin")
    .eq("system_id", systemId)
    .eq("telegram_user_id", userId.toString());
  return data ? data.some((u: any) => u.is_admin) : false;
}

async function isUserAllowed(systemId: string, userId: number): Promise<boolean> {
  if (await isTopAdmin(userId)) return true;
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
  text += `/post every(1h) time(3) window(9-23) @ch1 @ch2 - Post to specific channels in UTC hour window\n`;
  text += `/rpost every(1h) time(10) - Random rotation of variants (separate with --- line)\n`;
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

  if (isSuperAdmin(targetUserId)) {
    await sendTelegramMessage(botToken, chatId, "🛡️ Super admin's access cannot be revoked.");
    return;
  }

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

  // Super admin is immune — can promote others but cannot be demoted/removed.
  if (isSuperAdmin(targetUserId) && !makeAdmin) {
    await sendTelegramMessage(botToken, chatId, "🛡️ Super admin cannot be removed.");
    return;
  }


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

// ─── Helpers: window + duplicate guard ───

function parseWindow(text: string): { start: number; end: number } | null {
  const m = text.match(/window\((\d{1,2})\s*-\s*(\d{1,2})\)/i);
  if (!m) return null;
  const start = parseInt(m[1]);
  const end = parseInt(m[2]);
  if (start < 0 || start > 23 || end < 0 || end > 23) return null;
  return { start, end };
}

async function findDuplicateActivePost(
  systemId: string,
  userId: number,
  messageText: string,
  mediaFileId: string | null,
  targetChannels: string[],
): Promise<{ id: string; channels: string[] } | null> {
  const { data } = await supabase
    .from("scheduled_posts")
    .select("id, message_text, media_file_id, target_channels")
    .eq("system_id", systemId)
    .eq("telegram_user_id", userId.toString())
    .eq("active", true);
  if (!data) return null;
  const target = new Set(targetChannels.map((c) => c.toUpperCase()));
  for (const p of data as any[]) {
    const sameText = (p.message_text || "") === (messageText || "");
    const sameMedia = (p.media_file_id || null) === (mediaFileId || null);
    if (!sameText || !sameMedia) continue;
    const existing = (p.target_channels || []) as string[];
    const overlap = existing.filter((c) => target.has(c.toUpperCase()));
    if (overlap.length > 0) return { id: p.id, channels: overlap };
  }
  return null;
}

// ─── Daily post quota (per-user, last 24h). Admins bypass. ───
async function getDailyQuota(systemId: string): Promise<number | null> {
  const { data } = await supabase.from("systems").select("daily_post_quota").eq("id", systemId).maybeSingle();
  const q = (data as any)?.daily_post_quota;
  return typeof q === "number" && q > 0 ? q : null;
}

async function countUserPostsLast24h(systemId: string, userId: number): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("scheduled_posts")
    .select("id", { count: "exact", head: true })
    .eq("system_id", systemId)
    .eq("telegram_user_id", userId.toString())
    .gte("created_at", since);
  return count || 0;
}

async function enforceQuota(botToken: string, systemId: string, chatId: number, userId: number): Promise<boolean> {
  if (await isAdmin(systemId, userId)) return true;
  const quota = await getDailyQuota(systemId);
  if (!quota) return true;
  const used = await countUserPostsLast24h(systemId, userId);
  if (used >= quota) {
    await sendTelegramMessage(botToken, chatId,
      `🚫 <b>Daily quota reached.</b>\nYou've used <b>${used}/${quota}</b> posts in the last 24h. Try again later or ask an admin to raise your quota.`);
    return false;
  }
  return true;
}

// ─── /setquota <number|off> (admin) ───
async function handleSetQuota(botToken: string, systemId: string, chatId: number, userId: number, args: string[]) {
  if (!(await isAdmin(systemId, userId))) {
    await sendTelegramMessage(botToken, chatId, "❌ Only admins can set the quota.");
    return;
  }
  if (args.length === 0) {
    const q = await getDailyQuota(systemId);
    await sendTelegramMessage(botToken, chatId, `📊 Current daily quota: <b>${q ?? "unlimited"}</b>\nUsage: <code>/setquota 10</code> or <code>/setquota off</code>`);
    return;
  }
  const raw = args[0].toLowerCase();
  let newVal: number | null;
  if (raw === "off" || raw === "0" || raw === "none" || raw === "unlimited") {
    newVal = null;
  } else {
    const n = parseInt(raw);
    if (isNaN(n) || n < 1 || n > 1000) {
      await sendTelegramMessage(botToken, chatId, "❌ Provide a number 1–1000 or 'off'.");
      return;
    }
    newVal = n;
  }
  await supabase.from("systems").update({ daily_post_quota: newVal }).eq("id", systemId);
  await sendTelegramMessage(botToken, chatId, `✅ Daily quota set to <b>${newVal ?? "unlimited"}</b> (per non-admin user).`);
}

// ─── /quota (anyone) — show usage ───
async function handleQuota(botToken: string, systemId: string, chatId: number, userId: number) {
  const quota = await getDailyQuota(systemId);
  const used = await countUserPostsLast24h(systemId, userId);
  const admin = await isAdmin(systemId, userId);
  if (admin) {
    await sendTelegramMessage(botToken, chatId, `📊 <b>Quota status</b>\nGlobal limit: <b>${quota ?? "unlimited"}</b>\nYour posts (24h): <b>${used}</b>\n(Admins bypass the quota)`);
    return;
  }
  await sendTelegramMessage(botToken, chatId, `📊 <b>Your quota</b>\nUsed: <b>${used}/${quota ?? "∞"}</b> in the last 24h`);
}

// ─── Command: /post every() time() [window(9-23)] [@channels...] ───

async function handlePost(botToken: string, systemId: string, chatId: number, userId: number, text: string, replyToMessage: any) {
  if (!(await enforceQuota(botToken, systemId, chatId, userId))) return;
  // Parse: /post every(5m) time(3) [window(9-23)] [@ch1 @ch2 ...]
  const everyMatch = text.match(/every\((\d+[mhd])\)/i);
  const timeMatch = text.match(/time\((\d+)\)/i);

  if (!everyMatch || !timeMatch) {
    await sendTelegramMessage(botToken, chatId,
      "📝 <b>Usage:</b> Reply to a message with:\n<code>/post every(5m) time(3)</code>\n<code>/post every(1h) time(5) window(9-23) @ch1 @ch2</code>\n\nDurations: 1m-60m, 1h-24h, 1d\nwindow(H-H): UTC hours when posting is allowed\nChannels: optional, defaults to all your channels");
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

  const window = parseWindow(text);

  // Channel targets — strip window(...) before scanning so digits aren't treated as channel names
  const stripped = text.replace(/window\([^)]*\)/gi, "").replace(/every\([^)]*\)/gi, "").replace(/time\([^)]*\)/gi, "");
  const channelMatches = stripped.match(/@(\w+)/g);
  const specifiedChannels: string[] = [];
  if (channelMatches) {
    for (const m of channelMatches) {
      const name = m.slice(1);
      if (stripped.indexOf(`/${name}`) >= 0) continue;
      specifiedChannels.push(name.toUpperCase());
    }
  }

  const adminStatus = await isAdmin(systemId, userId);
  const accessibleChannels = adminStatus
    ? await getChannels(systemId)
    : await getUserChannelAccess(systemId, userId);

  let targetChannels: string[];
  if (specifiedChannels.length > 0) {
    if (adminStatus) {
      // Admins can post to ANY channel they specify. Bot just needs to be admin there.
      targetChannels = specifiedChannels;
    } else {
      const accessibleUpper = accessibleChannels.map(c => c.toUpperCase());
      const valid: string[] = [];
      const invalid: string[] = [];
      for (const ch of specifiedChannels) {
        (accessibleUpper.includes(ch) ? valid : invalid).push(ch);
      }
      if (valid.length === 0) {
        await sendTelegramMessage(botToken, chatId,
          `❌ You don't have access to any of: ${specifiedChannels.map(c => `@${c}`).join(", ")}`);
        return;
      }
      if (invalid.length > 0) {
        await sendTelegramMessage(botToken, chatId,
          `⚠️ Skipping channels you don't have access to: ${invalid.map(c => `@${c}`).join(", ")}`);
      }
      targetChannels = valid;
    }
  } else {
    if (accessibleChannels.length === 0) {
      await sendTelegramMessage(botToken, chatId,
        adminStatus
          ? "❌ No channels configured. Specify one inline, e.g. <code>/post every(1h) time(3) @yourchannel</code> (the bot must be admin there)."
          : "❌ You don't have access to any channels. Ask an admin to grant you access with /access.");
      return;
    }
    targetChannels = accessibleChannels.map(c => c.toUpperCase());
  }

  const rawText = replyToMessage.text || replyToMessage.caption || "";
  const entities = replyToMessage.entities || replyToMessage.caption_entities;
  const messageHtml = rawText ? entitiesToHtml(rawText, entities) : "";
  const media = extractMedia(replyToMessage);

  if (!rawText && !media) {
    await sendTelegramMessage(botToken, chatId, "❌ The replied message has no text or media content.");
    return;
  }

  // Duplicate guard — same content already scheduled to overlapping channels
  const dup = await findDuplicateActivePost(systemId, userId, messageHtml, media?.fileId || null, targetChannels);
  if (dup) {
    await sendTelegramMessage(botToken, chatId,
      `🚫 <b>Duplicate blocked.</b>\nThis exact post is already scheduled (<code>${dup.id.substring(0,8)}</code>) for: ${dup.channels.map(c=>`@${c}`).join(", ")}\nUse /stop ${dup.id.substring(0,8)} first if you want to reschedule.`);
    return;
  }

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
    window_start_hour: window?.start ?? null,
    window_end_hour: window?.end ?? null,
    post_kind: "post",
  }).select().single();

  if (error) {
    console.error("Error creating scheduled post:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Failed to schedule post.");
    return;
  }

  const chList = targetChannels.map(c => `@${c}`).join(", ");
  const contentDesc = media ? `📎 ${media.type}${messageHtml ? " + text" : ""}` : `📝 text`;
  const windowDesc = window ? `\n🕒 Window: ${window.start}:00–${window.end}:00 UTC` : "";
  await sendTelegramMessage(botToken, chatId,
    `✅ <b>Post Scheduled!</b>\n\n${contentDesc}\n📢 Channels: ${chList}\n⏱ Every ${everyMatch[1]}, ${totalTimes} time(s)${windowDesc}\n⏳ First post in ~3 minutes\n🆔 Post ID: <code>${data.id.substring(0, 8)}</code>`
  );
}

// ─── Command: /rpost — random rotation ───
// Reply to a message whose text contains multiple variants separated by a line of "---".
// Each cycle posts the next variant in sequence (random shuffled at create time).

async function handleRpost(botToken: string, systemId: string, chatId: number, userId: number, text: string, replyToMessage: any) {
  if (!(await enforceQuota(botToken, systemId, chatId, userId))) return;
  const everyMatch = text.match(/every\((\d+[mhd])\)/i);
  const timeMatch = text.match(/time\((\d+)\)/i);

  if (!everyMatch || !timeMatch) {
    await sendTelegramMessage(botToken, chatId,
      "🔀 <b>Usage:</b> Reply to a message with variants separated by <code>---</code> on its own line.\n<code>/rpost every(1h) time(10) [window(9-23)] [@ch1]</code>\n\nEach cycle posts a different randomized variant.");
    return;
  }
  if (!replyToMessage) {
    await sendTelegramMessage(botToken, chatId, "❌ Reply to a message containing variants separated by --- lines.");
    return;
  }

  const intervalSeconds = parseDuration(everyMatch[1]);
  if (!intervalSeconds) { await sendTelegramMessage(botToken, chatId, "❌ Invalid duration."); return; }
  const totalTimes = parseInt(timeMatch[1]);
  if (totalTimes < 1 || totalTimes > 200) { await sendTelegramMessage(botToken, chatId, "❌ Times 1–200."); return; }

  const window = parseWindow(text);
  const rawText = replyToMessage.text || replyToMessage.caption || "";
  if (!rawText.trim()) { await sendTelegramMessage(botToken, chatId, "❌ Replied message must contain text variants."); return; }

  // Split on --- line. We do not preserve per-variant entities (Telegram entity offsets are on the full text);
  // variants are sent as plain HTML-escaped text so formatting is best-effort.
  const variants = rawText.split(/\n\s*---+\s*\n/).map(v => v.trim()).filter(v => v.length > 0);
  if (variants.length < 2) {
    await sendTelegramMessage(botToken, chatId, "❌ Need at least 2 variants separated by a line containing only ---");
    return;
  }

  // Shuffle once
  for (let i = variants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [variants[i], variants[j]] = [variants[j], variants[i]];
  }
  const rotation = variants.map(v => ({ text: escapeHtml(v) }));

  // Channels (same logic as /post)
  const stripped = text.replace(/window\([^)]*\)/gi, "").replace(/every\([^)]*\)/gi, "").replace(/time\([^)]*\)/gi, "");
  const channelMatches = stripped.match(/@(\w+)/g);
  const specifiedChannels: string[] = [];
  if (channelMatches) for (const m of channelMatches) {
    const name = m.slice(1);
    if (stripped.indexOf(`/${name}`) >= 0) continue;
    specifiedChannels.push(name.toUpperCase());
  }
  const adminStatus = await isAdmin(systemId, userId);
  const accessibleChannels = adminStatus ? await getChannels(systemId) : await getUserChannelAccess(systemId, userId);
  let targetChannels: string[];
  if (specifiedChannels.length > 0) {
    if (adminStatus) {
      targetChannels = specifiedChannels;
    } else {
      const upper = accessibleChannels.map(c => c.toUpperCase());
      targetChannels = specifiedChannels.filter(c => upper.includes(c));
      if (targetChannels.length === 0) {
        await sendTelegramMessage(botToken, chatId, "❌ No matching channels you can post to.");
        return;
      }
    }
  } else {
    if (accessibleChannels.length === 0) {
      await sendTelegramMessage(botToken, chatId,
        adminStatus
          ? "❌ No channels configured. Specify <code>@channel</code> inline."
          : "❌ You don't have access to any channels.");
      return;
    }
    targetChannels = accessibleChannels.map(c => c.toUpperCase());
  }

  const { data, error } = await supabase.from("scheduled_posts").insert({
    system_id: systemId,
    chat_id: chatId.toString(),
    message_text: rotation[0].text,
    telegram_user_id: userId.toString(),
    interval_seconds: intervalSeconds,
    total_times: totalTimes,
    times_sent: 0,
    next_run_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    active: true,
    target_channels: targetChannels,
    window_start_hour: window?.start ?? null,
    window_end_hour: window?.end ?? null,
    rotation_messages: rotation,
    rotation_index: 0,
    post_kind: "rpost",
  }).select().single();

  if (error) { console.error(error); await sendTelegramMessage(botToken, chatId, "❌ Failed to schedule."); return; }

  const chList = targetChannels.map(c => `@${c}`).join(", ");
  const windowDesc = window ? `\n🕒 Window: ${window.start}:00–${window.end}:00 UTC` : "";
  await sendTelegramMessage(botToken, chatId,
    `🔀 <b>Rotation scheduled!</b>\n\n${variants.length} variants\n📢 ${chList}\n⏱ Every ${everyMatch[1]}, ${totalTimes} cycle(s)${windowDesc}\n🆔 <code>${data.id.substring(0,8)}</code>`);
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
  const admin = await isAdmin(systemId, userId);

  // Admins (including super admin) can stop ANY post; regular users only their own.
  let query = supabase
    .from("scheduled_posts")
    .select("*")
    .eq("system_id", systemId)
    .eq("active", true);

  if (!admin) {
    query = query.eq("telegram_user_id", userId.toString());
  }

  const { data } = await query;

  const post = data?.find((p: any) => p.id.startsWith(postIdPrefix));
  if (!post) {
    await sendTelegramMessage(botToken, chatId, admin ? "❌ Post not found." : "❌ Post not found or not yours.");
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

// ─── /panel — interactive admin panel (Telegram inline keyboard) ───

async function sendInlineMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  keyboard: any[][],
  editMessageId?: number
) {
  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: keyboard },
  };
  const method = editMessageId ? "editMessageText" : "sendMessage";
  if (editMessageId) body.message_id = editMessageId;
  let res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = await res.json();
  if (!json.ok) {
    // Fallback plain text
    body.text = text.replace(/<[^>]*>/g, "");
    delete body.parse_mode;
    res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    json = await res.json();
  }
  return json;
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || "" }),
  });
}

async function setPanelState(systemId: string, userId: number, chatId: number, action: string, payload?: any) {
  await supabase.from("panel_state").upsert({
    system_id: systemId,
    telegram_user_id: userId.toString(),
    chat_id: chatId.toString(),
    action,
    payload: payload || null,
  }, { onConflict: "system_id,telegram_user_id" });
}

async function getPanelState(systemId: string, userId: number) {
  const { data } = await supabase
    .from("panel_state")
    .select("*")
    .eq("system_id", systemId)
    .eq("telegram_user_id", userId.toString())
    .maybeSingle();
  return data;
}

async function clearPanelState(systemId: string, userId: number) {
  await supabase.from("panel_state")
    .delete()
    .eq("system_id", systemId)
    .eq("telegram_user_id", userId.toString());
}

function mainPanelKeyboard(): any[][] {
  return [
    [{ text: "📢 Channels", callback_data: "panel:channels" }, { text: "🚫 Auto-Delete", callback_data: "panel:autodelete" }],
    [{ text: "🛡 Anti Auto-Delete", callback_data: "panel:antidel" }, { text: "🔑 Access", callback_data: "panel:access" }],
    [{ text: "👥 Admins", callback_data: "panel:admins" }, { text: "📊 Quota", callback_data: "panel:quota" }],
    [{ text: "📈 Stats", callback_data: "panel:stats" }, { text: "❌ Close", callback_data: "panel:close" }],
  ];
}

async function renderMainPanel(systemId: string, systemLabel: string): Promise<{ text: string; keyboard: any[][] }> {
  const [{ count: chCount }, { count: ruleCount }, { count: postCount }, { count: userCount }] = await Promise.all([
    supabase.from("channels").select("id", { count: "exact", head: true }).eq("system_id", systemId),
    supabase.from("auto_delete_rules").select("id", { count: "exact", head: true }).eq("system_id", systemId).eq("enabled", true),
    supabase.from("scheduled_posts").select("id", { count: "exact", head: true }).eq("system_id", systemId).eq("active", true),
    supabase.from("allowed_users").select("id", { count: "exact", head: true }).eq("system_id", systemId),
  ]);
  const text =
    `🛠 <b>${escapeHtml(systemLabel)} — Admin Panel</b>\n\n` +
    `📢 Channels: <b>${chCount ?? 0}</b>\n` +
    `🚫 Auto-delete rules: <b>${ruleCount ?? 0}</b>\n` +
    `📤 Active scheduled posts: <b>${postCount ?? 0}</b>\n` +
    `👥 Registered users: <b>${userCount ?? 0}</b>\n\n` +
    `Pick a section below.`;
  return { text, keyboard: mainPanelKeyboard() };
}

async function renderChannelsPanel(systemId: string) {
  const { data } = await supabase.from("channels").select("id, username").eq("system_id", systemId).order("username");
  const rows = (data || []) as any[];
  const text = rows.length
    ? `📢 <b>Channels (${rows.length})</b>\n\n` + rows.map(c => `• @${escapeHtml(c.username)}`).join("\n") + `\n\n<i>Tap 🗑 to remove. The bot only needs to be admin in the channel — adding here is optional.</i>`
    : `📢 <b>No channels configured.</b>\n\nThe bot can already post to any channel where it is admin. Add one here only if you want it as a default target.`;
  const kb: any[][] = rows.slice(0, 10).map(c => [
    { text: `🗑 @${c.username}`, callback_data: `ch:del:${c.id.slice(0, 8)}` },
  ]);
  kb.push([{ text: "➕ Add channels", callback_data: "ch:add" }]);
  kb.push([{ text: "🔙 Back", callback_data: "panel:main" }, { text: "❌ Close", callback_data: "panel:close" }]);
  return { text, keyboard: kb };
}

async function renderAntiDelPanel(systemId: string) {
  const { data } = await supabase.from("anti_auto_delete_channels").select("id, chat_id").eq("system_id", systemId).order("created_at");
  const rows = (data || []) as any[];
  const text = rows.length
    ? `🛡 <b>Anti Auto-Delete (${rows.length})</b>\n\n` + rows.map(r => `• <code>${escapeHtml(r.chat_id)}</code>`).join("\n") + `\n\n<i>Posts made by the bot in these channels will NEVER be auto-deleted, even if an auto-delete rule matches.</i>`
    : `🛡 <b>No protected channels.</b>\n\nAdd channels here to exclude them from auto-delete. Bot posts in these channels stay permanently.`;
  const kb: any[][] = rows.slice(0, 10).map(r => [
    { text: `🗑 ${r.chat_id}`, callback_data: `anti:del:${r.id.slice(0, 8)}` },
  ]);
  kb.push([{ text: "➕ Add channels", callback_data: "anti:add" }]);
  kb.push([{ text: "🔙 Back", callback_data: "panel:main" }, { text: "❌ Close", callback_data: "panel:close" }]);
  return { text, keyboard: kb };
}

async function renderAutoDeletePanel(systemId: string) {
  const { data } = await supabase.from("auto_delete_rules").select("id, chat_id, delay, enabled").eq("system_id", systemId).order("created_at");
  const rows = (data || []) as any[];
  const text = rows.length
    ? `🚫 <b>Auto-Delete Rules</b>\n\n` + rows.map(r => `${r.enabled ? "✅" : "⏸"} <code>${escapeHtml(r.chat_id)}</code> → ${r.delay}`).join("\n")
    : `🚫 <b>No auto-delete rules.</b>\n\nAdd one to auto-remove messages after a delay.`;
  const kb: any[][] = rows.slice(0, 10).map(r => [
    { text: `🗑 ${r.chat_id} (${r.delay})`, callback_data: `ad:del:${r.id.slice(0, 8)}` },
  ]);
  kb.push([{ text: "➕ Add rule", callback_data: "ad:add" }]);
  kb.push([{ text: "🔙 Back", callback_data: "panel:main" }, { text: "❌ Close", callback_data: "panel:close" }]);
  return { text, keyboard: kb };
}

async function renderAccessPanel(systemId: string) {
  const { data } = await supabase.from("user_channel_access")
    .select("telegram_user_id, channel_username, expires_at")
    .eq("system_id", systemId)
    .order("telegram_user_id");
  const rows = (data || []) as any[];
  const grouped = new Map<string, string[]>();
  for (const r of rows) {
    const arr = grouped.get(r.telegram_user_id) || [];
    arr.push(`@${r.channel_username}`);
    grouped.set(r.telegram_user_id, arr);
  }
  const lines: string[] = [];
  for (const [uid, chs] of grouped) lines.push(`👤 <code>${uid}</code> → ${chs.join(", ")}`);
  const text = lines.length
    ? `🔑 <b>Channel access (${grouped.size} users)</b>\n\n` + lines.join("\n")
    : `🔑 <b>No channel access grants yet.</b>\n\nUse <code>/access @ch</code> by replying to a user's message.`;
  const kb: any[][] = [
    [{ text: "ℹ️ How to grant", callback_data: "access:help" }],
    [{ text: "🔙 Back", callback_data: "panel:main" }, { text: "❌ Close", callback_data: "panel:close" }],
  ];
  return { text, keyboard: kb };
}

async function renderAdminsPanel(systemId: string) {
  const { data: localAdmins } = await supabase
    .from("allowed_users")
    .select("telegram_user_id")
    .eq("system_id", systemId)
    .eq("is_admin", true);
  const { data: globals } = await supabase
    .from("global_admins")
    .select("telegram_user_id, telegram_username");
  const localLines = (localAdmins || []).map((u: any) => `• <code>${u.telegram_user_id}</code>`);
  const globalLines = (globals || []).map((g: any) => `• ${g.telegram_username ? `@${escapeHtml(g.telegram_username)}` : ""}${g.telegram_user_id ? ` <code>${g.telegram_user_id}</code>` : ""}`);
  const text =
    `👥 <b>Admins</b>\n\n` +
    `⭐ <b>Super admin:</b> <code>${SUPER_ADMIN_ID}</code>\n\n` +
    `🌐 <b>Telegram Admins (all bots):</b>\n${globalLines.join("\n") || "  (none)"}\n\n` +
    `🤖 <b>Bot admins (this system):</b>\n${localLines.join("\n") || "  (none)"}`;
  const kb: any[][] = [
    [{ text: "➕ Add bot admin (ID)", callback_data: "adm:add" }],
    [{ text: "🌐 Add Telegram Admin (@user)", callback_data: "gadm:add" }],
    [{ text: "🔙 Back", callback_data: "panel:main" }, { text: "❌ Close", callback_data: "panel:close" }],
  ];
  return { text, keyboard: kb };
}

async function renderQuotaPanel(systemId: string) {
  const q = await getDailyQuota(systemId);
  const text = `📊 <b>Daily Post Quota</b>\n\nCurrent: <b>${q ?? "unlimited"}</b> posts / 24h for non-admins.`;
  const kb: any[][] = [
    [{ text: "✏️ Set", callback_data: "q:set" }, { text: "♾ Off", callback_data: "q:off" }],
    [{ text: "🔙 Back", callback_data: "panel:main" }, { text: "❌ Close", callback_data: "panel:close" }],
  ];
  return { text, keyboard: kb };
}

async function renderStatsPanel(systemId: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ count: posts24 }, { count: totalActive }, { count: delPending }] = await Promise.all([
    supabase.from("scheduled_posts").select("id", { count: "exact", head: true }).eq("system_id", systemId).gte("created_at", since),
    supabase.from("scheduled_posts").select("id", { count: "exact", head: true }).eq("system_id", systemId).eq("active", true),
    supabase.from("pending_deletions").select("id", { count: "exact", head: true }),
  ]);
  const text =
    `📈 <b>Stats</b>\n\n` +
    `New posts (24h): <b>${posts24 ?? 0}</b>\n` +
    `Active schedules: <b>${totalActive ?? 0}</b>\n` +
    `Pending deletions (all bots): <b>${delPending ?? 0}</b>`;
  const kb: any[][] = [
    [{ text: "🔙 Back", callback_data: "panel:main" }, { text: "❌ Close", callback_data: "panel:close" }],
  ];
  return { text, keyboard: kb };
}

async function handlePanel(botToken: string, system: any, chatId: number, userId: number) {
  if (!(await isAdmin(system.id, userId))) {
    await sendTelegramMessage(botToken, chatId, "❌ Only admins can open the panel.");
    return;
  }
  const { text, keyboard } = await renderMainPanel(system.id, system.label);
  await sendInlineMessage(botToken, chatId, text, keyboard);
}

async function handleCallbackQuery(botToken: string, system: any, cb: any) {
  const userId = cb.from.id;
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;
  const data: string = cb.data || "";

  if (!(await isAdmin(system.id, userId))) {
    await answerCallbackQuery(botToken, cb.id, "Not allowed");
    return;
  }

  await answerCallbackQuery(botToken, cb.id);

  const edit = async (text: string, kb: any[][]) => {
    await sendInlineMessage(botToken, chatId, text, kb, messageId);
  };

  if (data === "panel:main") {
    const r = await renderMainPanel(system.id, system.label); return edit(r.text, r.keyboard);
  }
  if (data === "panel:channels") { const r = await renderChannelsPanel(system.id); return edit(r.text, r.keyboard); }
  if (data === "panel:autodelete") { const r = await renderAutoDeletePanel(system.id); return edit(r.text, r.keyboard); }
  if (data === "panel:access") { const r = await renderAccessPanel(system.id); return edit(r.text, r.keyboard); }
  if (data === "panel:admins") { const r = await renderAdminsPanel(system.id); return edit(r.text, r.keyboard); }
  if (data === "panel:quota") { const r = await renderQuotaPanel(system.id); return edit(r.text, r.keyboard); }
  if (data === "panel:stats") { const r = await renderStatsPanel(system.id); return edit(r.text, r.keyboard); }
  if (data === "panel:close") {
    return edit("✅ Panel closed.", [[{ text: "🛠 Open again", callback_data: "panel:main" }]]);
  }

  if (data === "panel:antidel") { const r = await renderAntiDelPanel(system.id); return edit(r.text, r.keyboard); }

  if (data === "ch:add") {
    await setPanelState(system.id, userId, chatId, "add_channel");
    return edit("➕ Send one or more channel usernames as your next message.\nSeparate with spaces, commas, or new lines.\n\nExample:\n<code>@chan1 @chan2 @chan3</code>\n\n/cancel to abort.", [[{ text: "🔙 Back", callback_data: "panel:channels" }]]);
  }
  if (data.startsWith("ch:del:")) {
    const prefix = data.slice("ch:del:".length);
    const { data: rows } = await supabase.from("channels").select("id, username").eq("system_id", system.id);
    const match = (rows || []).find((r: any) => r.id.startsWith(prefix));
    if (match) await supabase.from("channels").delete().eq("id", match.id);
    const r = await renderChannelsPanel(system.id); return edit(r.text, r.keyboard);
  }
  if (data === "ad:add") {
    await setPanelState(system.id, userId, chatId, "add_autodelete");
    return edit("➕ Send the rule as: <code>&lt;chat_id_or_@username&gt; &lt;delay&gt;</code>\nExample: <code>@mychannel 5m</code> or <code>-100123 1h</code>\nValid delays: 1m, 5m, 15m, 30m, 1h, 2h, 3h, 4h, 6h, 12h, 24h.\n\n/cancel to abort.", [[{ text: "🔙 Back", callback_data: "panel:autodelete" }]]);
  }
  if (data.startsWith("ad:del:")) {
    const prefix = data.slice("ad:del:".length);
    const { data: rows } = await supabase.from("auto_delete_rules").select("id").eq("system_id", system.id);
    const match = (rows || []).find((r: any) => r.id.startsWith(prefix));
    if (match) await supabase.from("auto_delete_rules").delete().eq("id", match.id);
    const r = await renderAutoDeletePanel(system.id); return edit(r.text, r.keyboard);
  }
  if (data === "anti:add") {
    await setPanelState(system.id, userId, chatId, "add_antidel");
    return edit("🛡 Send one or more channels/chat IDs to protect from auto-delete.\nSeparate with spaces, commas, or new lines.\n\nExamples:\n<code>@chan1 @chan2</code>\n<code>-1001234567890</code>\n\n/cancel to abort.", [[{ text: "🔙 Back", callback_data: "panel:antidel" }]]);
  }
  if (data.startsWith("anti:del:")) {
    const prefix = data.slice("anti:del:".length);
    const { data: rows } = await supabase.from("anti_auto_delete_channels").select("id").eq("system_id", system.id);
    const match = (rows || []).find((r: any) => r.id.startsWith(prefix));
    if (match) await supabase.from("anti_auto_delete_channels").delete().eq("id", match.id);
    const r = await renderAntiDelPanel(system.id); return edit(r.text, r.keyboard);
  }
  if (data === "adm:add") {
    await setPanelState(system.id, userId, chatId, "add_admin");
    return edit("➕ Send the Telegram user ID of the new bot admin.\n\n/cancel to abort.", [[{ text: "🔙 Back", callback_data: "panel:admins" }]]);
  }
  if (data === "gadm:add") {
    await setPanelState(system.id, userId, chatId, "add_global_admin");
    return edit("🌐 Send the username (e.g. <code>@username</code>) or numeric ID of the new <b>Telegram Admin</b> (admin on every bot).\n\n/cancel to abort.", [[{ text: "🔙 Back", callback_data: "panel:admins" }]]);
  }
  if (data === "access:help") {
    return edit("🔑 To grant access: reply to a user's message with <code>/access @channel1 @channel2</code>\nTo revoke: reply with <code>/remove @channel</code>", [[{ text: "🔙 Back", callback_data: "panel:access" }]]);
  }
  if (data === "q:set") {
    await setPanelState(system.id, userId, chatId, "set_quota");
    return edit("✏️ Send the new daily quota number (e.g. <code>5</code>). /cancel to abort.", [[{ text: "🔙 Back", callback_data: "panel:quota" }]]);
  }
  if (data === "q:off") {
    await supabase.from("systems").update({ daily_post_quota: null }).eq("id", system.id);
    const r = await renderQuotaPanel(system.id); return edit(r.text, r.keyboard);
  }
}

async function handlePendingPanelInput(botToken: string, system: any, chatId: number, userId: number, text: string): Promise<boolean> {
  const state = await getPanelState(system.id, userId);
  if (!state) return false;
  if (text.trim().toLowerCase() === "/cancel") {
    await clearPanelState(system.id, userId);
    await sendTelegramMessage(botToken, chatId, "✅ Cancelled.");
    return true;
  }

  const respond = async (msg: string, openAfter?: () => Promise<{ text: string; keyboard: any[][] }>) => {
    await clearPanelState(system.id, userId);
    await sendTelegramMessage(botToken, chatId, msg);
    if (openAfter) {
      const r = await openAfter();
      await sendInlineMessage(botToken, chatId, r.text, r.keyboard);
    }
  };

  if (state.action === "add_channel") {
    const tokens = text.split(/[\s,\n]+/).map(t => t.trim().replace(/^@/, "").toLowerCase()).filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const t of tokens) {
      if (/^[a-z0-9_]{3,}$/i.test(t)) valid.push(t); else invalid.push(t);
    }
    if (valid.length === 0) {
      await sendTelegramMessage(botToken, chatId, "❌ No valid usernames found. Try again or /cancel.");
      return true;
    }
    const { data: existing } = await supabase.from("channels").select("username").eq("system_id", system.id);
    const existingSet = new Set((existing || []).map((r: any) => r.username.toLowerCase()));
    const toInsert = valid.filter(v => !existingSet.has(v));
    const skipped = valid.filter(v => existingSet.has(v));
    let added: string[] = [];
    if (toInsert.length) {
      const { data: inserted, error } = await supabase.from("channels").insert(toInsert.map(u => ({ system_id: system.id, username: u }))).select("username");
      if (!error) added = (inserted || []).map((r: any) => `@${r.username}`);
    }
    let msg = added.length ? `✅ Added: ${added.join(", ")}` : "ℹ️ Nothing new added.";
    if (skipped.length) msg += `\n⚠️ Already existed: ${skipped.map(s => `@${s}`).join(", ")}`;
    if (invalid.length) msg += `\n❌ Invalid: ${invalid.join(", ")}`;
    return respond(msg, () => renderChannelsPanel(system.id));
  }

  if (state.action === "add_antidel") {
    const tokens = text.split(/[\s,\n]+/).map(t => t.trim()).filter(Boolean);
    if (tokens.length === 0) {
      await sendTelegramMessage(botToken, chatId, "❌ Send at least one channel. Try again or /cancel.");
      return true;
    }
    const normalized = tokens.map(t => t.startsWith("-") || /^\d+$/.test(t) ? t : (t.startsWith("@") ? t : `@${t}`));
    const rows = normalized.map(c => ({ system_id: system.id, chat_id: c }));
    const { data: inserted, error } = await supabase.from("anti_auto_delete_channels").upsert(rows, { onConflict: "system_id,chat_id", ignoreDuplicates: true } as any).select("chat_id");
    const added = (inserted || []).map((r: any) => r.chat_id);
    let msg = added.length ? `✅ Protected: ${added.join(", ")}` : "ℹ️ Nothing new added (all already protected).";
    if (error && added.length === 0) msg = "❌ Could not add.";
    return respond(msg, () => renderAntiDelPanel(system.id));
  }

  if (state.action === "add_autodelete") {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) {
      await sendTelegramMessage(botToken, chatId, "❌ Send: <code>chat_id delay</code>. Try again or /cancel.");
      return true;
    }
    const chat = parts[0];
    const delay = parts[1].toLowerCase();
    const valid = ["1m","5m","15m","30m","1h","2h","3h","4h","6h","12h","24h"];
    if (!valid.includes(delay)) {
      await sendTelegramMessage(botToken, chatId, `❌ Invalid delay. Use one of: ${valid.join(", ")}`);
      return true;
    }
    await supabase.from("auto_delete_rules").insert({ system_id: system.id, chat_id: chat, delay, enabled: true });
    return respond(`✅ Auto-delete rule added.`, () => renderAutoDeletePanel(system.id));
  }

  if (state.action === "add_admin") {
    const id = text.trim();
    if (!/^\d+$/.test(id)) {
      await sendTelegramMessage(botToken, chatId, "❌ Send a numeric Telegram user ID. /cancel to abort.");
      return true;
    }
    await supabase.from("allowed_users").upsert(
      { system_id: system.id, telegram_user_id: id, is_admin: true },
      { onConflict: "system_id,telegram_user_id" } as any
    );
    return respond(`✅ User <code>${id}</code> is now a bot admin.`, () => renderAdminsPanel(system.id));
  }

  if (state.action === "add_global_admin") {
    const raw = text.trim();
    const insertObj: any = {};
    if (/^\d+$/.test(raw)) insertObj.telegram_user_id = raw;
    else insertObj.telegram_username = raw.replace(/^@/, "").toLowerCase();
    const { error } = await supabase.from("global_admins").insert(insertObj);
    if (error) return respond("❌ Could not add (maybe duplicate).", () => renderAdminsPanel(system.id));
    return respond(`✅ New Telegram Admin added.`, () => renderAdminsPanel(system.id));
  }

  if (state.action === "set_quota") {
    const n = parseInt(text.trim(), 10);
    if (isNaN(n) || n < 1 || n > 1000) {
      await sendTelegramMessage(botToken, chatId, "❌ Send a number 1–1000. /cancel to abort.");
      return true;
    }
    await supabase.from("systems").update({ daily_post_quota: n }).eq("id", system.id);
    return respond(`✅ Daily quota set to ${n}.`, () => renderQuotaPanel(system.id));
  }

  return false;
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

    // ─── Callback queries (inline buttons from /panel) ───
    if (update.callback_query) {
      const system = await getSystemByToken(botToken);
      if (system) {
        await ensureGlobalAdminRegistered(update.callback_query.from.id, update.callback_query.from.username);
        await handleCallbackQuery(botToken, system, update.callback_query);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const username = message.from?.username;
    const text = message.text || message.caption || "";
    const messageId = message.message_id;
    const replyToMessage = message.reply_to_message;

    if (!userId) {
      return new Response(JSON.stringify({ ok: true }), {

        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Register Telegram Admin user_id by username if matched
    await ensureGlobalAdminRegistered(userId, username);

    // Auto-delete check
    await handleAutoDelete(botToken, system.id, chatId, messageId);

    // Pending /panel input (non-command messages from an admin in a pending step)
    if (!text.startsWith("/") || text.trim().toLowerCase() === "/cancel") {
      if (await isAdmin(system.id, userId)) {
        const consumed = await handlePendingPanelInput(botToken, system, chatId, userId, text);
        if (consumed) {
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    if (!text.startsWith("/")) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parts = text.split(/\s+/);
    const command = parts[0].split("@")[0].toLowerCase();
    const args = parts.slice(1);

    // Access control — Top admins (super + Telegram Admins) always bypass
    const topAdmin = await isTopAdmin(userId);
    const { data: allUsers } = await supabase
      .from("allowed_users")
      .select("id")
      .eq("system_id", system.id);

    const hasAccessControl = allUsers && allUsers.length > 0;

    if (hasAccessControl && !topAdmin) {
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
    const adminCommands = new Set(["/access", "/remove", "/revoke", "/addadmin", "/removeadmin", "/allposts", "/stopall", "/channels", "/myaccess", "/setquota", "/panel"]);
    const userAllowedCommands = new Set(["/start", "/help", "/id", "/post", "/rpost", "/stop", "/myposts", "/quota"]);

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

      case "/panel":
        await handlePanel(botToken, system, chatId, userId);
        break;


      case "/id":
        await sendTelegramMessage(botToken, chatId,
          `🆔 Chat ID: <code>${chatId}</code>\n👤 Your ID: <code>${userId}</code>`
        );
        break;

      case "/post":
        await handlePost(botToken, system.id, chatId, userId, text, replyToMessage);
        break;

      case "/rpost":
        await handleRpost(botToken, system.id, chatId, userId, text, replyToMessage);
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

      case "/setquota":
        await handleSetQuota(botToken, system.id, chatId, userId, args);
        break;

      case "/quota":
        await handleQuota(botToken, system.id, chatId, userId);
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

