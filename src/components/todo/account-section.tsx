import * as React from "react";
import { Check, Cloud, CloudOff, Copy, LogOut, Mail, RefreshCw, Server, Sparkles } from "lucide-react";
import { syncErrorText, type SyncApi } from "@/hooks/use-sync";
import { toFa } from "@/lib/jalali";
import { connectCreate, connectRevoke, connectStatus } from "@/lib/sync";
import { cn } from "@/lib/utils";

function ago(ms?: number) {
  if (!ms) return "هنوز نه";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "همین الان";
  if (s < 3600) return `${toFa(Math.round(s / 60))} دقیقه پیش`;
  return `${toFa(Math.round(s / 3600))} ساعت پیش`;
}

const field =
  "w-full rounded-full bg-black/25 px-4 py-2.5 text-sm text-white outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] placeholder:text-white/35 focus:ring-1 focus:ring-white/30";
const primary =
  "flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-bold text-black transition-opacity disabled:opacity-40";
const secondary =
  "flex flex-1 items-center justify-center gap-2 rounded-full bg-white/[0.07] py-2.5 text-xs font-semibold text-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] hover:bg-white/[0.12]";

export function AccountSection({ sync }: { sync: SyncApi }) {
  const { account, status, lastError } = sync;
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [email, setEmail] = React.useState(account.email ?? "");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** فقط وقتی سرور در حالت آزمایشی است کد را برمی‌گرداند */
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [showServer, setShowServer] = React.useState(false);
  const [server, setServer] = React.useState(account.server);
  const [, tick] = React.useState(0);

  React.useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 20_000);
    return () => clearInterval(iv);
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(syncErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (account.token) {
    const offline = status === "offline" || status === "error";
    return (
      <div className="space-y-3 rounded-2xl bg-white/[0.03] p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-black">
            {offline ? <CloudOff className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" dir="ltr">
              {account.email}
            </p>
            <p className={cn("text-xs", offline ? "text-amber-200" : "text-white/50")}>
              {status === "syncing" ? "در حال همگام‌سازی…" : offline ? lastError : `آخرین همگام‌سازی: ${ago(account.lastSyncAt)}`}
            </p>
          </div>
        </div>
        <p className="text-[11px] leading-5 text-white/45">
          کارها، ترتیب‌شان، یادداشت سریع و ظاهر برنامه بین همهٔ دستگاه‌هایی که با این ایمیل وارد شده‌اند یکی می‌ماند.
        </p>
        <div className="flex gap-2">
          <button onClick={() => void sync.syncNow()} className={secondary} disabled={status === "syncing"}>
            <RefreshCw className={cn("h-4 w-4", status === "syncing" && "animate-spin")} />
            همگام‌سازی الان
          </button>
          <button onClick={() => void sync.logout()} className={secondary}>
            <LogOut className="h-4 w-4" />
            خروج
          </button>
        </div>
        <ClaudeConnect server={account.server} token={account.token} />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white/[0.03] p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
      <p className="text-[12px] leading-6 text-white/60">
        با ایمیلت وارد شو تا کارهایت بین ویندوز و گوشی یکی باشد. رمز عبور لازم نیست؛ یک کد ۶ رقمی به ایمیلت می‌آید.
      </p>
      {step === "email" ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await sync.requestCode(email);
              setDevCode(r.devCode ?? null);
              setStep("code");
              setCode("");
            });
          }}
        >
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            autoComplete="email"
            className={cn(field, "text-left")}
          />
          <button type="submit" className={primary} disabled={busy || !email.includes("@")}>
            <Mail className="h-4 w-4" />
            {busy ? "در حال فرستادن…" : "فرستادن کد ورود"}
          </button>
        </form>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => sync.verifyCode(email, code));
          }}
        >
          <p className="text-xs text-white/55">
            کد به <span dir="ltr">{email}</span> فرستاده شد. پوشهٔ اسپم را هم نگاه کن.
          </p>
          {devCode && <p className="text-xs text-white/40" data-dev-code={devCode}>کد آزمایشی سرور محلی: {devCode}</p>}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d۰-۹]/g, ""))}
            placeholder="------"
            className={cn(field, "text-center text-xl tracking-[0.5em]")}
            autoFocus
          />
          <button type="submit" className={primary} disabled={busy || code.length !== 6}>
            {busy ? "در حال بررسی…" : "ورود"}
          </button>
          <div className="flex justify-between px-1 text-xs">
            <button type="button" onClick={() => setStep("email")} className="text-white/50 hover:text-white">
              تغییر ایمیل
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => sync.requestCode(email).then(() => undefined))}
              className="text-white/50 hover:text-white"
            >
              فرستادن دوبارهٔ کد
            </button>
          </div>
        </form>
      )}
      {error && <p className="px-1 text-xs text-amber-200">{error}</p>}

      <button onClick={() => setShowServer((v) => !v)} className="flex items-center gap-1.5 px-1 text-[11px] text-white/35 hover:text-white/60">
        <Server className="h-3 w-3" />
        آدرس سرور
      </button>
      {showServer && (
        <div className="flex gap-2">
          <input dir="ltr" value={server} onChange={(e) => setServer(e.target.value)} className={cn(field, "py-2 text-left text-xs")} />
          <button onClick={() => sync.setServer(server)} className="shrink-0 rounded-full bg-white/[0.08] px-4 text-xs font-semibold">
            ذخیره
          </button>
        </div>
      )}
    </div>
  );
}

/** آدرس شخصی برای وصل کردن یادنگار به Claude (MCP) */
function ClaudeConnect({ server, token }: { server: string; token: string }) {
  const [active, setActive] = React.useState<boolean | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    connectStatus(server, token)
      .then((r) => setActive(r.active))
      .catch(() => setActive(null));
  }, [server, token]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(syncErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const r = await connectCreate(server, token);
      setUrl(r.url);
      setActive(true);
      setCopied(false);
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      inputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2.5 border-t border-white/[0.06] pt-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-white/70" />
        <p className="text-sm font-semibold">اتصال به Claude</p>
        {active && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-200">فعال</span>}
      </div>
      <p className="text-[11px] leading-5 text-white/45">
        با این آدرس، Claude می‌تواند کارهایت را ببیند و برایت برنامه بچیند. آدرس را در Claude، بخش تنظیمات ← Connectors ← افزودن connector دلخواه بگذار. این آدرس مثل رمز است؛ به کسی نده.
      </p>
      {url ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input ref={inputRef} readOnly dir="ltr" value={url} onFocus={(e) => e.target.select()} className={cn(field, "py-2 text-left text-[11px]")} />
            <button onClick={() => void copy()} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-bold text-black">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "کپی شد" : "کپی"}
            </button>
          </div>
          <p className="text-[11px] text-amber-200/80">این آدرس فقط همین یک بار نشان داده می‌شود. همین الان در Claude بگذارش.</p>
        </div>
      ) : (
        <button onClick={() => void create()} disabled={busy} className={primary}>
          <Sparkles className="h-4 w-4" />
          {busy ? "در حال ساختن…" : active ? "ساختن آدرس تازه (آدرس قبلی باطل می‌شود)" : "ساختن آدرس اتصال"}
        </button>
      )}
      {active && (
        <button
          onClick={() =>
            void run(async () => {
              await connectRevoke(server, token);
              setActive(false);
              setUrl(null);
            })
          }
          disabled={busy}
          className="px-1 text-[11px] text-white/40 hover:text-white/70"
        >
          قطع اتصال Claude
        </button>
      )}
      {error && <p className="px-1 text-xs text-amber-200">{error}</p>}
    </div>
  );
}
