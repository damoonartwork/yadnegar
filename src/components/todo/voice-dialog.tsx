import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Mic, RotateCcw, Square, Star, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayKey, fromKey, jDay, monthName, toFa, weekdayFull } from "@/lib/jalali";
import { voiceToTasks, type VoiceTask } from "@/lib/sync";
import { syncErrorText, type SyncApi } from "@/hooks/use-sync";
import { PersianTimePicker } from "@/components/ui/persian-time-picker";

const MAX_SECONDS = 120;

// ---------- ضبط و تبدیل به WAV ۱۶ کیلوهرتز (برای Whisper) ----------
async function toWav16k(blob: Blob): Promise<Blob> {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  void ctx.close();
  const rate = 16000;
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const x = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

type Phase = "recording" | "working" | "review" | "error";

interface Draft extends VoiceTask {
  key: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  sync: SyncApi;
  onAdd: (tasks: VoiceTask[]) => void;
  onNeedAccount: () => void;
}

function dayLabel(key: string) {
  const d = fromKey(key);
  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000));
  const rel = key === today ? "امروز، " : key === tomorrow ? "فردا، " : "";
  return `${rel}${weekdayFull(d)} ${toFa(jDay(d))} ${monthName(d)}`;
}

function dayOptions(extra: string[]) {
  const list: string[] = [];
  const base = new Date();
  for (let i = 0; i < 45; i++) list.push(dayKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)));
  for (const e of extra) if (!list.includes(e)) list.push(e);
  return list.sort();
}

