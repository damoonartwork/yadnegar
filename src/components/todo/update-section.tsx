import { Download, ExternalLink, RefreshCw, Rocket } from "lucide-react";
import { useUpdate } from "@/hooks/use-update";
import { toFa } from "@/lib/jalali";
import { cn } from "@/lib/utils";

/** پیام خطای قابل فهم برای کاربر */
function explainError(message?: string) {
  const m = message ?? "";
  if (/ACCESS_DENIED|EACCES|EPERM|blocked/i.test(m))
    return "آنتی‌ویروس، فایروال یا فیلترشکن اجازهٔ اتصال به یادنگار نمی‌دهد. یادنگار را در لیست مجاز آن برنامه قرار بده، یا نسخهٔ جدید را دستی دانلود کن.";
  if (/TIMED_OUT|ETIMEDOUT|timeout|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|CONNECTION_|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY|HTTP \d/i.test(m))
    return "به GitHub وصل نشد. اینترنت یا فیلترشکن را بررسی کن، یا نسخهٔ جدید را دستی دانلود کن.";
  return "بررسی به‌روزرسانی ناموفق بود. می‌توانی نسخهٔ جدید را دستی دانلود کنی.";
}

export function UpdateSection() {
  const u = useUpdate();
  if (!u.supported) return null;
  const { state, version, percent, message } = u.status;

  const text: Record<string, string> = {
    idle: "برای دیدن نسخهٔ جدید، بررسی کن.",
    checking: "در حال بررسی…",
    none: "آخرین نسخه را داری ✓",
    available: `نسخهٔ ${toFa(version ?? "")} آماده دانلود است.`,
    downloading: `در حال دانلود… ${toFa(percent ?? 0)}٪`,
    ready: `نسخهٔ ${toFa(version ?? "")} دانلود شد. با یک کلیک نصب می‌شود.`,
    error: explainError(message),
    unsupported: "به‌روزرسانی خودکار فقط در نسخهٔ نصبی کار می‌کند.",
  };

  const btn =
    "flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-colors disabled:opacity-50";

  return (
    <div className="space-y-2 rounded-2xl bg-white/[0.03] p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">نسخهٔ فعلی</p>
        <span className="text-xs text-white/50" dir="ltr">
          {toFa(u.version || "—")}
        </span>
      </div>
      <p className={cn("text-xs", state === "error" ? "text-amber-200/80" : "text-white/55")}>{text[state]}</p>
      {state === "error" && message && (
        <p className="truncate text-[10px] text-white/30" dir="ltr" title={message}>
          {message}
        </p>
      )}
      {state === "downloading" && (
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-white transition-all" style={{ width: `${percent ?? 0}%` }} />
        </div>
      )}
      {state === "ready" ? (
        <button onClick={u.install} className={cn(btn, "w-full bg-white text-black hover:bg-white/90")}>
          <Rocket className="h-4 w-4" />
          نصب و اجرای دوباره
        </button>
      ) : state === "available" ? (
        <button onClick={u.download} className={cn(btn, "w-full bg-white text-black hover:bg-white/90")}>
          <Download className="h-4 w-4" />
          دانلود نسخهٔ جدید
        </button>
      ) : (
        <button
          onClick={u.check}
          disabled={state === "checking" || state === "downloading" || state === "unsupported"}
          className={cn(btn, "w-full bg-white/[0.07] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] hover:bg-white/[0.12]")}
        >
          <RefreshCw className={cn("h-4 w-4", state === "checking" && "animate-spin")} />
          بررسی به‌روزرسانی
        </button>
      )}
      {state === "error" && (
        <button
          onClick={u.openReleases}
          className="flex w-full items-center justify-center gap-2 py-1 text-xs font-semibold text-white/60 hover:text-white"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          دانلود دستی آخرین نسخه از GitHub
        </button>
      )}
    </div>
  );
}
