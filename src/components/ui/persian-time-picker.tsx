import * as React from "react";
import { createPortal } from "react-dom";
import { Clock, Minus, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { toFa } from "@/lib/jalali";

// انتخابگر ساعت فارسی: ۲۴ ساعته، اعداد فارسی، بدون AM/PM و بدون وابستگی به زبان ویندوز

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function partOfDay(h: number) {
  if (h >= 5 && h < 12) return "صبح";
  if (h >= 12 && h < 14) return "ظهر";
  if (h >= 14 && h < 18) return "عصر";
  return "شب";
}

function fromNow(minutes: number) {
  const d = new Date(Date.now() + minutes * 60_000);
  if (d.getDate() !== new Date().getDate()) return "23:55";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface PersianTimePickerProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  /** فقط آیکن (وقتی ساعتی انتخاب نشده) */
  compact?: boolean;
  className?: string;
}

export function PersianTimePicker({ value, onChange, compact, className }: PersianTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const [h, m] = (value ?? fromNow(60)).split(":").map(Number);
  const [hour, setHour] = React.useState(h);
  const [minute, setMinute] = React.useState(m);

  const POP_W = 312;
  const POP_H = 404;

  const openPicker = () => {
    const r = triggerRef.current!.getBoundingClientRect();
    const top = r.top > POP_H + 16 ? r.top - POP_H - 8 : Math.min(r.bottom + 8, window.innerHeight - POP_H - 8);
    const right = Math.max(8, Math.min(window.innerWidth - r.right, window.innerWidth - POP_W - 8));
    setPos({ top, right });
    const [hh, mm] = (value ?? fromNow(60)).split(":").map(Number);
    setHour(hh);
    setMinute(mm);
    setOpen(true);
  };

  const commit = (hh = hour, mm = minute) => {
    onChange(`${pad(hh)}:${pad(mm)}`);
    setOpen(false);
  };

  const bumpMinute = (d: number) => {
    let total = hour * 60 + minute + d;
    total = (total + 1440) % 1440;
    setHour(Math.floor(total / 60));
    setMinute(total % 60);
  };

  const cell = (active: boolean) =>
    cn(
      "h-8 rounded-full text-[13px] font-semibold transition-colors",
      active ? "bg-white text-black shadow-[0_0_14px_rgba(255,255,255,0.35)]" : "text-white/75 hover:bg-white/10"
    );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        title="ساعت یادآوری"
        className={cn(
          "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 text-sm font-semibold transition-colors",
          "bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_2px_8px_rgba(0,0,0,0.4)] hover:bg-white/[0.09]",
          value ? "px-3 text-white" : compact ? "w-8 text-white/70" : "px-3 text-white/60",
          className
        )}
      >
        <Clock className="h-4 w-4" />
        {value ? toFa(value) : !compact && "ساعت"}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div data-yg-popover className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
              <motion.div
                dir="rtl"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                style={{ top: pos.top, right: pos.right, width: POP_W }}
                data-yg-popover
                className="fixed z-[61] rounded-3xl border border-white/10 yg-panel p-4 text-white backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_20px_50px_rgba(0,0,0,0.6)]"
              >
                {/* نمایش ساعت انتخاب‌شده */}
                <div className="mb-3 flex items-center justify-between">
                  <button onClick={() => bumpMinute(-1)} className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10">
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="text-center">
                    <div className="glow-text text-4xl font-bold leading-none" dir="ltr">
                      {toFa(`${pad(hour)}:${pad(minute)}`)}
                    </div>
                    <div className="mt-1 text-xs text-white/45">{partOfDay(hour)}</div>
                  </div>
                  <button onClick={() => bumpMinute(1)} className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <p className="mb-1 text-[11px] font-semibold text-white/40">ساعت</p>
                <div className="grid grid-cols-6 gap-1">
                  {HOURS.map((x) => (
                    <button key={x} onClick={() => setHour(x)} className={cell(x === hour)}>
                      {toFa(x)}
                    </button>
                  ))}
                </div>

                <p className="mt-3 mb-1 text-[11px] font-semibold text-white/40">دقیقه</p>
                <div className="grid grid-cols-6 gap-1">
                  {MINUTES.map((x) => (
                    <button key={x} onClick={() => setMinute(x)} className={cell(x === minute)}>
                      {toFa(pad(x))}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    { label: "۱۵ دقیقه دیگر", v: () => fromNow(15) },
                    { label: "یک ساعت دیگر", v: () => fromNow(60) },
                    { label: "۹ صبح", v: () => "09:00" },
                    { label: "۶ عصر", v: () => "18:00" },
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        const [a, b] = p.v().split(":").map(Number);
                        commit(a, b);
                      }}
                      className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/75 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] hover:bg-white/[0.12]"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => commit()}
                    className="flex-1 rounded-full bg-white py-2 text-sm font-bold text-black hover:bg-white/90"
                  >
                    تأیید
                  </button>
                  {value && (
                    <button
                      onClick={() => {
                        onChange(undefined);
                        setOpen(false);
                      }}
                      className="flex items-center gap-1 rounded-full bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.12]"
                    >
                      <X className="h-3.5 w-3.5" />
                      بدون یادآوری
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
