import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

export type Section = "income" | "cos" | "opex";

const TABLE_BY_SECTION: Record<Section, string> = {
  income: "IncomeEntries",
  cos: "CostOfServices",
  opex: "OperatingExpenses",
};

export interface EntryRow {
  id: number;
  date: string;
  year: number;
  month: number;
  category: string;
  description: string;
  amount: number;
  vat: number;
  account: string;
  paymentMode: string;
  supplier: string;
  breakdown: string;
  createdAt: string;
  updatedAt: string;
  section?: Section;
}

export interface EntryInput {
  id?: number;
  section: Section;
  date: string;
  year: number;
  month: number;
  category: string;
  description: string;
  amount: number;
  vat?: number;
  account?: string;
  paymentMode?: string;
  supplier?: string;
  breakdown?: string;
}

let db: Database.Database;
let dbPath = "";

export function getDbPath(): string {
  return dbPath;
}

/** Live-safe online backup of the open database to destPath. */
export function backupDatabase(destPath: string): Promise<unknown> {
  return db.backup(destPath);
}

/** Close the database so its file can be replaced (used by restore). */
export function closeDatabase(): void {
  db.close();
}

export function initDatabase(): void {
  dbPath = path.join(app.getPath("userData"), "financial-statements.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const entryTableSql = (name: string) => `
    CREATE TABLE IF NOT EXISTS ${name} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_${name}_ym ON ${name} (year, month);
    CREATE INDEX IF NOT EXISTS idx_${name}_cat ON ${name} (category);
  `;

  db.exec(`
    ${entryTableSql("IncomeEntries")}
    ${entryTableSql("CostOfServices")}
    ${entryTableSql("OperatingExpenses")}

    CREATE TABLE IF NOT EXISTS Company (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT 'My Trucking Company',
      logo TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      tin TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'PHP',
      fiscalYearStart INTEGER NOT NULL DEFAULT 1,
      decimalPlaces INTEGER NOT NULL DEFAULT 2
    );
    INSERT OR IGNORE INTO Company (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'Encoder',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO Users (id, name, email, role)
      SELECT 1, 'Administrator', '', 'Admin'
      WHERE NOT EXISTS (SELECT 1 FROM Users WHERE id = 1);

    CREATE TABLE IF NOT EXISTS AuditLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL DEFAULT 1,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entityId INTEGER,
      details TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migrations for renamed categories
  db.prepare(
    "UPDATE CostOfServices SET category = 'Travel Expenses/Out of Town' WHERE category = 'Travel Expenses'"
  ).run();
  const opexRenames: [string, string][] = [
    ["Repairs and Maintenance", "Repairs and Maint-Materials/spar"],
    ["Membership Dues", "Membership & Assessment due"],
    ["Donations", "Donations & Solicitations"],
  ];
  for (const [from, to] of opexRenames) {
    db.prepare("UPDATE OperatingExpenses SET category = ? WHERE category = ?").run(to, from);
  }

  // Migration: report signatories stored with the company profile
  const companyCols = (
    db.prepare("PRAGMA table_info(Company)").all() as { name: string }[]
  ).map((c) => c.name);
  for (const col of ["preparedBy", "checkedBy", "approvedBy"]) {
    if (!companyCols.includes(col)) {
      db.exec(`ALTER TABLE Company ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }

  // Migration: per-entry receipt breakdown (e.g. "1500+2300+800"),
  // 12% VAT, owning account, mode of payment, and supplier.
  const entryColumnMigrations: [string, string][] = [
    ["breakdown", `TEXT NOT NULL DEFAULT ''`],
    ["vat", `REAL NOT NULL DEFAULT 0`],
    ["account", `TEXT NOT NULL DEFAULT ''`],
    ["paymentMode", `TEXT NOT NULL DEFAULT ''`],
    ["supplier", `TEXT NOT NULL DEFAULT ''`],
  ];
  for (const t of Object.values(TABLE_BY_SECTION)) {
    const cols = (
      db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]
    ).map((c) => c.name);
    for (const [col, def] of entryColumnMigrations) {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE ${t} ADD COLUMN ${col} ${def}`);
      }
    }
  }
}

function table(section: Section): string {
  const t = TABLE_BY_SECTION[section];
  if (!t) throw new Error(`Unknown section: ${section}`);
  return t;
}

function audit(action: string, entity: string, entityId: number | null, details: string) {
  db.prepare(
    "INSERT INTO AuditLogs (action, entity, entityId, details) VALUES (?, ?, ?, ?)"
  ).run(action, entity, entityId, details);
}

export function listEntries(year: number, month?: number): EntryRow[] {
  const rows: EntryRow[] = [];
  for (const section of Object.keys(TABLE_BY_SECTION) as Section[]) {
    const t = table(section);
    const sql = month
      ? `SELECT * FROM ${t} WHERE year = ? AND month = ? ORDER BY date, id`
      : `SELECT * FROM ${t} WHERE year = ? ORDER BY date, id`;
    const found = (month
      ? db.prepare(sql).all(year, month)
      : db.prepare(sql).all(year)) as EntryRow[];
    for (const r of found) rows.push({ ...r, section });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  return rows;
}

export function createEntry(input: EntryInput): EntryRow {
  const t = table(input.section);
  let id: number;
  const breakdown = input.breakdown ?? "";
  const vat = input.vat ?? 0;
  const account = input.account ?? "";
  const paymentMode = input.paymentMode ?? "";
  const supplier = input.supplier ?? "";
  if (input.id != null) {
    // Restore (undo of delete) — preserve original id
    db.prepare(
      `INSERT INTO ${t} (id, date, year, month, category, description, amount, vat, account, paymentMode, supplier, breakdown) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(input.id, input.date, input.year, input.month, input.category, input.description, input.amount, vat, account, paymentMode, supplier, breakdown);
    id = input.id;
  } else {
    const res = db
      .prepare(
        `INSERT INTO ${t} (date, year, month, category, description, amount, vat, account, paymentMode, supplier, breakdown) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(input.date, input.year, input.month, input.category, input.description, input.amount, vat, account, paymentMode, supplier, breakdown);
    id = Number(res.lastInsertRowid);
  }
  audit("CREATE", t, id, `${input.category}: ${input.description} = ${input.amount}`);
  const row = db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id) as EntryRow;
  return { ...row, section: input.section };
}

export function updateEntry(input: EntryInput & { id: number }): EntryRow {
  const t = table(input.section);
  db.prepare(
    `UPDATE ${t} SET date = ?, year = ?, month = ?, category = ?, description = ?, amount = ?, vat = ?, account = ?, paymentMode = ?, supplier = ?, breakdown = ?, updatedAt = datetime('now') WHERE id = ?`
  ).run(input.date, input.year, input.month, input.category, input.description, input.amount, input.vat ?? 0, input.account ?? "", input.paymentMode ?? "", input.supplier ?? "", input.breakdown ?? "", input.id);
  audit("UPDATE", t, input.id, `${input.category}: ${input.description} = ${input.amount}`);
  const row = db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(input.id) as EntryRow;
  return { ...row, section: input.section };
}

export function deleteEntry(section: Section, id: number): void {
  const t = table(section);
  const row = db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id) as EntryRow | undefined;
  db.prepare(`DELETE FROM ${t} WHERE id = ?`).run(id);
  audit("DELETE", t, id, row ? `${row.category}: ${row.description} = ${row.amount}` : "");
}

export function searchEntries(query: string, year?: number): EntryRow[] {
  const rows: EntryRow[] = [];
  const like = `%${query}%`;
  for (const section of Object.keys(TABLE_BY_SECTION) as Section[]) {
    const t = table(section);
    let sql = `SELECT * FROM ${t} WHERE (description LIKE ? OR category LIKE ? OR date LIKE ? OR CAST(year AS TEXT) LIKE ? OR CAST(month AS TEXT) LIKE ?)`;
    const params: (string | number)[] = [like, like, like, like, like];
    if (year) {
      sql += " AND year = ?";
      params.push(year);
    }
    sql += " ORDER BY date DESC LIMIT 200";
    const found = db.prepare(sql).all(...params) as EntryRow[];
    for (const r of found) rows.push({ ...r, section });
  }
  return rows;
}

export function getCompany() {
  return db.prepare("SELECT * FROM Company WHERE id = 1").get();
}

export function updateCompany(data: {
  name: string;
  logo: string;
  address: string;
  tin: string;
  currency: string;
  fiscalYearStart: number;
  decimalPlaces: number;
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
}) {
  db.prepare(
    `UPDATE Company SET name = ?, logo = ?, address = ?, tin = ?, currency = ?, fiscalYearStart = ?, decimalPlaces = ?, preparedBy = ?, checkedBy = ?, approvedBy = ? WHERE id = 1`
  ).run(
    data.name,
    data.logo,
    data.address,
    data.tin,
    data.currency,
    data.fiscalYearStart,
    data.decimalPlaces,
    data.preparedBy,
    data.checkedBy,
    data.approvedBy
  );
  audit("UPDATE", "Company", 1, `Company profile updated`);
  return getCompany();
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM Settings").all() as {
    key: string;
    value: string;
  }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO Settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export function listAuditLogs(limit = 100) {
  return db
    .prepare("SELECT * FROM AuditLogs ORDER BY id DESC LIMIT ?")
    .all(limit);
}

export function getUser() {
  return db.prepare("SELECT * FROM Users WHERE id = 1").get();
}
