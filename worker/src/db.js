export const DEFAULT_BOXES = [
  { slug: "inbox", name: "ورود" },
  { slug: "work", name: "کار" },
  { slug: "ideas", name: "ایده‌ها" },
  { slug: "links", name: "لینک‌ها" },
];

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function rows(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  return res.results || [];
}

export function assertFileIdOnly(item) {
  if (!item || typeof item !== "object") throw new Error("invalid_item");
  const banned = ["blob", "file_bytes", "bytes_data", "content", "data", "buffer", "file_blob"];
  for (const k of banned) {
    if (item[k] != null) throw new Error("refuse_file_bytes");
  }
  if (item.file_id != null && typeof item.file_id !== "string") {
    throw new Error("file_id_must_be_text");
  }
  if (typeof item.file_id === "string" && item.file_id.length > 4096) {
    throw new Error("file_id_too_long");
  }
}

export async function ensureUser(db, tgUser) {
  const id = Number(tgUser.id);
  const ts = nowSec();
  const existing = await db.prepare("SELECT id, plan FROM users WHERE id = ?").bind(id).first();
  if (!existing) {
    await db
      .prepare(
        "INSERT INTO users (id, username, first_name, plan, created_at, updated_at) VALUES (?, ?, ?, 'free', ?, ?)",
      )
      .bind(id, tgUser.username || null, tgUser.first_name || null, ts, ts)
      .run();
  } else {
    await db
      .prepare("UPDATE users SET username = ?, first_name = ?, updated_at = ? WHERE id = ?")
      .bind(tgUser.username || null, tgUser.first_name || null, ts, id)
      .run();
  }

  const existingBoxes = rows(
    await db.prepare("SELECT id, slug, name FROM boxes WHERE user_id = ? ORDER BY sort_order").bind(id).all(),
  );
  const have = new Set(existingBoxes.map((b) => b.slug));
  let order = 0;
  for (const box of DEFAULT_BOXES) {
    if (!have.has(box.slug)) {
      await db
        .prepare("INSERT INTO boxes (user_id, slug, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(id, box.slug, box.name, order, ts)
        .run();
    }
    order += 1;
  }
  return id;
}

export async function inboxBoxId(db, userId) {
  const row = await db
    .prepare("SELECT id FROM boxes WHERE user_id = ? AND slug = 'inbox'")
    .bind(userId)
    .first();
  return row ? row.id : null;
}

export async function saveItem(db, item) {
  assertFileIdOnly(item);
  const ts = nowSec();
  const result = await db
    .prepare(
      `INSERT INTO items (user_id, box_id, file_id, file_unique_id, kind, label, mime, byte_size, text_body, pinned, opened, source_id, tg_message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    )
    .bind(
      item.userId,
      item.boxId,
      item.file_id || null,
      item.file_unique_id || null,
      item.kind,
      item.label || item.kind,
      item.mime || null,
      Number(item.bytes || 0),
      item.text_body || null,
      item.sourceId || null,
      item.tgMessageId || null,
      ts,
    )
    .run();
  return result && result.meta ? result.meta.last_row_id : null;
}

export async function upsertSource(db, src) {
  const ts = nowSec();
  if (src.tgChatId != null) {
    const row = await db
      .prepare("SELECT id FROM sources WHERE user_id = ? AND tg_chat_id = ?")
      .bind(src.userId, src.tgChatId)
      .first();
    if (row) {
      await db
        .prepare("UPDATE sources SET username = ?, title = ?, kind = ? WHERE id = ? AND user_id = ?")
        .bind(src.username || null, src.title, src.kind || null, row.id, src.userId)
        .run();
      return row.id;
    }
  }
  const result = await db
    .prepare(
      "INSERT INTO sources (user_id, tg_chat_id, username, title, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(src.userId, src.tgChatId || null, src.username || null, src.title, src.kind || null, ts)
    .run();
  return result && result.meta ? result.meta.last_row_id : null;
}

export async function eraseUser(db, userId) {
  const id = Number(userId);
  await db.prepare("DELETE FROM items WHERE user_id = ?").bind(id).run();
  await db.prepare("DELETE FROM sources WHERE user_id = ?").bind(id).run();
  await db.prepare("DELETE FROM boxes WHERE user_id = ?").bind(id).run();
  await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
}

export async function pinItem(db, userId, itemId) {
  const row = await db
    .prepare("SELECT id, pinned FROM items WHERE id = ? AND user_id = ?")
    .bind(itemId, userId)
    .first();
  if (!row) return null;
  const next = row.pinned ? 0 : 1;
  await db
    .prepare("UPDATE items SET pinned = ? WHERE id = ? AND user_id = ?")
    .bind(next, itemId, userId)
    .run();
  return next;
}

export async function markOpened(db, userId, itemIds) {
  for (const id of itemIds) {
    await db.prepare("UPDATE items SET opened = 1 WHERE id = ? AND user_id = ?").bind(id, userId).run();
  }
}

export async function getItem(db, userId, itemId) {
  return db.prepare("SELECT * FROM items WHERE id = ? AND user_id = ?").bind(itemId, userId).first();
}

export async function getShelf(db, userId) {
  const user = await db.prepare("SELECT plan FROM users WHERE id = ?").bind(userId).first();
  const boxRows = rows(
    await db
      .prepare(
        `SELECT b.id, b.slug, b.name, COUNT(i.id) AS count
         FROM boxes b LEFT JOIN items i ON i.box_id = b.id AND i.user_id = b.user_id
         WHERE b.user_id = ?
         GROUP BY b.id
         ORDER BY b.sort_order`,
      )
      .bind(userId)
      .all(),
  );
  const itemRows = rows(
    await db
      .prepare(
        "SELECT id, box_id, kind, byte_size, label, pinned, opened FROM items WHERE user_id = ? ORDER BY created_at DESC LIMIT 200",
      )
      .bind(userId)
      .all(),
  );
  const srcRows = rows(
    await db
      .prepare("SELECT id, username, title FROM sources WHERE user_id = ? ORDER BY created_at DESC LIMIT 100")
      .bind(userId)
      .all(),
  );
  return {
    plan: user && user.plan === "pro" ? "pro" : "free",
    boxes: boxRows.map((b) => ({
      id: String(b.id),
      name: b.name,
      count: Number(b.count || 0),
      slug: b.slug,
    })),
    items: itemRows.map((it) => ({
      id: String(it.id),
      box: String(it.box_id),
      kind: it.kind,
      bytes: Number(it.byte_size || 0),
      label: it.label,
      pin: Boolean(it.pinned),
      opened: Boolean(it.opened),
    })),
    sources: srcRows.map((s) => ({
      id: String(s.id),
      username: s.username || "",
      title: s.title,
    })),
  };
}

export async function setPlan(db, userId, plan) {
  await db
    .prepare("UPDATE users SET plan = ?, updated_at = ? WHERE id = ?")
    .bind(plan, nowSec(), userId)
    .run();
}
