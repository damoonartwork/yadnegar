import * as React from "react";
import { motion } from "motion/react";
import { BellRing, Star, X } from "lucide-react";
import { toFa } from "@/lib/jalali";

// پنجرهٔ کوچک یادآوری که فرآیند اصلی در گوشهٔ صفحه باز می‌کند (مستقل از اعلان‌های ویندوز)

function chime() {
  try {
    const ctx = new AudioContext();
    const notes = [880, 1174.66, 1567.98];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 1);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {
    /* بدون صدا */
  }
}

export function ReminderPopup({ params }: { params: URLSearchParams }) {
  const id = params.get("id") ?? "";
  const title = params.get("title") ?? "";
  const time = params.get("time") ?? "";
  const important = params.get("important") === "1";
  const api = window.yadnegar;
  const act = (a: "done" | "snooze10" | "snooze60" | "dismiss" | "open") => {
    api?.reminderAction?.(id, a);
    // اگر به هر دلیلی پیام به برنامه نرسید، پنجره خودش بسته شود
    setTimeout(() => window.close(), 400);
  };

  React.useEffect(() => {
    document.body.style.background = "transparent";
    if (params.get("sound") === "1") chime();
  }, [params]);

  return (
    <div dir="rtl" className="flex h-screen w-screen items-center justify-center p-2">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="relative h-full w-full rounded-[26px] border border-white/10 bg-[#151515]/95 p-4 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-1px_1px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.35)]">
            {important ? <Star className="h-4 w-4" fill="currentColor" /> : <BellRing className="h-4 w-4" />}
          </span>
          <button onClick={() => act("open")} className="min-w-0 flex-1 text-right">
            <p className="text-[11px] font-semibold text-white/45">
              {important ? "یادآوری کار مهم" : "یادآوری یادنگار"}
              {time && ` · ساعت ${toFa(time)}`}
            </p>
            <p className="mt-1 line-clamp-2 text-[15px] font-bold leading-6">{title}</p>
          </button>
          <button onClick={() => act("dismiss")} className="grid h-8 w-8 place-items-center rounded-full text-white/40 hover:bg-white/10 hover:text-white" title="بستن">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="absolute inset-x-4 bottom-4 flex gap-2">
          <button onClick={() => act("done")} className="flex-1 rounded-full bg-white py-2 text-xs font-bold text-black hover:bg-white/90">
            انجام شد
          </button>
          <button
            onClick={() => act("snooze10")}
            className="flex-1 rounded-full bg-white/[0.07] py-2 text-xs font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] hover:bg-white/[0.12]"
          >
            ۱۰ دقیقه بعد
          </button>
          <button
            onClick={() => act("snooze60")}
            className="flex-1 rounded-full bg-white/[0.07] py-2 text-xs font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] hover:bg-white/[0.12]"
          >
            یک ساعت بعد
          </button>
        </div>
      </motion.div>
    </div>
  );
}
