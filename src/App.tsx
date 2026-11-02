import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { GlassCalendar, type DayMark } from "@/components/ui/glass-calendar";
import { LiquidGlassButton } from "@/components/ui/liquid-glass-button";
import { Glass } from "@/components/todo/glass";
import { TitleBar } from "@/components/todo/title-bar";
import { ClockCard } from "@/components/todo/clock-card";
import { GregorianCard } from "@/components/todo/gregorian-card";
import { NotesCard } from "@/components/todo/notes-card";
import { UpcomingStrip } from "@/components/todo/upcoming-strip";
import { AddTask, type AddTaskHandle } from "@/components/todo/add-task";
import { TaskItem } from "@/components/todo/task-item";
import { ReminderToasts } from "@/components/todo/reminder-toast";
import { SettingsPanel } from "@/components/todo/settings-panel";
import { useTasks, dueAt } from "@/hooks/use-tasks";
import { dayKey, jDay, longFa, monthName, toFa } from "@/lib/jalali";
import { isSameDay } from "date-fns";
import { Backdrop } from "@/components/todo/backdrop";
import type { Task } from "@/lib/types";

type Filter = "day" | "important" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "day", label: "این روز" },
  { id: "important", label: "مهم‌ها" },
  { id: "all", label: "همه" },
];

function sortTasks(a: Task, b: Task) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.important !== b.important) return a.important ? -1 : 1;
  const da = dueAt(a) ?? Infinity;
  const db = dueAt(b) ?? Infinity;
  if (da !== db) return da - db;
  return b.createdAt - a.createdAt;
}

export default function App() {
  const store = useTasks();
  const { tasks } = store;
  const [selected, setSelected] = React.useState(new Date());
  const [filter, setFilter] = React.useState<Filter>("day");
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const addRef = React.useRef<AddTaskHandle>(null);

  const selectedKey = dayKey(selected);

  const marks = React.useMemo(() => {
    const m: Record<string, DayMark> = {};
    for (const t of tasks) {
      if (t.done) continue;
      const cur = m[t.date] ?? { count: 0, important: false };
      m[t.date] = { count: cur.count + 1, important: cur.important || t.important };
    }
    return m;
  }, [tasks]);

  const visible = React.useMemo(() => {
    let list = tasks;
    if (filter === "day") list = tasks.filter((t) => t.date === selectedKey);
    else if (filter === "important") list = tasks.filter((t) => t.important && !t.done);
    return [...list].sort(sortTasks);
  }, [tasks, filter, selectedKey]);

  const dayTasks = tasks.filter((t) => t.date === selectedKey);
  const doneCount = dayTasks.filter((t) => t.done).length;
  const progress = dayTasks.length ? doneCount / dayTasks.length : 0;

  const pickDate = (d: Date) => {
    setSelected(d);
    setFilter("day");
  };

  // اعمال تنظیمات شیشه روی کل برنامه
  const { glassBlur, glassTint, glassEdge } = store.settings;
  React.useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--g-blur", `${glassBlur}px`);
    r.setProperty("--g-tint", String(glassTint / 100));
    r.setProperty("--g-edge", String(glassEdge / 100));
  }, [glassBlur, glassTint, glassEdge]);

  // میانبر Ctrl+N برای کار جدید
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "n" || e.key === "N" || e.key === "د")) {
        e.preventDefault();
        addRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div dir="rtl" className="flex h-full flex-col">
      <Backdrop settings={store.settings} />
      <TitleBar onSettings={() => setSettingsOpen(true)} />

      {/* شبکهٔ ۲×۲: کارت‌های هر ردیف هم‌ارتفاع و هر ستون هم‌عرض هستند */}
      <main className="grid min-h-0 flex-1 grid-cols-[340px_1fr] grid-rows-[156px_88px_auto_minmax(0,1fr)] gap-5 px-6 pt-2 pb-6">
        <ClockCard tasks={tasks} className="col-start-1 row-start-1 h-full" />
        <UpcomingStrip tasks={tasks} onPick={pickDate} className="col-start-2 row-start-1 h-full min-w-0" />
        <GregorianCard className="col-start-1 row-start-2 h-full" />

        <Glass className="col-start-1 row-start-3" contentClassName="p-4">
          <GlassCalendar
            variant="bare"
            defaultView="monthly"
            showFooter={false}
            compact
            selectedDate={selected}
            onDateSelect={pickDate}
            marks={marks}
          />
        </Glass>

        <NotesCard
          className="col-start-1 row-start-4 h-full min-h-0"
          tasks={tasks}
          note={store.settings.quickNote}
          onNoteChange={(v) => store.setSettings((s) => ({ ...s, quickNote: v }))}
        />

        <section className="col-start-2 row-span-3 row-start-2 flex min-h-0 min-w-0 flex-col">
          <Glass className="min-h-0 flex-1" contentClassName="flex h-full flex-col p-6">
            <div className="mb-5 flex shrink-0 items-start justify-between gap-4">
              <div>
                <h1 className="glow-text text-2xl font-bold">
                  {filter === "day" ? longFa(selected) : filter === "important" ? "کارهای مهم" : "همهٔ کارها"}
                </h1>
                <div className="mt-2 flex h-4 items-center gap-2">
                  {filter === "day" && dayTasks.length > 0 && (
                    <>
                      <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className="h-full rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                          animate={{ width: `${progress * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-white/45">
                        {toFa(doneCount)} از {toFa(dayTasks.length)} انجام شد
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {FILTERS.map((f) => (
                  <LiquidGlassButton key={f.id} size="sm" active={filter === f.id} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </LiquidGlassButton>
                ))}
              </div>
            </div>

            <ul className="thin-scroll -mx-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              <AnimatePresence initial={false}>
                {visible.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    showDate={filter !== "day"}
                    onToggle={() => store.updateTask(t.id, { done: !t.done })}
                    onImportant={() => store.updateTask(t.id, { important: !t.important })}
                    onRemove={() => store.removeTask(t.id)}
                    onEdit={(patch) => store.updateTask(t.id, patch)}
                  />
                ))}
              </AnimatePresence>
              {store.loaded && visible.length === 0 && (
                <motion.li
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-white/35"
                >
                  <Sparkles className="h-7 w-7" />
                  <p className="text-sm">{filter === "important" ? "کار مهم باقی‌مانده‌ای نداری" : "برای این روز کاری نیست"}</p>
                  <p className="text-xs text-white/25">از کادر پایین یک کار اضافه کن (Ctrl+N)</p>
                </motion.li>
              )}
            </ul>

            <div className="mt-4 shrink-0">
              <AddTask
                ref={addRef}
                dateLabel={isSameDay(selected, new Date()) ? "امروز" : `${toFa(jDay(selected))} ${monthName(selected)}`}
                onAdd={(v) => {
                  store.addTask({ ...v, date: selectedKey });
                  if (filter !== "day") setFilter("day");
                }}
              />
            </div>
          </Glass>
        </section>
      </main>

      <ReminderToasts
        reminders={store.reminders}
        onDone={(id) => {
          store.updateTask(id, { done: true });
          store.dismissReminder(id);
        }}
        onSnooze={store.snooze}
        onDismiss={store.dismissReminder}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={store.settings}
        onChange={store.setSettings}
        isDesktop={store.isDesktop}
      />
    </div>
  );
}
