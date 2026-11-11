import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Check, LayoutGrid, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type BlockId = "clock" | "gregorian" | "calendar" | "notes" | "upcoming" | "tasks";

export const DEFAULT_LAYOUT: { left: BlockId[]; right: BlockId[] } = {
  left: ["clock", "gregorian", "calendar", "notes"],
  right: ["upcoming", "tasks"],
};

const LABELS: Record<BlockId, string> = {
  clock: "ساعت و تاریخ شمسی",
  gregorian: "ساعت و تاریخ میلادی",
  calendar: "تقویم",
  notes: "یادداشت و آمار",
  upcoming: "یادآوری‌های پیش رو",
  tasks: "کارها",
};

/** اندازهٔ هر بخش داخل ستون: بعضی ثابت، بعضی فضای باقی‌مانده را پر می‌کنند */
const SIZE: Record<BlockId, string> = {
  clock: "h-[156px] shrink-0",
  gregorian: "h-[96px] shrink-0",
  calendar: "shrink-0",
  notes: "min-h-[120px] flex-1",
  upcoming: "h-[156px] shrink-0",
  tasks: "min-h-0 flex-1",
};

/** ترتیب ذخیره‌شده را معتبر می‌کند (بخش جاافتاده یا تکراری → پیش‌فرض) */
export function normalizeLayout(raw?: { left?: string[]; right?: string[] }): { left: BlockId[]; right: BlockId[] } {
  const ok = (col: "left" | "right") => {
    const want = DEFAULT_LAYOUT[col];
    const got = raw?.[col];
    return Array.isArray(got) && got.length === want.length && want.every((id) => got.includes(id)) ? (got as BlockId[]) : want;
  };
  return { left: ok("left"), right: ok("right") };
}

export function LayoutBlock({
  id,
  editing,
  canUp,
  canDown,
  onMove,
  children,
}: {
  id: BlockId;
  editing: boolean;
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: -1 | 1) => void;
  children: React.ReactNode;
}) {
  const arrow =
    "grid h-8 w-8 place-items-center rounded-full bg-white text-black shadow-md transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-25";
  return (
    <motion.div
      layout
      transition={{ type: "spring", damping: 30, stiffness: 320 }}
      className={cn("relative flex min-h-0 flex-col", SIZE[id])}
    >
      <div className={cn("flex min-h-0 flex-1 flex-col transition-opacity", editing && "pointer-events-none opacity-45")}>{children}</div>
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-white/40"
          >
            <button className={arrow} disabled={!canUp} onClick={() => onMove(-1)} title="بالا">
              <ArrowUp className="h-4 w-4" />
            </button>
            <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">{LABELS[id]}</span>
            <button className={arrow} disabled={!canDown} onClick={() => onMove(1)} title="پایین">
              <ArrowDown className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function LayoutEditBar({ open, onReset, onDone }: { open: boolean; onReset: () => void; onDone: () => void }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDone]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 yg-panel py-1.5 pr-4 pl-1.5 text-white backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_12px_40px_rgba(0,0,0,0.5)]"
        >
          <LayoutGrid className="h-4 w-4 text-white/60" />
          <span className="text-xs font-semibold text-white/75">با فلش‌ها جای هر بخش را با بالایی یا پایینی‌اش عوض کن</span>
          <button onClick={onReset} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/[0.08] hover:text-white">
            <RotateCcw className="h-3.5 w-3.5" />
            پیش‌فرض
          </button>
          <button onClick={onDone} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-black">
            <Check className="h-3.5 w-3.5" />
            تمام
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
