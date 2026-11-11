import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Glass } from "./glass";
import { WORLD_ZONES, findZone, offsetFromLocal } from "@/lib/world-zones";
import { toFa } from "@/lib/jalali";
import { cn } from "@/lib/utils";

/** «۸:۳۰ ساعت عقب‌تر» و مانند آن نسبت به ساعت این کامپیوتر */
function diffLabel(min: number) {
  if (min === 0) return "هم‌زمان با ساعت شما";
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  const dir = min > 0 ? "جلوتر" : "عقب‌تر";
  if (h === 0) return `${toFa(m)} دقیقه ${dir}`;
  const t = m ? `${toFa(h)}:${toFa(String(m).padStart(2, "0"))}` : toFa(h);
  return `${t} ساعت ${dir}`;
}

interface Props {
  zone: string;
  onZoneChange: (zone: string) => void;
  className?: string;
}

/** کارت تاریخ و ساعت میلادی یک کشور دلخواه (پیش‌فرض: آمریکا، نیویورک) */
export function GregorianCard({ zone, onZoneChange, className }: Props) {
  const [now, setNow] = React.useState(new Date());
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [pos, setPos] = React.useState({ top: 0, right: 0, width: 300 });
  const btnRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(iv);
  }, []);

  const safeZone = React.useMemo(() => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      return zone;
    } catch {
      return "America/New_York";
    }
  }, [zone]);

  const current = findZone(safeZone);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: safeZone, ...o }).format(now);
  const time = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
  const [clock, ampm] = time.split(" ");
  const date = fmt({ weekday: "short", month: "short", day: "numeric", year: "numeric" });
  // همان تاریخ میلادی با نوشتهٔ فارسی: «چهارشنبه ۱۱ نوامبر ۲۰۲۶»
  const faDate = new Intl.DateTimeFormat("fa-IR-u-ca-gregory-nu-arabext", {
    timeZone: safeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(now)
    .replace(/،/g, "");
  const shortCity = current.city?.split(" / ")[0];

  const list = React.useMemo(() => {
    const q = query.trim();
    if (!q) return WORLD_ZONES;
    return WORLD_ZONES.filter((z) => `${z.country} ${z.city ?? ""} ${z.zone}`.toLowerCase().includes(q.toLowerCase()));
  }, [query]);

  const openPicker = () => {
    const r = btnRef.current!.getBoundingClientRect();
    const width = 320;
    setPos({
      top: Math.min(r.bottom + 8, window.innerHeight - 420),
      right: Math.max(8, window.innerWidth - r.right),
      width,
    });
    setQuery("");
    setOpen(true);
  };

  return (
    <Glass className={className} contentClassName="flex h-full items-center justify-between gap-3 px-6">
      <div dir="ltr" className="flex shrink-0 items-baseline gap-1.5 font-sans">
        <span className="glow-text text-3xl font-bold leading-none tracking-tight">{clock}</span>
        <span className="text-xs font-semibold text-white/50">{ampm}</span>
      </div>

      <div className="min-w-0 text-left">
        <button
          ref={btnRef}
          onClick={openPicker}
          title="انتخاب کشور"
          className="inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {current.country}
            {shortCity ? ` · ${shortCity}` : ""}
          </span>
        </button>
        <div dir="ltr" className="mt-0.5 truncate px-1.5 font-sans text-[15px] font-semibold text-white/90">
          {date}
        </div>
        <div className="truncate px-1.5 text-left text-[11.5px] text-white/50">{faDate}</div>
      </div>

      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
              <motion.div
                dir="rtl"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                style={{ top: pos.top, right: pos.right, width: pos.width }}
                className="fixed z-[61] flex max-h-[400px] flex-col rounded-3xl border border-white/10 yg-panel p-3 text-white backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_20px_50px_rgba(0,0,0,0.6)]"
              >
                <div className="mb-2 flex items-center gap-2 rounded-full bg-black/30 px-3 py-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                  <Search className="h-4 w-4 shrink-0 text-white/40" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="جست‌وجوی کشور یا شهر…"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
                  />
                </div>
                <ul className="thin-scroll -mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                  {list.map((z) => {
                    const active = z.zone === safeZone;
                    return (
                      <li key={z.zone}>
                        <button
                          onClick={() => {
                            onZoneChange(z.zone);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-right transition-colors",
                            active ? "bg-white/10" : "hover:bg-white/[0.06]"
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{z.country}</span>
                            {z.city && <span className="block truncate text-[11px] text-white/45">{z.city}</span>}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-[11px] text-white/40">{diffLabel(offsetFromLocal(z.zone, now))}</span>
                            {active && <Check className="h-4 w-4" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {list.length === 0 && <li className="py-6 text-center text-xs text-white/40">چیزی پیدا نشد</li>}
                </ul>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </Glass>
  );
}
