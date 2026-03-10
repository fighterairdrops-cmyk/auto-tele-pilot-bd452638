CREATE TABLE public.pending_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_token text NOT NULL,
  chat_id text NOT NULL,
  message_id bigint NOT NULL,
  delete_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_deletions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pending_deletions_delete_at ON public.pending_deletions(delete_at);
