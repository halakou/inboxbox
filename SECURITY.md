# Security Policy

## Supported versions

The `main` branch and the live Worker at `https://inboxbox.halakou.workers.dev`.

## Reporting a vulnerability

Use GitHub **private vulnerability reporting** on this repository. Do not open a public issue for secrets or exploitable bugs. Do not paste tokens, `.env` files, or customer `file_id` values.

## Product rules

1. Never commit `BOT_TOKEN`, `WEBHOOK_SECRET`, `SETUP_KEY`, `.env`, or `.dev.vars`.
2. Store Telegram `file_id` only. Do not download or persist customer file bytes.
3. No LLM on the save/open path.
4. Product bot commands are `/start` and `/shelf` only. No admin, build, or host-control commands on the product bot.
5. Verify Mini App identity with HMAC on `initData`. Verify the webhook with `X-Telegram-Bot-Api-Secret-Token`.
6. Each D1 row belongs to that user's `telegram_user_id`. Other users must not read it.
7. Mini App URL stays public HTTPS (Telegram WebView). Secrets stay in Cloudflare.

## Secrets

```bash
cd worker
npx wrangler secret put BOT_TOKEN
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put SETUP_KEY
```
