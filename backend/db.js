const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'shift_navigator.db');
const db = new Database(DB_PATH);

function initDb() {
  db.exec(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      order_num INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      role TEXT NOT NULL,
      avatar TEXT NOT NULL,
      phone TEXT DEFAULT '',
      telegram_chat_id TEXT DEFAULT '',
      team_id TEXT DEFAULT '',
      is_team_leader INTEGER DEFAULT 0,
      technology TEXT DEFAULT '',
      is_manager INTEGER DEFAULT 0,
      manager_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      label TEXT DEFAULT '',
      color TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS oncall_entries (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT DEFAULT '',
      notified INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);

  const defaults = {
    telegram_token: process.env.TELEGRAM_TOKEN || '',
    telegram_group_chat_id: '',
    notification_template: '🔔 <b>Sobreaviso Iniciando!</b>\n\n👤 Analista: <b>{{name}}</b>\n📅 Data: {{date}}\n⏰ Horário: {{start_time}} – {{end_time}}\n🏷️ Tipo: {{label}}\n\nMantenha o celular próximo!',
    last_import_date: '',
    last_import_period: '',
    seeded: '0',
    push_notification_template: '🔔 Sobreaviso Iniciando\n\n👤 {{name}}\n⏰ {{start_time}}–{{end_time}}\n🏷️ {{label}}'
  };

  const ins = db.prepare("INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)");
  Object.entries(defaults).forEach(([k, v]) => ins.run(k, v));

  // Migrations — add columns that may not exist in older DBs
  const migrations = [
    "ALTER TABLE members ADD COLUMN email TEXT DEFAULT ''",
    "ALTER TABLE shifts ADD COLUMN label TEXT DEFAULT ''",
    "ALTER TABLE shifts ADD COLUMN color TEXT DEFAULT ''",
    "ALTER TABLE members ADD COLUMN technology TEXT DEFAULT ''",
    "ALTER TABLE members ADD COLUMN is_manager INTEGER DEFAULT 0",
    "ALTER TABLE members ADD COLUMN manager_order INTEGER DEFAULT 0",
    "ALTER TABLE push_subscriptions ADD COLUMN id INTEGER",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (_) { /* column already exists, ignore */ }
  }

  // Preencher id nas linhas existentes sem id
  try { db.exec("UPDATE push_subscriptions SET id = rowid WHERE id IS NULL"); } catch (_) {}

  // Push subscriptions for PWA
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER,
      endpoint TEXT PRIMARY KEY,
      keys TEXT NOT NULL DEFAULT '{}',
      member_id TEXT,
      created_at TEXT
    )
  `);

  console.log('✅ Database initialized:', DB_PATH);
}

module.exports = { db, initDb };
