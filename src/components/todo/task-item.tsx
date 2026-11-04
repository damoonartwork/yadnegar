import * as React from "react";
import { Bell, Check, GripVertical, Pen, Star, Trash2 } from "lucide-react";
import { Reorder } from "motion/react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { fromKey, jDay, monthName, toFa } from "@/lib/jalali";
import { dueAt } from "@/hooks/use-tasks";
import { PersianTimePicker } from "@/components/ui/persian-time-picker";

interface Props {
  task: Task;
  /** شمارهٔ کار در لیست (از صفر) */
  index: number;
  /** امکان جابه‌جایی با کشیدن */
  draggable?: boolean;
  onDragEnd?: () => void;
  showDate?: boolean;
  onToggle: () => void;
  onImportant: () => void;
  onRemove: () => void;
  onEdit: (patch: Partial<Task>) => void;
}

export function TaskItem({ task, index, draggable, onDragEnd, showDate, onToggle, onImportant, onRemove, onEdit }: Props) {
  const [editing, setEditing] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [title, setTitle] = React.useState(task.title);
  const [time, setTime] = React.useState(task.time ?? "");

  const due = dueAt(task);
  const overdue = !task.done && due !== null && due < Date.now();

  const startEdit = () => {
    setTitle(task.title);
    setTime(task.time ?? "");
    setEditing(true);
  };

  const save = () => {
    const t = title.trim();
    if (t) onEdit({ title: t, ...(time !== (task.time ?? "") ? { time: time || undefined } : {}) });
    setEditing(false);
  };

  return (
    <Reorder.Item
      as="li"
      value={task}
      dragListener={!!draggable && !editing}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd?.();
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.2, layout: { type: "spring", stiffness: 520, damping: 38 } }}
      whileDrag={{
        scale: 1.025,
        boxShadow: "0 18px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.18), 0 0 28px rgba(255,255,255,0.08)",
      }}
      style={{ position: "relative", zIndex: dragging ? 50 : 0 }}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
        draggable && !editing && "cursor-grab active:cursor-grabbing",
        dragging
          ? "border-white/20 bg-[#262628]/95 backdrop-blur-xl"
          : task.important && !task.done
            ? "border-amber-200/20 bg-amber-200/[0.05] shadow-[inset_0_1px_1px_rgba(253,230,138,0.12)]"
            : "border-white/[0.07] bg-white/[0.03] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] hover:bg-white/[0.06]"
      )}
    >
      {/* شماره کار؛ هنگام کشیدن روشن می‌شود */}
      <span
        className={cn(
          "relative grid h-7 w-7 shrink-0 place-items-center rounded-[10px] text-[13px] font-bold tabular-nums transition-all duration-200",
          dragging
            ? "scale-110 bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.45)]"
            : task.done
              ? "bg-white/[0.04] text-white/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
              : task.important
                ? "bg-amber-200/10 text-amber-200 shadow-[inset_0_1px_1px_rgba(253,230,138,0.2)]"
                : "bg-white/[0.07] text-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
        )}
      >
        <span className={cn("transition-opacity", draggable && !dragging && !editing && "group-hover:opacity-0")}>
          {toFa(index + 1)}
        </span>
        {draggable && !editing && (
          <GripVertical
            className={cn(
              "absolute h-4 w-4 opacity-0 transition-opacity",
              !dragging && "group-hover:opacity-70"
            )}
          />
        )}
      </span>

      <button
        onClick={onToggle}
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all",
          task.done ? "border-transparent bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.35)]" : "border-white/30 hover:border-white/70"
        )}
      >
        {task.done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1" onDoubleClick={startEdit}>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              className="min-w-0 flex-1 rounded-md bg-black/25 px-2 py-1 text-sm outline-none"
            />
            <PersianTimePicker value={time || undefined} onChange={(v) => setTime(v ?? "")} />
            <button onClick={save} className="rounded-md bg-white/15 px-2 py-1 text-xs hover:bg-white/25">
              ثبت
            </button>
          </div>
        ) : (
          <>
            <p className={cn("truncate text-sm font-medium", task.done && "text-white/40 line-through")}>{task.title}</p>
            {(task.time || showDate) && (
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/45">
                {showDate && (
                  <span>
                    {toFa(jDay(fromKey(task.date)))} {monthName(fromKey(task.date))}
                  </span>
                )}
                {task.time && (
                  <span className={cn("flex items-center gap-1", overdue && "text-amber-200/80")}>
                    <Bell className="h-3 w-3" />
                    {task.snoozedUntil && !task.done
                      ? `${toFa(new Date(task.snoozedUntil).toTimeString().slice(0, 5))} (به تعویق افتاده)`
                      : toFa(task.time)}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {!editing && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={startEdit}
            className="grid h-7 w-7 place-items-center rounded-md text-white/40 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
            title="ویرایش"
          >
            <Pen className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRemove}
            className="grid h-7 w-7 place-items-center rounded-md text-white/40 opacity-0 transition hover:bg-rose-500/20 hover:text-rose-300 group-hover:opacity-100"
            title="حذف"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onImportant}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md transition hover:bg-white/10",
              task.important ? "text-amber-300" : "text-white/30 hover:text-white/70"
            )}
            title="مهم"
          >
            <Star className="h-4 w-4" fill={task.important ? "currentColor" : "none"} />
          </button>
        </div>
      )}
    </Reorder.Item>
  );
}
