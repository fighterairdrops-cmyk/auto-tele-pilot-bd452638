
-- Systems table
CREATE TABLE public.systems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('bot', 'account')),
  label TEXT NOT NULL,
  username TEXT,
  status TEXT NOT NULL DEFAULT 'online',
  bot_token TEXT,
  api_id TEXT,
  api_hash TEXT,
  string_session TEXT,
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Access control: allowed users
CREATE TABLE public.allowed_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  telegram_user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Access control: allowed groups
CREATE TABLE public.allowed_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Channels
CREATE TABLE public.channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Scheduled tasks
CREATE TABLE public.scheduled_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  repeat_interval TEXT NOT NULL DEFAULT 'once',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Auto-delete rules
CREATE TABLE public.auto_delete_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  delay TEXT NOT NULL DEFAULT '5m',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_delete_rules ENABLE ROW LEVEL SECURITY;

-- Allow all operations (single-user tool, no auth)
CREATE POLICY "Allow all on systems" ON public.systems FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on allowed_users" ON public.allowed_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on allowed_groups" ON public.allowed_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on channels" ON public.channels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on scheduled_tasks" ON public.scheduled_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on auto_delete_rules" ON public.auto_delete_rules FOR ALL USING (true) WITH CHECK (true);
