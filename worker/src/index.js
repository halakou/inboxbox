/**
 * InboxBox Cloudflare Worker — always-on Telegram shelf.
 * Hot path: no LLM. Store file_id only. Commands: /start /shelf.
 */
import { verifyInitData } from "./hmac.js";
import { extractSave, extractSource, sendMethodForKind } from "./media.js";
import {
  ensureUser,
  inboxBoxId,
  saveItem,
  upsertSource,
  eraseUser,
  pinItem,
  markOpened,
  getItem,
  getShelf,
  setPlan,
} from "./db.js";

const PAGES = "https://halakou.github.io/inboxbox/";
const JSON_HDR = { "content-type": "application/json; charset=utf-8" };

const COPY = {
  start:
    "InboxBox قفسهٔ خصوصی توست.\n\nSaved Messages یک چت بی‌انتهاست. اینجا هر فایل در باکس خودش می‌ماند.\n\nیک فایل، عکس، ویدیو یا متن فوروارد کن — همان یک حرکت. فایل روی تلگرام می‌ماند؛ ما فقط شناسه را نگه می‌داریم.\n\nدستورها: /start و /shelf",
  shelf: "قفسه‌ات را باز کن.",
  saved: "در «ورود» ذخیره شد.",
  unknown: "فقط /start و /shelf.",
  privacy:
    "حریم خصوصی: فایل‌ها روی سرورهای تلگرام می‌مانند. InboxBox فقط file_id و برچسب را ذخیره می‌کند؛ بایت فایل را دانلود یا نگه نمی‌دارد.",
  erased: "همهٔ داده‌های قفسهٔ تو پاک شد.",
  vip: "InboxBox Pro — ۱۴۹ ستاره. باکس و پین بیشتر.",
  empty: "چیزی برای باز کردن نبود.",
};

function miniAppUrl(env) {
  return String(env.MINI_APP_URL || PAGES);
}

function inlineShelf(env) {
  return { inline_keyboard: [[{ text: "باز کردن قفسه", web_app: { url: miniAppUrl(env) } }]] };
}

function replyShelf(env) {
  return {
    keyboard: [[{ text: "قفسه", web_app: { url: miniAppUrl(env) } }]],
    resize_keyboard: true,
  };
}

function timingSafeEqualStr(a, b) {
  const aa = String(a || "");
  const bb = String(b || "");
  const enc = new TextEncoder();
  const ba = enc.encode(aa);
  const bb2 = enc.encode(bb);
  const len = Math.max(ba.length, bb2.length);
  let out = ba.length ^ bb2.length;
  for (let i = 0; i < len; i++) {
    out |= (ba[i] || 0) ^ (bb2[i] || 0);
  }
  return out === 0;
}

async function tgCall(env, method, body) {
  const token = env.BOT_TOKEN;
  if (!token) return { ok: false, description: "missing_token" };
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ ok: false }));
  if (!json.ok) console.error("tg_method_failed", method, json.error_code || res.status);
  return json;
}

