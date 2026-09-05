# InboxBox architecture

## Product

- Source: GitHub `halakou/inboxbox`
- Runtime: Cloudflare Workers + D1 + same-origin Mini App
- Hot path: webhook → store Telegram `file_id` → HTTP 200. No LLM on save/open.
- Commands: `/start`, `/shelf`
- Mini App URL stays public HTTPS (Telegram WebView)

## Data

Each row belongs to `telegram_user_id`. Other users cannot read it.

## Secrets

`BOT_TOKEN`, `WEBHOOK_SECRET`, and `SETUP_KEY` are Cloudflare Worker secrets. They are never committed.

## Out of scope

This repository is the customer product. Workstation automation and local models are not part of the product runtime.
