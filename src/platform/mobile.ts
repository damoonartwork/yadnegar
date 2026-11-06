// لایهٔ اندروید (Capacitor): همان رابط window.yadnegar نسخهٔ ویندوز را پیاده می‌کند
// تا بقیهٔ برنامه بدون تغییر روی موبایل کار کند.
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { StatusBar, Style } from "@capacitor/status-bar";
import { DEFAULT_SETTINGS, type AppData, type ReminderEvent, type Settings, type Task, type UpdateStatus, type YadnegarAPI } from "@/lib/types";

export const isNative = () => Capacitor.isNativePlatform();

const DATA_KEY = "yadnegar-data";
const CHANNEL = "reminders";
const ACTIONS = "REMINDER";
const REPO = "damoonartwork/yadnegar";

type Listener<T> = (v: T) => void;
const tasksListeners = new Set<Listener<Task[]>>();
const reminderListeners = new Set<Listener<ReminderEvent>>();
const updateListeners = new Set<Listener<UpdateStatus>>();

let data: AppData = { tasks: [], settings: { ...DEFAULT_SETTINGS } };
let updateState: UpdateStatus = { state: "idle" };
let latestApkUrl: string | null = null;
let appVersion = "";

// ---------- ذخیره‌سازی ----------
async function persist() {
  await Preferences.set({ key: DATA_KEY, value: JSON.stringify(data) });
}

// ---------- زمان‌بندی یادآورها با خود اندروید ----------
function dueAt(t: Task): number | null {
  if (t.snoozedUntil) return t.snoozedUntil;
  if (!t.time) return null;
  const [y, m, d] = t.date.split("-").map(Number);
  const [h, min] = t.time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

/** شناسهٔ عددی پایدار برای هر کار (اندروید شناسهٔ عددی می‌خواهد) */
function notifId(taskId: string): number {
  let h = 0;
  for (let i = 0; i < taskId.length; i++) h = (h * 31 + taskId.charCodeAt(i)) | 0;
  return Math.abs(h % 2_000_000_000) + 1;
}

let scheduleTimer: number | undefined;
function scheduleSoon() {
  window.clearTimeout(scheduleTimer);
  scheduleTimer = window.setTimeout(() => void reschedule(), 400);
}

async function reschedule() {
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    const now = Date.now();
    const list: LocalNotificationSchema[] = [];
    for (const t of data.tasks) {
      const due = dueAt(t);
      if (t.done || due === null || due <= now) continue;
      list.push({
        id: notifId(t.id),
        title: t.important ? "⭐ یادآوری کار مهم" : "یادآوری یادنگار",
        body: t.title,
        schedule: { at: new Date(due), allowWhileIdle: true },
        channelId: CHANNEL,
        actionTypeId: ACTIONS,
        smallIcon: "ic_stat_yadnegar",
        iconColor: "#FFFFFF",
        extra: { taskId: t.id, time: t.time ?? "" },
      });
    }
    if (list.length) await LocalNotifications.schedule({ notifications: list });
  } catch (e) {
    console.error("reschedule failed", e);
  }
}

function applyAction(taskId: string, action: "done" | "snooze10" | "snooze60") {
  const t = data.tasks.find((x) => x.id === taskId);
  if (!t) return;
  if (action === "done") t.done = true;
  else t.snoozedUntil = Date.now() + (action === "snooze10" ? 10 : 60) * 60_000;
  void persist();
  scheduleSoon();
  tasksListeners.forEach((cb) => cb([...data.tasks]));
}

// ---------- به‌روزرسانی از GitHub ----------
function setUpdate(patch: Partial<UpdateStatus>) {
  updateState = { ...updateState, ...patch } as UpdateStatus;
  updateListeners.forEach((cb) => cb(updateState));
}

function isNewer(remote: string, local: string) {
  const a = remote.split(".").map((x) => parseInt(x, 10) || 0);
  const b = local.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

async function checkUpdate(): Promise<UpdateStatus> {
  setUpdate({ state: "checking", message: undefined });
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rel = await res.json();
    const version = String(rel.tag_name || "").replace(/^v/, "");
    const apk = (rel.assets || []).find((a: { name: string }) => a.name.toLowerCase().endsWith(".apk"));
    if (apk && version && isNewer(version, appVersion)) {
      latestApkUrl = apk.browser_download_url;
      setUpdate({ state: "available", version });
    } else {
      setUpdate({ state: "none" });
    }
  } catch (e) {
    setUpdate({ state: "error", message: String((e as Error)?.message || e).slice(0, 300) });
  }
  return updateState;
}