function json(data, status, extra) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HDR, ...(extra || {}) },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const ok =
    origin === "https://halakou.github.io" ||
    origin.endsWith(".pages.dev") ||
    origin === "https://web.telegram.org" ||
    origin.endsWith(".telegram.org");
  return {
    "access-control-allow-origin": ok ? origin : "https://halakou.github.io",
    "access-control-allow-headers": "content-type, authorization, x-telegram-init-data",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function commandOf(text) {
  if (!text || text[0] !== "/") return null;
  return text.split(/\s+/)[0].split("@")[0].toLowerCase();
}

function readInitData(request, body) {
  const auth = request.headers.get("Authorization") || "";
  if (/^tma\s+/i.test(auth)) return auth.replace(/^tma\s+/i, "");
  const hdr = request.headers.get("X-Telegram-Init-Data");
  if (hdr) return hdr;
  if (body && typeof body.initData === "string") return body.initData;
  return new URL(request.url).searchParams.get("initData") || "";
}

async function requireMiniUser(request, env, body) {
  const raw = readInitData(request, body);
  const verified = await verifyInitData(raw, env.BOT_TOKEN);
  if (!verified) return null;
  return verified.user;
}

async function sendText(env, chatId, text, markup) {
  const body = { chat_id: chatId, text };
  if (markup) body.reply_markup = markup;
  return tgCall(env, "sendMessage", body);
}

async function sendSavedFile(env, chatId, item) {
  if (!item) return { ok: false };
  if (item.kind === "text") {
    return sendText(env, chatId, item.text_body || item.label || "");
  }
  if (!item.file_id) return { ok: false };
  const spec = sendMethodForKind(item.kind) || { method: "sendDocument", field: "document" };
  return tgCall(env, spec.method, { chat_id: chatId, [spec.field]: item.file_id });
}

async function handleOp(env, db, tgUser, chatId, payload) {
  const op = payload && payload.op;
  if (!op) return;
  await ensureUser(db, tgUser);
  const userId = Number(tgUser.id);

  if (op === "erase") {
    await eraseUser(db, userId);
    await sendText(env, chatId, COPY.erased);
    return;
  }
  if (op === "pin") {
    const id = Number(payload.id);
    if (id) await pinItem(db, userId, id);
    return;
  }
  if (op === "open") {
    const item = await getItem(db, userId, Number(payload.id));
    await markOpened(db, userId, [Number(payload.id)]);
    const sent = await sendSavedFile(env, chatId, item);
    if (!sent.ok) await sendText(env, chatId, COPY.empty);
    return;
  }
  if (op === "open_many") {
    const ids = Array.isArray(payload.ids) ? payload.ids.map(Number).filter(Boolean).slice(0, 10) : [];
    await markOpened(db, userId, ids);
    let n = 0;
    for (const id of ids) {
      const item = await getItem(db, userId, id);
      const sent = await sendSavedFile(env, chatId, item);
      if (sent.ok) n += 1;
    }
    if (!n) await sendText(env, chatId, COPY.empty);
    return;
  }
  if (op === "vip") {
    const inv = await tgCall(env, "sendInvoice", {
      chat_id: chatId,
      title: "InboxBox Pro",
      description: COPY.vip,
      payload: "inboxbox-pro",
      currency: "XTR",
      prices: [{ label: "Pro", amount: 149 }],
    });
    if (!inv.ok) await sendText(env, chatId, COPY.vip, inlineShelf(env));
    return;
  }
  if (op === "settings") {
    await sendText(env, chatId, COPY.privacy);
  }
}

async function handleMessage(env, db, message) {
  if (!message || !message.from) return;
  if (message.chat && message.chat.type !== "private") return;
  const chatId = message.chat.id;
  const tgUser = message.from;

  if (message.successful_payment && message.successful_payment.invoice_payload === "inboxbox-pro") {
    await ensureUser(db, tgUser);
    await setPlan(db, tgUser.id, "pro");
    await sendText(env, chatId, "Pro فعال شد.", inlineShelf(env));
    return;
  }

  if (message.web_app_data && message.web_app_data.data) {
    let payload = {};
    try {
      payload = JSON.parse(message.web_app_data.data);
    } catch {
      payload = {};
    }
    await handleOp(env, db, tgUser, chatId, payload);
    return;
  }

  const cmd = commandOf(message.text || "");
  if (cmd === "/start") {
    await ensureUser(db, tgUser);
    await sendText(env, chatId, COPY.start, replyShelf(env));
    return;
  }
  if (cmd === "/shelf") {
    await ensureUser(db, tgUser);
    await sendText(env, chatId, COPY.shelf, inlineShelf(env));
    return;
  }
  if (cmd) {
    await sendText(env, chatId, COPY.unknown, inlineShelf(env));
    return;
  }

  const save = extractSave(message);
  if (!save) return;
  await ensureUser(db, tgUser);
  const boxId = await inboxBoxId(db, tgUser.id);
  if (!boxId) return;
  let sourceId = null;
  const src = extractSource(message);
  if (src) {
    sourceId = await upsertSource(db, { userId: tgUser.id, ...src });
  }
  await saveItem(db, {
    userId: tgUser.id,
    boxId,
    file_id: save.file_id,
    file_unique_id: save.file_unique_id,
    kind: save.kind,
    label: save.label,
    mime: save.mime,
    bytes: save.bytes,
    text_body: save.text_body,
    sourceId,
    tgMessageId: message.message_id,
  });
  await sendText(env, chatId, COPY.saved, inlineShelf(env));
}

async function handleWebhook(request, env) {
  const want = env.WEBHOOK_SECRET || "";
  const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  if (!want || !timingSafeEqualStr(got, want)) {
    return json({ ok: false }, 401);
  }
  const update = await request.json().catch(() => null);
  if (!update) return json({ ok: true }, 200);

  try {
    if (update.pre_checkout_query) {
      await tgCall(env, "answerPreCheckoutQuery", {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      });
      return json({ ok: true }, 200);
    }
    const message = update.message || update.edited_message;
    if (message) await handleMessage(env, env.DB, message);
  } catch (err) {
    console.error("webhook_error", err && err.message);
  }
  return json({ ok: true }, 200);
}

async function handleSetup(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || request.headers.get("X-Setup-Key") || "";
  if (!env.SETUP_KEY || !timingSafeEqualStr(key, env.SETUP_KEY)) {
    return json({ ok: false }, 401);
  }
  const hook = `${url.origin}/webhook`;
  const result = await tgCall(env, "setWebhook", {
    url: hook,
    secret_token: env.WEBHOOK_SECRET,
    allowed_updates: ["message", "pre_checkout_query"],
    drop_pending_updates: false,
  });
  return json({ ok: Boolean(result.ok), webhook: hook }, result.ok ? 200 : 502);
}

async function handleShelf(request, env) {
  const user = await requireMiniUser(request, env, null);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401, corsHeaders(request));
  await ensureUser(env.DB, user);
  const shelf = await getShelf(env.DB, user.id);
  return json({ ok: true, ...shelf }, 200, corsHeaders(request));
}

async function handleOpHttp(request, env) {
  const body = await request.json().catch(() => ({}));
  const user = await requireMiniUser(request, env, body);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401, corsHeaders(request));
  const op = body.op;
  if (op === "erase") {
    await eraseUser(env.DB, user.id);
    return json({ ok: true, erased: true }, 200, corsHeaders(request));
  }
  if (op === "pin") {
    const pinned = await pinItem(env.DB, user.id, Number(body.id));
    return json({ ok: pinned != null, pinned }, 200, corsHeaders(request));
  }
  if (op === "open" || op === "open_many" || op === "vip" || op === "settings") {
    await handleOp(env, env.DB, user, user.id, body);
    return json({ ok: true }, 200, corsHeaders(request));
  }
  return json({ ok: false, error: "unknown_op" }, 400, corsHeaders(request));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (request.method === "GET" && (path === "/health" || path === "/")) {
      return json({ ok: true, service: "inboxbox" }, 200);
    }
    if (request.method === "GET" && path === "/setup") {
      return handleSetup(request, env);
    }
    if (request.method === "POST" && path === "/webhook") {
      return handleWebhook(request, env);
    }
    if (request.method === "GET" && path === "/api/shelf") {
      return handleShelf(request, env);
    }
    if (request.method === "POST" && path === "/api/op") {
      return handleOpHttp(request, env);
    }
    return json({ ok: false }, 404);
  },
};
