ALTER TABLE public.systems ADD COLUMN IF NOT EXISTS daily_post_quota integer;
ALTER TABLE public.user_channel_access ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;