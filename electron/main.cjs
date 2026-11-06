// فرآیند اصلی Electron — پنجره، System Tray، ذخیره‌سازی و یادآورها
const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, shell, screen, session } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const updater = require("./updater.cjs");
const fs = require("node:fs");

const APP_ID = "ir.yadnegar.app";
const ROOT = path.join(__dirname, "..");
const ICON_ASAR = path.join(ROOT, "build", "icon.png");
const TRAY_ICON = path.join(ROOT, "build", "tray.png");
const INDEX_HTML = path.join(ROOT, "dist", "index.html");
const CHECK_EVERY_MS = 15_000;
const MISSED_WINDOW_MS = 24 * 60 * 60 * 1000; // یادآورهای جامانده تا ۲۴ ساعت قبل هنوز اعلام می‌شوند

const POPUP_W = 400;
const POPUP_H = 190;
const POPUP_GAP = 12;

let win = null;
let tray = null;
let quitting = false;
let iconOnDisk = ICON_ASAR;
const fired = new Set(); // جلوگیری از اعلان تکراری در یک اجرا
const liveNotifications = new Set(); // نگه داشتن ارجاع؛ وگرنه ویندوز ممکن است اعلان را نشان ندهد
const popups = new Map(); // id → BrowserWindow

// ---------- ذخیره‌سازی ----------
const dataFile = () => path.join(app.getPath("userData"), "yadnegar-data.json");
let data = {
  tasks: [],
  settings: { autoStart: true, closeToTray: true, popupReminder: true, windowsNotification: true, sound: true },
};

function loadData() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataFile(), "utf8"));
    data = { tasks: raw.tasks || [], settings: { ...data.settings, ...(raw.settings || {}) } };
  } catch {
    /* اولین اجرا */
  }
}

function saveData() {
  try {
    const file = dataFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data), "utf8");
    fs.renameSync(tmp, file);
  } catch (e) {
    console.error("save failed", e);
  }
}

function broadcastTasks() {
  if (win && !win.isDestroyed()) win.webContents.send("tasks-updated", data.tasks);
}

/** ویندوز نمی‌تواند آیکن اعلان را از داخل فایل asar بخواند؛ یک نسخه روی دیسک می‌سازیم */
function prepareIcon() {
  try {
    const target = path.join(app.getPath("userData"), "notify-icon.png");
    const icon = fs.readFileSync(ICON_ASAR);
    // اگر آیکن برنامه عوض شده باشد، نسخهٔ روی دیسک هم به‌روز شود
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(icon)) fs.writeFileSync(target, icon);
    iconOnDisk = target;
  } catch (e) {
    console.error("icon copy failed", e);
  }
}

// ---------- یادآورها ----------
function dueAt(t) {
  if (t.snoozedUntil) return t.snoozedUntil;
  if (!t.time) return null;
  const [y, m, d] = t.date.split("-").map(Number);
  const [h, min] = t.time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

function showWindow() {
  if (!win) return createWindow(true);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function showWindowsNotification(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: iconOnDisk, silent: false });
  liveNotifications.add(n);
  const drop = () => liveNotifications.delete(n);
  n.on("click", () => {
    drop();
    showWindow();
  });
  n.on("close", drop);
  n.on("failed", (_e, err) => {
    drop();
    console.error("notification failed:", err);
  });
  n.show();
  setTimeout(drop, 10 * 60 * 1000);
}

/** چیدن پنجره‌های یادآوری از پایین به بالا در گوشهٔ صفحه */
function layoutPopups() {
  const wa = screen.getPrimaryDisplay().workArea;
  let i = 0;
  for (const p of popups.values()) {
    if (p.isDestroyed()) continue;
    const x = wa.x + wa.width - POPUP_W - 16;
    const y = wa.y + wa.height - (POPUP_H + POPUP_GAP) * (i + 1) - 4;
    p.setBounds({ x, y, width: POPUP_W, height: POPUP_H });
    i++;
  }
}

