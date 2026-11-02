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
        setTasks(data.tasks ?? []);
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
        { id: uid(), done: false, createdAt: Date.now(), ...input, time: input.time || undefined },
        ...prev,
      ]);
    },
    []
  );

  const updateTask = React.useCallback((id: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        // اگر ساعت یا روز عوض شد، یادآوری دوباره فعال شود
        if (patch.time !== undefined || patch.date !== undefined) {
          next.notified = false;
          next.snoozedUntil = undefined;
        }
        return next;
      })
    );
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
        t.id === id ? { ...t, notified: false, snoozedUntil: Date.now() + minutes * 60_000 } : t
      )
    );
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    tasks,
    settings,
    setSettings,
    loaded,
    reminders,
    addTask,
    updateTask,
    removeTask,
    dismissReminder,
    snooze,
    isDesktop: !!api,
  };
}
