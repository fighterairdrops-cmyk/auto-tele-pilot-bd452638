
CREATE TABLE public.anti_auto_delete_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (system_id, chat_id)
);

GRANT SELECT ON public.anti_auto_delete_channels TO authenticated;
GRANT ALL ON public.anti_auto_delete_channels TO service_role;

ALTER TABLE public.anti_auto_delete_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view anti auto delete channels"
ON public.anti_auto_delete_channels
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.systems s
    WHERE s.id = anti_auto_delete_channels.system_id
      AND s.user_id = auth.uid()
  )
);

CREATE INDEX idx_anti_autodel_system ON public.anti_auto_delete_channels(system_id);
