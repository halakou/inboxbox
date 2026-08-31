import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  DEFAULT_BOXES,
  assertFileIdOnly,
  ensureUser,
  inboxBoxId,
  saveItem,
  eraseUser,
  getShelf,
} from "../src/db.js";
import { signInitData, verifyInitData } from "../src/hmac.js";
import { extractSave } from "../src/media.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readFileSync(join(root, "schema.sql"), "utf8");
const indexSrc = readFileSync(join(root, "src/index.js"), "utf8");

class MemD1 {
  constructor() {
    this.users = new Map();
    this.boxes = [];
    this.items = [];
    this.sources = [];
    this.seq = { boxes: 1, items: 1, sources: 1 };
  }
  prepare(sql) {
    const n = sql.replace(/\s+/g, " ").trim();
    return {
      bind: (...args) => ({
        first: async () => this.first(n, args),
        all: async () => ({ results: this.all(n, args) }),
        run: async () => this.run(n, args),
      }),
    };
  }
  first(sql, a) {
    if (sql.startsWith("SELECT id, plan FROM users")) return this.users.get(a[0]) || null;
    if (sql.startsWith("SELECT plan FROM users")) {
      const u = this.users.get(a[0]);
      return u ? { plan: u.plan } : null;
    }
    if (sql.includes("FROM boxes") && sql.includes("slug = 'inbox'")) {
      return this.boxes.find((b) => b.user_id === a[0] && b.slug === "inbox") || null;
    }
    if (sql.startsWith("SELECT id, pinned FROM items")) {
      return this.items.find((i) => i.id === a[0] && i.user_id === a[1]) || null;
    }
    if (sql.startsWith("SELECT * FROM items")) {
      return this.items.find((i) => i.id === a[0] && i.user_id === a[1]) || null;
    }
    if (sql.startsWith("SELECT id FROM sources")) {
      return this.sources.find((s) => s.user_id === a[0] && s.tg_chat_id === a[1]) || null;
    }
    return null;
  }
  all(sql, a) {
    const uid = a[0];
    if (sql.includes("FROM boxes") && sql.includes("COUNT")) {
      return this.boxes
        .filter((b) => b.user_id === uid)
        .sort((x, y) => x.sort_order - y.sort_order)
        .map((b) => ({
          ...b,
          count: this.items.filter((i) => i.box_id === b.id && i.user_id === uid).length,
        }));
    }
    if (sql.startsWith("SELECT id, slug, name FROM boxes")) {
      return this.boxes.filter((b) => b.user_id === uid).sort((x, y) => x.sort_order - y.sort_order);
    }
    if (sql.startsWith("SELECT id, box_id, kind")) {
      return this.items.filter((i) => i.user_id === uid).sort((x, y) => y.created_at - x.created_at);
    }
    if (sql.startsWith("SELECT id, username, title FROM sources")) {
      return this.sources.filter((s) => s.user_id === uid);
    }
    return [];
  }
  run(sql, a) {
    if (sql.startsWith("INSERT INTO users")) {
      this.users.set(a[0], {
        id: a[0],
        username: a[1],
        first_name: a[2],
        plan: "free",
        created_at: a[3],
        updated_at: a[4],
      });
      return { success: true, meta: { last_row_id: a[0], changes: 1 } };
    }
    if (sql.startsWith("UPDATE users SET username")) {
      const u = this.users.get(a[3]);
      if (u) {
        u.username = a[0];
        u.first_name = a[1];
        u.updated_at = a[2];
      }
      return { success: true, meta: { last_row_id: 0, changes: u ? 1 : 0 } };
    }
    if (sql.startsWith("UPDATE users SET plan")) {
      const u = this.users.get(a[2]);
      if (u) {
        u.plan = a[0];
        u.updated_at = a[1];
      }
      return { success: true, meta: { last_row_id: 0, changes: u ? 1 : 0 } };
    }
    if (sql.startsWith("INSERT INTO boxes")) {
      const row = {
        id: this.seq.boxes++,
        user_id: a[0],
        slug: a[1],
        name: a[2],
        sort_order: a[3],
        created_at: a[4],
      };
      this.boxes.push(row);
      return { success: true, meta: { last_row_id: row.id, changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO items")) {
      const row = {
        id: this.seq.items++,
        user_id: a[0],
        box_id: a[1],
        file_id: a[2],
        file_unique_id: a[3],
        kind: a[4],
        label: a[5],
        mime: a[6],
        byte_size: a[7],
        text_body: a[8],
        pinned: 0,
        opened: 0,
        source_id: a[9],
        tg_message_id: a[10],
        created_at: a[11],
      };
      this.items.push(row);
      return { success: true, meta: { last_row_id: row.id, changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO sources")) {
      const row = {
        id: this.seq.sources++,
        user_id: a[0],
        tg_chat_id: a[1],
        username: a[2],
        title: a[3],
        kind: a[4],
        created_at: a[5],
      };
      this.sources.push(row);
      return { success: true, meta: { last_row_id: row.id, changes: 1 } };
    }
    if (sql.startsWith("DELETE FROM items")) {
      const before = this.items.length;
      this.items = this.items.filter((i) => i.user_id !== a[0]);
      return { success: true, meta: { last_row_id: 0, changes: before - this.items.length } };
    }
    if (sql.startsWith("DELETE FROM sources")) {
      this.sources = this.sources.filter((s) => s.user_id !== a[0]);
      return { success: true, meta: { last_row_id: 0, changes: 1 } };
    }
    if (sql.startsWith("DELETE FROM boxes")) {
      this.boxes = this.boxes.filter((b) => b.user_id !== a[0]);
      return { success: true, meta: { last_row_id: 0, changes: 1 } };
    }
    if (sql.startsWith("DELETE FROM users")) {
      this.users.delete(a[0]);
      return { success: true, meta: { last_row_id: 0, changes: 1 } };
    }
    if (sql.startsWith("UPDATE items SET pinned")) {
      const it = this.items.find((i) => i.id === a[1] && i.user_id === a[2]);
      if (it) it.pinned = a[0];
      return { success: true, meta: { last_row_id: 0, changes: it ? 1 : 0 } };
    }
    if (sql.startsWith("UPDATE items SET opened")) {
      const it = this.items.find((i) => i.id === a[0] && i.user_id === a[1]);
      if (it) it.opened = 1;
      return { success: true, meta: { last_row_id: 0, changes: it ? 1 : 0 } };
    }
    throw new Error("unhandled sql: " + sql);
  }
}

test("schema stores file_id TEXT and has no blob columns", () => {
  assert.match(schema, /file_id\s+TEXT/);
  assert.doesNotMatch(schema, /\bBLOB\b/i);
  assert.doesNotMatch(schema, /file_bytes/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS users/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS boxes/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS items/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS sources/);
});

test("product bot has only /start and /shelf — no system-control commands", () => {
  assert.match(indexSrc, /\/start/);
  assert.match(indexSrc, /\/shelf/);
  assert.doesNotMatch(indexSrc, /cmd === "\/build"/);
  assert.doesNotMatch(indexSrc, /cmd === "\/status"/);
  assert.doesNotMatch(indexSrc, /cmd === "\/test"/);
  assert.doesNotMatch(indexSrc, /بساز/);
});

test("default boxes exist for a new user", async () => {
  const db = new MemD1();
  await ensureUser(db, { id: 101, username: "a", first_name: "Ada" });
  const shelf = await getShelf(db, 101);
  assert.equal(shelf.boxes.length, 4);
  assert.deepEqual(
    shelf.boxes.map((b) => b.slug),
    DEFAULT_BOXES.map((b) => b.slug),
  );
  assert.deepEqual(
    shelf.boxes.map((b) => b.name),
    ["ورود", "کار", "ایده‌ها", "لینک‌ها"],
  );
  assert.equal(shelf.plan, "free");
});

test("save item stores file_id not bytes", async () => {
  const db = new MemD1();
  await ensureUser(db, { id: 7, first_name: "B" });
  const boxId = await inboxBoxId(db, 7);
  assert.ok(boxId);
  assert.throws(() => assertFileIdOnly({ file_id: "Ag-file", file_bytes: Buffer.from("secret") }));
  const id = await saveItem(db, {
    userId: 7,
    boxId,
    file_id: "AgAD-telegram-file-id",
    kind: "document",
    label: "resume.pdf",
    bytes: 2048,
  });
  const row = db.items.find((i) => i.id === id);
  assert.equal(row.file_id, "AgAD-telegram-file-id");
  assert.equal(typeof row.file_id, "string");
  assert.equal(row.byte_size, 2048);
  assert.equal(row.blob, undefined);
  assert.equal(row.file_bytes, undefined);
  assert.ok(!Object.values(row).some((v) => Buffer.isBuffer(v)));
  const extracted = extractSave({
    document: { file_id: "AgAD-telegram-file-id", file_name: "resume.pdf", file_size: 2048 },
  });
  assert.equal(extracted.file_id, "AgAD-telegram-file-id");
  assert.equal(extracted.blob, undefined);
});

test("erase deletes only that user's rows", async () => {
  const db = new MemD1();
  await ensureUser(db, { id: 1, first_name: "One" });
  await ensureUser(db, { id: 2, first_name: "Two" });
  const box1 = await inboxBoxId(db, 1);
  const box2 = await inboxBoxId(db, 2);
  await saveItem(db, { userId: 1, boxId: box1, file_id: "file-a", kind: "photo", label: "a" });
  await saveItem(db, { userId: 2, boxId: box2, file_id: "file-b", kind: "photo", label: "b" });
  assert.equal(db.items.length, 2);
  await eraseUser(db, 1);
  assert.equal(db.users.has(1), false);
  assert.equal(db.users.has(2), true);
  assert.equal(db.boxes.filter((b) => b.user_id === 1).length, 0);
  assert.equal(db.boxes.filter((b) => b.user_id === 2).length, 4);
  assert.equal(db.items.length, 1);
  assert.equal(db.items[0].user_id, 2);
  assert.equal(db.items[0].file_id, "file-b");
});

test("initData HMAC roundtrip", async () => {
  const token = "test-bot-token-not-a-secret";
  const user = { id: 42, first_name: "Nia" };
  const init = await signInitData(
    {
      auth_date: String(Math.floor(Date.now() / 1000)),
      query_id: "AAE",
      user: JSON.stringify(user),
    },
    token,
  );
  const ok = await verifyInitData(init, token);
  assert.ok(ok);
  assert.equal(ok.user.id, 42);
  const bad = await verifyInitData(init.replace("Nia", "Eve"), token);
  assert.equal(bad, null);
});
