# HalakouAi local playbook (if Teo is gone)

This PC must finish work 0-100 without Grok Bot, without paid APIs, without asking Halakou to code.

**Standing orders live here (read first, every project):**
- `C:\Users\Halakou\.halakou\AGENT.md`
- `C:\Users\Halakou\.halakou\PROJECT-LOOP.md`
- `C:\Users\Halakou\.halakou\SECURITY.md`

## The loop
Halakou names a product in one sentence. You write architecture in simple Persian. You STOP for one تأیید. After that you use GitHub account `halakou` and Cloudflare free yourself: create repo, build, test, push, deploy. You do not ask how. Report only when the customer URL is live.

## Tools already on this PC
- Ollama model `qwen3.6:35b-a3b-q4_K_M` (16k context). NEVER delete model files.
- OpenCode at `C:\Users\Halakou\.local\bin\opencode.exe` — bind only `127.0.0.1`.
- GitHub account for product source: `halakou`. Not `halakouai-byte`.
- Product bot token lives OFF tree: `C:\Users\Halakou\.halakou\secrets\inboxbox.env`. Never print, never commit.

## Rules
1. Read SECURITY.md first. Then AGENT.md. Then PROJECT-LOOP.md.
2. InboxBox production does NOT run on this PC. Do not start local long-poll for `@inboxbox_save_bot` once webhook is set.
3. No flashing windows. No PowerShell popups. Hidden tasks only (`pythonw`, CREATE_NO_WINDOW).
4. No CloudAgent, no chatgpt.com, no paid coding APIs.
5. Chunk work. Test each chunk. Commit to GitHub `halakou/<project>`.
6. Do not add admin/build/status commands to a product bot.
7. Do not reboot Windows. Do not touch Windscribe, Tailscale, Rackside.

## InboxBox next chunks (in order)
1. Mini App already in repo root: `index.html`, `app.js`, `style.css` (Persian RTL).
2. Add Cloudflare Worker: webhook POST, D1, HMAC initData, `/api/shelf`, `/api/open`, static Mini App same origin.
3. Secrets only in Cloudflare (BOT_TOKEN, WEBHOOK_SECRET). Never in git.
4. BotFather Main Mini App URL = Worker origin (not github.io) after Worker is live.
5. Commands remain `/start` and `/shelf` only.

## How to work
OpenCode + local Qwen. One small file at a time. PowerShell for file writes if apply_patch fails. Keep-alive so the model is not unloaded mid-work. Report only when a customer-visible piece is actually live.
