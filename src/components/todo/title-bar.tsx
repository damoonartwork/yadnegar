import { Copy, Minus, Pin, Settings, Square, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { useUpdate } from "@/hooks/use-update";

/** نوار عنوان سفارشی به سبک ویندوز؛ دکمه‌ها مثل ویندوز فارسی سمت چپ هستند */
export function TitleBar({ onSettings }: { onSettings?: () => void }) {
  const api = window.yadnegar;
  const [pinned, setPinned] = React.useState(false);
  const [maximized, setMaximized] = React.useState(false);
  const { status } = useUpdate();
  const hasUpdate = status.state === "available" || status.state === "ready" || status.state === "downloading";

  React.useEffect(() => api?.onMaximizeChange?.(setMaximized), [api]);

  const btn = "grid h-9 w-11 place-items-center text-white/60 transition-colors hover:bg-white/10 hover:text-white";

  return (
    <div className="drag flex h-9 shrink-0 items-center justify-between pr-4">
      <div className="flex items-center gap-2 text-[13px] font-bold text-white/75">
        <img src="./logo.png" alt="" className="yg-logo h-5 w-5" draggable={false} />
        یادنگار
      </div>
      <div className="no-drag flex items-center">
        {hasUpdate && onSettings && (
          <button
            onClick={onSettings}
            className="ml-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-black shadow-[0_0_14px_rgba(255,255,255,0.35)] hover:bg-white/90"
          >
            {status.state === "ready" ? "به‌روزرسانی آماده نصب است" : "نسخهٔ جدید آمده"}
          </button>
        )}
        {onSettings && (
          <button title="تنظیمات" onClick={onSettings} className={btn}>
            <Settings className="h-4 w-4" />
          </button>
        )}
      {api && (
        <div className="flex items-center">
          <button
            title="همیشه رو"
            onClick={async () => setPinned(await api.togglePin())}
            className={cn(btn, pinned && "text-white")}
          >
            <Pin className="h-3.5 w-3.5" fill={pinned ? "currentColor" : "none"} />
          </button>
          <button title="کوچک کردن" onClick={() => api.minimize()} className={btn}>
            <Minus className="h-4 w-4" />
          </button>
          <button title={maximized ? "برگرداندن" : "بزرگ کردن"} onClick={() => api.toggleMaximize()} className={btn}>
            {maximized ? <Copy className="h-3.5 w-3.5 -scale-x-100" /> : <Square className="h-3.5 w-3.5" />}
          </button>
          <button title="بستن" onClick={() => api.close()} className={cn(btn, "hover:bg-[#c42b1c] hover:text-white")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