function showPopup(payload) {
  const existing = popups.get(payload.id);
  if (existing && !existing.isDestroyed()) existing.close();

  const p = new BrowserWindow({
    width: POPUP_W,
    height: POPUP_H,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    icon: iconOnDisk,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  p.setAlwaysOnTop(true, "screen-saver");
  const query = new URLSearchParams({
    id: payload.id,
    title: payload.title,
    time: payload.time || "",
    important: payload.important ? "1" : "",
    sound: data.settings.sound ? "1" : "",
  }).toString();
  p.loadFile(INDEX_HTML, { hash: `popup?${query}` });
  popups.set(payload.id, p);
  layoutPopups();
  p.once("ready-to-show", () => p.showInactive());
  p.on("closed", () => {
    popups.delete(payload.id);
    layoutPopups();
  });
}

function fireReminder(t) {
  const title = t.important ? "⭐ یادآوری کار مهم" : "یادآوری یادنگار";
  if (data.settings.windowsNotification !== false) showWindowsNotification(title, t.title);
  if (data.settings.popupReminder !== false) {
    showPopup({ id: t.id, title: t.title, time: t.time, important: t.important });
  } else if (win && !win.isDestroyed()) {
    win.webContents.send("reminder", { id: t.id, title: t.title, time: t.time });
  }
  if (win && !win.isDestroyed() && !win.isFocused()) win.flashFrame(true);
}

function checkReminders() {
  const now = Date.now();
  let changed = false;

  for (const t of data.tasks) {
    if (t.done || t.notified) continue;
    const due = dueAt(t);
    if (due === null || due > now) continue;

    const key = `${t.id}|${due}`;
    t.notified = true;
    changed = true;
    if (fired.has(key)) continue;
    fired.add(key);

    if (now - due > MISSED_WINDOW_MS) continue; // خیلی قدیمی — بی‌صدا رد شود
    fireReminder(t);
  }

  if (changed) {
    saveData();
    broadcastTasks();
  }
}

function applyReminderAction(id, action) {
  const popup = popups.get(id);
  if (action === "open") showWindow();
  if (id !== "__test") {
    const t = data.tasks.find((x) => x.id === id);
    if (t) {
      if (action === "done" || action === "snooze10" || action === "snooze60") t.updatedAt = Date.now();
      if (action === "done") t.done = true;
      if (action === "snooze10" || action === "snooze60") {
        t.snoozedUntil = Date.now() + (action === "snooze10" ? 10 : 60) * 60_000;
        t.notified = false;
      }
      saveData();
      broadcastTasks();
    }
  }
  if (popup && !popup.isDestroyed()) popup.close();
}

// ---------- اجرا همراه ویندوز ----------
function applyAutoStart() {
  if (!app.isPackaged) return; // در حالت توسعه، electron.exe را در استارت‌آپ ثبت نکن
  // نسخهٔ پرتابل از پوشهٔ موقت اجرا می‌شود؛ باید مسیر خود فایل exe ثبت شود
  const portableExe = process.env.PORTABLE_EXECUTABLE_FILE;
  app.setLoginItemSettings({
    openAtLogin: !!data.settings.autoStart,
    args: ["--hidden"],
    ...(portableExe ? { path: portableExe } : {}),
  });
}

// ---------- پنجرهٔ اصلی ----------
function createWindow(forceShow = false) {
  win = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 1000,
    minHeight: 790,
    center: true,
    frame: false,
    show: false,
    backgroundColor: "#0a0a0a",
    title: "یادنگار",
    icon: iconOnDisk,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  win.loadFile(INDEX_HTML);

  const startHidden = process.argv.includes("--hidden") && !forceShow;
  win.once("ready-to-show", () => {
    if (!startHidden) win.show();
  });

  win.on("focus", () => win.flashFrame(false));
  win.on("maximize", () => win.webContents.send("maximize-change", true));
  win.on("unmaximize", () => win.webContents.send("maximize-change", false));

  win.on("close", (e) => {
    if (!quitting && data.settings.closeToTray) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on("closed", () => (win = null));

  // لینک‌های بیرونی در مرورگر باز شوند
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function createTray() {
  const img = nativeImage.createFromPath(TRAY_ICON);
  tray = new Tray(img.isEmpty() ? nativeImage.createFromPath(ICON_ASAR).resize({ width: 16 }) : img);
  tray.setToolTip("یادنگار");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "نمایش یادنگار", click: showWindow },
      { type: "separator" },
      {
        label: "خروج کامل",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("click", () => {
    if (win && win.isVisible() && win.isFocused()) win.hide();
    else showWindow();
  });
}

// ---------- به‌روزرسانی از GitHub Releases ----------
let updateState = { state: "idle" };
function sendUpdate(patch) {
  updateState = { ...updateState, ...patch };
  if (win && !win.isDestroyed()) win.webContents.send("update-status", updateState);
}

/** پروکسی تنظیم‌شده در ویندوز (مثلاً فیلترشکن) برای آدرس GitHub */
async function systemProxyRule() {
  try {
    return await session.defaultSession.resolveProxy("https://github.com");
  } catch {
    return "DIRECT";
  }
}

/** فقط نسخهٔ نصبی می‌تواند خودش را به‌روز کند (نه حالت توسعه و نه پرتابل) */
function canUpdate() {
  if (process.env.YADNEGAR_TEST_VERSION) return true; // فقط برای آزمایش
  return app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE;
}
const currentVersion = () => process.env.YADNEGAR_TEST_VERSION || app.getVersion();

let latestInfo = null;
let installerPath = null;
let busy = false;

async function checkForUpdates() {
  if (!canUpdate()) {
    sendUpdate({ state: "unsupported" });
    return updateState;
  }
  if (busy || updateState.state === "ready") return updateState;
  busy = true;
  sendUpdate({ state: "checking", message: undefined });
  try {
    const info = await updater.checkLatest({ proxyRule: await systemProxyRule() });
    if (updater.isNewer(info.version, currentVersion())) {
      latestInfo = info;
      sendUpdate({ state: "available", version: info.version });
    } else {
      sendUpdate({ state: "none" });
    }
  } catch (e) {
    sendUpdate({ state: "error", message: String((e && e.message) || e).slice(0, 300) });
  } finally {
    busy = false;
  }
  return updateState;
}

async function downloadUpdate() {
  if (!latestInfo || busy) return;
  busy = true;
  sendUpdate({ state: "downloading", percent: 0 });
  try {
    const dir = path.join(app.getPath("temp"), "yadnegar-update");
    installerPath = await updater.download(latestInfo, dir, {
      proxyRule: await systemProxyRule(),
      onProgress: (pct) => sendUpdate({ state: "downloading", percent: pct }),
    });
    sendUpdate({ state: "ready", version: latestInfo.version, percent: 100 });
  } catch (e) {
    sendUpdate({ state: "error", message: String((e && e.message) || e).slice(0, 300) });
  } finally {
    busy = false;
  }
}

/** نصب بی‌صدا و اجرای دوبارهٔ برنامه بعد از نصب */
function installUpdate() {
  if (!installerPath || !fs.existsSync(installerPath)) return;
  quitting = true;
  const child = spawn(installerPath, ["/S", "--updated", "--force-run"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  app.quit();
}

ipcMain.handle("app-version", () => currentVersion());
ipcMain.handle("update-get", () => updateState);
ipcMain.handle("update-check", () => checkForUpdates());
ipcMain.handle("update-download", () => downloadUpdate());
ipcMain.on("open-releases", () => shell.openExternal("https://github.com/damoonartwork/yadnegar/releases/latest"));
ipcMain.on("update-install", installUpdate);

// ---------- IPC ----------
ipcMain.handle("load", () => data);
ipcMain.handle("save-tasks", (_e, tasks) => {
  if (Array.isArray(tasks)) {
    data.tasks = tasks;
    saveData();
    checkReminders();
  }
});
ipcMain.handle("save-settings", (_e, settings) => {
  data.settings = { ...data.settings, ...settings };
  saveData();
  applyAutoStart();
});
ipcMain.handle("toggle-pin", () => {
  if (!win) return false;
  const next = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(next);
  return next;
});
ipcMain.on("minimize", () => win && win.minimize());
ipcMain.on("close", () => win && win.close());
ipcMain.on("toggle-maximize", () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on("test-notification", () => {
  fireReminder({ id: "__test", title: "این یک یادآوری آزمایشی است ✨", time: "", important: false });
});
ipcMain.on("open-notification-settings", () => shell.openExternal("ms-settings:notifications"));
ipcMain.on("reminder-action", (_e, { id, action }) => applyReminderAction(id, action));

// بعضی آنتی‌ویروس‌ها و فیلترشکن‌ها پردازهٔ شبکهٔ محدودشدهٔ کرومیوم را مسدود می‌کنند
app.commandLine.appendSwitch("disable-features", "NetworkServiceSandbox");

// ---------- چرخهٔ عمر ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID); // باید با AppUserModelID میان‌بر نصب‌کننده یکی باشد
    Menu.setApplicationMenu(null);
    prepareIcon();
    loadData();
    applyAutoStart();
    createWindow();
    createTray();
    checkReminders();
    setInterval(checkReminders, CHECK_EVERY_MS);
    // بررسی بی‌صدا چند ثانیه بعد از اجرا و سپس هر ۶ ساعت
    setTimeout(() => canUpdate() && checkForUpdates(), 8000);
    setInterval(() => canUpdate() && checkForUpdates(), 6 * 60 * 60 * 1000);
    screen.on("display-metrics-changed", layoutPopups);
  });

  app.on("before-quit", () => (quitting = true));
  app.on("window-all-closed", () => {
    if (!data.settings.closeToTray) app.quit();
  });
}
