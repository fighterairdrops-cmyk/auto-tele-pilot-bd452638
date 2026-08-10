-- Railway Postgres schema for the Telegram bot platform.
-- Run once against your Railway Postgres database:
--   psql "$DATABASE_URL" -f railway/schema.sql
-- (No RLS here — this database is only reached by the Railway service itself.)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  type TEXT NOT NULL CHECK (type IN ('bot', 'account')),
  label TEXT NOT NULL,
  username TEXT,
  status TEXT NOT NULL DEFAULT 'online',
  bot_token TEXT,
  api_id TEXT,
  api_hash TEXT,
  string_session TEXT,
  daily_post_quota INTEGER,
  last_checked TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS allowed_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  telegram_user_id TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS allowed_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  repeat_interval TEXT NOT NULL DEFAULT 'once',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auto_delete_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  delay TEXT NOT NULL DEFAULT '5m',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anti_auto_delete_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (system_id, chat_id)
);
CREATE INDEX IF NOT EXISTS idx_anti_autodel_system ON anti_auto_delete_channels(system_id);

CREATE TABLE IF NOT EXISTS user_channel_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  telegram_user_id TEXT NOT NULL,
  channel_username TEXT NOT NULL,
  granted_by TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (system_id, telegram_user_id, channel_username)
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL DEFAULT 3600,
  total_times INTEGER NOT NULL DEFAULT 1,
  times_sent INTEGER NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,
  media_file_id TEXT,
  media_type TEXT,
  target_channels TEXT[],
  rotation_messages JSONB,
  rotation_index INTEGER NOT NULL DEFAULT 0,
  window_start_hour INTEGER,
  window_end_hour INTEGER,
  post_kind TEXT NOT NULL DEFAULT 'post',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_dedup ON scheduled_posts(system_id, telegram_user_id, active);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due ON scheduled_posts(active, next_run_at);

CREATE TABLE IF NOT EXISTS pending_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  message_id BIGINT NOT NULL,
  delete_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pending_deletions_delete_at ON pending_deletions(delete_at);

CREATE TABLE IF NOT EXISTS global_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id TEXT,
  telegram_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS global_admins_uid_idx ON global_admins(telegram_user_id) WHERE telegram_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS global_admins_uname_idx ON global_admins(lower(telegram_username)) WHERE telegram_username IS NOT NULL;
INSERT INTO global_admins (telegram_username)
SELECT 'gojo_the_king'
WHERE NOT EXISTS (SELECT 1 FROM global_admins WHERE lower(telegram_username) = 'gojo_the_king');

CREATE TABLE IF NOT EXISTS panel_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  telegram_user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (system_id, telegram_user_id)
);
