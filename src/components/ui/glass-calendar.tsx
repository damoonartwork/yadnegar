import * as React from "react";
import { Settings, Plus, Pen, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  isSameDay,
  isToday,
  getDaysInMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns-jalali";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { columnOf, dayKey, jDay, jYear, monthName, toFa, weekdayShort, WEEK_HEADER } from "@/lib/jalali";

// نسخهٔ فارسی/شمسی و راست‌به‌چپ از GlassCalendar
// - تقویم جلالی (date-fns-jalali)، اعداد فارسی، شروع هفته از شنبه
// - زبانه‌های هفتگی/ماهانه کار می‌کنند و روزهایی که کار دارند نقطه می‌گیرند
// - variant="bare" پس‌زمینهٔ خودش را ندارد تا داخل LiquidGlassCard قرار بگیرد

export interface DayMark {
  count: number;
  important: boolean;
}

interface Day {
  date: Date;
  isToday: boolean;
  isSelected: boolean;
}

type View = "weekly" | "monthly";

export interface GlassCalendarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  /** کلید: yyyy-MM-dd */
  marks?: Record<string, DayMark>;
  defaultView?: View;
  showFooter?: boolean;
  variant?: "glass" | "bare";
  /** ارتفاع کارت را پر کند و ردیف‌ها یکنواخت پخش شوند */
  fill?: boolean;
  /** نسخهٔ جمع‌وجور: بدون زبانه‌ها، خانه‌های کوچک‌تر */
  compact?: boolean;
  onSettingsClick?: () => void;
  onAddNote?: () => void;
  onNewEvent?: () => void;
  className?: string;
}

