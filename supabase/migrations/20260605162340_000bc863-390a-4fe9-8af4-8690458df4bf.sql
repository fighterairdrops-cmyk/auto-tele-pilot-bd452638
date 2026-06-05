
CREATE TABLE public.global_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id text,
  telegram_username text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.global_admins TO service_role;
GRANT SELECT ON public.global_admins TO authenticated;
ALTER TABLE public.global_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read global_admins" ON public.global_admins FOR SELECT TO authenticated USING (true);

CREATE UNIQUE INDEX global_admins_uid_idx ON public.global_admins(telegram_user_id) WHERE telegram_user_id IS NOT NULL;
CREATE UNIQUE INDEX global_admins_uname_idx ON public.global_admins(lower(telegram_username)) WHERE telegram_username IS NOT NULL;

INSERT INTO public.global_admins (telegram_username) VALUES ('gojo_the_king');

CREATE TABLE public.panel_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  telegram_user_id text NOT NULL,
  chat_id text NOT NULL,
  action text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system_id, telegram_user_id)
);
GRANT ALL ON public.panel_state TO service_role;
ALTER TABLE public.panel_state ENABLE ROW LEVEL SECURITY;