// ---------- راه‌اندازی ----------
export async function installMobileBridge() {
  const stored = await Preferences.get({ key: DATA_KEY });
  if (stored.value) {
    try {
      const raw = JSON.parse(stored.value);
      data = { tasks: raw.tasks ?? [], settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) } };
    } catch {
      /* دادهٔ خراب — از نو */
    }
  }
  appVersion = (await App.getInfo()).version;

  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: "یادآوری کارها",
    description: "یادآوری سر ساعت کارها",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
  }).catch(() => {});
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTIONS,
        actions: [
          { id: "done", title: "انجام شد" },
          { id: "snooze10", title: "۱۰ دقیقه بعد" },
        ],
      },
    ],
  }).catch(() => {});

  // وقتی برنامه باز است، یادآور داخل برنامه هم نشان داده شود
  LocalNotifications.addListener("localNotificationReceived", (n) => {
    const taskId = n.extra?.taskId as string | undefined;
    if (!taskId) return;
    reminderListeners.forEach((cb) => cb({ id: taskId, title: n.body ?? "", time: n.extra?.time || undefined }));
  });
  // دکمه‌های داخل اعلان
  LocalNotifications.addListener("localNotificationActionPerformed", (a) => {
    const taskId = a.notification.extra?.taskId as string | undefined;
    if (!taskId) return;
    if (a.actionId === "done" || a.actionId === "snooze10") applyAction(taskId, a.actionId);
  });

  // دکمهٔ بازگشت اندروید: اول پنجره‌های باز بسته شوند، بعد برنامه به پس‌زمینه برود
  App.addListener("backButton", () => {
    const ev = new CustomEvent("yadnegar:back", { cancelable: true });
    if (window.dispatchEvent(ev)) void App.minimizeApp();
  });
  // با برگشتن به برنامه، یادآورها دوباره چیده شوند (مثلاً بعد از تغییر ساعت گوشی)
  App.addListener("resume", () => scheduleSoon());

  const api: YadnegarAPI = {
    platform: "android",
    load: async () => data,
    saveTasks: async (tasks) => {
      data.tasks = tasks;
      await persist();
      scheduleSoon();
    },
    saveSettings: async (settings: Settings) => {
      data.settings = { ...data.settings, ...settings };
      await persist();
    },
    onTasksUpdated: (cb) => {
      tasksListeners.add(cb);
      return () => tasksListeners.delete(cb);
    },
    onReminder: (cb) => {
      reminderListeners.add(cb);
      return () => reminderListeners.delete(cb);
    },
    testNotification: () => {
      void LocalNotifications.schedule({
        notifications: [
          {
            id: 1,
            title: "یادنگار",
            body: "اعلان‌ها درست کار می‌کنند ✨",
            schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
            channelId: CHANNEL,
            smallIcon: "ic_stat_yadnegar",
            iconColor: "#FFFFFF",
          },
        ],
      });
    },
    openNotificationSettings: () => {
      void LocalNotifications.changeExactNotificationSetting().catch(() => {});
    },
    minimize: () => void App.minimizeApp(),
    close: () => void App.minimizeApp(),
    toggleMaximize: () => {},
    togglePin: async () => false,
    appVersion: async () => appVersion,
    getUpdate: async () => updateState,
    checkUpdate,
    downloadUpdate: async () => {
      if (latestApkUrl) await Browser.open({ url: latestApkUrl });
    },
    installUpdate: () => {},
    openReleases: () => void Browser.open({ url: `https://github.com/${REPO}/releases/latest` }),
    onUpdateStatus: (cb) => {
      updateListeners.add(cb);
      return () => updateListeners.delete(cb);
    },
    requestNotificationPermission: async () => {
      const p = await LocalNotifications.requestPermissions();
      const exact = await LocalNotifications.checkExactNotificationSetting().catch(() => ({ exact_alarm: "granted" }));
      return { notifications: p.display === "granted", exact: exact.exact_alarm === "granted" };
    },
    setStatusBar: async (light: boolean) => {
      await StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {});
      await StatusBar.setBackgroundColor({ color: light ? "#eceef2" : "#0a0a0a" }).catch(() => {});
    },
  };
  window.yadnegar = api;

  // اولین اجرا: اجازهٔ اعلان
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") await LocalNotifications.requestPermissions().catch(() => {});
  scheduleSoon();
  setTimeout(() => void checkUpdate(), 6000);
}