export const GlassCalendar = React.forwardRef<HTMLDivElement, GlassCalendarProps>(
  (
    {
      className,
      selectedDate: propSelectedDate,
      onDateSelect,
      marks = {},
      defaultView = "weekly",
      showFooter = true,
      variant = "glass",
      fill = false,
      compact = false,
      onSettingsClick,
      onAddNote,
      onNewEvent,
      ...props
    },
    ref
  ) => {
    const [view, setView] = React.useState<View>(defaultView);
    const [cursor, setCursor] = React.useState(propSelectedDate || new Date());
    const [selectedDate, setSelectedDate] = React.useState(propSelectedDate || new Date());

    React.useEffect(() => {
      if (propSelectedDate) {
        setSelectedDate(propSelectedDate);
        setCursor(propSelectedDate);
      }
    }, [propSelectedDate]);

    const toDay = React.useCallback(
      (date: Date): Day => ({ date, isToday: isToday(date), isSelected: isSameDay(date, selectedDate) }),
      [selectedDate]
    );

    const weekDays = React.useMemo(() => {
      const start = startOfWeek(cursor, { weekStartsOn: 6 });
      return Array.from({ length: 7 }, (_, i) => toDay(addDays(start, i)));
    }, [cursor, toDay]);

    const monthDays = React.useMemo(() => {
      const start = startOfMonth(cursor);
      const total = getDaysInMonth(cursor);
      return Array.from({ length: total }, (_, i) => toDay(addDays(start, i)));
    }, [cursor, toDay]);

    const leadingBlanks = columnOf(startOfMonth(cursor));

    const handleDateClick = (date: Date) => {
      setSelectedDate(date);
      onDateSelect?.(date);
    };

    const goPrev = () => setCursor((c) => (view === "weekly" ? subWeeks(c, 1) : subMonths(c, 1)));
    const goNext = () => setCursor((c) => (view === "weekly" ? addWeeks(c, 1) : addMonths(c, 1)));
    const goToday = () => {
      const now = new Date();
      setCursor(now);
      handleDateClick(now);
    };

    const titleKey = `${jYear(cursor)}-${monthName(cursor)}`;
    const showTodayChip = !isSameDay(selectedDate, new Date()) || !isSameDay(cursor, new Date());

    const renderDay = (day: Day) => {
      const mark = marks[dayKey(day.date)];
      return (
        <button
          key={dayKey(day.date)}
          onClick={() => handleDateClick(day.date)}
          className={cn(
            "relative flex items-center justify-center rounded-full text-[13px] font-semibold transition-all duration-200",
            compact ? "h-8 w-8" : "h-9 w-9",
            day.isSelected
              ? "bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.35)]"
              : "text-white/85 hover:bg-white/10",
            day.isToday && !day.isSelected && "ring-1 ring-white/45"
          )}
        >
          {toFa(jDay(day.date))}
          {mark && (
            <span
              className={cn(
                "absolute bottom-[3px] h-1 w-1 rounded-full",
                day.isSelected ? "bg-black/70" : mark.important ? "bg-amber-300" : "bg-white/70"
              )}
            />
          )}
        </button>
      );
    };

    return (
      <div
        ref={ref}
        dir="rtl"
        className={cn(
          "w-full text-white font-sans",
          fill && "flex h-full flex-col",
          variant === "glass" && "rounded-3xl p-5 shadow-2xl bg-white/[0.05] backdrop-blur-xl border border-white/10",
          className
        )}
        {...props}
      >
        {/* سربرگ: زبانه‌ها و تنظیمات */}
        <div className={cn("flex items-center justify-between", compact && "hidden")}>
          <div className="flex items-center gap-1 rounded-full bg-black/30 p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
            {(["weekly", "monthly"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-full px-4 py-1 text-xs transition-colors",
                  view === v ? "bg-white font-bold text-black shadow-md" : "font-semibold text-white/55 hover:text-white"
                )}
              >
                {v === "weekly" ? "هفتگی" : "ماهانه"}
              </button>
            ))}
          </div>
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              title="تنظیمات"
            >
              <Settings className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* نام ماه و جابه‌جایی */}
        <div className={cn("flex items-center justify-between", compact ? "mb-3" : "my-4")}>
          <div className="flex items-baseline gap-2">
            <motion.p
              key={titleKey}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn("glow-text font-extrabold tracking-tight", compact ? "text-2xl" : "text-3xl")}
            >
              {monthName(cursor)}
            </motion.p>
            <span className="text-sm font-medium text-white/40">{toFa(jYear(cursor))}</span>
          </div>
          <div className="flex items-center gap-1">
            {showTodayChip && (
              <button
                onClick={goToday}
                className="ml-1 rounded-full bg-white/[0.07] px-3 py-1 text-[11px] font-semibold text-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] transition-colors hover:bg-white/15"
              >
                امروز
              </button>
            )}
            {/* در راست‌به‌چپ، «قبلی» سمت راست است */}
            <button onClick={goPrev} className="rounded-full p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              <ChevronRight className="h-5 w-5" />
            </button>
            <button onClick={goNext} className="rounded-full p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* روزها */}
        <AnimatePresence mode="wait" initial={false}>
          {view === "weekly" ? (
            <motion.div
              key="weekly"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn("flex justify-between", fill && "flex-1 items-center")}
            >
              {weekDays.map((day) => (
                <div key={dayKey(day.date)} className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-white/40">{weekdayShort(day.date)}</span>
                  {renderDay(day)}
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="monthly"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(fill && "flex min-h-0 flex-1 flex-col")}
            >
              <div className="mb-1 grid grid-cols-7 justify-items-center">
                {WEEK_HEADER.map((w) => (
                  <span key={w} className="text-xs font-bold text-white/40">
                    {w}
                  </span>
                ))}
              </div>
              <div
                className={cn(
                  "grid grid-cols-7 justify-items-center gap-y-0.5",
                  fill && "min-h-0 flex-1 grid-rows-6 items-center"
                )}
              >
                {Array.from({ length: leadingBlanks }, (_, i) => (
                  <span key={`b${i}`} />
                ))}
                {monthDays.map((d) => renderDay(d))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showFooter && (
          <>
            <div className="mt-5 h-px bg-white/10" />
            <div className="mt-4 flex items-center justify-between gap-4">
              <button
                onClick={onAddNote}
                className="flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
              >
                <Pen className="h-4 w-4" />
                <span>یادداشت سریع…</span>
              </button>
              <button
                onClick={onNewEvent}
                className="flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-2 text-xs font-bold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] transition-colors hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
                <span>کار جدید</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }
);

GlassCalendar.displayName = "GlassCalendar";
