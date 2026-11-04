import { AnimatePresence, motion } from "motion/react";
import { BellRing, X } from "lucide-react";
import type { ReminderEvent } from "@/lib/types";
import { toFa } from "@/lib/jalali";

interface Props {
  reminders: ReminderEvent[];
  onDone: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onDismiss: (id: string) => void;
}

export function ReminderToasts({ reminders, onDone, onSnooze, onDismiss }: Props) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-50 flex w-[380px] flex-col gap-2">
      <AnimatePresence>
        {reminders.map((r) => (
          <motion.div
            key={r.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="pointer-events-auto w-full rounded-3xl border border-white/10 yg-panel p-4 backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_10px_40px_rgba(0,0,0,0.6),0_0_30px_rgba(255,255,255,0.06)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.3)]">
                <BellRing className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-white/50">
                  یادآوری {r.time ? `· ساعت ${toFa(r.time)}` : ""}
                </p>
                <p className="mt-0.5 text-sm font-bold">{r.title}</p>
              </div>
              <button onClick={() => onDismiss(r.id)} className="text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onDone(r.id)}
                className="flex-1 rounded-full bg-white py-1.5 text-xs font-bold text-black transition hover:bg-white/90"
              >
                انجام شد
              </button>
              <button
                onClick={() => onSnooze(r.id, 10)}
                className="flex-1 rounded-full bg-white/[0.06] py-1.5 text-xs font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] transition hover:bg-white/[0.12]"
              >
                ۱۰ دقیقه بعد
              </button>
              <button
                onClick={() => onSnooze(r.id, 60)}
                className="flex-1 rounded-full bg-white/[0.06] py-1.5 text-xs font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] transition hover:bg-white/[0.12]"
              >
                یک ساعت بعد
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
