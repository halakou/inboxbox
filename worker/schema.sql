-- InboxBox D1 schema. Store Telegram file_id only. Never blobs / file bytes.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS boxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, slug),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tg_chat_id INTEGER,
  username TEXT,
  title TEXT NOT NULL,
  kind TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  box_id INTEGER NOT NULL,
  file_id TEXT,
  file_unique_id TEXT,
  kind TEXT NOT NULL,
  label TEXT,
  mime TEXT,
  byte_size INTEGER NOT NULL DEFAULT 0,
  text_body TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  opened INTEGER NOT NULL DEFAULT 0,
  source_id INTEGER,
  tg_message_id INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (box_id) REFERENCES boxes(id),
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX IF NOT EXISTS idx_boxes_user ON boxes(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_items_user_created ON items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_user_box ON items(user_id, box_id);
CREATE INDEX IF NOT EXISTS idx_items_user_pinned ON items(user_id, pinned);
CREATE INDEX IF NOT EXISTS idx_sources_user ON sources(user_id);
CREATE INDEX IF NOT EXISTS idx_sources_user_chat ON sources(user_id, tg_chat_id);