export function VoiceDialog({ open, onClose, sync, onAdd, onNeedAccount }: Props) {
  const signedIn = !!sync.account.token;
  const [phase, setPhase] = React.useState<Phase>("recording");
  const [seconds, setSeconds] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [remaining, setRemaining] = React.useState<number | null>(null);

  const rec = React.useRef<{ mr: MediaRecorder; stream: MediaStream; ctx: AudioContext; raf: number; timer: number; cancelled: boolean } | null>(null);

  const cleanup = React.useCallback(() => {
    const r = rec.current;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx.close().catch(() => {});
    rec.current = null;
  }, []);

  const send = React.useCallback(
    async (blob: Blob) => {
      setPhase("working");
      try {
        const wav = await toWav16k(blob);
        const r = await voiceToTasks(sync.account.server, sync.account.token!, wav);
        setText(r.text);
        setRemaining(r.remaining);
        setDrafts(r.tasks.map((t, i) => ({ ...t, key: `${Date.now()}-${i}` })));
        setPhase("review");
      } catch (e) {
        setError(e instanceof Error && e.name === "EncodingError" ? "صدای ضبط‌شده خوانده نشد. دوباره امتحان کن." : syncErrorText(e));
        setPhase("error");
      }
    },
    [sync.account.server, sync.account.token]
  );

  const start = React.useCallback(async () => {
    setError(null);
    setSeconds(0);
    setLevel(0);
    setPhase("recording");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("به میکروفون دسترسی نیست. اجازهٔ میکروفون را در تنظیمات دستگاه برای یادنگار روشن کن.");
      setPhase("error");
      return;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported?.(m));
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      const cancelled = rec.current?.cancelled;
      cleanup();
      if (!cancelled) void send(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
    };
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const x of data) sum += (x - 128) ** 2;
      setLevel(Math.min(1, Math.sqrt(sum / data.length) / 40));
      if (rec.current) rec.current.raf = requestAnimationFrame(tick);
    };
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS && mr.state === "recording") mr.stop();
    }, 250);
    rec.current = { mr, stream, ctx, raf: requestAnimationFrame(tick), timer, cancelled: false };
    mr.start();
  }, [cleanup, send]);

  const stop = () => {
    const r = rec.current;
    if (r && r.mr.state === "recording") r.mr.stop();
  };

  const close = React.useCallback(() => {
    if (rec.current) {
      rec.current.cancelled = true;
      if (rec.current.mr.state === "recording") rec.current.mr.stop();
      else cleanup();
    }
    onClose();
  }, [cleanup, onClose]);

  // با باز شدن، ضبط خودکار شروع شود
  React.useEffect(() => {
    if (open && signedIn) void start();
    if (!open) {
      setDrafts([]);
      setText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => () => cleanup(), [cleanup]);

  // دکمهٔ بازگشت اندروید و Esc
  React.useEffect(() => {
    if (!open) return;
    const onBack = (e: Event) => {
      e.preventDefault();
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("yadnegar:back", onBack);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("yadnegar:back", onBack);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const patch = (key: string, p: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const options = React.useMemo(() => dayOptions(drafts.map((d) => d.date)), [drafts]);
  const valid = drafts.filter((d) => d.title.trim());

  const btn = "flex items-center justify-center gap-2 rounded-full px-5 py-2 text-[13px] font-bold transition-colors disabled:opacity-40";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[45] flex items-center justify-center bg-black/40 p-3"
          onClick={() => phase !== "working" && phase !== "review" && close()}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-[520px] flex-col overflow-hidden rounded-3xl border border-white/10 yg-panel text-white backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_20px_60px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <Mic className="h-4 w-4" />
                افزودن با صدا
              </h2>
              <button onClick={close} className="grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/[0.06] hover:text-white" aria-label="بستن">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!signedIn ? (
              <div className="space-y-4 px-5 pt-2 pb-5 text-center">
                <p className="text-[13px] leading-6 text-white/65">
                  برای افزودن کار با صدا، اول با ایمیلت وارد شو. ورود رایگان است و فقط یک کد ۶ رقمی می‌خواهد.
                </p>
                <button onClick={onNeedAccount} className={cn(btn, "mx-auto bg-white text-black")}>
                  رفتن به حساب کاربری
                </button>
              </div>
            ) : phase === "recording" ? (
              <div className="flex flex-col items-center gap-5 px-5 pt-4 pb-6">
                <p className="text-center text-[12px] leading-6 text-white/55">
                  کارهایت را پشت سر هم بگو؛ مثلاً «فردا ساعت ده جلسه با علی، امروز دامنه رو بخرم که مهمه».
                </p>
                <div className="relative grid h-28 w-28 place-items-center">
                  <motion.span
                    className="absolute inset-0 rounded-full bg-white/10"
                    animate={{ scale: 1 + level * 0.6, opacity: 0.35 + level * 0.5 }}
                    transition={{ type: "spring", damping: 15, stiffness: 200 }}
                  />
                  <span className="absolute inset-3 animate-pulse rounded-full bg-white/[0.06]" />
                  <button onClick={stop} className="relative grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-lg" aria-label="تمام">
                    <Square className="h-5 w-5" fill="currentColor" />
                  </button>
                </div>
                <p className="text-sm font-semibold tabular-nums" dir="ltr">
                  {toFa(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`)}
                  <span className="text-white/35"> / {toFa("2:00")}</span>
                </p>
                <div className="flex gap-2">
                  <button onClick={stop} className={cn(btn, "bg-white text-black")}>
                    <Check className="h-4 w-4" />
                    تمام شد
                  </button>
                  <button onClick={close} className={cn(btn, "bg-white/[0.07] text-white/80")}>
                    لغو
                  </button>
                </div>
              </div>
            ) : phase === "working" ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10">
                <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                <p className="text-[13px] text-white/60">در حال شنیدن و جدا کردن کارها…</p>
              </div>
            ) : phase === "error" ? (
              <div className="space-y-4 px-5 pt-3 pb-5 text-center">
                <p className="text-[13px] leading-6 text-amber-200">{error}</p>
                <button onClick={() => void start()} className={cn(btn, "mx-auto bg-white text-black")}>
                  <RotateCcw className="h-4 w-4" />
                  دوباره
                </button>
              </div>
            ) : (
              <>
                <div className="thin-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-3">
                  {text && (
                    <p className="rounded-2xl bg-black/20 px-3.5 py-2.5 text-[12px] leading-6 text-white/55">«{text}»</p>
                  )}
                  {drafts.length === 0 ? (
                    <p className="py-4 text-center text-[13px] text-white/55">کاری در صحبتت پیدا نشد. دوباره امتحان کن.</p>
                  ) : (
                    <>
                      <p className="px-1 pt-1 text-[11px] font-bold text-white/40">
                        {toFa(drafts.length)} کار پیدا شد — پیش از ثبت می‌توانی اصلاحشان کنی
                      </p>
                      {drafts.map((d) => (
                        <div key={d.key} className="space-y-2 rounded-2xl bg-white/[0.04] p-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
                          <div className="flex items-center gap-2">
                            <input
                              value={d.title}
                              onChange={(e) => patch(d.key, { title: e.target.value })}
                              className="min-w-0 flex-1 rounded-full bg-black/25 px-3.5 py-1.5 text-[13px] text-white outline-none focus:ring-1 focus:ring-white/30"
                            />
                            <button
                              onClick={() => patch(d.key, { important: !d.important })}
                              className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", d.important ? "text-amber-300" : "text-white/40 hover:text-white")}
                              title="مهم"
                            >
                              <Star className="h-4 w-4" fill={d.important ? "currentColor" : "none"} />
                            </button>
                            <button
                              onClick={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/40 hover:text-rose-300"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={d.date}
                              onChange={(e) => patch(d.key, { date: e.target.value })}
                              className="yg-select min-w-0 flex-1 rounded-full bg-black/25 px-3 py-1.5 text-[12px] text-white/80 outline-none"
                            >
                              {options.map((k) => (
                                <option key={k} value={k}>
                                  {dayLabel(k)}
                                </option>
                              ))}
                            </select>
                            <PersianTimePicker value={d.time} onChange={(t) => patch(d.key, { time: t })} compact />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 border-t border-white/[0.06] px-5 py-3">
                  <button
                    onClick={() => {
                      onAdd(valid.map(({ key: _k, ...t }) => ({ ...t, title: t.title.trim() })));
                      onClose();
                    }}
                    disabled={!valid.length}
                    className={cn(btn, "flex-1 bg-white text-black")}
                  >
                    <Check className="h-4 w-4" />
                    {valid.length ? `ثبت ${toFa(valid.length)} کار` : "ثبت"}
                  </button>
                  <button onClick={() => void start()} className={cn(btn, "bg-white/[0.07] text-white/80")}>
                    <Mic className="h-4 w-4" />
                    ضبط دوباره
                  </button>
                </div>
                {remaining !== null && remaining <= 10 && (
                  <p className="px-5 pb-3 text-center text-[11px] text-white/40">امروز {toFa(remaining)} بار دیگر می‌توانی از ویس استفاده کنی.</p>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
