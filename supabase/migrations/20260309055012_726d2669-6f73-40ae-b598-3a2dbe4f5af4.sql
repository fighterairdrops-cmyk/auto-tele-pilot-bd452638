
ALTER TABLE public.scheduled_posts 
  ADD COLUMN IF NOT EXISTS media_file_id text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS target_channels text[];
