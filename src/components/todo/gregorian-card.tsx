import * as React from "react";
import { Glass } from "./glass";

const pad = (n: number) => String(n).padStart(2, "0");

/** کارت تاریخ و ساعت میلادی، زیر کارت ساعت و تاریخ شمسی */
export function GregorianCard({ className }: { className?: string }) {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(iv);
  }, []);

  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const date = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const h = now.getHours();
  const time12 = `${((h + 11) % 12) + 1}:${pad(now.getMinutes())}`;

  return (
    <Glass className={className} contentClassName="flex h-full items-center justify-between gap-4 px-6" >
      <div dir="ltr" className="flex items-baseline gap-1.5 font-sans">
        <span className="glow-text text-3xl font-bold leading-none tracking-tight">{time12}</span>
        <span className="text-xs font-semibold text-white/50">{h < 12 ? "AM" : "PM"}</span>
      </div>
      <div dir="ltr" className="min-w-0 text-left font-sans">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/45">{weekday}</div>
        <div className="mt-0.5 truncate text-base font-semibold text-white/90">{date}</div>
      </div>
    </Glass>
  );
}
