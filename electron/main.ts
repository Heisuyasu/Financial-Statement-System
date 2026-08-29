import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "path";
import fs from "fs";
import {
  initDatabase,
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  searchEntries,
  getCompany,
  updateCompany,
  getAllSettings,
  setSetting,
  listAuditLogs,
  getUser,
  getDbPath,
  backupDatabase,
  closeDatabase,
  EntryInput,
  Section,
} from "./db";

let mainWindow: BrowserWindow | null = null;

// ----- Automatic backups -----
const AUTO_BACKUP_KEEP = 14; // keep the newest 14 daily backups

function autoBackupDir(): string {
  return path.join(app.getPath("userData"), "backups");
}

async function runAutoBackup(): Promise<void> {
  try {
    const dir = autoBackupDir();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const dest = path.join(dir, `AutoBackup_${stamp}.db`);
    if (!fs.existsSync(dest)) {
      await backupDatabase(dest);
    }
    // Prune: keep only the newest AUTO_BACKUP_KEEP files
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("AutoBackup_") && f.endsWith(".db"))
      .sort();
    while (files.length > AUTO_BACKUP_KEEP) {
      const oldest = files.shift();
      if (oldest) fs.unlinkSync(path.join(dir, oldest));
    }
  } catch (err) {
    console.error("Auto backup failed:", err);
  }
}

/** Validates + restores the database from srcPath, then restarts the app. */
function restoreFromFile(srcPath: string): { restored: boolean; error?: string } {
  if (!fs.existsSync(srcPath)) {
    return { restored: false, error: "Backup file not found." };
  }
  const header = Buffer.alloc(16);
  const fd = fs.openSync(srcPath, "r");
  fs.readSync(fd, header, 0, 16, 0);
  fs.closeSync(fd);
  if (!header.toString("utf8").startsWith("SQLite format 3")) {
    return { restored: false, error: "That file is not a valid database backup." };
  }

  const dbPath = getDbPath();
  closeDatabase();
  // Keep a safety copy of the current data before overwriting
  fs.copyFileSync(dbPath, `${dbPath}.pre-restore`);
  for (const suffix of ["-wal", "-shm"]) {
    const p = `${dbPath}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  fs.copyFileSync(srcPath, dbPath);

  // Restart the app so every window reloads from the restored database
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 600);
  return { restored: true };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: "#021A54",
    title: "YTS Financial Statement Generator",
    icon: path.join(__dirname, "../Images/logo.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    // DevTools no longer opens automatically; press F12 / Ctrl+Shift+I when needed
    if (process.env.OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function registerIpc(): void {
  ipcMain.handle("entries:list", (_e, year: number, month?: number) =>
    listEntries(year, month)
  );
  ipcMain.handle("entries:create", (_e, input: EntryInput) => createEntry(input));
  ipcMain.handle("entries:update", (_e, input: EntryInput & { id: number }) =>
    updateEntry(input)
  );
  ipcMain.handle("entries:delete", (_e, section: Section, id: number) =>
    deleteEntry(section, id)
  );
  ipcMain.handle("entries:search", (_e, query: string, year?: number) =>
    searchEntries(query, year)
  );

  ipcMain.handle("company:get", () => getCompany());
  ipcMain.handle("company:update", (_e, data) => updateCompany(data));

  ipcMain.handle("settings:getAll", () => getAllSettings());
  ipcMain.handle("settings:set", (_e, key: string, value: string) =>
    setSetting(key, value)
  );

  ipcMain.handle("audit:list", (_e, limit?: number) => listAuditLogs(limit));
  ipcMain.handle("user:get", () => getUser());

  ipcMain.handle(
    "file:save",
    async (
      _e,
      options: { defaultName: string; filterName: string; extensions: string[] },
      data: ArrayBuffer
    ) => {
      if (!mainWindow) return { saved: false };
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: options.defaultName,
        filters: [{ name: options.filterName, extensions: options.extensions }],
      });
      if (result.canceled || !result.filePath) return { saved: false };
      fs.writeFileSync(result.filePath, Buffer.from(data));
      return { saved: true, path: result.filePath };
    }
  );

  // ----- Database backup & restore -----
  ipcMain.handle("db:backup", async () => {
    if (!mainWindow) return { saved: false };
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save database backup",
      defaultPath: `FinancialStatements_Backup_${stamp}.db`,
      filters: [{ name: "SQLite Database", extensions: ["db"] }],
    });
    if (result.canceled || !result.filePath) return { saved: false };
    await backupDatabase(result.filePath);
    return { saved: true, path: result.filePath };
  });

  ipcMain.handle("db:restore", async () => {
    if (!mainWindow) return { restored: false };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose a backup to restore",
      properties: ["openFile"],
      filters: [{ name: "SQLite Database", extensions: ["db"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return { restored: false };
    return restoreFromFile(result.filePaths[0]);
  });

  ipcMain.handle("db:restoreFrom", (_e, srcPath: string) => restoreFromFile(srcPath));

  ipcMain.handle("db:autoBackups", () => {
    const dir = autoBackupDir();
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("AutoBackup_") && f.endsWith(".db"))
      .map((f) => {
        const full = path.join(dir, f);
        const st = fs.statSync(full);
        return { name: f, path: full, size: st.size, modified: st.mtime.toISOString() };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
  });

  ipcMain.handle("logo:pick", async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === "jpg" ? "jpeg" : ext;
    const base64 = fs.readFileSync(filePath).toString("base64");
    return `data:image/${mime};base64,${base64}`;
  });
}

// Disable GPU shader disk cache to prevent Windows cache lock errors (Access is denied / cache_util_win.cc)
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

app.whenReady().then(() => {
  initDatabase();
  registerIpc();
  createWindow();

  // Daily automatic backup: once on launch, then re-checked every 6 hours
  runAutoBackup();
  setInterval(runAutoBackup, 6 * 60 * 60 * 1000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
