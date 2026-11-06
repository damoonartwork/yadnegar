-- یادنگار: حساب‌ها و همگام‌سازی
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- کدهای ورود (هش‌شده، ۱۰ دقیقه اعتبار)
CREATE TABLE IF NOT EXISTS login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL
);

-- نشست هر دستگاه (توکن هش‌شده)
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device TEXT,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- هر کار یک ردیف؛ rev برای «چه چیزی از آخرین همگام‌سازی عوض شده»
CREATE TABLE IF NOT EXISTS tasks (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS tasks_rev ON tasks(user_id, rev);

-- تنظیمات مشترک بین دستگاه‌ها (یک ردیف برای هر کاربر)
CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL
);

-- شمارندهٔ rev هر کاربر
CREATE TABLE IF NOT EXISTS counters (
  user_id TEXT PRIMARY KEY,
  rev INTEGER NOT NULL
);
