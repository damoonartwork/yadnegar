import * as React from "react";
import { Bell, Check, GripVertical, Pen, Star, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { Reorder, motion, useDragControls, useMotionValue } from "motion/react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
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
  /** لمسی (موبایل): فقط با گرفتن شماره جابه‌جا شود تا اسکرول لیست مختل نشود */
  touch?: boolean;
  onDragEnd?: () => void;
  showDate?: boolean;
  onToggle: () => void;
  onImportant: () => void;
  onRemove: () => void;
  onEdit: (patch: Partial<Task>) => void;
}

export function TaskItem({ task, index, draggable, touch, onDragEnd, showDate, onToggle, onImportant, onRemove, onEdit }: Props) {
  const [editing, setEditing] = React.useState(false);
  /** دکمهٔ موس پایین است و کارت در دست است */
  const [lifted, setLifted] = React.useState(false);
  /** نسخهٔ شناور کارت روی بالاترین لایه نمایش داده می‌شود (حین کشیدن و فرود) */
  const [floating, setFloating] = React.useState(false);
  const liRef = React.useRef<HTMLLIElement>(null);
  const dragControls = useDragControls();
  const landTimer = React.useRef<number>();
  const top = useMotionValue(0);
  const left = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);

  // نسخهٔ شناور هر فریم دقیقاً روی جای کارت اصلی قرار می‌گیرد
  React.useEffect(() => {
    if (!floating) return;
    let raf = 0;
    const follow = () => {
      const r = liRef.current?.getBoundingClientRect();
      if (r) {
        top.set(r.top);
        left.set(r.left);
        width.set(r.width);
        height.set(r.height);
      }
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [floating, top, left, width, height]);

  React.useEffect(() => () => window.clearTimeout(landTimer.current), []);
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
    const changed = t !== task.title || time !== (task.time ?? "");
    if (t && changed) onEdit({ title: t, ...(time !== (task.time ?? "") ? { time: time || undefined } : {}) });
    setEditing(false);
  };

  // کلیک بیرون از کادر ویرایش = ثبت (به‌جز کلیک داخل پنجرهٔ انتخاب ساعت)
  const editRef = React.useRef<HTMLDivElement>(null);
  const saveRef = React.useRef(save);
  saveRef.current = save;
  React.useEffect(() => {
    if (!editing) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (!el || editRef.current?.contains(el) || el.closest("[data-yg-popover]")) return;
      saveRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [editing]);

  const content = (glow: boolean, handle = false) => (
    <>
      {/* شماره کار؛ هنگام کشیدن روشن می‌شود. در موبایل همین دستگیرهٔ جابه‌جایی است */}
      <span
        onPointerDown={
          handle && touch && draggable && !editing
            ? (e) => {
                e.preventDefault();
                dragControls.start(e);
              }
            : undefined
        }
        style={touch && draggable ? { touchAction: "none" } : undefined}
        className={cn(
          "relative grid shrink-0 place-items-center rounded-[10px] text-[13px] font-bold tabular-nums transition-all duration-200",
          touch && draggable ? "h-9 w-11 grid-cols-[auto_auto] gap-0.5 px-1" : "h-7 w-7",
          glow
            ? "scale-110 bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.45)]"
            : task.done
              ? "bg-white/[0.04] text-white/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
              : task.important
                ? "bg-amber-200/10 text-amber-200 shadow-[inset_0_1px_1px_rgba(253,230,138,0.2)]"
                : "bg-white/[0.07] text-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
        )}
      >
        <span className={cn("transition-opacity", !touch && draggable && !glow && !editing && "group-hover:opacity-0")}>
          {toFa(index + 1)}
        </span>
        {touch && draggable && <GripVertical className="h-3.5 w-3.5 opacity-50" />}
        {!touch && draggable && !editing && (
          <GripVertical
            className={cn(
              "absolute h-4 w-4 opacity-0 transition-opacity",
              !glow && "group-hover:opacity-70"
            )}
          />
        )}
      </span>

      {/* محدودهٔ تیک بزرگ‌تر از خود دایره است و کشیدن کار را شروع نمی‌کند */}
      <button
        onClick={onToggle}
        title={task.done ? "برگرداندن" : "انجام شد"}
        className="group/check -my-2 -mx-1.5 grid shrink-0 cursor-pointer place-items-center self-stretch px-1.5 py-2"
      >
        <span
          className={cn(
            "grid h-5 w-5 place-items-center rounded-full border-2 transition-all",
            task.done
              ? "border-transparent bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.35)]"
              : "border-white/30 group-hover/check:scale-110 group-hover/check:border-white/80"
          )}
        >
          {task.done && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      </button>

      <div className="min-w-0 flex-1" onDoubleClick={startEdit} onClick={touch && !editing ? startEdit : undefined}>
        {editing ? (
          <div ref={editRef} className="flex items-center gap-2">
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
            {touch && (
              <button onClick={onRemove} title="حذف" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-rose-300">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={save} className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-xs hover:bg-white/25">
              ثبت
            </button>
          </div>
        ) : (
          <>
            <p className={cn(touch ? "line-clamp-2 text-sm leading-6 font-medium" : "truncate text-sm font-medium", task.done && "text-white/40 line-through")}>{task.title}</p>
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
        <div className="flex cursor-default items-center gap-0.5" data-no-drag>
          {!touch && (
            <>
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
            </>
          )}
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
    </>
  );

  return (
    <>
      <Reorder.Item
        ref={liRef}
        as="li"
        value={task}
        dragListener={false}
        dragControls={dragControls}
        onPointerDown={(e) => {
          // کشیدن از هر جای کارت، به‌جز دکمه‌ها (تیک، ستاره، …) و کادرهای متن
          if (touch || !draggable || editing) return;
          if ((e.target as Element).closest("button, input, a, [data-no-drag]")) return;
          dragControls.start(e);
        }}
        onDragStart={() => {
          if (touch) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
          window.clearTimeout(landTimer.current);
          setLifted(true);
          setFloating(true);
        }}
        onDragEnd={() => {
          setLifted(false);
          onDragEnd?.();
          // کمی صبر تا کارت در جای جدیدش فرود بیاید
          landTimer.current = window.setTimeout(() => setFloating(false), 300);
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ duration: 0.2, layout: { type: "spring", stiffness: 520, damping: 38 } }}
        style={{ position: "relative" }}
        className={cn(
          "group flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
          !touch && draggable && !editing && "cursor-grab active:cursor-grabbing",
          floating
            ? "border-transparent bg-transparent shadow-none [&>*]:invisible"
            : task.important && !task.done
              ? "border-amber-200/20 bg-amber-200/[0.05] shadow-[inset_0_1px_1px_rgba(253,230,138,0.12)]"
              : "border-white/[0.07] bg-white/[0.03] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] hover:bg-white/[0.06]"
        )}
      >
        {content(false, true)}
      </Reorder.Item>

      {floating &&
        createPortal(
          <motion.div
            dir="rtl"
            aria-hidden
            style={{ position: "fixed", top, left, width, height, zIndex: 200, pointerEvents: "none" }}
            initial={{ scale: 1, rotate: 0, boxShadow: "0 0 0 rgba(0,0,0,0)" }}
            animate={
              lifted
                ? {
                    scale: 1.035,
                    rotate: -0.6,
                    boxShadow:
                      "0 28px 60px rgba(0,0,0,0.6), 0 10px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.16), 0 0 40px rgba(255,255,255,0.08)",
                  }
                : { scale: 1, rotate: 0, boxShadow: "0 0 0 rgba(0,0,0,0)" }
            }
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="yg-float flex items-center gap-3 rounded-2xl border border-white/25 px-4 py-3 font-sans text-white"
          >
            {content(lifted)}
          </motion.div>,
          document.body
        )}
    </>
  );
}
