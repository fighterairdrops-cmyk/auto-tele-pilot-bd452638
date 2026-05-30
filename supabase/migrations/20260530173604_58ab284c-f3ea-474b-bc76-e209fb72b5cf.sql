
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS rotation_messages jsonb,
  ADD COLUMN IF NOT EXISTS rotation_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS window_start_hour integer,
  ADD COLUMN IF NOT EXISTS window_end_hour integer,
  ADD COLUMN IF NOT EXISTS post_kind text NOT NULL DEFAULT 'post';

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_dedup
  ON public.scheduled_posts(system_id, telegram_user_id, active);
