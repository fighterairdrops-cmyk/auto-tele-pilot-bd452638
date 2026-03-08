
-- Add is_admin flag to allowed_users
ALTER TABLE public.allowed_users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Create user_channel_access table for per-user channel permissions
CREATE TABLE public.user_channel_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  telegram_user_id text NOT NULL,
  channel_username text NOT NULL,
  granted_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(system_id, telegram_user_id, channel_username)
);

ALTER TABLE public.user_channel_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own user_channel_access" ON public.user_channel_access
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM systems WHERE systems.id = user_channel_access.system_id AND systems.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM systems WHERE systems.id = user_channel_access.system_id AND systems.user_id = auth.uid()
  )
);

-- Create scheduled_posts table for /post every() time() commands
CREATE TABLE public.scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  message_text text NOT NULL,
  telegram_user_id text NOT NULL,
  interval_seconds integer NOT NULL DEFAULT 3600,
  total_times integer NOT NULL DEFAULT 1,
  times_sent integer NOT NULL DEFAULT 0,
  next_run_at timestamp with time zone NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scheduled_posts" ON public.scheduled_posts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM systems WHERE systems.id = scheduled_posts.system_id AND systems.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM systems WHERE systems.id = scheduled_posts.system_id AND systems.user_id = auth.uid()
  )
);

-- Enable realtime for scheduled_posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_posts;
