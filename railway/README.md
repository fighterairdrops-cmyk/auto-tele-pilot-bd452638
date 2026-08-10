# Railway bot service

Runs the whole Telegram bot stack on Railway (independent of Lovable credits):

- `POST /telegram-webhook/<bot_token>` — the Telegram webhook (all commands, `/panel`, inline buttons)
- internal loop every 30s — scheduled posts (`/post`, `/rpost`, time windows, quotas)
- internal loop every 30s — auto-delete queue (respects anti-auto-delete channels)
- daily summary DM at 09:00 UTC
- `GET /health` — health check
- `POST /admin/register-webhooks` — re-point every bot's webhook at this service (header `x-admin-token`)
- `POST /admin/run/scheduled-posts | auto-deletes | daily-summary` — manual trigger (header `x-admin-token`)

The bot logic is **not duplicated**. `src/generated/*` is produced from `supabase/functions/*` by
`node scripts/sync-from-supabase.mjs`; only the Deno/Supabase header is swapped for a Postgres shim
(`src/db.ts`) that speaks the same `supabase.from(...)` API against Railway Postgres.

## Deploy in 6 steps

1. **Push this repo to GitHub** (Lovable → GitHub sync), then in Railway: *New Project → Deploy from GitHub repo*.
2. **Set the root directory** to `railway` (Service → Settings → Root Directory). Railway autodetects Node and runs `npm start`.
3. **Add Postgres**: in the same project → *New → Database → Postgres*.
4. **Variables** (Service → Variables):
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference the Postgres service)
   - `ADMIN_TOKEN` = any long random string
   - `PUBLIC_URL` = your service domain (Settings → Networking → *Generate Domain*), e.g. `https://xxx.up.railway.app`
5. **Create the schema** — from your machine, or Railway's shell:
   ```bash
   cd railway && npm install && DATABASE_URL="<railway postgres url>" npm run db:setup
   ```
6. **Deploy.** On boot the service points every bot's Telegram webhook at itself, so `/panel`, `/post`,
   `/rpost`, auto-delete and summaries all run on Railway. Check `https://<domain>/health`.

## Moving your existing data over

If the Lovable Cloud database is reachable again, dump and restore just the bot tables:

```bash
pg_dump "$LOVABLE_DB_URL" --data-only --no-owner \
  -t public.systems -t public.allowed_users -t public.allowed_groups -t public.channels \
  -t public.auto_delete_rules -t public.anti_auto_delete_channels -t public.user_channel_access \
  -t public.scheduled_posts -t public.pending_deletions -t public.global_admins \
  > bot-data.sql
psql "$RAILWAY_DB_URL" -f bot-data.sql
```

Otherwise just re-add your bot(s) with `INSERT INTO systems (type, label, bot_token) VALUES ('bot','Scheduler','<token>');`
and add channels from `/panel` inside Telegram.

## Fallback back to Lovable Cloud

Nothing was removed — the Supabase edge functions are still in `supabase/functions/`. To switch back,
call `setWebhook` with the Supabase function URL (or set `AUTO_SET_WEBHOOK=false` here and pause the
Railway service).

## Local run

```bash
cd railway
npm install
cp .env.example .env   # fill DATABASE_URL
npm run dev
```

## After editing bot logic

Edit `supabase/functions/telegram-webhook/index.ts` (single source of truth), then:

```bash
node railway/scripts/sync-from-supabase.mjs
```

and redeploy.
