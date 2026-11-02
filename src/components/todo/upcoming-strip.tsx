import * as React from "react";
import { Bell, CalendarClock, Star } from "lucide-react";
import { addDays, isSameDay } from "date-fns";
import { Glass } from "./glass";
import type { Task } from "@/lib/types";
import { dueAt } from "@/hooks/use-tasks";
import { jDay, monthName, toFa } from "@/lib/jalali";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

/** فاصلهٔ روز یادآور تا امروز: امروز، فردا، پس‌فردا، n روز دیگر */
function relativeLabel(d: Date) {
  const today = new Date();
  if (isSameDay(d, today)) return "امروز";
  if (isSameDay(d, addDays(today, 1))) return "فردا";
  if (isSameDay(d, addDays(today, 2))) return "پس‌فردا";
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return `${toFa(Math.round((b - a) / 86_400_000))} روز دیگر`;
}

/** نوار یادآورهای پیش رو — مثل کارت پیش‌بینی ساعتی در عکس اول */
export function UpcomingStrip({ tasks, onPick, className }: { tasks: Task[]; onPick: (d: Date) => void; className?: string }) {
  const items = React.useMemo(() => {
    const now = Date.now();
    return tasks
      .filter((t) => !t.done && (dueAt(t) ?? 0) >= now)
      .sort((a, b) => dueAt(a)! - dueAt(b)!)
      .slice(0, 6);
  }, [tasks]);

  return (
    <Glass className={className} contentClassName="flex h-full flex-col px-5 py-4">
      <p className="mb-1 text-xs font-bold text-white/40">یادآورهای پیش رو</p>
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-white/40">
          <CalendarClock className="h-5 w-5" />
          برای کارهایت ساعت یادآوری بگذار تا اینجا ببینی
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-6 gap-2">
          {items.map((t) => {
            const d = new Date(dueAt(t)!);
            return (
              <button
                key={t.id}
                onClick={() => onPick(d)}
                className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 transition-colors hover:bg-white/[0.06]"
                title={t.title}
              >
                <span className="whitespace-nowrap text-[13px] font-semibold">
                  {toFa(jDay(d))} {monthName(d)}، {toFa(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}
                </span>
                {t.important ? (
                  <Star className="h-5 w-5 text-amber-300" fill="currentColor" />
                ) : (
                  <Bell className="h-5 w-5 text-white/85" />
                )}
                <span className={cn("w-full truncate text-center text-xs", t.important ? "text-white" : "text-white/70")}>
                  {t.title}
                </span>
                <span className="text-[10px] text-white/35">{relativeLabel(d)}</span>
              </button>
            );
          })}
        </div>
      )}
    </Glass>
  );
}
