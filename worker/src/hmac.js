/**
 * Telegram Mini App initData HMAC (core.telegram.org/bots/webapps).
 * secret = HMAC-SHA256(bot_token) with key "WebAppData".
 */
const enc = new TextEncoder();

export async function hmacSha256(key, message) {
  const keyBytes = typeof key === "string" ? enc.encode(key) : key;
  const msgBytes = typeof message === "string" ? enc.encode(message) : message;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, msgBytes));
}

export function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  return out === 0;
}

export async function verifyInitData(initData, botToken, { maxAgeSec = 86400 } = {}) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const pairs = [];
  for (const [k, v] of params.entries()) {
    if (k === "hash" || k === "signature") continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secret = await hmacSha256("WebAppData", botToken);
  const digest = await hmacSha256(secret, dataCheckString);
  if (!timingSafeEqualHex(toHex(digest), hash)) return null;

  const authDate = Number(params.get("auth_date") || 0);
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  const now = Math.floor(Date.now() / 1000);
  if (maxAgeSec > 0 && now - authDate > maxAgeSec) return null;

  let user = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
  if (!user || typeof user.id !== "number") return null;
  return {
    user,
    authDate,
    queryId: params.get("query_id"),
    startParam: params.get("start_param"),
  };
}

export async function signInitData(fields, botToken) {
  const params = new URLSearchParams(fields);
  const pairs = [];
  for (const [k, v] of params.entries()) {
    if (k === "hash" || k === "signature") continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const secret = await hmacSha256("WebAppData", botToken);
  const digest = await hmacSha256(secret, pairs.join("\n"));
  params.set("hash", toHex(digest));
  return params.toString();
}
