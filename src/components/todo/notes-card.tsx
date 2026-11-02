import * as React from "react";
import { startOfWeek, addDays } from "date-fns-jalali";
import { NotebookPen } from "lucide-react";
import { Glass } from "./glass";
import type { Task } from "@/lib/types";
import { dueAt } from "@/hooks/use-tasks";
import { dayKey, toFa } from "@/lib/jalali";
import { cn } from "@/lib/utils";

interface Props {
  tasks: Task[];
  note: string;
  onNoteChange: (v: string) => void;
  className?: string;
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: "warn" }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center rounded-2xl bg-white/[0.04] py-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
      <span className={cn("glow-text text-lg font-bold leading-6", tone === "warn" && "text-amber-200")}>{value}</span>
      <span className="text-[10px] font-semibold text-white/45">{label}</span>
    </div>
  );
}

/** خلاصهٔ کارها + دفترچهٔ یادداشت سریع (زیر تقویم) */
export function NotesCard({ tasks, note, onNoteChange, className }: Props) {
  const [draft, setDraft] = React.useState(note);
  React.useEffect(() => setDraft(note), [note]);

  const stats = React.useMemo(() => {
    const now = new Date();
    const today = dayKey(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 6 });
    const weekKeys = new Set(Array.from({ length: 7 }, (_, i) => dayKey(addDays(weekStart, i))));
    const todayTasks = tasks.filter((t) => t.date === today);
    return {
      todayDone: todayTasks.filter((t) => t.done).length,
      todayTotal: todayTasks.length,
      weekDone: tasks.filter((t) => t.done && weekKeys.has(t.date)).length,
      overdue: tasks.filter((t) => {
        if (t.done) return false;
        const due = dueAt(t);
        return (due !== null && due < now.getTime()) || t.date < today;
      }).length,
    };
  }, [tasks]);

  return (
    <Glass className={className} contentClassName="flex h-full flex-col gap-3 overflow-hidden p-4">
      <div className="flex shrink-0 gap-2">
        <Stat value={`${toFa(stats.todayDone)}/${toFa(stats.todayTotal)}`} label="امروز" />
        <Stat value={toFa(stats.weekDone)} label="انجام‌شدهٔ هفته" />
        <Stat value={toFa(stats.overdue)} label="عقب‌افتاده" tone={stats.overdue ? "warn" : undefined} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-white/45">
          <NotebookPen className="h-3.5 w-3.5" />
          یادداشت سریع
        </div>
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onNoteChange(e.target.value);
          }}
          placeholder="ایده، شماره تلفن، لیست خرید… (خودکار ذخیره می‌شود)"
          className="thin-scroll min-h-0 flex-1 resize-none rounded-2xl bg-black/20 p-3 text-sm leading-7 text-white/90 outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] placeholder:text-white/30 focus:bg-black/30"
        />
      </div>
    </Glass>
  );
}
