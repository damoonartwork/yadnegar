import * as React from "react";
import { AnimatePresence, Reorder, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { isSameDay } from "date-fns";
import { LiquidGlassButton } from "@/components/ui/liquid-glass-button";
import { AddTask, type AddTaskHandle } from "./add-task";
import { TaskItem } from "./task-item";
import type { useTasks } from "@/hooks/use-tasks";
import { dayKey, jDay, longFa, monthName, toFa } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

export type Filter = "day" | "important" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "day", label: "این روز" },
  { id: "important", label: "مهم‌ها" },
  { id: "all", label: "همه" },
];

/** ترتیب دستی؛ در نماهای چندروزه اول بر اساس روز */
function sortTasks(byDate: boolean) {
  return (a: Task, b: Task) => {
    if (byDate && a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.order ?? 0) - (b.order ?? 0) || b.createdAt - a.createdAt;
  };
}

interface Props {
  store: ReturnType<typeof useTasks>;
  selected: Date;
  filter: Filter;
  setFilter: (f: Filter) => void;
  addRef: React.RefObject<AddTaskHandle>;
  /** نسخهٔ موبایل: جابه‌جایی با گرفتن شماره، دکمه‌ها همیشه پیدا */
  touch?: boolean;
}

/** سربرگ روز، فیلترها، لیست کارها با جابه‌جایی، و کادر افزودن */
export function TaskPanel({ store, selected, filter, setFilter, addRef, touch }: Props) {
  const { tasks } = store;
  const selectedKey = dayKey(selected);

  const visible = React.useMemo(() => {
    let list = tasks;
    if (filter === "day") list = tasks.filter((t) => t.date === selectedKey);
    else if (filter === "important") list = tasks.filter((t) => t.important && !t.done);
    return [...list].sort(sortTasks(filter !== "day"));
  }, [tasks, filter, selectedKey]);

  // در حین کشیدن، ترتیب موقت محلی است و با رها کردن ذخیره می‌شود
  const [dragList, setDragList] = React.useState<Task[] | null>(null);
  const dragRef = React.useRef<Task[] | null>(null);
  const shown = dragList ?? visible;
  const canDrag = filter === "day" && visible.length > 1;
  const commitDrag = () => {
    if (dragRef.current) store.reorderTasks(dragRef.current.map((t) => t.id));
    dragRef.current = null;
    setDragList(null);
  };

  const dayTasks = tasks.filter((t) => t.date === selectedKey);
  const doneCount = dayTasks.filter((t) => t.done).length;
  const progress = dayTasks.length ? doneCount / dayTasks.length : 0;

  return (
    <>
      <div className={cn("flex shrink-0 justify-between gap-3", touch ? "mb-3 flex-col" : "mb-5 items-start gap-4")}>
        <div>
          <h1 className={cn("glow-text font-bold", touch ? "text-lg" : "text-2xl")}>
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

      <Reorder.Group
        as="ul"
        axis="y"
        layoutScroll
        values={shown}
        onReorder={(list) => {
          dragRef.current = list;
          setDragList(list);
        }}
        className="thin-scroll -mx-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
      >
        <AnimatePresence initial={false}>
          {shown.map((t, i) => (
            <TaskItem
              key={t.id}
              task={t}
              index={i}
              draggable={canDrag}
              touch={touch}
              onDragEnd={commitDrag}
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
            <p className="text-xs text-white/25">{touch ? "از کادر پایین یک کار اضافه کن" : "از کادر پایین یک کار اضافه کن (Ctrl+N)"}</p>
          </motion.li>
        )}
      </Reorder.Group>

      <div className={cn("shrink-0", touch ? "mt-3" : "mt-4")}>
        <AddTask
          ref={addRef}
          touch={touch}
          dateLabel={isSameDay(selected, new Date()) ? "امروز" : `${toFa(jDay(selected))} ${monthName(selected)}`}
          onAdd={(v) => {
            store.addTask({ ...v, date: selectedKey });
            if (filter !== "day") setFilter("day");
          }}
        />
      </div>
    </>
  );
}
