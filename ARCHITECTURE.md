# InboxBox architecture

Product and workstation are separate.

## Product (customers)
- Source: GitHub `halakou/inboxbox` (may go private after Mini App is served from Cloudflare).
- Runtime: Cloudflare Workers + D1 + static Mini App. Free tier first.
- Not on HalakouAi. Power cut must not kill the bot.
- Hot path: webhook → store Telegram `file_id` → 200. No LLM.
- Commands: `/start`, `/shelf` only.
- Mini App URL must stay public HTTPS.

## Workstation (Halakou, local, free)
- Lives on HalakouAi even if Teo/Grok Bot subscription ends.
- Local Qwen via Ollama, OpenCode on 127.0.0.1.
- Reads this repo and SECURITY.md. Does not call paid cloud coding APIs.
- Must not flash windows. Hidden tasks only. No PowerShell popups.
- Does not long-poll the product bot.

## If Teo is gone
1. OpenCode + Ollama already on the PC.
2. Follow SECURITY.md then this file.
3. Chunk work. Test. Commit to GitHub account `halakou`.
4. Deploy Worker with Wrangler when Cloudflare is connected.
5. Never put tokens in git.
