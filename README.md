# InboxBox

Telegram Mini App inbox. Send a file in chat; open it later from the shelf. Telegram keeps the bytes — this Worker stores `file_id` only.

**Live:** [inboxbox.halakou.workers.dev](https://inboxbox.halakou.workers.dev)  
**Bot:** [@inboxbox_save_bot](https://t.me/inboxbox_save_bot)

## What it does

1. Talk to the bot (`/start` and `/shelf` only).
2. Incoming media is recorded as Telegram `file_id` + owner `telegram_user_id`.
3. The Mini App (Persian RTL) lists the shelf and opens files through Telegram.
4. Identity: HMAC on Mini App `initData`. Webhook: `X-Telegram-Bot-Api-Secret-Token`.

The Worker never downloads customer files. A home PC going offline cannot kill the bot.

## Stack

| Piece | Role |
|---|---|
| Cloudflare Worker | webhook, HMAC, `/api/shelf`, `/api/open`, static Mini App |
| D1 | per-user rows |
| Telegram | file storage (`file_id`) |
| Mini App | same-origin assets in `public/` |

## Repo layout

```text
public/            Mini App (HTML/CSS/JS, RTL)
worker/            Cloudflare Worker + tests
worker/schema.sql  D1 schema
SECURITY.md        reporting + product rules
```

## Local

```bash
cd worker
npm test
npx wrangler dev
```

Secrets stay in Cloudflare, never in git:

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put SETUP_KEY
```

See `.env.example`. Do not copy real values into the tree.

## Security

- No user HTML; text is escaped
- HMAC `initData`
- Webhook secret token
- Per-user data isolation
- Report vulnerabilities via GitHub private reporting on this repo

## License

MIT
