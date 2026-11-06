import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ListTodo, NotebookPen, Settings } from "lucide-react";
import { GlassCalendar, type DayMark } from "@/components/ui/glass-calendar";
import { Glass } from "@/components/todo/glass";
import { ClockCard } from "@/components/todo/clock-card";
import { GregorianCard } from "@/components/todo/gregorian-card";
import { NotesCard } from "@/components/todo/notes-card";
import { UpcomingStrip } from "@/components/todo/upcoming-strip";
import { TaskPanel, type Filter } from "@/components/todo/task-panel";
import type { AddTaskHandle } from "@/components/todo/add-task";
import type { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

type Tab = "tasks" | "calendar" | "notes";

const TABS: { id: Tab; label: string; Icon: typeof ListTodo }[] = [
  { id: "tasks", label: "کارها", Icon: ListTodo },
  { id: "calendar", label: "تقویم", Icon: CalendarDays },
  { id: "notes", label: "یادداشت", Icon: NotebookPen },
];

interface Props {
  store: ReturnType<typeof useTasks>;
  selected: Date;
  pickDate: (d: Date) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  marks: Record<string, DayMark>;
  addRef: React.RefObject<AddTaskHandle>;
  onSettings: () => void;
  settingsOpen: boolean;
  closeSettings: () => void;
}

/** چیدمان موبایل: نوار بالا، سه زبانه و نوار زبانه‌های پایین */
export function MobileApp({ store, selected, pickDate, filter, setFilter, marks, addRef, onSettings, settingsOpen, closeSettings }: Props) {
  const [tab, setTab] = React.useState<Tab>("tasks");

  // دکمهٔ بازگشت اندروید
  React.useEffect(() => {
    const onBack = (e: Event) => {
      if (settingsOpen) {
        closeSettings();
        e.preventDefault();
      } else if (tab !== "tasks") {
        setTab("tasks");
        e.preventDefault();
      }
    };
    window.addEventListener("yadnegar:back", onBack);
    return () => window.removeEventListener("yadnegar:back", onBack);
  }, [settingsOpen, tab, closeSettings]);

  return (
    <div dir="rtl" className="flex h-full flex-col">
      {/* نوار بالا */}
      <header className="flex shrink-0 items-center justify-between px-5 pt-3 pb-2">
        <div className="flex items-center gap-2 text-[15px] font-bold text-white/85">
          <img src="./logo.png" alt="" className="yg-logo h-6 w-6" draggable={false} />
          یادنگار
        </div>
        <button
          onClick={onSettings}
          title="تنظیمات"
          className="grid h-10 w-10 place-items-center rounded-full text-white/70 transition-colors active:bg-white/10"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      <main className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {tab === "tasks" && (
            <motion.section
              key="tasks"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex flex-col gap-3 px-3 pb-3"
            >
              <Glass className="shrink-0" contentClassName="px-4 pt-3 pb-4">
                <GlassCalendar
                  variant="bare"
                  defaultView="weekly"
                  showFooter={false}
                  selectedDate={selected}
                  onDateSelect={pickDate}
                  marks={marks}
                />
              </Glass>
              <Glass className="min-h-0 flex-1" contentClassName="flex h-full flex-col p-4">
                <TaskPanel store={store} selected={selected} filter={filter} setFilter={setFilter} addRef={addRef} touch />
              </Glass>
            </motion.section>
          )}

          {tab === "calendar" && (
            <motion.section
              key="calendar"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="thin-scroll absolute inset-0 flex flex-col gap-3 overflow-y-auto px-3 pb-3"
            >
              <ClockCard tasks={store.tasks} className="h-[140px] shrink-0" />
              <GregorianCard
                className="h-[84px] shrink-0"
                zone={store.settings.worldZone}
                onZoneChange={(z) => store.setSettings((s) => ({ ...s, worldZone: z }))}
              />
              <Glass className="shrink-0" contentClassName="p-4">
                <GlassCalendar
                  variant="bare"
                  defaultView="monthly"
                  showFooter={false}
                  compact
                  selectedDate={selected}
                  onDateSelect={(d) => {
                    pickDate(d);
                    setTab("tasks");
                  }}
                  marks={marks}
                />
              </Glass>
              <UpcomingStrip
                tasks={store.tasks}
                scroll
                className="shrink-0"
                onPick={(d) => {
                  pickDate(d);
                  setTab("tasks");
                }}
              />
            </motion.section>
          )}

          {tab === "notes" && (
            <motion.section
              key="notes"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex flex-col px-3 pb-3"
            >
              <NotesCard
                className="min-h-0 flex-1"
                tasks={store.tasks}
                note={store.settings.quickNote}
                onNoteChange={(v) => store.setSettings((s) => ({ ...s, quickNote: v }))}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* نوار زبانه‌های پایین */}
      <nav className="shrink-0 px-4 pt-1 pb-4">
        <div className="yg-glass-bar mx-auto flex max-w-md items-center justify-between rounded-full border border-white/10 p-1.5">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold transition-colors",
                  active ? "text-black" : "text-white/60"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.3)]"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
