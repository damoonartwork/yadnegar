import * as React from "react";
import { CalendarDays, Mic, Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiquidGlassButton } from "@/components/ui/liquid-glass-button";
import { PersianTimePicker } from "@/components/ui/persian-time-picker";

export interface AddTaskHandle {
  focus: () => void;
}

interface Props {
  /** روزی که کار به آن اضافه می‌شود (مثلاً «امروز» یا «۱۳ آبان») */
  dateLabel: string;
  /** موبایل: متن راهنمای کوتاه‌تر */
  touch?: boolean;
  onAdd: (v: { title: string; time?: string; important: boolean }) => void;
}

export const AddTask = React.forwardRef<AddTaskHandle, Props>(({ onAdd, dateLabel, touch }, ref) => {
  const [title, setTitle] = React.useState("");
  const [time, setTime] = React.useState<string | undefined>();
  const [important, setImportant] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onAdd({ title: t, time, important });
    setTitle("");
    setTime(undefined);
    setImportant(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 py-1.5 pr-5 pl-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),inset_0_-1px_1px_rgba(255,255,255,0.04)]">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={touch ? "کار تازه‌ای بنویس…" : "کار تازه‌ای بنویس و Enter بزن…"}
        enterKeyHint="done"
        className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-white/35"
      />
      <span className="hidden items-center gap-1 text-xs text-white/40 sm:flex">
        <CalendarDays className="h-3.5 w-3.5" />
        {dateLabel}
      </span>
      <LiquidGlassButton
        size="icon-sm"
        title="افزودن با صدا"
        onClick={() => window.dispatchEvent(new CustomEvent("yadnegar:voice"))}
      >
        <Mic className="h-4 w-4" />
      </LiquidGlassButton>
      <PersianTimePicker value={time} onChange={setTime} compact />
      <LiquidGlassButton
        size="icon-sm"
        title="مهم"
        active={important}
        onClick={() => setImportant((v) => !v)}
        className={cn(important && "text-amber-300 hover:text-amber-300")}
      >
        <Star className="h-4 w-4" fill={important ? "currentColor" : "none"} />
      </LiquidGlassButton>
      <LiquidGlassButton variant="solid" size="sm" onClick={submit} disabled={!title.trim()}>
        <Plus className="h-4 w-4" />
        افزودن
      </LiquidGlassButton>
    </div>
  );
});
AddTask.displayName = "AddTask";
