# Operator notes

This is a public product repository. Secrets live in Cloudflare, never in git.

1. Commands on the product bot: `/start` and `/shelf` only. Do not add admin, build, or status commands.
2. Mini App URL is the Worker origin (`https://inboxbox.halakou.workers.dev`), not GitHub Pages.
3. Store Telegram `file_id` only. Do not download customer bytes.
4. Deploy the Worker from `worker/` with Wrangler. Do not long-poll the product bot on a home PC once the webhook is set.
5. Never commit `.env`, `.dev.vars`, or Wrangler secret values.

See `ARCHITECTURE.md` for the product shape and `SECURITY.md` to report issues.
