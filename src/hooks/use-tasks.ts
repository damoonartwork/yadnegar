import * as React from "react";
import { DEFAULT_SETTINGS, type AppData, type ReminderEvent, type Settings, type Task } from "@/lib/types";
import { fromKey } from "@/lib/jalali";

const LS_KEY = "yadnegar-data";

export function dueAt(t: Task): number | null {
  if (t.snoozedUntil) return t.snoozedUntil;
  if (!t.time) return null;
  const [h, m] = t.time.split(":").map(Number);
  const d = fromKey(t.date);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** ترتیب قدیمی (پیش از ترتیب دستی) — فقط برای مهاجرت کارهای موجود */
function legacySort(a: Task, b: Task) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.important !== b.important) return a.important ? -1 : 1;
  const da = dueAt(a) ?? Infinity;
  const db = dueAt(b) ?? Infinity;
  if (da !== db) return da - db;
  return b.createdAt - a.createdAt;
}

/** به کارهایی که هنوز ترتیب ندارند، ترتیب یکتا بده */
function withOrder(input: Task[]): Task[] {
  // کارهای قدیمی زمان ویرایش ندارند
  const tasks = input.some((t) => !t.updatedAt) ? input.map((t) => (t.updatedAt ? t : { ...t, updatedAt: t.createdAt })) : input;
  if (tasks.every((t) => typeof t.order === "number")) return tasks;
  let max = Math.max(0, ...tasks.map((t) => t.order ?? 0));
  const missing = tasks.filter((t) => typeof t.order !== "number").sort(legacySort);
  const assigned = new Map(missing.map((t) => [t.id, ++max]));
  return tasks.map((t) => (assigned.has(t.id) ? { ...t, order: assigned.get(t.id) } : t));
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * منبع دادهٔ برنامه. داخل Electron از فایل JSON (از طریق preload) استفاده می‌کند
 * و در مرورگر (npm run dev) به localStorage و Notification مرورگر برمی‌گردد.
 */
export function useTasks() {
  const api = typeof window !== "undefined" ? window.yadnegar : undefined;
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = React.useState(false);
  const [reminders, setReminders] = React.useState<ReminderEvent[]>([]);
  const tasksRef = React.useRef(tasks);
  tasksRef.current = tasks;

  // بارگذاری اولیه
  React.useEffect(() => {
    (async () => {
      let data: AppData | null = null;
      if (api) data = await api.load();
      else {
        try {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) data = JSON.parse(raw);
        } catch {
          /* ignore */
        }
      }
      if (data) {
        setTasks(withOrder(data.tasks ?? []));
        setSettings({ ...DEFAULT_SETTINGS, ...(data.settings ?? {}) });
      }
      setLoaded(true);
    })();
  }, [api]);

  // ذخیره
  React.useEffect(() => {
    if (!loaded) return;
    if (api) api.saveTasks(tasks);
    else {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ tasks, settings }));
      } catch {
        /* ignore */
      }
    }
  }, [tasks, settings, loaded, api]);

  // ذخیرهٔ تنظیمات با کمی تأخیر (برای اسلایدرها)
  React.useEffect(() => {
    if (!loaded || !api) return;
    const t = setTimeout(() => api.saveSettings(settings), 300);
    return () => clearTimeout(t);
  }, [settings, loaded, api]);

  // رویدادهای فرآیند اصلی
  React.useEffect(() => {
    if (!api) return;
    const off1 = api.onTasksUpdated((t) => setTasks(t));
    const off2 = api.onReminder((r) =>
      setReminders((prev) => (prev.some((p) => p.id === r.id) ? prev : [...prev, r]))
    );
    return () => {
      off1();
      off2();
    };
  }, [api]);

  // حالت مرورگر: بررسی یادآورها
  React.useEffect(() => {
    if (api || !loaded) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const tick = () => {
      const now = Date.now();
      const due = tasksRef.current.filter((t) => {
        const at = dueAt(t);
        return !t.done && !t.notified && at !== null && at <= now;
      });
      if (!due.length) return;
      const ids = new Set(due.map((t) => t.id));
      setTasks((prev) => prev.map((t) => (ids.has(t.id) ? { ...t, notified: true } : t)));
      setReminders((r) => [
        ...r.filter((x) => !ids.has(x.id)),
        ...due.map((t) => ({ id: t.id, title: t.title, time: t.time })),
      ]);
      if ("Notification" in window && Notification.permission === "granted") {
        due.forEach((t) => new Notification("یادآوری یادنگار", { body: t.title }));
      }
    };
    tick();
    const iv = setInterval(tick, 15000);
    return () => clearInterval(iv);
  }, [api, loaded]);

  const addTask = React.useCallback(
    (input: { title: string; date: string; time?: string; important: boolean }) => {
      setTasks((prev) => [
        {
          id: uid(),
          done: false,
          createdAt: Date.now(),
          ...input,
          time: input.time || undefined,
          order: Math.max(0, ...prev.map((t) => t.order ?? 0)) + 1,
          updatedAt: Date.now(),
        },
        ...prev,
      ]);
    },
    []
  );

  const updateTask = React.useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch, updatedAt: Date.now() };
        // اگر ساعت یا روز عوض شد، یادآوری دوباره فعال شود
        if (patch.time !== undefined || patch.date !== undefined) {
          next.notified = false;
          next.snoozedUntil = undefined;
        }
        return next;
      })
    );
  }, []);

  /**
   * جابه‌جایی دستی: همان مقادیر ترتیبِ کارهای این لیست را به ترتیب جدید می‌دهد
   * تا جای کارهای دیگر (روزهای دیگر) دست نخورد.
   */
  const reorderTasks = React.useCallback((ids: string[]) => {
    setTasks((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      const slots = ids
        .map((id) => byId.get(id)?.order ?? 0)
        .sort((a, b) => a - b);
      const next = new Map(ids.map((id, i) => [id, slots[i]]));
      const now = Date.now();
      return prev.map((t) => (next.has(t.id) && t.order !== next.get(t.id) ? { ...t, order: next.get(t.id), updatedAt: now } : t));
    });
  }, []);

  const removeTask = React.useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissReminder = React.useCallback((id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const snooze = React.useCallback((id: string, minutes: number) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, notified: false, snoozedUntil: Date.now() + minutes * 60_000, updatedAt: Date.now() } : t
      )
    );
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /** جایگزینی مستقیم (برای اعمال تغییرهای دستگاه‌های دیگر) */
  const replaceTasks = React.useCallback((fn: (prev: Task[]) => Task[]) => setTasks(fn), []);

  return {
    tasks,
    replaceTasks,
    settings,
    setSettings,
    loaded,
    reminders,
    addTask,
    reorderTasks,
    updateTask,
    removeTask,
    dismissReminder,
    snooze,
    isDesktop: !!api,
  };
}
