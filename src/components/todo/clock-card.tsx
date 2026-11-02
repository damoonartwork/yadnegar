import * as React from "react";
import { BellRing } from "lucide-react";
import { Glass } from "./glass";
import type { Task } from "@/lib/types";
import { dueAt } from "@/hooks/use-tasks";
import { longFa, toFa } from "@/lib/jalali";

const pad = (n: number) => String(n).padStart(2, "0");

export function ClockCard({ tasks, className }: { tasks: Task[]; className?: string }) {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(iv);
  }, []);

  const next = React.useMemo(() => {
    const t = now.getTime();
    return tasks
      .filter((x) => !x.done && (dueAt(x) ?? 0) >= t)
      .sort((a, b) => dueAt(a)! - dueAt(b)!)[0];
  }, [tasks, now]);

  return (
    <Glass className={className} contentClassName="flex h-full flex-col items-start justify-center px-6">
      <div className="glow-text text-5xl font-bold leading-none tracking-tight" dir="ltr">
        {toFa(`${pad(now.getHours())}:${pad(now.getMinutes())}`)}
      </div>
      <div className="mt-2 text-base text-white/80">{longFa(now)}</div>
      <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-xs font-medium text-white/75 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
        <BellRing className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {next ? `بعدی: ساعت ${toFa(next.snoozedUntil ? fmt(next.snoozedUntil) : next.time!)} — ${next.title}` : "یادآوری پیش رو نداری"}
        </span>
      </div>
    </Glass>
  );
}

function fmt(ms: number) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
